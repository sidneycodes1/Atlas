const { Connection, Keypair, sendAndConfirmTransaction, Transaction } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount, createMint, mintTo } = require('@solana/spl-token');
require('dotenv').config({ path: '.env.local' });
const bs58 = require('bs58').default || require('bs58');

async function main() {
  const secretKeyString = process.env.JITO_AUTH_KEYPAIR;
  if (!secretKeyString) {
    console.error("Missing JITO_AUTH_KEYPAIR");
    return;
  }
  
  let authority;
  try {
    const arr = JSON.parse(secretKeyString);
    authority = Keypair.fromSecretKey(new Uint8Array(arr));
  } catch (e) {
    try {
      authority = Keypair.fromSecretKey(bs58.decode(secretKeyString));
    } catch (err) {
      console.error("Failed to parse JITO_AUTH_KEYPAIR");
      return;
    }
  }

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  console.log("Operator address:", authority.publicKey.toBase58());

  console.log("Creating new ATLAS-USD test mint...");
  const mint = await createMint(
    connection,
    authority,
    authority.publicKey,
    null,
    6 // 6 decimals like USDC
  );
  console.log("New Mint Address:", mint.toBase58());

  console.log("Getting/Creating ATA for operator...");
  const ata = await getAssociatedTokenAddress(mint, authority.publicKey);
  
  let ataExists = false;
  try {
    await getAccount(connection, ata);
    ataExists = true;
  } catch (e) {
    ataExists = false;
  }

  if (!ataExists) {
    console.log("ATA does not exist. Creating...");
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        authority.publicKey,
        ata,
        authority.publicKey,
        mint
      )
    );
    await sendAndConfirmTransaction(connection, tx, [authority]);
    console.log("ATA created at:", ata.toBase58());
  } else {
    console.log("ATA already exists at:", ata.toBase58());
  }

  console.log("Minting 10,000 ATLAS-USD to operator...");
  await mintTo(
    connection,
    authority,
    mint,
    ata,
    authority.publicKey,
    10000 * Math.pow(10, 6)
  );

  const accountInfo = await getAccount(connection, ata);
  console.log("Final ATA Balance:", Number(accountInfo.amount) / Math.pow(10, 6));
  
  console.log("\n=== SUCCESS ===");
  console.log("Please update your route.ts with this new mint address:");
  console.log(`tokenMint = "${mint.toBase58()}";`);
}

main().catch(console.error);
