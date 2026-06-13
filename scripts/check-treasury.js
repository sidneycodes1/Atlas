const { Keypair, Connection } = require('@solana/web3.js');
require('dotenv').config({ path: '.env.local' });

async function getConnectionWithFallback() {
  // Always use public devnet
  return new Connection('https://api.devnet.solana.com', 'confirmed');
}

const keysToCheck = ['TREASURY_PRIVATE_KEY', 'ATLAS_TREASURY_KEYPAIR', 'JITO_AUTH_KEYPAIR'];

(async () => {
  const connection = await getConnectionWithFallback();

  for (const keyName of keysToCheck) {
    const secretStr = process.env[keyName];
    if (!secretStr) {
      console.log(`\n--- ${keyName} ---`);
      console.log('Not found in .env.local');
      continue;
    }
    try {
      const secret = JSON.parse(secretStr);
      const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
      const balance = await connection.getBalance(keypair.publicKey);
      const derivedAddress = keypair.publicKey.toBase58();
      
      console.log(`\n--- ${keyName} ---`);
      console.log('Derived address:', derivedAddress);
      
      // Print address character by character to confirm visually
      console.log('Derived address chars:', derivedAddress.split('').join(' '));
      
      console.log('Balance:', balance / 1e9, 'SOL');
    } catch (e) {
      console.log(`\n--- ${keyName} ---`);
      console.log('Error parsing:', e.message);
    }
  }
  
  const targetAddress = '6gZwFJk1xQKKAUQsSsj5xbMvPXAfJcSNNhek4rEuuDiA';
  console.log('\n--- TARGET ADDRESS CHECK ---');
  console.log('Target address: ', targetAddress);
  console.log('Target address chars:', targetAddress.split('').join(' '));
})();
