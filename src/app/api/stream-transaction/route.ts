import { NextRequest } from "next/server";
import { subscribeToTransaction } from "@/lib/yellowstone/client";

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
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        console.log(`[Stream API] Initiating SSE for signature: ${signature}`);
        const stream = subscribeToTransaction(signature, isSimulated, simulationMode);
        
        for await (const update of stream) {
          sendEvent(update);
          if (update.stage === "finalized" || update.stage === "failed") {
            break;
          }
        }
      } catch (err: any) {
        console.error(`[Stream API] Error:`, err);
        sendEvent({
          stage: "failed",
          slot: 0,
          timestamp: Date.now(),
          error: err.message || "Unknown streaming error",
        });
      } finally {
        controller.close();
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
