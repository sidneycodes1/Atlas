import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { markUserAsFunded } from '@/lib/user-funding';

export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json();
    
    if (!walletAddress) {
      return Response.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    console.log('[Onboard API] Funding wallet:', walletAddress);

    // Connect to RPC
    const connection = new Connection(
      process.env.SOLINFRA_RPC_URL || 'https://fra.rpc.solinfra.dev/sol?api_key=' + process.env.YELLOWSTONE_GRPC_TOKEN,
      'confirmed'
    );

    // Parse treasury keypair from env
    let treasurySecret: number[];
    try {
      treasurySecret = JSON.parse(process.env.ATLAS_TREASURY_KEYPAIR || '[]');
    } catch {
      throw new Error('Invalid ATLAS_TREASURY_KEYPAIR format');
    }

    if (!treasurySecret || treasurySecret.length !== 64) {
      throw new Error('Treasury keypair must be 64 bytes');
    }

    const treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(treasurySecret));
    console.log('[Onboard API] Treasury address:', treasuryKeypair.publicKey.toString());

    // Validate user wallet address
    let userPublicKey: PublicKey;
    try {
      userPublicKey = new PublicKey(walletAddress);
    } catch {
      throw new Error('Invalid user wallet address');
    }

    // Check treasury balance
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
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

    const recentBlockhash = await connection.getLatestBlockhash();
    const transaction = new Transaction({
      recentBlockhash: recentBlockhash.blockhash,
      feePayer: treasuryKeypair.publicKey,
    }).add(instruction);

    transaction.sign(treasuryKeypair);
    const txnBuffer = transaction.serialize();
    const signature = await connection.sendRawTransaction(txnBuffer);
    
    console.log('[Onboard API] Transaction sent:', signature);

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('[Onboard API] Transaction confirmed:', signature);

    // Mark user as funded
    markUserAsFunded(walletAddress);

    return Response.json({
      success: true,
      signature,
      amount: 0.5,
      message: '✓ 0.5 Devnet SOL added to your wallet',
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Onboard API] Error:', error.message);
    return Response.json({
      success: false,
      error: error.message || 'Failed to fund wallet',
    }, { status: 500 });
  }
}
