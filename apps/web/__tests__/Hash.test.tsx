import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { truncateHash, Hash } from "@/components/primitives/Hash";

// ── truncateHash (pure function) ─────────────────────────────────────────────

describe("truncateHash", () => {
  it("returns hash unchanged when shorter than 2×chars+1", () => {
    expect(truncateHash("abcd", 4)).toBe("abcd");
    expect(truncateHash("ab", 4)).toBe("ab");
    expect(truncateHash("abcdefgh", 4)).toBe("abcdefgh"); // exactly 8 = 2×4, no ellipsis
  });

  it("truncates when hash is longer than 2×chars+1", () => {
    expect(truncateHash("abcdefghij", 4)).toBe("abcd…ghij");
  });

  it("truncates 64-char SHA-256 with chars=6 correctly", () => {
    const hash = "9f3ca4e2b87d1f605c3a29e4d81f9b0e3c5d7a2f1e8b4c6d9a0f3e7b2c5d8a1f4";
    const result = truncateHash(hash, 6);
    expect(result).toBe("9f3ca4…d8a1f4");
    expect(result.length).toBe(6 + 1 + 6); // chars + ellipsis + chars
  });

  it("truncates 64-char SHA-256 with chars=4 (architecture doc style)", () => {
    const hash = "9f3ca4e2b87d1f605c3a29e4d81f9b0e3c5d7a2f1e8b4c6d9a0f3e7b2c5d8a1f4";
    const result = truncateHash(hash, 4);
    expect(result).toBe("9f3c…a1f4");
  });

  it("handles empty string", () => {
    expect(truncateHash("", 4)).toBe("");
  });

  it("returns prefix+ellipsis+suffix", () => {
    const result = truncateHash("abcdefghij", 3);
    expect(result).toBe("abc…hij");
  });
});

// ── Hash component copy state machine ───────────────────────────────────────

function installClipboardMock() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    writable: true,
    configurable: true,
  });
  return writeText;
}

describe("Hash copy state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installClipboardMock();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows 'Copied!' and writes full hash to clipboard", async () => {
    const writeText = installClipboardMock();
    const hash = "9f3ca4e2b87d1f605c3a29e4d81f9b0e3c5d7a2f1e8b4c6d9a0f3e7b2c5d8a1f4";
    render(<Hash hash={hash} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(writeText).toHaveBeenCalledWith(hash);
    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });

  it("returns to idle after 2s", async () => {
    render(<Hash hash="9f3ca4e2b87d1f605c3a29" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(screen.getByText("Copied!")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(2100); });
    expect(screen.queryByText("Copied!")).toBeNull();
  });

  it("shows the truncated hash when idle", () => {
    render(<Hash hash="9f3ca4e2b87d1f605c3a29e4d81f9b0e3c5d7a2f1e8b4c6d9a0f3e7b2c5d8a1f4" />);
    expect(screen.getByText("9f3ca4…d8a1f4")).toBeInTheDocument();
  });

  it("calls onVerify when verify button clicked", () => {
    const onVerify = vi.fn();
    render(
      <Hash
        hash="9f3ca4e2b87d1f605c3a29e4d81f9b0e3c5d7a2f1e8b4c6d9a0f3e7b2c5d8a1f4"
        showVerify
        onVerify={onVerify}
      />
    );
    fireEvent.click(screen.getByText("verify"));
    expect(onVerify).toHaveBeenCalledOnce();
  });
});
