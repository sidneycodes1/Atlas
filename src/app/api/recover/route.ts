import { NextRequest } from "next/server";
import { analyzeFailure, FailureContext } from "@/lib/ai/recovery-engine";
import { executeRecovery } from "@/lib/ai/executor";
import { Keypair } from "@solana/web3.js";
import bs58pkg from "bs58";
const bs58 = (bs58pkg as any).default || bs58pkg;

export const dynamic = "force-dynamic";

function getAuthorityKeypair(): Keypair {
  const secretKeyString = process.env.ATLAS_TREASURY_KEYPAIR;
  if (!secretKeyString) {
    return Keypair.generate();
  }
  try {
    const arr = JSON.parse(secretKeyString);
    return Keypair.fromSecretKey(new Uint8Array(arr));
  } catch (e) {
    try {
      return Keypair.fromSecretKey(bs58.decode(secretKeyString));
    } catch (err) {
      return Keypair.generate();
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { failureContext, originalParams } = body as {
      failureContext: FailureContext;
      originalParams: {
        toAddress: string;
        amountLamports: number;
        tipLamports: number;
        blockhash: string;
      };
    };

    if (!failureContext || !originalParams) {
      return new Response("Missing parameters", { status: 400 });
    }

    const responseStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendEvent = (phase: string, data: any) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ phase, data })}\n\n`)
          );
        };

        try {
          // Phase 1: Analyzing
          console.log("[Recover API] Phase: analyzing");
          sendEvent("analyzing", { message: "Atlas AI scanning transaction failure logs..." });
          await new Promise((resolve) => setTimeout(resolve, 1500));

          // Call AI to generate recovery plan
          const plan = await analyzeFailure(failureContext);

          // Phase 2: Planning
          console.log("[Recover API] Phase: planning");
          
          // Stream the plan text character-by-character to simulate typing/thinking
          const observation = plan.observation;
          const reasoning = plan.reasoning;
          const decision = plan.decision;
          
          sendEvent("planning", {
            plan: {
              observation: "",
              reasoning: "",
              decision: "",
              action: plan.action,
              confidence: plan.confidence,
            },
            message: "Diagnosing failure root causes..."
          });

          // Stream typewriter effect for UI
          let currentObs = "";
          for (let i = 0; i < observation.length; i += 3) {
            currentObs += observation.substring(i, i + 3);
            sendEvent("planning", {
              plan: {
                observation: currentObs,
                reasoning: "",
                decision: "",
                action: plan.action,
                confidence: plan.confidence,
              }
            });
            await new Promise((resolve) => setTimeout(resolve, 20));
          }

          let currentReason = "";
          for (let i = 0; i < reasoning.length; i += 5) {
            currentReason += reasoning.substring(i, i + 5);
            sendEvent("planning", {
              plan: {
                observation,
                reasoning: currentReason,
                decision: "",
                action: plan.action,
                confidence: plan.confidence,
              }
            });
            await new Promise((resolve) => setTimeout(resolve, 15));
          }

          let currentDecision = "";
          for (let i = 0; i < decision.length; i += 4) {
            currentDecision += decision.substring(i, i + 4);
            sendEvent("planning", {
              plan: {
                observation,
                reasoning,
                decision: currentDecision,
                action: plan.action,
                confidence: plan.confidence,
              }
            });
            await new Promise((resolve) => setTimeout(resolve, 15));
          }

          await new Promise((resolve) => setTimeout(resolve, 800));

          // Phase 3: Executing
          console.log("[Recover API] Phase: executing");
          sendEvent("executing", {
            action: plan.action,
            message: `Initiating self-healing action: ${plan.action.type.toUpperCase()}`
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Rebuild Keypair from authority or fallback
          const authorityKeypair = getAuthorityKeypair();

          // Prepare full bundle params for resubmission
          const bundleParams = {
            fromKeypair: authorityKeypair,
            toAddress: originalParams.toAddress,
            amountLamports: originalParams.amountLamports,
            tipLamports: plan.action.newTipLamports || originalParams.tipLamports,
            blockhash: originalParams.blockhash,
          };

          // Execute recovery plan
          const execResult = await executeRecovery(plan, bundleParams);

          // Phase 4: Complete
          console.log("[Recover API] Phase: complete");
          sendEvent("complete", {
            result: execResult,
            message: execResult.status === "accepted" 
              ? "Transaction successfully recovered and finalized!"
              : "Recovery attempt rejected: " + execResult.error
          });

        } catch (err: any) {
          console.error("[Recover API] Error during recovery stream:", err);
          sendEvent("failed", { error: err.message || "Autonomous recovery failed" });
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
  } catch (error: any) {
    console.error("[Recover API] Route error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
