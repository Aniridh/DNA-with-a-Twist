"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MockEventStream } from "@/lib/api";
import type { ProvenanceEvent } from "@/lib/types";
import { apiClient } from "@/lib/getApiClient";

export type StreamStatus = "connecting" | "streaming" | "done" | "disconnected";

// Backoff schedule in ms: 1s, 2s, 4s, 8s, 16s, 30s (capped)
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000] as const;
const MAX_BACKOFF = 30000;

export function getBackoffMs(attempt: number): number {
  return attempt < BACKOFF_MS.length ? BACKOFF_MS[attempt] : MAX_BACKOFF;
}

function isMockStream(s: EventSource | MockEventStream): s is MockEventStream {
  return "isMock" in s && s.isMock === true;
}

export interface UseRunEventsResult {
  events: ProvenanceEvent[];
  status: StreamStatus;
  /** Seconds until next reconnect attempt. Only set when status === 'disconnected'. */
  reconnectIn: number | null;
  /** Force-disconnects the current stream. Used for testing and the dev page. */
  disconnect: () => void;
}

export function useRunEvents(runId: string): UseRunEventsResult {
  const [events, setEvents] = useState<ProvenanceEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [reconnectIn, setReconnectIn] = useState<number | null>(null);

  const attemptRef = useRef(0);
  const unmountedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setReconnectIn(null);
  }, []);

  const scheduleReconnect = useCallback(
    (connect: () => void) => {
      const delayMs = getBackoffMs(attemptRef.current);
      const delaySec = Math.ceil(delayMs / 1000);
      attemptRef.current++;

      setReconnectIn(delaySec);
      let remaining = delaySec;

      countdownRef.current = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearCountdown();
          if (!unmountedRef.current) connect();
        } else {
          setReconnectIn(remaining);
        }
      }, 1000);
    },
    [clearCountdown]
  );

  const disconnect = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    clearCountdown();
    if (!unmountedRef.current) setStatus("disconnected");
  }, [clearCountdown]);

  useEffect(() => {
    unmountedRef.current = false;
    attemptRef.current = 0;

    function connect() {
      if (unmountedRef.current) return;

      setStatus("connecting");
      const stream = apiClient.streamRunEvents(runId);

      if (isMockStream(stream)) {
        const unsub = stream.subscribe(
          (event) => {
            if (unmountedRef.current) return;
            setStatus("streaming");
            setEvents((prev) => [...prev, event]);
          },
          () => {
            if (unmountedRef.current) return;
            setStatus("done");
            clearCountdown();
            attemptRef.current = 0;
          }
        );
        cleanupRef.current = unsub;
      } else {
        const es = stream as EventSource;

        es.onopen = () => {
          if (unmountedRef.current) return;
          setStatus("streaming");
          attemptRef.current = 0;
          clearCountdown();
        };

        es.onmessage = (e: MessageEvent) => {
          if (unmountedRef.current) return;
          try {
            const event = JSON.parse(e.data as string) as ProvenanceEvent;
            setEvents((prev) => [...prev, event]);
            if (event.event_type === "run.summary.done") {
              setStatus("done");
              es.close();
            }
          } catch {
            // malformed event — skip
          }
        };

        es.onerror = () => {
          if (unmountedRef.current) return;
          es.close();
          setStatus("disconnected");
          scheduleReconnect(connect);
        };

        cleanupRef.current = () => es.close();
      }
    }

    connect();

    return () => {
      unmountedRef.current = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      clearCountdown();
    };
  }, [runId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { events, status, reconnectIn, disconnect };
}
