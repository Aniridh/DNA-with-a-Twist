"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Hash } from "@/components/primitives/Hash";
import { apiClient } from "@/lib/getApiClient";
import type { ResearchObject } from "@schemas/ResearchObject";
import type { UploadResponse } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

type UploadedFile = UploadResponse & { name: string; sizeBytes: number };

interface WizardState {
  backbone: UploadedFile | null;
  fastq: UploadedFile | null;
  pdb: UploadedFile | null;
  metadata: { key: string; value: string }[];
}

type Step = "upload" | "review" | "creating" | "done";

// ── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ["Upload files", "Review", "Hash reveal"] as const;

function StepIndicator({ current }: { current: Step }) {
  const idx = current === "upload" ? 0 : current === "review" ? 1 : 2;
  return (
    <ol className="flex items-center gap-0">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                i < idx && "border-primary bg-primary text-primary-foreground",
                i === idx && "border-primary bg-primary text-primary-foreground",
                i > idx && "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {i < idx ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "text-sm",
                i === idx ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "mx-3 h-px w-8 shrink-0",
                i < idx ? "bg-primary" : "bg-muted-foreground/20"
              )}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

// ── File slot ────────────────────────────────────────────────────────────────

function FileSlot({
  label,
  accept,
  required,
  uploaded,
  uploading,
  onChange,
}: {
  label: string;
  accept: string;
  required?: boolean;
  uploaded: UploadedFile | null;
  uploading: boolean;
  onChange: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
        {!required && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
      </label>

      {uploaded ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-950">
          <FileIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-emerald-800 dark:text-emerald-200">
              {uploaded.name}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {formatBytes(uploaded.sizeBytes)}
            </p>
          </div>
          <Hash hash={uploaded.sha256} chars={5} />
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => ref.current?.click()}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8",
            "text-sm text-muted-foreground transition-colors",
            uploading
              ? "cursor-not-allowed opacity-50"
              : "hover:border-muted-foreground/50 hover:text-foreground cursor-pointer"
          )}
        >
          {uploading ? (
            <>
              <SpinnerIcon className="size-5 animate-spin" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <UploadIcon className="size-5" />
              <span>Click to select {label.toLowerCase()} file</span>
              <span className="text-xs opacity-60">{accept}</span>
            </>
          )}
        </button>
      )}

      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onChange(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ── Metadata editor ──────────────────────────────────────────────────────────

function MetadataEditor({
  pairs,
  onChange,
}: {
  pairs: { key: string; value: string }[];
  onChange: (pairs: { key: string; value: string }[]) => void;
}) {
  function update(i: number, field: "key" | "value", val: string) {
    const next = pairs.map((p, idx) => (idx === i ? { ...p, [field]: val } : p));
    onChange(next);
  }

  function remove(i: number) {
    onChange(pairs.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Metadata</label>
      <div className="space-y-2">
        {pairs.map((pair, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="key"
              value={pair.key}
              onChange={(e) => update(i, "key", e.target.value)}
              className="h-9 flex-1 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              type="text"
              placeholder="value"
              value={pair.value}
              onChange={(e) => update(i, "value", e.target.value)}
              className="h-9 flex-1 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Remove field"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...pairs, { key: "", value: "" }])}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        + Add field
      </button>
    </div>
  );
}

// ── Hash reveal ──────────────────────────────────────────────────────────────

function HashReveal({ ro }: { ro: ResearchObject }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center animate-hash-reveal">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
        <CheckCircleIcon className="size-8 text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="space-y-1">
        <p className="text-lg font-semibold">Research Object created</p>
        <p className="text-sm text-muted-foreground">
          Your inputs are now permanently identified by this content hash.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Content hash
        </p>
        <div className="rounded-xl border bg-muted/40 px-6 py-4">
          <Hash hash={ro.content_hash} chars={12} className="text-base" />
        </div>
        <p className="text-xs text-muted-foreground max-w-xs">
          This hash covers your backbone, target PDB, and FASTQ (if provided), plus PAM and metadata.
          Anyone with this hash can verify the exact inputs that produced any run.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href={`/research-objects/${ro.id}`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          View Research Object
        </Link>
        <Link
          href={`/runs/new?ro=${ro.id}`}
          className={cn(buttonVariants())}
        >
          Start a Run →
        </Link>
      </div>
    </div>
  );
}

// ── Main wizard page ─────────────────────────────────────────────────────────

export default function NewResearchObjectPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [wizard, setWizard] = useState<WizardState>({
    backbone: null,
    fastq: null,
    pdb: null,
    metadata: [
      { key: "organism", value: "" },
      { key: "gene", value: "" },
    ],
  });
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [createdRO, setCreatedRO] = useState<ResearchObject | null>(null);

  const uploadFile = useCallback(
    async (slot: "backbone" | "fastq" | "pdb", file: File) => {
      setUploading((u) => ({ ...u, [slot]: true }));
      setError(null);
      try {
        const result = await apiClient.uploadFile(file);
        setWizard((w) => ({
          ...w,
          [slot]: { ...result, name: file.name, sizeBytes: file.size },
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading((u) => ({ ...u, [slot]: false }));
      }
    },
    []
  );

  const canProceedToReview =
    wizard.backbone !== null && !Object.values(uploading).some(Boolean);

  async function handleCreate() {
    if (!wizard.backbone) return;
    setStep("creating");
    setError(null);
    try {
      const metadata = Object.fromEntries(
        wizard.metadata.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value.trim()])
      );
      const ro = await apiClient.createResearchObject({
        backbone_upload_id: wizard.backbone.file_id,
        fastq_upload_id: wizard.fastq?.file_id,
        pdb_upload_id: wizard.pdb?.file_id,
        metadata,
      });
      setCreatedRO(ro);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Research Object");
      setStep("review");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Research Object</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your experimental inputs to create a permanently identified, verifiable record.
        </p>
      </div>

      <StepIndicator current={step} />

      <div className="rounded-xl border bg-card p-6">
        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className="space-y-6">
            <FileSlot
              label="Backbone FASTA"
              accept=".fasta,.fa,.fna"
              required
              uploaded={wizard.backbone}
              uploading={uploading.backbone ?? false}
              onChange={(f) => uploadFile("backbone", f)}
            />
            <FileSlot
              label="FASTQ"
              accept=".fastq,.fastq.gz,.fq"
              uploaded={wizard.fastq}
              uploading={uploading.fastq ?? false}
              onChange={(f) => uploadFile("fastq", f)}
            />
            <FileSlot
              label="Target PDB"
              accept=".pdb"
              uploaded={wizard.pdb}
              uploading={uploading.pdb ?? false}
              onChange={(f) => uploadFile("pdb", f)}
            />

            <MetadataEditor
              pairs={wizard.metadata}
              onChange={(m) => setWizard((w) => ({ ...w, metadata: m }))}
            />

            {error && <ErrorBanner message={error} />}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canProceedToReview}
                onClick={() => setStep("review")}
                className={cn(buttonVariants(), !canProceedToReview && "opacity-50 cursor-not-allowed")}
              >
                Review →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {step === "review" && wizard.backbone && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Files
              </h2>
              <ReviewFile label="Backbone FASTA" file={wizard.backbone} />
              {wizard.fastq && <ReviewFile label="FASTQ" file={wizard.fastq} />}
              {wizard.pdb && <ReviewFile label="Target PDB" file={wizard.pdb} />}
            </div>

            {wizard.metadata.some((p) => p.key.trim()) && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Metadata
                </h2>
                <dl className="divide-y rounded-lg border">
                  {wizard.metadata
                    .filter((p) => p.key.trim())
                    .map((p) => (
                      <div key={p.key} className="flex gap-4 px-4 py-2 text-sm">
                        <dt className="w-32 shrink-0 text-muted-foreground">{p.key}</dt>
                        <dd className="font-mono">{p.value || <span className="text-muted-foreground italic">empty</span>}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            )}

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Creating a Research Object is permanent.
              </p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                The content hash locks these exact file hashes and metadata. You cannot edit them after creation.
              </p>
            </div>

            {error && <ErrorBanner message={error} />}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep("upload")}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className={cn(buttonVariants())}
              >
                Create Research Object
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3a: Creating ── */}
        {step === "creating" && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <SpinnerIcon className="size-8 animate-spin text-muted-foreground" />
            <div>
              <p className="font-medium">Computing content hash…</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Canonicalizing inputs and recording provenance
              </p>
            </div>
          </div>
        )}

        {/* ── Step 3b: Done ── */}
        {step === "done" && createdRO && <HashReveal ro={createdRO} />}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ReviewFile({ label, file }: { label: string; file: UploadedFile }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border px-4 py-3">
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">{label} · {formatBytes(file.sizeBytes)}</p>
      </div>
      <Hash hash={file.sha256} chars={6} />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

// ── Utilities ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Icons ────────────────────────────────────────────────────────────────────

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cn("size-5", className)} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cn("size-4", className)} aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("size-8", className)} aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
