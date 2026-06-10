"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { getConnection } from "@/lib/solana/connection";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Cpu, LogOut, ArrowRight, ShieldAlert, LayoutDashboard } from "lucide-react";

import WalletDashboard, { DashboardTransaction } from "@/components/wallet/WalletDashboard";
import { truncateAddress } from "@/lib/utils";
import TransactionPortal from "@/components/atlas/TransactionPortal";
import { Step } from "@/components/atlas/LifecycleTracker";
import { hasUserBeenFunded } from "@/lib/user-funding";

export default function DashboardPage() {
  const { authenticated, ready, logout, login } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();

  // Find the embedded Solana wallet
  const solWallet = wallets.find(
    (w: any) => w.walletClientType === "privy" || !w.address.startsWith("0x")
  );
  const address = solWallet ? solWallet.address : "";

  // Wallet states
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);
  const [isAirdropLoading, setIsAirdropLoading] = useState(false);
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [isTransferLoading, setIsTransferLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    const id = setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 7000);
    return id;
  };

  // Keyboard shortcut listener (Cmd+K or Ctrl+K to toggle portal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsPortalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Sync state with localStorage for demo history persistence
  useEffect(() => {
    if (address) {
      const cached = localStorage.getItem(`atlas_txs_${address}`);
      if (cached) {
        setTransactions(JSON.parse(cached));
      }
    }
  }, [address]);

  const saveTransactions = (txs: DashboardTransaction[]) => {
    setTransactions(txs);
    if (address) {
      localStorage.setItem(`atlas_txs_${address}`, JSON.stringify(txs));
    }
  };

  // Fetch SOL balance
  const fetchBalance = async () => {
    if (!address) return;
    try {
      const connection = getConnection();
      const pubkey = new PublicKey(address);
      const lamports = await connection.getBalance(pubkey);
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  };

  // Auth redirection removed - dashboard is accessible to all users

  useEffect(() => {
    if (address) {
      fetchBalance();
      const interval = setInterval(fetchBalance, 10000);
      return () => clearInterval(interval);
    }
  }, [address]);

  // Auto-airdrop on login
  const prevAddressRef = useRef("");

  useEffect(() => {
    if (ready && authenticated && address && address !== prevAddressRef.current) {
      prevAddressRef.current = address;

      const autoFund = async () => {
        if (!hasUserBeenFunded(address)) {
          console.log(`[Auto-Onboard] Initiating login auto-funding for ${address}`);
          try {
            const res = await fetch("/api/onboard", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ walletAddress: address }),
            });
            const data = await res.json();
            if (data.success) {
              console.log("✓ Wallet funded with 0.5 SOL");
              setBalance(0.5);
              
              // Add onboarding transaction to local history
              const newTx: DashboardTransaction = {
                signature: data.signature,
                type: "Airdrop",
                amount: 0.5,
                status: "Finalized",
                timestamp: Date.now(),
              };
              setTransactions((prev) => {
                const updated = [newTx, ...prev];
                localStorage.setItem(`atlas_txs_${address}`, JSON.stringify(updated));
                return updated;
              });
            } else {
              console.error("Funding failed:", data.error);
              showToast("Devnet airdrop rate limited. Use faucet.solana.com");
            }
          } catch (err) {
            console.error("Error calling onboard:", err);
            showToast("Devnet airdrop rate limited. Use faucet.solana.com");
          }
        } else {
          console.log("[Auto-Onboard] User already funded. Skipping onboarding.");
        }
      };

      autoFund();
    } else if (!authenticated) {
      prevAddressRef.current = "";
    }
  }, [ready, authenticated, address]);

  // Request 1 SOL devnet funding
  const handleAirdrop = async () => {
    if (!address) return;
    setIsAirdropLoading(true);
    setErrorBanner(null);

    try {
      const res = await fetch("/api/fund-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Airdrop failed");
      }

      await fetchBalance();
      
      // Add airdrop transaction to local history
      const newTx: DashboardTransaction = {
        signature: data.signature,
        type: "Airdrop",
        amount: 1,
        status: "Finalized",
        timestamp: Date.now(),
      };
      saveTransactions([newTx, ...transactions]);
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Devnet faucet rate limited. Try again shortly.");
    } finally {
      setIsAirdropLoading(false);
    }
  };

  const showError = (msg: string) => {
    setErrorBanner(msg);
    setTimeout(() => {
      setErrorBanner(null);
    }, 6000);
  };

  // Lifecycle steps state
  const [steps, setSteps] = useState<Step[]>([
    { label: "Initiating Transfer", status: "idle" },
    { label: "Streaming to Yellowstone", status: "idle" },
    { label: "Bundle Status", status: "idle" },
    { label: "Re-submitting", status: "idle" },
    { label: "Finalized", status: "idle" },
  ]);

  // AI Recovery states
  const [recoveryState, setRecoveryState] = useState<{
    isActive: boolean;
    phase: "analyzing" | "planning" | "executing" | "complete" | "failed" | "idle";
    observation?: string;
    reasoning?: string;
    decision?: string;
    actionType?: string;
    statusMessage?: string;
  }>({
    isActive: false,
    phase: "idle",
  });

  const updateStep = (index: number, status: Step["status"], statusText?: string) => {
    setSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], status, statusText };
      return next;
    });
  };

  const resetSteps = () => {
    setSteps([
      { label: "Initiating Transfer", status: "idle" },
      { label: "Streaming to Yellowstone", status: "idle" },
      { label: "Bundle Status", status: "idle" },
      { label: "Re-submitting", status: "idle" },
      { label: "Finalized", status: "idle" },
    ]);
    setRecoveryState({ isActive: false, phase: "idle" });
  };

  // Submit transfer form handler
  const handleTransferSubmit = async (data: {
    toAddress: string;
    amountSol: number;
    atlasEnabled: boolean;
    failureMode?: string;
  }) => {
    setIsTransferLoading(true);
    resetSteps();
    setErrorBanner(null);

    // Step 1: Initiating
    updateStep(0, "pending", "Building Jito Transfer Bundle...");

    try {
      const res = await fetch("/api/submit-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAddress: data.toAddress,
          amountSol: data.amountSol,
          atlasEnabled: data.atlasEnabled,
          failureMode: data.failureMode,
        }),
      });

      const submitData = await res.json();
      if (!res.ok) {
        throw new Error(submitData.error || "Failed to submit bundle");
      }

      const signature = submitData.signature;
      const bundleId = submitData.bundleId;

      updateStep(0, "success", "Signed & Packaged.");

      // If simulated failure triggered
      if (data.failureMode && data.atlasEnabled) {
        // Step 2: Yellowstone
        updateStep(1, "pending", "Geyser checking block inclusion...");
        await new Promise((resolve) => setTimeout(resolve, 1200));
        updateStep(1, "success", "Decoded.");

        // Step 3: Bundle Status
        updateStep(2, "failed", `REJECTED: ${submitData.reason || "Under-tipped"}`);

        // Trigger AI Recovery pipeline!
        setRecoveryState({
          isActive: true,
          phase: "analyzing",
          statusMessage: "Scanning validation failure telemetry...",
        });

        // Make recovery request
        const recoveryRes = await fetch("/api/recover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            failureContext: {
              failureType: data.failureMode,
              bundleId,
              originalTipLamports: submitData.originalParams.tipLamports,
              blockhashAge: data.failureMode === "expired_blockhash" ? 172 : 14,
              networkCongestion: data.failureMode === "congestion" ? "high" : "low",
              previousAttempts: 0,
              slotInfo: { currentSlot: 28394012, leaderSlots: [28394015, 28394025] },
            },
            originalParams: submitData.originalParams,
          }),
        });

        if (!recoveryRes.ok) {
          throw new Error("AI Recovery engine route offline.");
        }

        // Read recovery SSE stream
        const reader = recoveryRes.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("Unreadable recovery stream");

        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const parsed = JSON.parse(line.substring(6));
              const { phase, data: phaseData } = parsed;

              if (phase === "analyzing") {
                setRecoveryState((prev) => ({ ...prev, phase, statusMessage: phaseData.message }));
              } else if (phase === "planning" && phaseData.plan) {
                setRecoveryState((prev) => ({
                  ...prev,
                  phase,
                  observation: phaseData.plan.observation,
                  reasoning: phaseData.plan.reasoning,
                  decision: phaseData.plan.decision,
                  actionType: phaseData.plan.action?.type,
                }));
              } else if (phase === "executing") {
                setRecoveryState((prev) => ({
                  ...prev,
                  phase,
                  actionType: phaseData.action?.type,
                  statusMessage: phaseData.message,
                }));
                updateStep(3, "pending", "Applying fixes...");
              } else if (phase === "complete") {
                const result = phaseData.result;
                if (result.status === "accepted") {
                  setRecoveryState((prev) => ({
                    ...prev,
                    phase,
                    statusMessage: phaseData.message,
                  }));
                  updateStep(3, "success", "Bundle Optimizations Injected.");

                  // Now stream the new transaction updates
                  updateStep(4, "pending", "Awaiting block confirmation...");
                  
                  // Setup SSE listener for newly recovered transaction stream
                  const eventSource = new EventSource(
                    `/api/stream-transaction?signature=${result.signature}&simulated=true`
                  );

                  eventSource.onmessage = async (event) => {
                    const update = JSON.parse(event.data);
                    console.log("[Recovery Stream Update]:", update);

                    if (update.stage === "confirmed") {
                      updateStep(4, "pending", "Slot Confirmed. Finalizing...");
                    } else if (update.stage === "finalized") {
                      eventSource.close();
                      updateStep(4, "success", "Finalized.");
                      
                      // Success! Add Self-Healing record to history
                      const newTx: DashboardTransaction = {
                        signature: result.signature,
                        type: "Recovery",
                        amount: data.amountSol,
                        status: "Self-Healing",
                        timestamp: Date.now(),
                        metadata: {
                          failureType: data.failureMode,
                          recoveryTime: `${((Date.now() - submitData.submittedAt) / 1000).toFixed(1)}s`,
                          attempts: 1,
                        },
                      };
                      saveTransactions([newTx, ...transactions]);
                      await fetchBalance();
                      setIsTransferLoading(false);
                    } else if (update.stage === "failed") {
                      eventSource.close();
                      updateStep(4, "failed", "Finalization failed.");
                      setIsTransferLoading(false);
                    }
                  };
                } else {
                  updateStep(3, "failed", "Healing Resubmission Rejected.");
                  setIsTransferLoading(false);
                }
              }
            }
          }
        }
      } else if (data.failureMode && !data.atlasEnabled) {
        // Without Atlas: simulate raw failure
        updateStep(1, "pending", "Checking Geyser inclusion...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        updateStep(1, "success", "Decoded.");
        updateStep(2, "failed", `REJECTED: ${submitData.reason || "Insufficient tip"}`);
        
        const newTx: DashboardTransaction = {
          signature,
          type: "Transfer",
          amount: data.amountSol,
          status: "Failed",
          timestamp: Date.now(),
        };
        saveTransactions([newTx, ...transactions]);
        setIsTransferLoading(false);
      } else {
        // Real or normal successful transaction
        updateStep(1, "pending", "Awaiting Yellowstone updates...");
        
        // Listen on stream-transaction API
        const isRealTx = !submitData.success && !data.failureMode; // if standard transfer succeeded
        const eventSource = new EventSource(
          `/api/stream-transaction?signature=${signature}&simulated=${!isRealTx}`
        );

        eventSource.onmessage = async (event) => {
          const update = JSON.parse(event.data);
          if (update.stage === "processed") {
            updateStep(1, "success", "Signature Scanned.");
            updateStep(2, "pending", "Confirming block consensus...");
          } else if (update.stage === "confirmed") {
            updateStep(2, "success", "1 Confirmation.");
            updateStep(4, "pending", "Finalizing slot...");
          } else if (update.stage === "finalized") {
            eventSource.close();
            updateStep(4, "success", "Consensus Finalized.");
            
            const newTx: DashboardTransaction = {
              signature,
              type: "Transfer",
              amount: data.amountSol,
              status: "Finalized",
              timestamp: Date.now(),
            };
            saveTransactions([newTx, ...transactions]);
            await fetchBalance();
            setIsTransferLoading(false);
          } else if (update.stage === "failed") {
            eventSource.close();
            updateStep(2, "failed", "Transaction dropped.");
            
            const newTx: DashboardTransaction = {
              signature,
              type: "Transfer",
              amount: data.amountSol,
              status: "Failed",
              timestamp: Date.now(),
            };
            saveTransactions([newTx, ...transactions]);
            setIsTransferLoading(false);
          }
        };
      }
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Failed to execute transfer.");
      setIsTransferLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-dark-bg text-white flex items-center justify-center font-mono text-xs">
        Loading Atlas operator console...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] relative select-none pb-20">
      {/* Background Grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Top Navbar */}
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="font-mono text-xl font-bold tracking-tighter text-white">
            ATLAS<span className="text-[var(--color-yellow)]">.</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded text-[10px] font-mono text-[var(--color-text-2)] uppercase tracking-wider">
            <LayoutDashboard className="w-3.5 h-3.5 text-[var(--color-yellow)]" />
            <span>OPERATOR CONTROL STATION</span>
          </div>
        </div>

        {/* Navbar Info & Controls */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-[9px] font-bold text-[var(--color-text-2)] font-mono tracking-wider">
              OPERATOR WALLET
            </span>
            <span className="text-xs text-white font-mono font-medium">
              {address ? truncateAddress(address) : "Not Connected"}
            </span>
          </div>

          <button
            onClick={() => setIsPortalOpen(true)}
            className="px-4 py-2 bg-[var(--color-yellow)] hover:bg-[var(--color-yellow-hover)] text-black font-semibold text-xs rounded-[var(--radius-lg)] transition flex items-center gap-1.5 shadow-[0_0_12px_rgba(240,201,58,0.1)] border-0"
          >
            <Cpu className="w-3.5 h-3.5 text-black" />
            <span>Portal</span>
            <span className="hidden sm:inline bg-black/15 px-1.5 py-0.5 rounded text-[9px] text-black font-mono">
              Ctrl+K
            </span>
          </button>

          {authenticated ? (
            <button
              onClick={logout}
              className="p-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] rounded-[var(--radius-lg)] text-[var(--color-text-2)] hover:text-white transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={login}
              className="px-4 py-2 bg-[var(--color-yellow)] hover:bg-[var(--color-yellow-hover)] text-black font-semibold text-xs rounded-[var(--radius-lg)] transition uppercase tracking-wider border-0"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* Main Layout Grid */}
      <div className="max-w-[900px] mx-auto px-6 py-8">
        {/* Error Notification Banner */}
        {errorBanner && (
          <div className="mb-6 p-4 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/20 rounded-[var(--radius-md)] text-[var(--color-danger)] text-xs font-mono flex items-center gap-3 animate-fade-slide-in">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div className="flex-1 font-medium">{errorBanner}</div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-[var(--color-danger)] hover:text-white font-bold"
            >
              ×
            </button>
          </div>
        )}

        <div className="w-full flex flex-col gap-6">
          {/* Wallet Dashboard */}
          <WalletDashboard
            balance={balance}
            address={address}
            transactions={transactions}
            onSendClick={() => setIsPortalOpen(true)}
            onAirdropClick={handleAirdrop}
            isAirdropLoading={isAirdropLoading}
          />
        </div>
      </div>

      {/* Transaction Portal Slide-In Widget */}
      <TransactionPortal
        isOpen={isPortalOpen}
        onClose={() => setIsPortalOpen(false)}
        onSubmit={handleTransferSubmit}
        isLoading={isTransferLoading}
        steps={steps}
        recoveryState={recoveryState}
      />

      {/* Custom Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] shadow-xl text-xs font-mono text-white flex items-center gap-3 animate-fade-slide-in max-w-sm">
          <div className="w-2 h-2 rounded-full bg-[var(--color-yellow)] animate-pulse" />
          <div className="flex-1 font-medium">{toastMessage}</div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-[var(--color-text-3)] hover:text-white font-bold text-sm"
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}
