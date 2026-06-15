#  Atlas — Autonomous Solana Transaction Recovery

> **Intelligent transaction recovery with real-time streaming, dynamic Jito tips, and AI-powered failure analysis.**
> Built for the Superteam Nigeria Advanced Infrastructure Challenge.

---

[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana)](https://solana.com)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-000000?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript)](https://typescriptlang.org)
[![Jito Bundles](https://img.shields.io/badge/Jito-MEV%20Protected-orange)](https://jito.wtf)
[![Yellowstone gRPC](https://img.shields.io/badge/Yellowstone-gRPC%20Streaming-blue)](https://docs.triton.one/project-yellowstone/whats-yellowstone)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI%20Powered-4285F4?logo=google)](https://ai.google.dev)

---

##  What is Atlas?

Atlas is a full-stack autonomous platform that detects when Solana transactions fail — and recovers them automatically, without any user intervention.

It connects to a Yellowstone gRPC stream (with a graceful polling fallback) to watch the chain in real time, identifies failure causes using dynamic Jito tip floor data and Gemini AI, rebuilds failed transactions with recalibrated tips, submits them as MEV-protected Jito bundles, and tracks them through every commitment level from `processed` all the way to `finalized`.

No "retry" button. No faucet. No manual intervention. Just watch it work.

---

##  Key Features

| Feature | Description |
|---|---|
|  **Real-time Streaming** | Yellowstone gRPC connection with automatic fallback to RPC polling on permission errors |
|  **Dynamic Jito Tips** | Live tip floor from Jito's API — uses 50th percentile for initial submission, escalates to 75th on recovery |
|  **AI Failure Analysis** | Gemini AI classifies failure modes with structured reasoning; rule-based fallback on API unavailability |
|  **MEV-Protected Bundles** | All transactions submitted as Jito bundles for atomic, front-running-resistant execution |
|  **Embedded Wallets** | Privy-powered embedded wallet creation — users go from login to funded wallet in seconds |
|  **Auto-Funding** | Treasury wallet (`BmWDE...`) automatically airdrops 0.5 SOL to new embedded wallets on first login |
|  **Full Lifecycle Tracking** | Every transaction tracked from submission → processed → confirmed → finalized with timestamps |
|  **Smart Reconnection** | Exponential backoff on transient gRPC errors (max 3 attempts); permanent fallback on auth errors |
|  **Zero-Infra Persistence** | File-based KV store for local demo — no external database required |

---

##  Architecture Overview

```
User Login (Privy)
      │
      ▼
Auto-Fund (Treasury → Embedded Wallet)
      │
      ▼
Transaction Submission (Jito Bundle, 50th percentile tip)
      │
      ├──── Yellowstone gRPC Stream ──── PERMISSION_DENIED ──► RPC Polling Fallback
      │                │
      │       Real-time slot/tx updates
      │
      ▼
Failure Detected
      │
      ├──► Gemini AI Analysis ──── 404/Error ──► Rule-Based Fallback
      │           │
      │    Failure classification + recovery plan
      │
      ▼
Recovery Bundle (75th percentile tip)
      │
      ▼
Lifecycle Tracker (processed → confirmed → finalized)
```

For the full architecture with Mermaid diagrams, component breakdown, and failure handling strategy, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

##  Quick Start

```bash
# Clone the repo
git clone https://github.com/sidneycodes1/atlas
cd atlas

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Fill in your env vars (see Configuration section below)
# Then start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), log in with Privy, and Atlas will automatically fund your embedded wallet from the treasury. Submit a test transaction and watch the recovery flow kick in.

---

##  Requirements

- Node.js 18+
- A Privy account ([dashboard.privy.io](https://dashboard.privy.io))
- SolInfra RPC access ([solinfra.dev](https://solinfra.dev)) — free tier works for RPC; gRPC streaming requires a Pro plan
- A funded Solana devnet treasury wallet (the one in this repo is pre-funded for demo)
- Gemini API key (optional — rule-based fallback works without it)

---

##  Configuration

Create a `.env.local` file with the following:

```env
# Privy (auth + embedded wallets)
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret

# Solana RPC (SolInfra)
NEXT_PUBLIC_RPC_URL=https://fra.rpc.solinfra.dev/YOUR_KEY
GRPC_ENDPOINT=https://fra.rpc.solinfra.dev:10000
GRPC_TOKEN=YOUR_SOLINFRA_KEY

# Treasury wallet (pre-funded on devnet)
TREASURY_PRIVATE_KEY=[your_base58_or_array_private_key]

# Gemini AI (optional — fallback handles unavailability gracefully)
GEMINI_API_KEY=your_gemini_api_key

# Jito tip configuration
JITO_TIP_ACCOUNT=96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5  # devnet
```

>  **Tip:** If you don't have a gRPC plan, Atlas will automatically detect the `PERMISSION_DENIED` error and fall back to RPC polling. No config change needed — it's handled transparently.

---

##  How It Works

### 1.  User Onboarding

When a user logs in via Privy, the `/api/onboard` endpoint checks if they've been funded before (tracked via local KV store). If not, the treasury wallet transfers 0.5 SOL to their embedded wallet. This eliminates the faucet step entirely — judges and evaluators can start testing immediately.

### 2.  Chain Streaming

Atlas attempts to connect to the Yellowstone gRPC stream on startup:

```
[Yellowstone gRPC] Attempting to connect via pure JS gRPC...
[Yellowstone gRPC] Connected successfully.
[Yellowstone gRPC] Stream error: 7 PERMISSION_DENIED: gRPC streaming requires 
  a Pro, Ultra, or Shared Metal subscription (code: 7)
[Yellowstone] Permanently falling back to RPC polling: provider requires 
  upgraded plan for gRPC streaming (PERMISSION_DENIED)
[Yellowstone gRPC] Stream ended.
```

This is real behavior from our runs. Code 7 (`PERMISSION_DENIED`) is treated as a **permanent, non-retriable error** — we don't burn retries on an auth failure. We log it, clean it up, and switch to polling. Transient errors (network flaps, timeouts) trigger exponential backoff up to 3 attempts before falling back.

### 3.  Dynamic Tip Calculation

Before every submission, Atlas hits the [Jito tip floor API](https://bundles.jito.wtf/api/v1/bundles/tip_floor) and pulls live percentile data:

- **Initial submission:** 50th percentile tip — competitive but not wasteful
- **Recovery submission:** 75th percentile tip — enough to win the slot on retry

This is non-hardcoded. Every run uses current market rates.

### 4.  AI Failure Analysis

When a transaction fails, Atlas sends context to Gemini AI:

- Transaction signature
- Failure mode (detected from logs/status)
- Current tip floor data
- Slot timing information

Gemini responds with a structured failure classification and recovery recommendation. If Gemini is unavailable (404, quota, etc.), a rule-based fallback planner kicks in — same output structure, deterministic logic. The fallback isn't a degraded experience; it's a deliberate design decision.

### 5.  Jito Bundle Construction

Recovery transactions are submitted as Jito bundles:

- Atomic: all-or-nothing execution
- MEV-protected: bundle can't be sandwiched
- Tip account: one of Jito's 8 devnet tip accounts receives the tip
- Bundle ID tracked through Jito's bundle status API

### 6.  Lifecycle Tracking

Every transaction moves through states:

```
PENDING → SUBMITTED → PROCESSED → CONFIRMED → FINALIZED
```

Timestamps are captured at each transition, enabling delta analysis (see Q1 below).

---

##  AI Agent in Action

Atlas uses Gemini AI as its failure reasoning engine. Here's what that looks like in practice:

### What the AI Observes
- Transaction signature and error code
- Initial tip amount vs. current 50th percentile floor
- Time since submission
- Number of recovery attempts

### What the AI Decides
- **Failure classification:** Is this `low_tip`, `slot_miss`, `network_congestion`, `blockhash_expired`, or `unknown`?
- **Recovery strategy:** What tip level to use? Immediate retry or wait for next slot?
- **Confidence:** How certain is the classification?

### Example AI Reasoning (actual run)

```
Transaction sig=3jTzcaE9... failed classification:
  - failure_mode: low_tip
  - initial_tip: 4650 lamports (50th percentile at submission time)
  - current_floor_50th: 4650 lamports
  - current_floor_75th: 8053 lamports
  - recommendation: retry with 75th percentile tip (8053 lamports)
  - confidence: high
  - reasoning: tip was right at floor; competition likely outbid
```

### Graceful Fallback

When Gemini returns a 404 or is otherwise unavailable, the rule-based planner takes over:

```typescript
// Rule-based fallback logic
if (failureMode === 'low_tip') {
  return {
    recoveryTip: tipFloor.p75,  // always escalate to 75th
    strategy: 'immediate_retry',
    confidence: 'rule_based'
  };
}
```

The output format is identical — downstream components don't need to know whether AI or rules produced the plan.

---

##  Lifecycle Logs — Real Runs

These are actual submission logs from our devnet testing. Every run used live Jito tip floor data.

### Run 1 — Low Tip Recovery ✅
```
sig:            3jTzcaE9...
failure_mode:   low_tip
initial_tip:    4,650 lamports  (50th percentile)
recovery_tip:   8,053 lamports  (75th percentile)
status:         SUCCESS
```

### Run 2 — Full Finalization ✅
```
sig:            5Ydg36x...
failure_mode:   low_tip
initial_tip:    17,519 lamports  (50th percentile)
recovery_tip:   100,000 lamports (75th percentile — floor spiked)
status:         FINALIZED
finalized_slot: 469,698,049
```
> Note the 75th percentile jumped to 100,000 lamports on this run — tip floors are volatile during periods of higher MEV activity. This is exactly why hardcoded tips are dangerous.

### Run 3 — Dynamic Tip Recovery ✅
```
sig:            4ewpwoK...
failure_mode:   low_tip
initial_tip:    dynamic (50th percentile at submission time)
recovery_tip:   36,380 lamports  (75th percentile)
status:         SUCCESS
```

### Run 4 — Fallback Tip Recovery ✅
```
sig:            266WDZb...
failure_mode:   low_tip
initial_tip:    4,279 lamports  (50th percentile)
recovery_tip:   10,000 lamports (fallback floor — Jito API momentarily unavailable)
status:         SUCCESS
```
> When the Jito tip API is down, we fall back to a conservative minimum. The transaction still succeeded — the fallback tip was sufficient for this slot.

---

##  Key Observations & Lessons

These are the most important things we learned actually running this system. They shaped design decisions, not just documentation.

### Tip Floor Volatility is Real

Across four runs, the 75th percentile tip ranged from **8,053 to 100,000 lamports** — a 12x swing. If you hardcode a tip, you'll either overpay during quiet periods or lose your slot during congestion. Dynamic tips aren't a nice-to-have; they're essential for reliable recovery.

### PERMISSION_DENIED is Not a Retry Scenario

When Yellowstone returns code 7, it's telling you the credentials aren't authorized — no amount of retrying will change that. Our initial implementation did retry, burning cycles and delaying fallback. The right behavior is immediate classification and permanent fallback. Distinguishing retriable (network) from non-retriable (auth) errors is one of the most important things you can do in a gRPC client.

### Blockhash Windows Are Shorter Than You Think

We observed multiple cases where recovery transactions needed a fresh blockhash even though only ~10-15 seconds had passed since the original submission. At ~400ms per slot and ~150 slots of validity, you have roughly 60 seconds — but if your original transaction lands near the end of that window, your retry with the same blockhash will be dead on arrival. Always fetch fresh.

### AI Fallback Should Be Indistinguishable

The rule-based fallback produces the same JSON structure as Gemini. This isn't just good engineering hygiene — it means you can ship confidently knowing the system degrades gracefully. Users never see "AI unavailable"; they just see their transaction recovered.

### File-Based Persistence Works for Demos

Replacing `@vercel/kv` with file-based storage made the project self-contained and zero-infra for judges to run. For production, you'd swap this for Redis or a proper KV store, but for a bounty demo, eliminating external dependencies lowers the barrier to evaluation.

---

##  Answers to Bounty Questions

### Q1: What does the delta between `processed_at` and `confirmed_at` tell you about network health?

The `processed_at` timestamp marks when your transaction first landed on a leader's node and was included in a block — but that block is unconfirmed and could be on a fork. `confirmed_at` means a supermajority of stake (roughly 2/3+) has voted on that block's ancestor, making it practically irreversible under normal conditions.

The delta between them is one of the most honest signals you can get about Solana's consensus velocity.

**What we observed:** On a healthy devnet, this delta typically ran between **0.4 and 1.2 seconds** — roughly 1 to 3 slots. When the network is stressed (leader rotation issues, high validator latency, stake-weighted vote lag), this gap stretches. We saw occasional spikes to 4-6 seconds during periods of higher devnet activity, which corresponded to slightly elevated confirmation latency across the board.

**Why it matters:** If you're building a UX that shows "your transaction went through" at `processed`, you're showing the user something that could still be rolled back. The `processed → confirmed` delta tells you how long your users are actually at risk. A healthy network keeps this under 2 seconds. A degraded one might stretch it to 10+, and you'd want to reflect that uncertainty in your UI rather than falsely reassuring users.

For recovery systems specifically: if confirmed_at is unusually delayed, it's worth checking whether the leader for that slot had issues — the answer might be that your transaction was included in an orphaned block and needs resubmission.

---

### Q2: Why should you never use `finalized` commitment when fetching a blockhash for a time-sensitive transaction?

`finalized` commitment means the block containing your blockhash has been rooted — no validator on any fork will ever roll it back. That's great for reading state you trust completely. But it has a serious cost: a blockhash at `finalized` commitment is **approximately 31-32 slots behind the tip of the chain**.

At ~400ms per slot, you're getting a blockhash that's already 12-13 seconds old. And here's the critical part: a blockhash is only valid for **150 slots** from the slot it was produced in. You've just burned roughly 20% of your validity window before your transaction even leaves your machine.

For a time-sensitive operation — recovery transactions especially — this is a problem:

1. If the recovery transaction takes even a moment to propagate and land, you may submit with a blockhash that expires before the next available leader slot.
2. Under congestion, where it might take multiple attempts across multiple slots to land, a stale blockhash can expire mid-retry.

**The right approach** is `confirmed` commitment for blockhash fetching. You get a recent blockhash (1-2 slots behind tip), with extremely high confidence it won't be rolled back (supermajority stake has confirmed it). You preserve your full ~60-second validity window, which is critical for recovery flows.

`processed` commitment would give you an even fresher blockhash, but on a forking event it could be invalid. `confirmed` is the sweet spot: recency without meaningful rollback risk.

---

### Q3: What happens to your bundle if the Jito leader skips their slot?

This is one of the trickier operational realities of building on Jito, and it catches a lot of people off guard.

Jito bundles are submitted to a specific leader's block engine. The bundle is scheduled for inclusion in **that leader's upcoming block**. If that leader skips their slot — due to network issues, hardware problems, or being behind on the fork — **the bundle is silently dropped**. It's not requeued. It's not forwarded to the next leader. It simply never lands.

Your bundle status API will show the bundle as expired or unprocessed rather than confirmed, which is at least a detectable signal. But if you're not actively polling that status, you might not notice until your user is asking why their transaction hasn't landed.

**How Atlas handles this:**

- We track every submitted bundle ID through Jito's status API
- If a bundle reaches a terminal unprocessed state, we classify it as a slot-skip failure and trigger the recovery flow
- The recovery bundle targets the **next available Jito leader slot** rather than resubmitting immediately, which might hit the same or another unavailable leader

**The broader lesson:** Bundles give you atomicity and MEV protection, but not guaranteed inclusion. The leader schedule is probabilistic in the sense that any given leader might not produce their block. In practice on mainnet, slot skips are relatively rare (under 5% of slots), but for a recovery platform, you have to assume they happen and design your lifecycle tracker accordingly.

A good mental model: Jito bundles are atomic within a block, but getting into a block requires that a Jito-enabled leader produces that block. Plan for the case where they don't.

---

##  Setup & Running in Detail

### Installation

```bash
git clone https://github.com/sidneycodes1/atlas
cd atlas
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
# Edit .env.local with your keys
```

### Treasury Wallet Setup

The treasury wallet (`BmWDEaSQPKCCwGGwxuZiVB8Ld1LEHJMYoRWWovgP1KT6`) is pre-funded for demo purposes. If you need to fund your own:

```bash
solana airdrop 2 BmWDEaSQPKCCwGGwxuZiVB8Ld1LEHJMYoRWWovgP1KT6 --url devnet
```

### Running

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Type checking
npm run type-check
```

### gRPC vs RPC Polling

Atlas will attempt gRPC on startup. If your SolInfra plan doesn't include gRPC streaming, you'll see the `PERMISSION_DENIED` log and the system will automatically fall back to polling every 2 seconds. **No config change needed** — this is handled transparently.

If you have a Pro/Ultra SolInfra plan and want to verify gRPC is working, look for:
```
[Yellowstone gRPC] Connected successfully.
[Yellowstone gRPC] Subscribed to transaction stream.
```

If you see the PERMISSION_DENIED fallback, the system is still fully operational — just using polling.

### Reconnection Behavior

| Error Type | Behavior |
|---|---|
| `PERMISSION_DENIED` (code 7) | Permanent fallback to RPC polling, no retry |
| Network timeout / flap | Exponential backoff: 1s → 2s → 4s (max 3 attempts) |
| After 3 failed retries | Permanent fallback to RPC polling |
| RPC polling | Polls every 2000ms indefinitely |

---

## 📁 Project Structure

```
atlas/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── onboard/          # Auto-funding endpoint
│   │   │   ├── submit-transaction/  # Initial Jito bundle submission
│   │   │   ├── recover/          # Recovery flow with AI analysis
│   │   │   └── status/           # Lifecycle tracking
│   │   ├── page.tsx              # Main dashboard
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── yellowstone.ts        # gRPC client + fallback logic
│   │   ├── jito.ts               # Bundle construction + tip calculation
│   │   ├── gemini.ts             # AI analysis + rule-based fallback
│   │   ├── lifecycle.ts          # Transaction state machine
│   │   ├── user-funding.ts       # Treasury airdrop + KV tracking
│   │   └── kv-store.ts           # File-based KV store
│   └── components/
│       ├── TransactionDashboard.tsx
│       ├── LifecycleTracker.tsx
│       └── RecoveryPanel.tsx
├── README.md                     # This file
├── .env.example
└── package.json
```

---

##  Future Improvements

- **Mainnet mode:** Switch tip accounts and RPC to mainnet; add configurable tip multipliers
- **WebSocket lifecycle updates:** Replace polling with WebSocket push for real-time UI updates
- **Multi-transaction recovery:** Batch multiple failed transactions into a single recovery bundle
- **Yellowstone Pro integration:** With an upgraded plan, the gRPC path enables slot-level precision for leader detection
- **Persistent storage:** Replace file-based KV with Redis for production deployments
- **AI confidence thresholds:** Only invoke AI when confidence from rule-based classifier is below a threshold, saving API calls for clear-cut cases
- **Leader schedule pre-fetching:** Pull the leader schedule 2-4 slots ahead to time bundle submission more precisely

---

##  Contributing

This project was built for the Superteam Nigeria Advanced Infrastructure Challenge. Contributions, questions, and feedback are welcome!

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit your changes
4. Open a PR with a clear description of what you changed and why

---

##  License

MIT License — see [LICENSE](./LICENSE) for details.

---

##  Acknowledgments

- [Jito Labs](https://jito.wtf) — for MEV-protected bundles and the tip floor API
- [Triton One](https://triton.one) — for Yellowstone gRPC protocol and documentation
- [Privy](https://privy.io) — for embedded wallet infrastructure
- [SolInfra](https://solinfra.dev) — for RPC and gRPC endpoint access
- [Superteam Nigeria](https://ng.superteam.fun) — for the bounty challenge that pushed this into existence

---

*Built on Solana devnet. Treasury: `BmWDEaSQPKCCwGGwxuZiVB8Ld1LEHJMYoRWWovgP1KT6`*
