"use client";

import { useCallback, useRef, useState } from "react";

export type CopyState = "idle" | "copying" | "copied" | "error";

export function useCopyHash(hash: string) {
  const [state, setState] = useState<CopyState>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async () => {
    if (state === "copying" || state === "copied") return;
    setState("copying");
    try {
      await navigator.clipboard.writeText(hash);
      setState("copied");
    } catch {
      setState("error");
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setState("idle"), 2000);
    }
  }, [hash, state]);

  return { state, copy };
}
