const { Connection, PublicKey } = require('@solana/web3.js');
require('dotenv').config({ path: '.env.local' });

const ADDR = new PublicKey('6gZwFJk1xQKKAUQsSsj5xbMvPXAfJcSNNhek4rEuuDiA');

(async () => {
  console.log('--- SolInfra RPC ---');
  try {
    const conn1 = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
    const bal1 = await conn1.getBalance(ADDR);
    const slot1 = await conn1.getSlot();
    console.log('Balance:', bal1 / 1e9, 'SOL | Slot:', slot1);
    const ver1 = await conn1.getVersion();
    console.log('Cluster version/info:', JSON.stringify(ver1));
  } catch (e) { console.log('Error:', e.message); }

  console.log('--- Public Devnet RPC ---');
  try {
    const conn2 = new Connection('https://api.devnet.solana.com', 'confirmed');
    const bal2 = await conn2.getBalance(ADDR);
    const slot2 = await conn2.getSlot();
    console.log('Balance:', bal2 / 1e9, 'SOL | Slot:', slot2);
    const ver2 = await conn2.getVersion();
    console.log('Cluster version/info:', JSON.stringify(ver2));
  } catch (e) { console.log('Error:', e.message); }
})();
