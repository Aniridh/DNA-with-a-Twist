"use client";

// TODO(packages/schemas): when packages/schemas/ResearchObject.ts lands, hash
// props typed as Sha256 brand should be imported from there. For now: string.

import { cn } from "@/lib/utils";
import { useCopyHash } from "@/lib/hooks/useCopyHash";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface HashProps {
  /** SHA-256 hex string. TODO(packages/schemas): brand as Sha256 when available. */
  hash: string;
  /** Number of chars to show on each side of the ellipsis. Default 6. */
  chars?: number;
  className?: string;
  /** Show a "Verify" button alongside the hash. */
  showVerify?: boolean;
  onVerify?: () => void;
}

/** Middle-truncates a hash string. Pure function — exported for tests. */
export function truncateHash(hash: string, chars: number): string {
  if (hash.length <= chars * 2 + 1) return hash;
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
}

export function Hash({ hash, chars = 6, className, showVerify, onVerify }: HashProps) {
  const { state, copy } = useCopyHash(hash);
  const truncated = truncateHash(hash, chars);
  const isCopied = state === "copied";
  const isCopying = state === "copying";

  return (
    <TooltipProvider delayDuration={300}>
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={copy}
              disabled={isCopying}
              aria-label={isCopied ? "Copied!" : `Copy hash: ${hash}`}
              className={cn(
                "group inline-flex items-center gap-1.5 rounded px-2 py-0.5",
                "font-mono text-xs tabular-nums tracking-tight",
                "border transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isCopied
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-muted-foreground/40"
              )}
            >
              {isCopied ? (
                <>
                  <CheckIcon />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <span>{truncated}</span>
                  <CopyIcon className="opacity-0 group-hover:opacity-60 transition-opacity" />
                </>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-mono text-xs max-w-xs break-all">
            {hash}
          </TooltipContent>
        </Tooltip>

        {showVerify && onVerify && (
          <button
            type="button"
            onClick={onVerify}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors"
          >
            verify
          </button>
        )}
      </span>
    </TooltipProvider>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn("size-3 shrink-0", className)}
      aria-hidden="true"
    >
      <path d="M4 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H6ZM2 6a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 0-2H3V7a1 1 0 0 0-1-1Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3 shrink-0"
      aria-hidden="true"
    >
      <path d="M2.5 8.5 6 12 13.5 4" />
    </svg>
  );
}
