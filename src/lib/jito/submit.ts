import { getConnection } from "../solana/connection";
import { Transaction } from "@solana/web3.js";
import { BundleParams } from "./bundle";

export interface BundleResult {
  bundleId: string;
  signature: string;
  status: "accepted" | "rejected";
  reason?: string;
}

/**
 * Submits the bundle to Solana Devnet or simulates Jito submission if requested.
 * On Devnet, Jito is simulated by submitting the main transfer transaction
 * directly to the Solana cluster via sendRawTransaction.
 */
export async function submitBundle(
  bundle: {
    transactions: Transaction[];
    params: BundleParams;
  }
): Promise<BundleResult> {
  const { transactions, params } = bundle;
  const connection = getConnection();

  const mainTx = transactions[0];
  const signature = mainTx.signatures[0]
    ? require("bs58").encode(mainTx.signatures[0].signature)
    : "simulated_sig_" + Math.random().toString(36).substring(2, 15);

  const bundleId = "jito_bundle_" + Math.random().toString(36).substring(2, 15);

  console.log(`[Jito Submit] Submitting bundle ${bundleId} (Signature: ${signature})...`);

  // Handle failure simulation modes
  if (params.isSimulated && params.simulationMode) {
    const mode = params.simulationMode;
    console.log(`[Jito Submit] Failure simulation active: ${mode}`);

    if (mode === "low_tip") {
      return {
        bundleId,
        signature,
        status: "rejected",
        reason: "Tip too low: Jito block engine requires minimum tip of 1000 lamports.",
      };
    }
    if (mode === "expired_blockhash") {
      return {
        bundleId,
        signature,
        status: "rejected",
        reason: "Blockhash expired: Transaction blockhash age exceeds 150 slots.",
      };
    }
    if (mode === "leader_miss") {
      return {
        bundleId,
        signature,
        status: "rejected",
        reason: "Leader schedule miss: Submitted transaction outside target leader slot window.",
      };
    }
    if (mode === "congestion") {
      return {
        bundleId,
        signature,
        status: "rejected",
        reason: "Network congestion: Bundle failed to be included due to intensive packet drops.",
      };
    }
  }

  // Real submission fallback for Devnet transfers
  try {
    const rawTx = mainTx.serialize();
    
    // Implement retry with exponential backoff (max 3 retries, 500ms base)
    let attempts = 0;
    const maxRetries = 3;
    let baseDelay = 500;
    let txSig = "";

    while (attempts < maxRetries) {
      try {
        console.log(`[Jito Submit] Attempting transfer submission (Attempt ${attempts + 1})...`);
        txSig = await connection.sendRawTransaction(rawTx, {
          skipPreflight: true,
          preflightCommitment: "confirmed",
        });
        break;
      } catch (err: any) {
        attempts++;
        if (attempts >= maxRetries) throw err;
        const delay = baseDelay * Math.pow(2, attempts);
        console.warn(`[Jito Submit] Submission failed, retrying in ${delay}ms:`, err.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.log(`[Jito Submit] Bundle main transaction successfully sent: ${txSig}`);
    return {
      bundleId,
      signature: txSig,
      status: "accepted",
    };
  } catch (err: any) {
    console.error(`[Jito Submit] Submission failed:`, err);
    return {
      bundleId,
      signature,
      status: "rejected",
      reason: err.message || "Solana transaction submission failed",
    };
  }
}
