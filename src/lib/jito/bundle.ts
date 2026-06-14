import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction, 
  createTransferInstruction,
  getAccount
} from "@solana/spl-token";
import { getConnectionWithFallback } from "../solana/connection";

export interface BundleParams {
  fromKeypair: Keypair;
  toAddress: string;
  amountLamports: number;
  tipLamports: number;
  blockhash: string;
  isSimulated?: boolean;
  simulationMode?: string;
  tokenMint?: string;
  tokenAmount?: number;
  tokenDecimals?: number;
}

// Devnet Jito Tip Accounts (Mocked or real mainnet values for structure)
export const JITO_TIP_ACCOUNTS = [
  "96gYZGLnJYVFihjzwyJYA3mqj1sNZgStJkhADHNfHybc",
  "HFqU5x63VT4CxQr6hbse5oeccn678nGv1d2D6VvADKep",
  "Cw8CFyM99Hi25DKCxUToPQg6gJCKpkwgS7987qy1pH95",
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
  const { fromKeypair, toAddress, amountLamports, tipLamports, blockhash, tokenMint, tokenAmount } = params;

  // 1. Create main transfer transaction
  const transferTx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: fromKeypair.publicKey,
  });

  if (params.tokenMint) {
    let mintPubkey: PublicKey;
    let toPubkey: PublicKey;
    try {
      mintPubkey = new PublicKey(tokenMint);
    } catch (e) {
      console.error('[BUNDLE] Failed to create PublicKey from:', JSON.stringify(tokenMint), 'variable: tokenMint');
      throw e;
    }
    try {
      toPubkey = new PublicKey(toAddress);
    } catch (e) {
      console.error('[BUNDLE] Failed to create PublicKey from:', JSON.stringify(toAddress), 'variable: toAddress');
      throw e;
    }
    
    // Derive ATAs
    const senderAta = await getAssociatedTokenAddress(mintPubkey, fromKeypair.publicKey);
    const recipientAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);
    
    const connection = await getConnectionWithFallback();
    
    // Check if recipient ATA exists
    let recipientAtaExists = false;
    try {
      await getAccount(connection, recipientAta);
      recipientAtaExists = true;
    } catch (e) {
      recipientAtaExists = false;
    }
    
    if (!recipientAtaExists) {
      transferTx.add(
        createAssociatedTokenAccountInstruction(
          fromKeypair.publicKey, // payer
          recipientAta, // ata
          toPubkey, // owner
          mintPubkey // mint
        )
      );
    }
    
    transferTx.add(
      createTransferInstruction(
        senderAta, // source
        recipientAta, // destination
        fromKeypair.publicKey, // owner
        tokenAmount // amount
      )
    );
  } else {
    let toPubkey: PublicKey;
    try {
      toPubkey = new PublicKey(toAddress);
    } catch (e) {
      console.error('[BUNDLE] Failed to create PublicKey from:', JSON.stringify(toAddress), 'variable: toAddress');
      throw e;
    }
    // Regular SOL transfer
    transferTx.add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPubkey,
        lamports: amountLamports,
      })
    );
  }
  
  transferTx.sign(fromKeypair);

  // 2. Create Jito tip transaction
  const tipAccount = getRandomTipAccount();
  let tipPubkey: PublicKey;
  try {
    tipPubkey = new PublicKey(tipAccount);
  } catch (e) {
    console.error('[BUNDLE] Failed to create PublicKey from:', JSON.stringify(tipAccount), 'variable: tipAccount');
    throw e;
  }
  const tipTx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: fromKeypair.publicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: tipPubkey,
      lamports: tipLamports,
    })
  );
  tipTx.sign(fromKeypair);

  return {
    transactions: [transferTx, tipTx],
    params,
  };
}
