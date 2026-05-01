import { describe, it, expect } from "vitest";
import { getBackoffMs } from "@/lib/hooks/useRunEvents";

// Tests for the pure backoff utility exported from useRunEvents.
// The hook itself requires a live React environment + EventSource/MockEventStream;
// those are exercised on /dev/primitives.

describe("getBackoffMs", () => {
  it("returns 1000ms for attempt 0", () => {
    expect(getBackoffMs(0)).toBe(1000);
  });

  it("returns 2000ms for attempt 1", () => {
    expect(getBackoffMs(1)).toBe(2000);
  });

  it("returns 4000ms for attempt 2", () => {
    expect(getBackoffMs(2)).toBe(4000);
  });

  it("returns 8000ms for attempt 3", () => {
    expect(getBackoffMs(3)).toBe(8000);
  });

  it("returns 16000ms for attempt 4", () => {
    expect(getBackoffMs(4)).toBe(16000);
  });

  it("caps at 30000ms for attempt 5", () => {
    expect(getBackoffMs(5)).toBe(30000);
  });

  it("caps at 30000ms for any attempt beyond the schedule", () => {
    expect(getBackoffMs(10)).toBe(30000);
    expect(getBackoffMs(100)).toBe(30000);
  });

  it("never exceeds 30000ms", () => {
    for (let i = 0; i < 20; i++) {
      expect(getBackoffMs(i)).toBeLessThanOrEqual(30000);
    }
  });

  it("is monotonically non-decreasing up to the cap", () => {
    let prev = 0;
    for (let i = 0; i < 6; i++) {
      const ms = getBackoffMs(i);
      expect(ms).toBeGreaterThanOrEqual(prev);
      prev = ms;
    }
  });
});
