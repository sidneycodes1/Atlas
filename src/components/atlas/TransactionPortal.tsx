"use client";

import React, { useState, useEffect } from "react";
import { X, Send, Cpu, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import LifecycleTracker, { Step } from "./LifecycleTracker";
import AIInterventionPanel from "./AIInterventionPanel";

interface TransactionPortalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    toAddress: string;
    amountSol: number;
    atlasEnabled: boolean;
    failureMode?: string;
    asset?: "SOL" | "USDC";
  }) => Promise<void>;
  isLoading: boolean;
  steps: Step[];
  recoveryState: {
    isActive: boolean;
    phase: "analyzing" | "planning" | "executing" | "complete" | "failed" | "idle";
    observation?: string;
    reasoning?: string;
    decision?: string;
    actionType?: string;
    statusMessage?: string;
  };
  className?: string;
}

export default function TransactionPortal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  steps,
  recoveryState,
  className,
}: TransactionPortalProps) {
  const [toAddress, setToAddress] = useState("");
  const [amountSol, setAmountSol] = useState("");
  const [atlasEnabled, setAtlasEnabled] = useState(true);
  const [asset, setAsset] = useState<"SOL" | "USDC">("SOL");
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [failureModeIndex, setFailureModeIndex] = useState(0);
  const FAILURE_MODES = ["low_tip", "expired_blockhash", "leader_miss", "congestion"];

  useEffect(() => {
    if (!isOpen) {
      setToAddress("");
      setAmountSol("");
      setAsset("SOL");
      setSimulateFailure(false);
      setFailureModeIndex(0);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toAddress || !amountSol) return;

    let selectedFailureMode = undefined;
    if (simulateFailure) {
      selectedFailureMode = FAILURE_MODES[failureModeIndex % FAILURE_MODES.length];
      setFailureModeIndex(prev => prev + 1);
    }

    onSubmit({
      toAddress,
      amountSol: parseFloat(amountSol),
      atlasEnabled,
      asset,
      ...(selectedFailureMode ? { failureMode: selectedFailureMode } : {})
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 w-full md:w-[450px] bg-[var(--color-surface)] border-l border-[var(--color-border)] z-40 flex flex-col justify-between shadow-2xl animate-fade-slide-in",
        className
      )}
    >
      {/* Portal Header */}
      <div className="p-5 border-b border-[var(--color-border)] flex justify-between items-center bg-black/20">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-[var(--color-yellow)]" />
          <h2 className="font-mono text-sm font-bold tracking-wider text-white uppercase m-0">
            Atlas | Transaction Portal
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--color-text-3)] hover:text-white p-1 hover:bg-[var(--color-surface-3)]/30 rounded transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Portal Body (Scrollable content) */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Recipient Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-[var(--color-text-2)] uppercase font-mono tracking-wider">
              Recipient Address (Solana Pubkey)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 96gYZGLnJYVFihjzwyJYA3mqj1sNZgSt..."
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              disabled={isLoading}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] px-3 py-2 text-xs text-white font-mono placeholder-[var(--color-text-3)]/40 focus:outline-none focus:border-[var(--color-yellow)] transition"
            />
          </div>

          {/* Asset Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-[var(--color-text-2)] uppercase font-mono tracking-wider">
              Asset
            </label>
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value as "SOL" | "USDC")}
              disabled={isLoading}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--color-yellow)] transition appearance-none"
            >
              <option value="SOL">SOL</option>
              <option value="USDC">ATLAS-USD</option>
            </select>
          </div>

          {/* Amount Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-[var(--color-text-2)] uppercase font-mono tracking-wider">
              Amount ({asset === "USDC" ? "ATLAS-USD" : "SOL"})
            </label>
            <input
              type="number"
              required
              step="0.0001"
              min="0.0001"
              placeholder="0.05"
              value={amountSol}
              onChange={(e) => setAmountSol(e.target.value)}
              disabled={isLoading}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] px-3 py-2 text-xs text-white font-mono placeholder-[var(--color-text-3)]/40 focus:outline-none focus:border-[var(--color-yellow)] transition"
            />
          </div>

          {/* Toggle 1: Route via Shadow Agent */}
          <div className="flex items-center justify-between p-3 bg-[var(--color-surface-2)]/40 border border-[var(--color-border)] rounded-[var(--radius-md)]">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-mono font-bold text-white">Route via Atlas Shadow Agent</span>
              <span className="text-[10px] text-[var(--color-text-3)]">Enables autonomous failure detection and healing.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={atlasEnabled}
                onChange={(e) => setAtlasEnabled(e.target.checked)}
                disabled={isLoading}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[var(--color-surface-3)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-yellow)]"></div>
            </label>
          </div>

          {/* Toggle 2: Simulate Failure */}
          <div className="flex items-center justify-between p-3 bg-[var(--color-surface-2)]/40 border border-[var(--color-border)] rounded-[var(--radius-md)]">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-mono font-bold text-white">Simulate Failure (Testing)</span>
              <span className="text-[10px] text-[var(--color-text-3)]">Forces a transaction failure to test recovery.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.checked)}
                disabled={isLoading}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[var(--color-surface-3)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-yellow)]"></div>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !toAddress || !amountSol}
            className="w-full bg-[var(--color-yellow)] hover:bg-[var(--color-yellow-hover)] text-black font-bold py-3 rounded-[var(--radius-lg)] text-xs transition duration-200 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Submitting Bundle...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 text-black" />
                <span>Execute Transfer</span>
              </>
            )}
          </button>
        </form>

        {/* Live Status Trackers */}
        {(isLoading || steps.some((s) => s.status !== "idle") || recoveryState.isActive) && (
          <div className="flex flex-col gap-4 mt-2 border-t border-[var(--color-border)] pt-5">
            {/* Steps Lifecycle Tracker */}
            <LifecycleTracker steps={steps} />

            {/* AI Intervention Panel */}
            <AIInterventionPanel
              isActive={recoveryState.isActive}
              phase={recoveryState.phase}
              observation={recoveryState.observation}
              reasoning={recoveryState.reasoning}
              decision={recoveryState.decision}
              actionType={recoveryState.actionType}
              statusMessage={recoveryState.statusMessage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
