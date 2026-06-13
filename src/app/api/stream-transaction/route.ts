import { NextRequest } from "next/server";
import { subscribeToTransaction } from "@/lib/yellowstone/client";
import { getConnectionWithFallback } from "@/lib/solana/connection";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const signature = searchParams.get("signature");
  const isSimulated = searchParams.get("simulated") === "true";
  const simulationMode = searchParams.get("simulationMode") || undefined;

  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const responseStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      const sendEvent = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Stream might be closed
        }
      };

      let cleanup: (() => void) | null = null;
      let hasReceivedUpdate = false;
      let isClosed = false;

      const stopStream = () => {
        if (isClosed) return;
        isClosed = true;
        if (cleanup) {
          cleanup();
        }
        try {
          controller.close();
        } catch (e) {}
      };

      try {
        console.log(`[Stream API] Initiating SSE for signature: ${signature} (Simulated: ${isSimulated})`);
        
        if (isSimulated) {
          // Use simulated path from subscribeToTransaction
          const stream = subscribeToTransaction(signature, true, simulationMode);
          for await (const update of stream) {
            sendEvent(update);
            if (update.stage === "finalized" || update.stage === "failed") {
              break;
            }
          }
          stopStream();
          return;
        }

        // For real transactions, we will try the WebSocket stream, 
        // but fallback to polling after a 5 second timeout if no confirmation is received.
        let wsTimeout = setTimeout(async () => {
          if (!hasReceivedUpdate && !isClosed) {
            console.warn(`[Stream API] WebSocket connection took too long or failed. Falling back to polling.`);
            isClosed = true; // prevent further yield processing
            
            // Start polling fallback
            cleanup = await startPollingFallback(signature, sendEvent, stopStream);
          }
        }, 5000);

        try {
          const stream = subscribeToTransaction(signature, false);
          for await (const update of stream) {
            if (isClosed) break;

            if (update.stage === "confirmed" || update.stage === "finalized") {
              hasReceivedUpdate = true;
              clearTimeout(wsTimeout);
            }

            sendEvent(update);

            if (update.stage === "finalized" || update.stage === "failed") {
              clearTimeout(wsTimeout);
              stopStream();
              return;
            }
          }
        } catch (wsErr: any) {
          console.warn(`[Stream API] WS stream threw error: ${wsErr.message}. Initiating polling fallback.`);
          clearTimeout(wsTimeout);
          if (!isClosed) {
            isClosed = true;
            cleanup = await startPollingFallback(signature, sendEvent, stopStream);
          }
        }
      } catch (err: any) {
        console.error(`[Stream API] Root Error:`, err);
        sendEvent({
          stage: "failed",
          slot: 0,
          timestamp: Date.now(),
          error: err.message || "Unknown streaming error",
        });
        stopStream();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function startPollingFallback(
  signature: string,
  sendEvent: (data: any) => void,
  stopStream: () => void
) {
  const startTime = Date.now();
  console.log(`[Stream API Fallback] Polling signature: ${signature}`);

  // Send a processed indicator if not already received
  sendEvent({
    stage: "processed",
    slot: 0,
    timestamp: Date.now(),
    latency: Date.now() - startTime,
  });

  let lastStage: string = "processed";
  const maxTimeout = 45000; // 45 seconds max duration for safety
  const intervalTime = 2000;

  const interval = setInterval(async () => {
    if (Date.now() - startTime > maxTimeout) {
      console.warn(`[Stream API Fallback] Polling timed out for ${signature}`);
      sendEvent({
        stage: "failed",
        slot: 0,
        timestamp: Date.now(),
        error: "Confirmation timeout exceeded.",
      });
      clearInterval(interval);
      stopStream();
      return;
    }

    try {
      const connection = await getConnectionWithFallback();
      const status = await connection.getSignatureStatus(signature);

      if (status && status.value) {
        const value = status.value;
        const slot = status.context?.slot || 0;

        if (value.err) {
          sendEvent({
            stage: "failed",
            slot,
            timestamp: Date.now(),
            latency: Date.now() - startTime,
            error: JSON.stringify(value.err),
          });
          clearInterval(interval);
          stopStream();
          return;
        }

        const confirmationStatus = value.confirmationStatus;
        if (confirmationStatus === "confirmed" && lastStage !== "confirmed") {
          lastStage = "confirmed";
          sendEvent({
            stage: "confirmed",
            slot,
            timestamp: Date.now(),
            latency: Date.now() - startTime,
          });
        } else if (confirmationStatus === "finalized") {
          if (lastStage !== "confirmed" && lastStage !== "finalized") {
            sendEvent({
              stage: "confirmed",
              slot,
              timestamp: Date.now(),
              latency: Date.now() - startTime,
            });
          }
          sendEvent({
            stage: "finalized",
            slot,
            timestamp: Date.now(),
            latency: Date.now() - startTime,
          });
          clearInterval(interval);
          stopStream();
        }
      }
    } catch (e: any) {
      console.error(`[Stream API Fallback] Polling error:`, e.message);
    }
  }, intervalTime);

  return () => {
    clearInterval(interval);
  };
}
