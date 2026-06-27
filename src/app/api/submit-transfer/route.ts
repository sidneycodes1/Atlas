import { NextRequest, NextResponse } from "next/server";
import { getConnection, getConnectionWithFallback } from "@/lib/solana/connection";
import { buildTransferBundle, BundleParams } from "@/lib/jito/bundle";
import { submitBundle } from "@/lib/jito/submit";
import { simulateFailure, FailureType } from "@/lib/jito/failure-sim";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import bs58pkg from "bs58";
const bs58 = (bs58pkg as any).default || bs58pkg;
import { getDynamicTip } from "@/lib/jito-tips";

async function getAuthorityBalance(authority: Keypair): Promise<number> {
  const publicConn = new Connection('https://api.devnet.solana.com', 'confirmed');
  const balance = await publicConn.getBalance(authority.publicKey);
  console.log(`[Submit] Authority balance check: ${balance / 1e9} SOL (${authority.publicKey.toBase58()})`);
  return balance;
}

function getAuthorityKeypair(): Keypair {
  const secretKeyString = process.env.ATLAS_TREASURY_KEYPAIR;
  if (!secretKeyString) {
    return Keypair.generate();
  }
  try {
    const arr = JSON.parse(secretKeyString);
    return Keypair.fromSecretKey(new Uint8Array(arr));
  } catch (e) {
    try {
      return Keypair.fromSecretKey(bs58.decode(secretKeyString));
    } catch (err) {
      return Keypair.generate();
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { toAddress, amountSol, atlasEnabled, failureMode, asset, tokenMint, tokenAmount } = body as any;

    const cleanToAddress = (toAddress || "").trim();

    console.log('[SUBMIT] Full body:', JSON.stringify(body));
    console.log('[SUBMIT] asset:', asset, '| tokenMint:', tokenMint, '| tokenAmount:', tokenAmount);
    console.log('[SUBMIT] Received toAddress:', JSON.stringify(cleanToAddress));
    console.log('[SUBMIT] toAddress length:', cleanToAddress?.length);

    if (!cleanToAddress || !amountSol) {
      return NextResponse.json({ error: "Missing recipient address or amount" }, { status: 400 });
    }

    try {
      new PublicKey(cleanToAddress);
    } catch (e: any) {
      return NextResponse.json({ 
        error: `Invalid recipient address: "${cleanToAddress}". Must be a valid base58 Solana address.` 
      }, { status: 400 });
    }

    console.log('[RPC] Requesting connection with fallback...');
    const connection = await getConnectionWithFallback();
    const authority = getAuthorityKeypair();
    const solBalance = await getAuthorityBalance(authority);

    const tipLamports = await getDynamicTip('normal');
    let amountLamports = 0;
    let finalTokenMint: string | undefined = tokenMint;
    let finalTokenAmount: number | undefined = tokenAmount;
    let tokenDecimals: number | undefined;

    if (asset === "USDC") {
      finalTokenMint = "DDSuJfCdWfDtTC4bf1B1kkZqQ1rmrFq5ZpbhwqjzmUZY";
      tokenDecimals = 6;
      finalTokenAmount = amountSol * Math.pow(10, tokenDecimals);
      
      try {
        const senderAta = await getAssociatedTokenAddress(new PublicKey(finalTokenMint), authority.publicKey);
        const publicConnection = new Connection("https://api.devnet.solana.com", "confirmed");
        const senderAccount = await getAccount(publicConnection, senderAta);
        const usdcBalance = Number(senderAccount.amount);
        const tokenAmountUnits = Math.floor(parseFloat(amountSol) * 1_000_000);
        if (usdcBalance < tokenAmountUnits) {
          return NextResponse.json({
            error: `Insufficient authority ATLAS-USD balance. Authority Address: ${authority.publicKey.toBase58()}. Balance: ${(usdcBalance / Math.pow(10, tokenDecimals)).toFixed(4)} ATLAS-USD. Required: ${amountSol} ATLAS-USD.`
          }, { status: 400 });
        }
      } catch (e: any) {
        return NextResponse.json({
          error: `Failed to fetch ATLAS-USD balance for authority. Does it have an ATA? ${e.message}`
        }, { status: 400 });
      }

      if (solBalance < tipLamports) {
        return NextResponse.json({
          error: `Insufficient SOL balance for tip. Required: ${tipLamports / LAMPORTS_PER_SOL} SOL.`
        }, { status: 400 });
      }
    } else {
      amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
      if (solBalance < amountLamports + tipLamports) {
        return NextResponse.json({
          error: `Insufficient authority balance on Devnet. Authority Address: ${authority.publicKey.toBase58()}. Balance: ${(solBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL. Required: ${(amountSol + tipLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL.`
        }, { status: 400 });
      }
    }

    let latestBlockhash: { blockhash: string; lastValidBlockHeight: number };
    try {
      latestBlockhash = await connection.getLatestBlockhash("confirmed");
    } catch (e) {
      console.log('[Submit] Primary RPC failed for blockhash, using public fallback...');
      const publicConn = new Connection('https://api.devnet.solana.com', 'confirmed');
      latestBlockhash = await publicConn.getLatestBlockhash("confirmed");
    }

    let params: BundleParams = {
      fromKeypair: authority,
      toAddress: cleanToAddress,
      amountLamports,
      tipLamports,
      blockhash: latestBlockhash.blockhash,
      isSimulated: false,
      tokenMint: finalTokenMint,
      tokenAmount: finalTokenAmount,
      tokenDecimals,
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
        toAddress: cleanToAddress,
        amountLamports,
        tipLamports: params.tipLamports,
        blockhash: latestBlockhash.blockhash,
        asset,
        tokenMint: finalTokenMint,
        tokenAmount: finalTokenAmount
      },
    });
  } catch (err: any) {
    console.error("[Submit Transfer API] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to submit transfer" }, { status: 500 });
  }
}
