import { getConnection } from "../solana/connection";
import { buildTransferBundle, BundleParams } from "../jito/bundle";
import { submitBundle, BundleResult } from "../jito/submit";
import { RecoveryPlan } from "./recovery-engine";

export interface ExecutionResult {
  signature: string;
  bundleId: string;
  status: "accepted" | "rejected";
  error?: string;
  newTipLamports?: number;
  delayMs?: number;
  newBlockhash?: boolean;
}

/**
 * Executes the recovery plan by modifying original bundle parameters and resubmitting.
 */
export async function executeRecovery(
  plan: RecoveryPlan,
  originalParams: BundleParams
): Promise<ExecutionResult> {
  console.log(`[Executor] Starting execution for recovery action: ${plan.action.type}`);
  const connection = getConnection();

  // Clone parameters to avoid mutating the original
  const recoveryParams: BundleParams = { ...originalParams };
  
  // Clean simulator modes for the recovery resubmission so it succeeds!
  recoveryParams.isSimulated = false;
  recoveryParams.simulationMode = undefined;

  let delayMs = 0;
  let newBlockhash = false;
  let newTipLamports = originalParams.tipLamports;

  switch (plan.action.type) {
    case "refresh_blockhash":
      console.log(`[Executor] Refreshing blockhash...`);
      const blockhashObj = await connection.getLatestBlockhash("confirmed");
      recoveryParams.blockhash = blockhashObj.blockhash;
      newBlockhash = true;
      break;

    case "increase_tip":
      newTipLamports = plan.action.newTipLamports || originalParams.tipLamports * 3;
      console.log(`[Executor] Increasing Jito tip to: ${newTipLamports} lamports`);
      recoveryParams.tipLamports = newTipLamports;
      break;

    case "wait_leader":
      delayMs = plan.action.delayMs || 400;
      console.log(`[Executor] Waiting for next leader slot: ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      break;

    case "resubmit_optimized":
      console.log(`[Executor] Resubmitting optimized bundle (New blockhash + Increased tip)...`);
      const freshBlockhash = await connection.getLatestBlockhash("confirmed");
      recoveryParams.blockhash = freshBlockhash.blockhash;
      newBlockhash = true;
      newTipLamports = plan.action.newTipLamports || originalParams.tipLamports * 5;
      recoveryParams.tipLamports = newTipLamports;
      break;
  }

  // Re-build and re-submit the bundle
  try {
    const bundle = await buildTransferBundle(recoveryParams);
    const result: BundleResult = await submitBundle(bundle);

    return {
      signature: result.signature,
      bundleId: result.bundleId,
      status: result.status,
      error: result.reason,
      newTipLamports: newTipLamports !== originalParams.tipLamports ? newTipLamports : undefined,
      delayMs: delayMs > 0 ? delayMs : undefined,
      newBlockhash,
    };
  } catch (err: any) {
    console.error(`[Executor] Recovery execution failed:`, err);
    return {
      signature: "",
      bundleId: "",
      status: "rejected",
      error: err.message || "Failed to rebuild or resubmit bundle",
    };
  }
}
