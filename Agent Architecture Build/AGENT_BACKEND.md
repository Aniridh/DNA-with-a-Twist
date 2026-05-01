# Backend Agent — Session Brief

**Project:** DNA with a Twist (Provenance Lab)
**Your role:** Backend agent. You own `apps/api/**` and `supabase/**`. You do not touch `apps/web/**`.
**Source of truth:** `ARCHITECTURE.md` in repo root. Read it cover to cover before writing any code. If anything in this brief contradicts `ARCHITECTURE.md`, the architecture doc wins — flag the conflict and stop.

---

## What you are building

A FastAPI service that turns gene-editing inputs into a hashed, immutable Research Object, runs a CRISPR scoring pipeline against it, emits an append-only event log, and produces a verifiable export pack. The wedge is **determinism**: replaying the same RO + prompt must produce a byte-identical prediction. Everything else is secondary.

You are not building suggestion AI. You are building the system of record.

---

## Scope, in priority order

1. **`canonical.py` + hash utilities + tests.** This blocks every other agent. Ship this in the first PR. Sorted keys, ISO-8601 UTC `Z` timestamps, no whitespace, UTF-8. SHA-256 over the canonical bytes.
2. **Supabase migrations** for `research_objects`, `runs`, `provenance_events`, `results`, plus RLS policies that scope every row to `auth.uid()`. Trigger on `provenance_events` that rejects UPDATE and DELETE — append-only is enforced at the DB layer, not just in app code.
3. **Layer 1 — ingestion endpoints.** `POST /api/v1/uploads` accepts FASTA/FASTQ/PDB. Biopython for parsing. PHRED Q20 gate on FASTQ. RCSB fetch for PDB IDs. Server-side SHA-256, never trust the client. Size caps: 10MB FASTA, 100MB FASTQ, 50MB PDB. Extension allowlist. Reject malformed inputs with structured Pydantic error responses, not 500s.
4. **Layer 2 — Research Object endpoint.** `POST /api/v1/research-objects` builds the canonical bundle, computes `content_hash`, writes one immutable row. The hash is the primary user-facing artifact — make it impossible to mutate after creation (no PATCH, no PUT).
5. **Scoring modules** in `apps/api/scoring/`:
   - `pam.py`: regex scan for NGG on both strands, return 20nt guides + position + strand
   - `doench_rs2.py`: use the `azimuth` package if it installs cleanly on Python 3.11; if not, port the Doench 2016 RS2 weights directly. Pure function, no I/O, no time, no randomness. Output `[0, 1]`.
   - `cfd.py`: hardcode the Doench 2016 CFD mismatch matrix as a constant. For each guide, scan the backbone for ≤4-mismatch hits, score each, return top-5.
   - Every scoring module gets a `__version__` string. The run manifest records all three versions.
6. **Layer 3-5 wiring.** `BackgroundTasks` for execution. Emit the five required events (`run.preflight.ok` → `run.extract.features` → `run.simulate.tick` × N → `run.score.emit` × N → `run.summary.done`). Build the export zip with `manifest.json`, `research_object.json`, `prediction.json`, `events.jsonl`, `inputs/`. Compute and store the zip's SHA-256.
7. **SSE endpoint** `GET /api/v1/runs/:id/events` for the frontend to stream. Use `sse-starlette`.
8. **Replay endpoint** `POST /api/v1/runs/:id/replay`. Creates a new run with the same RO and prompt. The reviewer's `test_replay.py` will assert the new run's `prediction.json` hash equals the original's. If it doesn't, you have a determinism bug — find it before merging.

---

## Hard rules (the reviewer will reject PRs that violate these)

- No `dict[str, Any]` in any public response. Every endpoint returns a Pydantic model.
- No `datetime.now()`, `time.time()`, `random.*`, or `uuid4()` inside scoring, canonicalization, or anything that gets hashed. Run timestamps live in the manifest only — they never enter `prediction.json`.
- `mypy --strict` clean. `ruff` clean. No `# type: ignore` without a comment explaining why.
- Every endpoint has at least one happy-path test and one validation-failure test.
- Supabase service role key is server-only. It must not appear in any response, log, or error message.

---

## Tech specifics

- Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2.0 async OR `supabase-py` (your call — pick one and stay consistent).
- `uv` for dependency management (faster than pip, deterministic lockfile).
- Pin every dependency. The env fingerprint in the run manifest is `sha256(pyproject.lock)` — if deps change, the fingerprint changes, and replays after a dep change get a new manifest fingerprint but identical prediction. The reviewer will test this.
- Deploy target: Fly.io or Render. Pick whichever you can ship to in under 30 minutes. Document the choice in the api `README`.

---

## Working with the other agents

- **Frontend:** consumes your API. They will start with mocked responses. The moment your endpoints land in `main`, frontend swaps to real calls. Do not break the API contract in `ARCHITECTURE.md` §4 without a PR to the architecture doc *first*.
- **Reviewer:** writes determinism and replay tests against your code. If a reviewer test fails on your PR, the failure is real — fix the code, don't argue with the test. If you genuinely think the test is wrong, file an issue with a counterexample, don't merge a workaround.

---

## First three PRs you should open

1. `feat/be/canonical-and-hash` — `canonical.py`, hash helpers, unit tests with 100-iteration determinism loop. **Land this within day one.** It unblocks the reviewer.
2. `feat/be/schema-and-migrations` — Supabase migrations + Pydantic models in `packages/schemas/`. Ship the schemas package even if it's mostly empty bodies — frontend needs the types.
3. `feat/be/l1-ingestion` — upload endpoint, FASTA/FASTQ/PDB parsers, validation tests.

After those three land, parallelize: scoring modules and L2 RO endpoint can go simultaneously.

---

## What "done" looks like for the demo

The demo script in `ARCHITECTURE.md` §10 runs end-to-end on a deployed Fly.io/Render instance, with a real Supabase project, against the real Vercel frontend. Click replay → identical hash → green badge. That's the bar.
