import { NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { markUserAsFunded, hasUserBeenFunded } from '@/lib/user-funding';
import { getConnectionWithFallback } from '@/lib/solana/connection';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('[ONBOARD] Hit with address:', body.walletAddress);

    const { walletAddress, force } = body;
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    if (!force && hasUserBeenFunded(walletAddress)) {
      return NextResponse.json({ success: false, error: "Already funded. Use the AIRDROP button if balance is low." });
    }

    console.log('[Onboard API] Funding wallet:', walletAddress);

    // Connect to RPC
    const connection = await getConnectionWithFallback();

    // Parse treasury keypair from env
    let treasurySecret: number[];
    try {
      treasurySecret = JSON.parse(process.env.ATLAS_TREASURY_KEYPAIR || '[]');
    } catch {
      throw new Error('Invalid ATLAS_TREASURY_KEYPAIR format');
    }

    if (!treasurySecret || treasurySecret.length === 0) {
      throw new Error('ATLAS_TREASURY_KEYPAIR not found or invalid');
    }

    const treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(treasurySecret));
    console.log('[Onboard API] Treasury address:', treasuryKeypair.publicKey.toString());

    // Validate user wallet address
    let userPublicKey: PublicKey;
    try {
      userPublicKey = new PublicKey(walletAddress);
    } catch {
      throw new Error('Invalid user wallet address');
    }

    // Check treasury balance
    const { Connection: SolConnection } = await import('@solana/web3.js');
    const publicConn = new SolConnection('https://api.devnet.solana.com', 'confirmed');
    const treasuryBalance = await publicConn.getBalance(treasuryKeypair.publicKey);
    console.log('[Onboard] Treasury balance check:', treasuryBalance / 1e9, 'SOL');
    const fundsNeeded = 0.5 * LAMPORTS_PER_SOL + 5000; // 0.5 SOL + fee buffer
    
    if (treasuryBalance < fundsNeeded) {
      throw new Error(`Treasury insufficient. Balance: ${treasuryBalance / LAMPORTS_PER_SOL} SOL, needs: ${fundsNeeded / LAMPORTS_PER_SOL} SOL`);
    }

    // Create transfer transaction
    const instruction = SystemProgram.transfer({
      fromPubkey: treasuryKeypair.publicKey,
      toPubkey: userPublicKey,
      lamports: 0.5 * LAMPORTS_PER_SOL,
    });

    let recentBlockhash: { blockhash: string; lastValidBlockHeight: number };
    try {
      recentBlockhash = await connection.getLatestBlockhash();
    } catch (e) {
      console.log('[Onboard] Primary RPC failed for blockhash, using public fallback...');
      const { Connection: SolConn } = await import('@solana/web3.js');
      const fallback = new SolConn('https://api.devnet.solana.com', 'confirmed');
      recentBlockhash = await fallback.getLatestBlockhash();
    }
    const transaction = new Transaction({
      recentBlockhash: recentBlockhash.blockhash,
      feePayer: treasuryKeypair.publicKey,
    }).add(instruction);

    transaction.sign(treasuryKeypair);
    const txnBuffer = transaction.serialize();
    
    console.log('[ONBOARD] Sending 0.5 SOL to:', walletAddress);
    let signature: string;
    try {
      signature = await connection.sendRawTransaction(txnBuffer);
    } catch (e) {
      console.log('[Onboard] Primary RPC failed for sendRawTransaction, using public fallback...');
      const { Connection: SolConn } = await import('@solana/web3.js');
      const fallback = new SolConn('https://api.devnet.solana.com', 'confirmed');
      signature = await fallback.sendRawTransaction(txnBuffer);
    }
    
    console.log('[Onboard API] Transaction sent:', signature);

    // Wait for confirmation
    try {
      await connection.confirmTransaction(signature, 'confirmed');
    } catch (e) {
      const { Connection: SolConn } = await import('@solana/web3.js');
      const fallback = new SolConn('https://api.devnet.solana.com', 'confirmed');
      await fallback.confirmTransaction(signature, 'confirmed');
    }
    console.log('[Onboard API] Transaction confirmed:', signature);
    console.log('[ONBOARD] Transfer complete. Signature:', signature);

    // Mark user as funded
    markUserAsFunded(walletAddress);

    return NextResponse.json({
      success: true,
      signature,
      amount: 0.5,
      message: '✓ 0.5 Devnet SOL added to your wallet',
    }, { status: 200 });

  } catch (e: any) {
    console.error('[ONBOARD] Error:', e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
