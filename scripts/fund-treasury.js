const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
require('dotenv').config({ path: '.env.local' });

(async () => {
  // Try SOLANA_RPC_URL first, fallback to public devnet if needed
  let rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  
  // If running with fallback flag or if the SolInfra RPC didn't work for airdrop
  if (process.argv.includes('--public-rpc')) {
    rpcUrl = 'https://api.devnet.solana.com';
  }
  
  console.log('Using RPC:', rpcUrl);
  const connection = new Connection(rpcUrl, 'confirmed');
  const secret = JSON.parse(process.env.JITO_AUTH_KEYPAIR);
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
  
  console.log('Requesting airdrop for:', keypair.publicKey.toBase58());
  
  try {
    const sig = await connection.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL);
    console.log('Airdrop signature:', sig);
    await connection.confirmTransaction(sig, 'confirmed');
    
    const balance = await connection.getBalance(keypair.publicKey);
    console.log('New balance:', balance / LAMPORTS_PER_SOL, 'SOL');
  } catch (e) {
    console.error('Airdrop failed:', e.message);
    console.log('If this RPC does not support airdrops, try: https://api.devnet.solana.com');
  }
})();
