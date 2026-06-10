import { NextRequest, NextResponse } from "next/server";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getConnection } from "@/lib/solana/connection";

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json();
    if (!walletAddress) {
      return NextResponse.json({ error: "Missing walletAddress" }, { status: 400 });
    }

    const connection = getConnection();
    const publicKey = new PublicKey(walletAddress);

    console.log(`[Airdrop] Requesting 1 SOL airdrop for ${walletAddress}...`);
    try {
      const signature = await connection.requestAirdrop(publicKey, 1 * LAMPORTS_PER_SOL);
      
      console.log(`[Airdrop] Airdrop signature: ${signature}. Confirming...`);
      
      // In devnet, requestAirdrop might require a few moments to sync
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction({
        signature,
        ...latestBlockhash,
      }, "confirmed");

      console.log(`[Airdrop] Successful airdrop for ${walletAddress}!`);
      return NextResponse.json({ success: true, amount: 1.0, signature });
    } catch (airdropError: any) {
      console.error(`[Airdrop] Failed to execute requestAirdrop:`, airdropError);
      return NextResponse.json({
        success: false,
        error: "Airdrop temporarily unavailable. Try again in 24h."
      });
    }
  } catch (error: any) {
    console.error(`[Airdrop] Request processing error:`, error);
    return NextResponse.json({ 
      success: false,
      error: "Airdrop temporarily unavailable. Try again in 24h."
    });
  }
}
