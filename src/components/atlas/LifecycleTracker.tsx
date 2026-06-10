"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface Step {
  label: string;
  status: "idle" | "pending" | "success" | "failed";
  statusText?: string;
}

interface LifecycleTrackerProps {
  steps: Step[];
  className?: string;
}

export default function LifecycleTracker({ steps, className }: LifecycleTrackerProps) {
  return (
    <div className={cn("p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)]", className)}>
      <div className="text-[10px] font-bold text-[var(--color-text-2)] font-mono tracking-wider uppercase mb-4">
        Yellowstone Geyser Stream Status
      </div>

      <div className="flex flex-col relative pl-2">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isPending = step.status === "pending";
          const isSuccess = step.status === "success";
          const isFailed = step.status === "failed";
          const isIdle = step.status === "idle";

          return (
            <div key={index} className="flex gap-4 relative pb-6 last:pb-0 group animate-fade-slide-in">
              {/* Vertical Connector Line */}
              {!isLast && (
                <div
                  className="absolute left-[7px] top-4 w-[2px] h-[calc(100%-4px)] bg-[var(--color-border)]"
                />
              )}

              {/* Step Icon */}
              <div className="z-10 flex items-center justify-center w-4 h-4 mt-0.5">
                {isSuccess && (
                  <div className="w-3.5 h-3.5 rounded-full bg-[var(--color-success)]" />
                )}
                {isFailed && (
                  <div className="w-3.5 h-3.5 rounded-full bg-[var(--color-danger)]" />
                )}
                {isPending && (
                  <div className="w-3.5 h-3.5 rounded-full bg-[var(--color-yellow)] animate-pulse" />
                )}
                {isIdle && (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--color-surface-3)] bg-transparent" />
                )}
              </div>

              {/* Step Content */}
              <div className="flex flex-col justify-start">
                <span
                  className={cn(
                    "text-xs font-mono font-medium tracking-wide",
                    isSuccess && "text-white",
                    isPending && "text-[var(--color-yellow)]",
                    isFailed && "text-[var(--color-danger)]",
                    isIdle && "text-[var(--color-text-3)]"
                  )}
                >
                  {step.label}
                </span>
                {step.statusText && (
                  <span
                    className={cn(
                      "text-[10px] mt-0.5 font-mono",
                      isSuccess && "text-[var(--color-success)]",
                      isPending && "text-[var(--color-text-2)]",
                      isFailed && "text-[var(--color-danger)] font-medium",
                      isIdle && "text-[var(--color-text-3)]"
                    )}
                  >
                    {step.statusText}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
