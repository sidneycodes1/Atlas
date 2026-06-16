import { executeRecovery } from "@/lib/ai/executor";
import { getDynamicTip } from "../jito-tips";

export interface FailureContext {
  failureType: "expired_blockhash" | "low_tip" | "leader_miss" | "congestion";
  bundleId: string;
  originalTipLamports: number;
  blockhashAge: number; // slots since blockhash was fetched
  networkCongestion: "low" | "medium" | "high";
  previousAttempts: number;
  slotInfo: { currentSlot: number; leaderSlots: number[] };
}

export interface RecoveryAction {
  type: "refresh_blockhash" | "increase_tip" | "wait_leader" | "resubmit_optimized";
  newTipLamports?: number;
  delayMs?: number;
  newBlockhash?: boolean;
}

export interface RecoveryPlan {
  observation: string; // 1-2 sentences, human readable
  reasoning: string; // Why this failure happened
  decision: string; // What Atlas decided to do
  action: RecoveryAction;
  confidence: number; // 0-1
}

/**
 * Analyzes the transaction failure using the Gemini API.
 * Falls back to a high-fidelity rule-based engine if the API key is missing or calls fail.
 */
export async function analyzeFailure(context: FailureContext): Promise<RecoveryPlan> {
  console.log(`[AI Recovery Engine] Analyzing failure: ${context.failureType}`);

  const systemPrompt = `You are Atlas, an AI transaction recovery agent for Solana. 
Analyze failed transactions and return recovery plans as JSON only. 
No markdown, no explanation outside JSON.
The output format must be EXACTLY this JSON structure:
{
  "observation": "1-2 sentences, human readable",
  "reasoning": "Why this failure happened in detail",
  "decision": "What Atlas decided to do",
  "action": {
    "type": "refresh_blockhash" | "increase_tip" | "wait_leader" | "resubmit_optimized",
    "newTipLamports": number (optional),
    "delayMs": number (optional),
    "newBlockhash": boolean (optional)
  },
  "confidence": number (between 0 and 1)
}`;

  const userPrompt = `Here is the transaction failure context:
${JSON.stringify(context, null, 2)}

Provide the RecoveryPlan JSON response:`;

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (apiKey && !apiKey.includes("YOUR_GEMINI")) {
    try {
      console.log(`[AI Recovery Engine] Querying Gemini...`);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API responded with status ${response.status}`);
      }

      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const plan = JSON.parse(text.trim()) as RecoveryPlan;
        console.log(`[AI Recovery Engine] AI plan generated successfully:`, plan);
        return plan;
      }
    } catch (err) {
      console.error(`[AI Recovery Engine] Gemini request failed, falling back to rule-engine:`, err);
    }
  }

  // High-fidelity fallback rule-based plan generation
  console.log(`[AI Recovery Engine] Using rule-based fallback recovery planner.`);
  await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate thinking latency

  switch (context.failureType) {
    case "expired_blockhash":
      return {
        observation: "Transaction rejected because the blockhash is too old.",
        reasoning: `The transaction blockhash age is ${context.blockhashAge} slots, which exceeds the Solana 150 slot threshold (~60-90 seconds). This renders the transaction expired.`,
        decision: "Fetch a fresh blockhash from the RPC provider and resubmit the bundle.",
        action: {
          type: "refresh_blockhash",
          newBlockhash: true,
        },
        confidence: 0.98,
      };

    case "low_tip":
      const recommendedTip = await getDynamicTip('retry');
      return {
        observation: "Bundle was rejected due to insufficient Jito tip.",
        reasoning: `The tip of ${context.originalTipLamports} lamports is below the minimum tip threshold required by Jito validators to prioritize this bundle under current network loads.`,
        decision: `Increase Jito tip fee to ${recommendedTip} lamports to ensure validator inclusion.`,
        action: {
          type: "increase_tip",
          newTipLamports: recommendedTip,
        },
        confidence: 0.95,
      };

    case "leader_miss":
      return {
        observation: "Transaction missed the target leader schedule slot window.",
        reasoning: "The bundle was sent during a transition phase or to a leader that has gone offline, leading to silent drops.",
        decision: "Wait for the next scheduled Jito leader slot (estimated 400ms delay) then resubmit the bundle.",
        action: {
          type: "wait_leader",
          delayMs: 400,
        },
        confidence: 0.9,
      };

    case "congestion":
      const highTip = await getDynamicTip('retry');
      return {
        observation: "Solana is experiencing intensive write lock and network congestion.",
        reasoning: "The network state is currently high-congestion, leading to packet drops. Transactions must be optimized with updated blockhash and higher Jito tip for priority.",
        decision: `Apply optimized resubmission: update the blockhash and increase the Jito tip to ${highTip} lamports.`,
        action: {
          type: "resubmit_optimized",
          newTipLamports: highTip,
          newBlockhash: true,
        },
        confidence: 0.92,
      };
  }
}
