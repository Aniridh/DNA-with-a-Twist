import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeterminismBadge } from "@/components/primitives/DeterminismBadge";

// chars=8 → "9f3ca4e2…c5d8a1f4" (last 6 of HASH_A are "d8a1f4", so last 8 = "c5d8a1f4")
const HASH_A = "9f3ca4e2b87d1f605c3a29e4d81f9b0e3c5d7a2f1e8b4c6d9a0f3e7b2c5d8a1f4";
// chars=8 → "1a2b3c4d…9e0f1a2b"
const HASH_B = "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b";

describe("DeterminismBadge state rendering", () => {
  it("renders checking state with accessible label", () => {
    render(<DeterminismBadge state="checking" />);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-label", "Verifying determinism");
    expect(screen.getByText("Verifying hashes…")).toBeInTheDocument();
  });

  it("renders match state with success label and message", () => {
    render(<DeterminismBadge state="match" hashA={HASH_A} />);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-label", "Determinism verified: hashes match");
    expect(screen.getByText("Hashes match — determinism verified")).toBeInTheDocument();
  });

  it("renders mismatch state with alert role", () => {
    render(<DeterminismBadge state="mismatch" hashA={HASH_A} hashB={HASH_B} />);
    const el = screen.getByRole("alert");
    expect(el).toHaveAttribute("aria-label", "Determinism failure: hashes do not match");
    expect(screen.getByText("Hash mismatch — non-deterministic output")).toBeInTheDocument();
  });

  it("shows hashA copy button in match state", () => {
    render(<DeterminismBadge state="match" hashA={HASH_A} />);
    // Hash renders a button whose aria-label contains the full hash
    expect(
      screen.getByRole("button", { name: `Copy hash: ${HASH_A}` })
    ).toBeInTheDocument();
  });

  it("shows both hash copy buttons in mismatch state", () => {
    render(<DeterminismBadge state="mismatch" hashA={HASH_A} hashB={HASH_B} />);
    expect(
      screen.getByRole("button", { name: `Copy hash: ${HASH_A}` })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Copy hash: ${HASH_B}` })
    ).toBeInTheDocument();
  });

  it("shows 'expected' and 'got' labels in mismatch state", () => {
    render(<DeterminismBadge state="mismatch" hashA={HASH_A} hashB={HASH_B} />);
    expect(screen.getByText("expected")).toBeInTheDocument();
    expect(screen.getByText("got")).toBeInTheDocument();
  });

  it("does not show hash content in checking state when no hash passed", () => {
    render(<DeterminismBadge state="checking" />);
    expect(screen.queryByText("expected")).toBeNull();
    expect(screen.queryByText("got")).toBeNull();
  });
});

describe("DeterminismBadge state transitions", () => {
  it("transitions from checking to match on prop change", () => {
    const { rerender } = render(<DeterminismBadge state="checking" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Verifying determinism");
    rerender(<DeterminismBadge state="match" hashA={HASH_A} />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Determinism verified: hashes match"
    );
  });

  it("transitions from checking to mismatch on prop change", () => {
    const { rerender } = render(<DeterminismBadge state="checking" />);
    rerender(<DeterminismBadge state="mismatch" hashA={HASH_A} hashB={HASH_B} />);
    expect(screen.getByRole("alert")).toHaveAttribute(
      "aria-label",
      "Determinism failure: hashes do not match"
    );
  });

  it("transitions back to checking from match", () => {
    const { rerender } = render(<DeterminismBadge state="match" hashA={HASH_A} />);
    rerender(<DeterminismBadge state="checking" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Verifying determinism");
  });
});
