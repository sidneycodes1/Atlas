"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Activity, ShieldCheck, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIInterventionPanelProps {
  isActive: boolean;
  phase: "analyzing" | "planning" | "executing" | "complete" | "failed" | "idle";
  observation?: string;
  reasoning?: string;
  decision?: string;
  actionType?: string;
  statusMessage?: string;
  className?: string;
}

export default function AIInterventionPanel({
  isActive,
  phase,
  observation,
  reasoning,
  decision,
  actionType,
  statusMessage,
  className,
}: AIInterventionPanelProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      return;
    }

    // Progress bar animation: map phases to target progress thresholds
    let target = 0;
    if (phase === "analyzing") target = 20;
    else if (phase === "planning") target = 50;
    else if (phase === "executing") target = 85;
    else if (phase === "complete") target = 100;
    else if (phase === "failed") target = 100;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < target) return Math.min(prev + 2, target);
        if (prev > target) return prev - 1;
        return prev;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [isActive, phase]);

  if (!isActive) return null;

  return (
    <div
      className={cn(
        "border-[1.5px] border-[var(--color-yellow-border)] bg-[var(--color-yellow-dim)] rounded-[var(--radius-lg)] p-5 flex flex-col gap-4 animate-fade-slide-in relative overflow-hidden",
        "shadow-[0_0_20px_rgba(240,201,58,0.1)]",
        className
      )}
    >
      {/* Decorative pulse background */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--color-yellow)]/5 rounded-full blur-xl pointer-events-none animate-pulse-custom" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-2 text-[var(--color-yellow)] font-mono text-xs font-bold tracking-wider">
          <Sparkles className="w-4 h-4 animate-spin-slow" />
          <span>✦ ATLAS SHADOW AGENT INTERVENTION</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--color-text-2)]">
          <Activity className="w-3 h-3 animate-pulse text-[var(--color-yellow)]" />
          <span className="uppercase">{phase}...</span>
        </div>
      </div>

      {/* Grid columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        {/* Left Column: Diagnostics */}
        <div className="flex flex-col gap-3 bg-black/30 p-3 rounded-[var(--radius-md)] border border-[var(--color-border)]">
          <div className="text-[10px] text-[var(--color-yellow)] uppercase font-bold tracking-wide flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" /> DIAGNOSTICS & TELEMETRY
          </div>
          <div className="flex flex-col gap-2">
            <div>
              <span className="text-[var(--color-text-2)] font-bold">OBSERVATION:</span>
              <p className={cn("text-[var(--color-text)] mt-1 min-h-[30px]", phase === "planning" && "cursor-blink")}>
                {observation || statusMessage || "Awaiting validator failure logs..."}
              </p>
            </div>
            {reasoning && (
              <div className="animate-fade-slide-in">
                <span className="text-[var(--color-text-2)] font-bold">REASONING:</span>
                <p className="text-[var(--color-text)] mt-1 leading-relaxed">{reasoning}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Execution */}
        <div className="flex flex-col gap-3 bg-black/30 p-3 rounded-[var(--radius-md)] border border-[var(--color-border)]">
          <div className="text-[10px] text-[var(--color-yellow)] uppercase font-bold tracking-wide flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> SELF-HEALING ACTION
          </div>
          <div className="flex flex-col gap-2">
            <div>
              <span className="text-[var(--color-text-2)] font-bold">DECISION:</span>
              <p className="text-[var(--color-text)] mt-1 min-h-[30px]">{decision || "Evaluating optimal healing path..."}</p>
            </div>
            {actionType && (
              <div className="mt-2 p-2 bg-[var(--color-yellow-dim)] border border-[var(--color-yellow-border)] rounded-[var(--radius-sm)] text-[var(--color-yellow)] flex flex-col gap-1 animate-fade-slide-in">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-2)]">ACTIVE PLAN:</span>
                <span className="font-bold text-white text-xs tracking-wider uppercase font-mono">
                  {actionType.replace("_", " ")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex flex-col gap-1.5 mt-2">
        <div className="flex justify-between text-[9px] text-[var(--color-text-2)] font-mono">
          <span>RECOVERY ENGINE PROGRESS</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-1 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-yellow)] transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
