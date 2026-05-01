"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Hash } from "@/components/primitives/Hash";

export type DeterminismState = "checking" | "match" | "mismatch";

export interface DeterminismBadgeProps {
  state: DeterminismState;
  hashA?: string;
  hashB?: string;
  className?: string;
}

export function DeterminismBadge({ state, hashA, hashB, className }: DeterminismBadgeProps) {
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [state]);

  return (
    <div
      key={animKey}
      role={state === "mismatch" ? "alert" : "status"}
      aria-label={
        state === "checking"
          ? "Verifying determinism"
          : state === "match"
          ? "Determinism verified: hashes match"
          : "Determinism failure: hashes do not match"
      }
      className={cn(
        "rounded-lg border p-4 transition-colors",
        state === "checking" && "border-dashed border-slate-300 bg-slate-50 animate-pulse-gentle dark:border-slate-700 dark:bg-slate-900",
        state === "match" && "border-emerald-300 bg-emerald-50 animate-verdict-match dark:border-emerald-700 dark:bg-emerald-950",
        state === "mismatch" && "border-red-300 bg-red-50 animate-verdict-mismatch dark:border-red-700 dark:bg-red-950",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {state === "checking" && <SpinnerIcon />}
        {state === "match" && <CheckMarkIcon />}
        {state === "mismatch" && <CrossMarkIcon />}

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-semibold",
              state === "checking" && "text-slate-600 dark:text-slate-400",
              state === "match" && "text-emerald-700 dark:text-emerald-300",
              state === "mismatch" && "text-red-700 dark:text-red-300"
            )}
          >
            {state === "checking" && "Verifying hashes…"}
            {state === "match" && "Hashes match — determinism verified"}
            {state === "mismatch" && "Hash mismatch — non-deterministic output"}
          </p>

          {state === "match" && hashA && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <Hash hash={hashA} chars={8} />
            </div>
          )}

          {state === "mismatch" && (
            <div className="mt-2 space-y-1 text-xs">
              {hashA && (
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-slate-500">expected</span>
                  <Hash hash={hashA} chars={8} />
                </div>
              )}
              {hashB && (
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-red-500">got</span>
                  <Hash hash={hashB} chars={8} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="size-5 shrink-0 animate-spin text-slate-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function CheckMarkIcon() {
  return (
    <svg
      className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M4 13 9 18 20 7"
        strokeDasharray="30"
        strokeDashoffset="0"
        className="animate-draw-check"
      />
    </svg>
  );
}

function CrossMarkIcon() {
  return (
    <svg
      className="size-5 shrink-0 text-red-600 dark:text-red-400"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6 18 18" strokeDasharray="22" strokeDashoffset="0" className="animate-draw-cross" />
      <path d="M18 6 6 18" strokeDasharray="22" strokeDashoffset="0" className="animate-draw-cross" />
    </svg>
  );
}
