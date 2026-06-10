import { BundleParams } from "./bundle";

export type FailureType = "low_tip" | "expired_blockhash" | "leader_miss" | "congestion";

/**
 * Modifies BundleParams to simulate specific transaction failure conditions.
 */
export function simulateFailure(
  params: BundleParams,
  type: FailureType
): BundleParams {
  console.log(`[Failure Sim] Applying failure modifier for: ${type}`);

  switch (type) {
    case "low_tip":
      // Set tip to extremely low value (below Jito's minimum tip)
      return {
        ...params,
        tipLamports: 100, // standard Jito minimum is usually ~1000+ lamports
        isSimulated: true,
        simulationMode: "low_tip",
      };

    case "expired_blockhash":
      // Set blockhash to an expired or old value (simulated via age)
      return {
        ...params,
        isSimulated: true,
        simulationMode: "expired_blockhash",
      };

    case "leader_miss":
      // Simulates sending the transaction out-of-sync with the leader schedule
      return {
        ...params,
        isSimulated: true,
        simulationMode: "leader_miss",
      };

    case "congestion":
      // Simulates intensive network packet drops or multiple identical bundle spam
      return {
        ...params,
        isSimulated: true,
        simulationMode: "congestion",
      };

    default:
      return params;
  }
}
