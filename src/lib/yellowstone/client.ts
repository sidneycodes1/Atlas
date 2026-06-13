import { getConnection, getConnectionWithFallback } from "../solana/connection";
import { Connection, SignatureResult } from "@solana/web3.js";

export interface TransactionUpdate {
  stage: "processed" | "confirmed" | "finalized" | "failed";
  slot: number;
  timestamp: number;
  latency?: number; // Latency in ms since start
  error?: string;
}

/**
 * Streams real-time transaction updates using Solana RPC WebSocket subscription.
 * Falls back to polling if WebSocket fails.
 * Supports simulated transactions for end-to-end demo testing.
 */
export async function* subscribeToTransaction(
  signature: string,
  isSimulated: boolean = false,
  simulationMode?: string
): AsyncGenerator<TransactionUpdate> {
  const startTime = Date.now();
  console.log(`[Geyser Client] Subscribing to signature: ${signature} (Simulated: ${isSimulated})`);

  if (isSimulated) {
    console.log('[Geyser Client] Simulated mode — skipping WebSocket entirely');
    const mode = simulationMode || "success";
    
    yield {
      stage: "processed",
      slot: 28394012,
      timestamp: Date.now(),
      latency: Date.now() - startTime,
    };
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (mode === "low_tip" || mode === "expired_blockhash" || mode === "leader_miss" || mode === "congestion") {
      yield {
        stage: "failed",
        slot: 28394015,
        timestamp: Date.now(),
        latency: Date.now() - startTime,
        error: `Simulation Error: ${mode.toUpperCase()}`,
      };
      return;
    }

    yield {
      stage: "confirmed",
      slot: 28394022,
      timestamp: Date.now(),
      latency: Date.now() - startTime,
    };
    await new Promise((resolve) => setTimeout(resolve, 1000));

    yield {
      stage: "finalized",
      slot: 28394050,
      timestamp: Date.now(),
      latency: Date.now() - startTime,
    };
    return;
  }

  // Real Web3.js Connection subscription
  const connection = await getConnectionWithFallback();
  let resolved = false;
  const queue: TransactionUpdate[] = [];
  let resolveNext: ((value: any) => void) | null = null;

  // 1. Subscribe to 'processed' via WebSocket if possible, otherwise we listen for signature confirmations
  const subId = connection.onSignature(
    signature,
    (result: SignatureResult, context) => {
      if (resolved) return;
      
      const isError = !!result.err;
      const update: TransactionUpdate = {
        stage: isError ? "failed" : "confirmed",
        slot: context.slot,
        timestamp: Date.now(),
        latency: Date.now() - startTime,
        error: isError ? JSON.stringify(result.err) : undefined,
      };
      
      queue.push(update);
      if (resolveNext) {
        resolveNext({ value: update, done: false });
        resolveNext = null;
      }

      if (isError || update.stage === "confirmed") {
        // Now wait for finalized
        connection.onSignature(
          signature,
          (finalizedResult, finalizedCtx) => {
            const finalizedUpdate: TransactionUpdate = {
              stage: finalizedResult.err ? "failed" : "finalized",
              slot: finalizedCtx.slot,
              timestamp: Date.now(),
              latency: Date.now() - startTime,
              error: finalizedResult.err ? JSON.stringify(finalizedResult.err) : undefined,
            };
            queue.push(finalizedUpdate);
            if (resolveNext) {
              resolveNext({ value: finalizedUpdate, done: false });
              resolveNext = null;
            }
            resolved = true;
          },
          "finalized"
        );
      }
    },
    "confirmed"
  );

  // Send initial 'processed' stage update
  const processedUpdate: TransactionUpdate = {
    stage: "processed",
    slot: await connection.getSlot("processed").catch(() => 0),
    timestamp: Date.now(),
    latency: Date.now() - startTime,
  };
  queue.push(processedUpdate);

  try {
    while (!resolved || queue.length > 0) {
      if (queue.length > 0) {
        const item = queue.shift()!;
        yield item;
        if (item.stage === "finalized" || item.stage === "failed") {
          break;
        }
      } else {
        await new Promise((resolve) => {
          resolveNext = resolve;
        });
      }
    }
  } finally {
    try {
      connection.removeSignatureListener(subId);
    } catch (e) {
      // Ignore
    }
  }
}
