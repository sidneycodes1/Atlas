"use client";

import React, { useState } from "react";
import { ArrowUpRight, ArrowDownLeft, Coins, ExternalLink, Loader2 } from "lucide-react";
import { cn, truncateAddress } from "@/lib/utils";

export interface DashboardTransaction {
  signature: string;
  type: "Transfer" | "Airdrop" | "Recovery";
  amount: number;
  status: "Finalized" | "Self-Healing" | "Failed";
  timestamp: number;
  metadata?: {
    failureType?: string;
    recoveryTime?: string;
    attempts?: number;
  };
}

interface WalletDashboardProps {
  balance: number;
  address: string;
  transactions: DashboardTransaction[];
  onSendClick: () => void;
  onAirdropClick: () => void;
  isAirdropLoading: boolean;
  className?: string;
}

export default function WalletDashboard({
  balance,
  address,
  transactions,
  onSendClick,
  onAirdropClick,
  isAirdropLoading,
  className,
}: WalletDashboardProps) {
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Balance Panel */}
      <div className="wallet-balance-card border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6 relative flex flex-col justify-between min-h-[180px]">
        <div className="flex justify-between items-start z-10">
          <div>
            <span className="text-[10px] font-bold text-[var(--color-text-2)] uppercase tracking-wider font-mono">
              SOLANA DEVNET ACCOUNT
            </span>
            <div className="text-white font-mono text-xs font-medium tracking-tight mt-1">
              {address ? truncateAddress(address) : "Not connected"}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-yellow)] bg-[var(--color-yellow-dim)] px-2.5 py-1 rounded border border-[var(--color-yellow-border)] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-yellow)] animate-pulse" />
            CONNECTED DEVNET
          </div>
        </div>

        <div className="my-4 z-10">
          <span className="text-[10px] font-bold text-[var(--color-text-2)] uppercase tracking-wider font-mono">
            AVAILABLE BALANCE
          </span>
          <div className="text-[var(--color-yellow)] font-mono text-4xl md:text-5xl font-bold mt-1 tracking-tight flex items-baseline gap-2">
            {balance.toFixed(4)} <span className="text-lg text-white font-sans font-medium">SOL</span>
          </div>
        </div>

        {/* Actions Row */}
        <div className="flex gap-3 mt-2 z-10">
          <button
            onClick={onSendClick}
            className="flex-1 bg-[var(--color-yellow)] hover:bg-[var(--color-yellow-hover)] text-black py-3 px-4 rounded-[var(--radius-lg)] font-bold text-xs transition duration-200 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(240,201,58,0.15)] border-0"
          >
            <ArrowUpRight className="w-4 h-4 text-black" /> SEND SOL
          </button>
          
          <button
            onClick={onAirdropClick}
            disabled={isAirdropLoading}
            className="flex-1 bg-[var(--color-surface-3)] border border-[var(--color-border-strong)] hover:brightness-110 text-white py-3 px-4 rounded-[var(--radius-lg)] font-semibold text-xs transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isAirdropLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-yellow)]" />
            ) : (
              <ArrowDownLeft className="w-4 h-4 text-[var(--color-yellow)]" />
            )}
            REQUEST AIRDROP
          </button>
        </div>
      </div>

      {/* Transaction Logs Header */}
      <div className="flex border-b border-[var(--color-border)] pb-3 px-4">
        <span className="text-xs font-mono font-bold tracking-wider text-white uppercase">
          Transaction Logs
        </span>
      </div>

      {/* Tab Content */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden min-h-[300px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-text-2)] bg-[var(--color-surface-2)]">
                <th className="p-4 uppercase tracking-wider font-semibold">Signature</th>
                <th className="p-4 uppercase tracking-wider font-semibold">Type</th>
                <th className="p-4 uppercase tracking-wider font-semibold">Amount</th>
                <th className="p-4 uppercase tracking-wider font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[var(--color-text-3)]">
                    <Coins className="w-8 h-8 text-[var(--color-text-3)]/40 mx-auto mb-2" />
                    No transactions detected yet. Send your first SOL transfer.
                  </td>
                </tr>
              ) : (
                transactions.map((tx, idx) => (
                  <tr
                    key={tx.signature}
                    className={cn(
                      "hover:bg-[var(--color-surface-2)] transition duration-150 animate-fade-slide-in",
                      idx === 0 && "bg-[var(--color-yellow-dim)]"
                    )}
                  >
                    {/* Signature */}
                    <td className="p-4 font-medium">
                      <a
                        href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-yellow)] hover:underline inline-flex items-center gap-1 group"
                      >
                        {truncateAddress(tx.signature)}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                      </a>
                    </td>

                    {/* Type */}
                    <td className="p-4 text-white font-medium">{tx.type}</td>

                    {/* Amount */}
                    <td className="p-4 font-bold text-white">
                      {tx.type === "Airdrop" ? "+" : "-"}
                      {tx.amount.toFixed(3)} SOL
                    </td>

                    {/* Status */}
                    <td className="p-4 text-right relative">
                      {tx.status === "Finalized" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-bold bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/20">
                          Finalized
                        </span>
                      )}
                      {tx.status === "Failed" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-bold bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger)]/20">
                          Failed
                        </span>
                      )}
                      {tx.status === "Self-Healing" && (
                        <div
                          className="inline-block relative"
                          onMouseEnter={() => setHoveredBadge(tx.signature)}
                          onMouseLeave={() => setHoveredBadge(null)}
                        >
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-bold bg-[var(--color-warning-bg)] text-[var(--color-yellow)] border border-[var(--color-yellow-border)] cursor-help select-none">
                            ✦ Self-Healing
                          </span>

                          {/* Tooltip */}
                          {hoveredBadge === tx.signature && tx.metadata && (
                            <div className="absolute right-0 bottom-full mb-2 z-50 w-52 p-2 bg-[var(--color-surface-2)] border border-[var(--color-yellow-border)] rounded-[var(--radius-md)] text-left shadow-lg text-[9px] leading-relaxed animate-fade-slide-in">
                              <div className="font-bold text-[var(--color-yellow)] uppercase tracking-wider mb-1">
                                Recovery Summary
                              </div>
                              <div className="text-white">
                                Reason: <span className="text-[var(--color-danger)] font-medium">{tx.metadata.failureType?.replace("_", " ")}</span>
                              </div>
                              <div className="text-white">
                                Recover Time: <span className="text-[var(--color-success)] font-medium">{tx.metadata.recoveryTime || "3.2s"}</span>
                              </div>
                              <div className="text-white">
                                Attempts: <span className="text-[var(--color-text-2)] font-medium">{tx.metadata.attempts || 1}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
