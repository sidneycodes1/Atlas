import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/solana/connection";
import { buildTransferBundle, BundleParams } from "@/lib/jito/bundle";
import { submitBundle } from "@/lib/jito/submit";
import { simulateFailure, FailureType } from "@/lib/jito/failure-sim";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

function getAuthorityKeypair(): Keypair {
  const secretKeyString = process.env.JITO_AUTH_KEYPAIR;
  if (!secretKeyString) {
    return Keypair.generate();
  }
  try {
    const arr = JSON.parse(secretKeyString);
    return Keypair.fromSecretKey(new Uint8Array(arr));
  } catch (e) {
    try {
      const bs58 = require("bs58");
      return Keypair.fromSecretKey(bs58.decode(secretKeyString));
    } catch (err) {
      return Keypair.generate();
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { toAddress, amountSol, atlasEnabled, failureMode } = body as {
      toAddress: string;
      amountSol: number;
      atlasEnabled: boolean;
      failureMode?: FailureType;
    };

    if (!toAddress || !amountSol) {
      return NextResponse.json({ error: "Missing recipient address or amount" }, { status: 400 });
    }

    const connection = getConnection();
    const authority = getAuthorityKeypair();
    const balance = await connection.getBalance(authority.publicKey);

    const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
    const tipLamports = 5000; // default standard Jito tip

    if (balance < amountLamports + tipLamports) {
      return NextResponse.json({
        error: `Insufficient authority balance on Devnet. Authority Address: ${authority.publicKey.toBase58()}. Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL. Required: ${(amountSol + tipLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL.`
      }, { status: 400 });
    }

    const latestBlockhash = await connection.getLatestBlockhash("confirmed");

    let params: BundleParams = {
      fromKeypair: authority,
      toAddress,
      amountLamports,
      tipLamports,
      blockhash: latestBlockhash.blockhash,
      isSimulated: false,
    };

    // Apply failure simulation if specified
    if (failureMode) {
      params = simulateFailure(params, failureMode);
    }

    // Build the bundle
    const bundle = await buildTransferBundle(params);

    // Submit the bundle
    const result = await submitBundle(bundle);

    return NextResponse.json({
      success: result.status === "accepted",
      bundleId: result.bundleId,
      signature: result.signature,
      status: result.status,
      reason: result.reason,
      submittedAt: Date.now(),
      originalParams: {
        toAddress,
        amountLamports,
        tipLamports,
        blockhash: latestBlockhash.blockhash,
      },
    });
  } catch (err: any) {
    console.error("[Submit Transfer API] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to submit transfer" }, { status: 500 });
  }
}
