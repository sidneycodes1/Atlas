import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

export interface BundleParams {
  fromKeypair: Keypair;
  toAddress: string;
  amountLamports: number;
  tipLamports: number;
  blockhash: string;
  isSimulated?: boolean;
  simulationMode?: string;
}

// Devnet Jito Tip Accounts (Mocked or real mainnet values for structure)
export const JITO_TIP_ACCOUNTS = [
  "96gYZGLnJYVFihjzwyJYA3mqj1sNZgStJkhADHNfHybc",
  "HFqU5x63VT4CxQr6hbse50eccn678nGv1d2D6VvADKep",
  "Cw8CFyM99Hi25DKCxUT0PQg6gJCKpkwgS7987qy1pH95",
  "ADa52h1Z412gJ6u41JbgMJxS2ztbNEw1s2iJNDrswC1y",
  "ADu35183vh9zoDT52euJLY56XcjNsKLXgbfXcPMgEs13",
  "Df1yQr17wHm91pk1GgDGr6b4Z4m73x8f1t1n75vHnB3t",
];

export function getRandomTipAccount(): string {
  const randomIndex = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
  return JITO_TIP_ACCOUNTS[randomIndex];
}

/**
 * Builds a transfer bundle consisting of:
 * 1. The main SOL transfer transaction.
 * 2. A Jito tip transaction to a random Jito tip account.
 */
export async function buildTransferBundle(params: BundleParams): Promise<{
  transactions: Transaction[];
  params: BundleParams;
}> {
  const { fromKeypair, toAddress, amountLamports, tipLamports, blockhash } = params;

  // 1. Create main transfer transaction
  const transferTx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: fromKeypair.publicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: new PublicKey(toAddress),
      lamports: amountLamports,
    })
  );
  transferTx.sign(fromKeypair);

  // 2. Create Jito tip transaction
  const tipAccount = getRandomTipAccount();
  const tipTx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: fromKeypair.publicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: new PublicKey(tipAccount),
      lamports: tipLamports,
    })
  );
  tipTx.sign(fromKeypair);

  return {
    transactions: [transferTx, tipTx],
    params,
  };
}
