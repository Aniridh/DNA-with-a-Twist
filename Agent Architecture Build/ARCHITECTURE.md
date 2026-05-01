# DNA with a Twist — Provenance Lab — MVP Architecture & Agent Coordination Spec

**Status:** Source of truth. Every agent (Frontend, Backend, Review) reads this before any work.
**Scope:** Layers 1–2 production-grade. Layers 3–5 stubbed but wired end-to-end so the demo loop closes.
**Wedge:** Verification, not suggestion. The MVP must prove `upload → hash → run → export → replay (identical hash)`.

---

## 1. Locked Technical Decisions

| Area | Decision |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui |
| Backend | FastAPI, Python 3.11, Pydantic v2 |
| DB / Auth / Storage | Supabase (Postgres + Auth + Storage) |
| Background runs | FastAPI `BackgroundTasks` for MVP. Upgrade path: Prefect or Celery. |
| Hashing | SHA-256 over canonical JSON (sorted keys, ISO-8601 UTC `Z` timestamps) |
| Scoring (real, CPU-only) | PAM regex (SpCas9 NGG) → Doench Rule Set 2 (on-target) → CFD score (off-target) |
| Deploy | Vercel (web) + Fly.io or Render (api) + Supabase managed |
| Domain | Custom domain via Vercel DNS config |

**Out of scope for MVP:** AlphaFold/structural prediction, multi-tenant teams, billing, LLM "suggest an edit" features, real wet-lab integration.

---

## 2. Repo Layout (file ownership is enforced)

```
dna-with-a-twist/
├── apps/
│   ├── web/                    ← FRONTEND AGENT owns
│   │   ├── app/                  ← Next.js routes
│   │   ├── components/           ← shadcn-based UI
│   │   ├── lib/
│   │   │   ├── api.ts              ← typed client (consumes packages/schemas)
│   │   │   └── supabase.ts         ← browser client
│   │   └── package.json
│   │
│   └── api/                    ← BACKEND AGENT owns
│       ├── routers/              ← FastAPI route handlers
│       ├── pipeline/
│       │   ├── ingest.py           ← L1: FASTA/FASTQ/PDB parse + validate
│       │   ├── research_object.py  ← L2: canonicalize + hash
│       │   ├── run.py              ← L3: manifest + execution
│       │   ├── provenance.py       ← L4: event emitter
│       │   └── export.py           ← L5: bundle zip + signed URL
│       ├── scoring/
│       │   ├── pam.py              ← NGG scan
│       │   ├── doench_rs2.py       ← on-target ML model
│       │   └── cfd.py              ← off-target mismatch score
│       ├── models/                 ← SQLAlchemy or Supabase client models
│       ├── canonical.py            ← canonical JSON serializer (CRITICAL)
│       └── pyproject.toml
│
├── packages/
│   └── schemas/                ← SHARED CONTRACT — generated, no hand edits
│       ├── ResearchObject.ts/.py
│       ├── Run.ts/.py
│       ├── ProvenanceEvent.ts/.py
│       └── Result.ts/.py
│
├── supabase/
│   └── migrations/             ← BACKEND AGENT owns
│
├── tests/                      ← REVIEW AGENT owns
│   ├── test_canonical_hash.py    ← determinism gate
│   ├── test_scoring.py           ← scoring sanity
│   └── test_replay.py            ← end-to-end replay test
│
├── ARCHITECTURE.md             ← this file
└── README.md
```

**Ownership rule:** Frontend agent never edits `apps/api/**` or `supabase/**`. Backend agent never edits `apps/web/**`. Both read `packages/schemas/**`. Review agent owns `tests/**` and gates merges to `main`.

**Sample data:** Lives in `tests/fixtures/` (Review agent owns). Backend agent must not create `apps/api/sample_data/` — if it exists, delete it and move files to `tests/fixtures/`.

**Merge authority:** Review agent approves PRs. Coordinator merges to `main`. No agent merges its own PR. No agent approves another agent's PR without Review agent sign-off.

---

## 3. Data Models (the contract)

All four models live in `packages/schemas/` and are mirrored in TS and Pydantic. Backend writes the Pydantic source; types are codegen'd to TS via `datamodel-code-generator` or hand-mirrored for MVP.

```python
class ResearchObject(BaseModel):
    id: UUID
    content_hash: str                    # SHA-256 of canonical bundle, hex
    backbone_ref: StorageRef             # Supabase storage path
    backbone_sha256: str
    target_pdb_ref: StorageRef | None
    target_pdb_sha256: str | None
    fastq_ref: StorageRef | None
    fastq_phred_pass_pct: float | None   # % bases >= Q20
    pam: Literal["NGG"] = "NGG"          # SpCas9 only for MVP
    metadata: dict[str, str]
    created_at: datetime                 # UTC, ISO-8601 Z
    created_by: UUID                     # supabase auth user id

class Run(BaseModel):
    id: UUID
    ro_id: UUID                          # FK
    prompt: str                          # natural-language intended edit
    status: Literal["queued", "running", "done", "failed"]
    manifest: RunManifest                # see below
    created_at: datetime
    finished_at: datetime | None

class RunManifest(BaseModel):
    git_sha: str                         # backend code git ref
    api_version: str
    scoring_versions: dict[str, str]     # {"doench_rs2": "1.0", "cfd": "1.0"}
    started_at: datetime
    env_fingerprint: str                 # SHA-256 of pinned dep versions

class ProvenanceEvent(BaseModel):
    id: UUID
    run_id: UUID
    seq: int                             # monotonic per run, gap-free
    event_type: str                      # see Section 5 vocabulary
    payload: dict
    emitted_at: datetime
    # APPEND-ONLY. Never updated. Reviewer enforces.

class Result(BaseModel):
    run_id: UUID
    prediction: PredictionPayload
    export_pack_ref: StorageRef | None   # populated when L5 finishes
    export_pack_sha256: str | None

class PredictionPayload(BaseModel):
    guides: list[GuideCandidate]
    summary: dict                        # top score, mean off-target, etc.

class GuideCandidate(BaseModel):
    sequence: str                        # 20nt
    pam: str                             # 3nt
    position: int
    strand: Literal["+", "-"]
    on_target_score: float               # Doench RS2, [0, 1]
    off_target_count: int
    off_target_top_hits: list[OffTargetHit]
    bystander_warnings: list[str]
```

---

## 4. API Contract

| Method | Path | Purpose | Body / Returns |
|---|---|---|---|
| POST | `/api/v1/uploads` | Upload raw file (FASTA/FASTQ/PDB) | multipart → `{file_id, sha256, kind}` |
| POST | `/api/v1/research-objects` | Build canonical RO from uploads | `{backbone_id, fastq_id?, pdb_id?, metadata}` → `ResearchObject` |
| GET | `/api/v1/research-objects/:id` | Fetch RO | `ResearchObject` |
| POST | `/api/v1/runs` | Start a run | `{ro_id, prompt}` → `{run_id, status_url}` |
| GET | `/api/v1/runs/:id` | Run state + last N events | `Run + recent events` |
| GET | `/api/v1/runs/:id/events` | Stream events (SSE) | text/event-stream |
| GET | `/api/v1/runs/:id/result` | Final prediction | `Result` |
| GET | `/api/v1/runs/:id/export` | Signed download URL for export pack | `{url, expires_at, sha256}` |
| POST | `/api/v1/runs/:id/replay` | Re-run same RO + prompt | `{new_run_id}` (must produce identical result hash) |

All responses are `Pydantic` validated. No `dict[str, Any]` in public surface. Reviewer rejects PRs that violate this.

---

## 5. Provenance Event Vocabulary (fixed for MVP)

Every run emits **at least** these events in this order:

1. `run.preflight.ok` — inputs validated, hashes recorded
2. `run.extract.features` — RO unpacked, target region identified
3. `run.simulate.tick` — one or more, simulation step (stubbed: just iterates over guide candidates)
4. `run.score.emit` — one per guide candidate, with on/off-target scores
5. `run.summary.pending` → `run.summary.done` — final aggregation

Reviewer enforces: ≥5 events per successful run, monotonic `seq`, append-only.

---

## 6. The Determinism Contract (the core of the demo)

This is what makes "Provenance Lab" credible. **Two separate runs with the same RO and same prompt MUST produce byte-identical `prediction.json`.** The replay button proves it.

Rules:
1. `apps/api/canonical.py` is the single canonicalization point. Sorts keys, formats timestamps as ISO-8601 UTC with `Z`, no whitespace, UTF-8, NFC-normalized Unicode.
2. RO `content_hash = sha256(canonical_json(bundle))` where `bundle` is **exactly** `{backbone_sha256, target_pdb_sha256, fastq_sha256, pam, metadata}` — no other fields. Any PR that adds a field to the hashed bundle requires an architecture PR to this doc first. Reviewer enforces.
3. Scoring functions are pure: `score(sequence, params) → float`, no time, no randomness, no I/O. `datetime.now()`, `random.*`, and unseeded `uuid4()` are rejected **only when they appear inside hashed payloads or canonicalization paths** — they are permitted in non-hashed paths (e.g., signed URL generation, run ID creation).
4. Run timestamps go in the manifest, **not** in the prediction. The prediction itself is timestamp-free so its hash is stable.
5. Replay-stability applies to **`prediction.json` and `research_object.json` only**. `manifest.json` and `events.jsonl` legitimately differ between runs (they contain run UUIDs and timestamps). `test_replay.py` asserts byte-equality on those two files only, not on the zip overall.

---

## 7. Layer-by-Layer Implementation Notes

### Layer 1 — Ingestion & Validation (production-grade)
- **FASTA:** Biopython `SeqIO.parse`, validate alphabet `{A,T,G,C,N}`, reject duplicate headers, max length 1Mb for MVP
- **FASTQ:** PHRED gate at Q20 default, report % pass; reject if <50% pass
- **PDB/mmCIF:** parse with `Bio.PDB`, OR fetch from RCSB by ID via `https://files.rcsb.org/download/{id}.pdb`
- All raw uploads stored in Supabase Storage, SHA-256 computed server-side, never trust client hash

### Layer 2 — Research Object (production-grade)
- Build canonical bundle: `{backbone_sha256, target_pdb_sha256, fastq_sha256, pam, metadata}`
- `content_hash = sha256(canonical_json(bundle))`
- One Postgres row, immutable. UI shows full hash, copy-to-clipboard, "verify" button (recomputes from refs)

### Layer 3 — Run Manifest (stubbed but real)
- `BackgroundTasks` kicks off `pipeline.run.execute(run_id)`
- Manifest captures git sha, api version, scoring lib versions, env fingerprint
- Status transitions emit `ProvenanceEvent`s

### Layer 4 — Provenance + Scoring (real scoring, stubbed simulation)
- **PAM scan:** find all NGG sites on both strands of the backbone, return guide candidates (20nt + PAM)
- **On-target (Doench RS2):** use `azimuth` package (or reimplement weights from Doench 2016). Outputs [0,1].
- **Off-target (CFD):** for each guide, scan backbone for ≤4-mismatch hits, compute CFD score per hit using Doench 2016 mismatch matrix. Aggregate top-5 hits.
- **Bystander:** flag adjacent C/A bases within editing window if base editor is implied (parse from prompt; for MVP just emit empty list).
- Emit `run.score.emit` per guide with the computed scores.

### Layer 5 — Export Pack
- Build `export.zip` containing:
  - `manifest.json` (RunManifest)
  - `research_object.json` (full RO)
  - `prediction.json` (Result.prediction, canonical)
  - `events.jsonl` (one ProvenanceEvent per line, in seq order)
  - `inputs/` (copies of original FASTA/FASTQ/PDB)
- Compute SHA-256 of the zip, store, return signed URL with 1h expiry

---

## 8. Frontend Pages (Frontend Agent scope)

| Route | Purpose |
|---|---|
| `/` | Landing + auth gate (Supabase magic link) |
| `/dashboard` | List of user's ROs and runs |
| `/research-objects/new` | 3-step wizard: upload → review → confirm hash |
| `/research-objects/:id` | RO detail: hash, refs, runs that used it |
| `/runs/new?ro=:id` | Prompt entry, "Start Run" |
| `/runs/:id` | Live event log (SSE), then prediction view + export button |
| `/runs/:id/compare/:other` | Side-by-side diff (proves replay determinism) |

**UI primitives that matter:**
- Hash display component: monospace, truncated middle, copy button, full-on-hover
- Event log: timestamped, color-coded per event_type, autoscroll
- Prediction table: sortable by on-target score, off-target count
- Determinism badge: green checkmark + "Replayed: hash matches" on `/runs/:id`

---

## 9. Review Agent Checklist (gates merges to `main`)

**Schema integrity**
- [ ] All public response types are Pydantic models, not `dict`
- [ ] `packages/schemas/` is in sync with `apps/api/models/`
- [ ] Frontend uses generated types, not hand-rolled interfaces

**Determinism (the single most important gate)**
- [ ] `test_canonical_hash.py` passes: same input → same hash, 100 iterations
- [ ] `test_replay.py` passes: replay produces byte-identical `prediction.json`
- [ ] No `datetime.now()` in scoring, canonicalization, or export logic
- [ ] No `random` without explicit seed, no `uuid4()` inside hashed payloads

**Provenance**
- [ ] Every run emits ≥5 events
- [ ] Events are append-only (no UPDATE in `provenance_events` table; enforced by RLS or trigger)
- [ ] Export pack reconstructs the run from events + RO

**Security**
- [ ] Supabase RLS enabled on all user-scoped tables
- [ ] Storage signed URLs, never public buckets
- [ ] File size cap (default 10MB FASTA, 100MB FASTQ) and extension allowlist
- [ ] No service role key in frontend

**UX gates**
- [ ] Hash visible everywhere a user makes a claim
- [ ] Run page updates without refresh (SSE working)
- [ ] Export button produces a downloadable file that opens

---

## 10. Demo Script (the loop that has to work)

1. Sign in with magic link
2. Upload `BCL11A_enhancer.fasta` (sample provided in `apps/api/sample_data/`)
3. Optionally enter PDB ID `7T1B` for Cas9 structure (auto-fetched)
4. Click "Create Research Object" → see SHA-256 hash, e.g. `9f3c…e21a`
5. Enter prompt: *"Disrupt GATA1 binding site at +58 enhancer"*
6. Click "Run" → event log streams: preflight → extract → simulate ×N → score ×N → summary
7. Prediction view: top 5 guides ranked by on-target score, with off-target counts
8. Click "Export Pack" → download `dnatwist_run_<id>.zip`, verify SHA matches displayed hash
9. Click "Replay" → identical prediction hash. Determinism badge turns green.

This is the 3-minute demo that proves the thesis.

---

## 11. Suggested Build Order (per agent, parallel)

**Backend agent (week 1)**
1. Supabase project + schema migrations + RLS
2. `canonical.py` + hash utilities + tests (BLOCKING for everyone)
3. L1 ingestion endpoints + tests
4. L2 RO creation + hash + tests
5. Scoring modules (PAM, Doench RS2, CFD) + unit tests
6. L3-L5 wired with stubbed simulate, real scoring, real export

**Frontend agent (week 1, can start day 1)**
1. Auth flow with Supabase
2. Dashboard skeleton
3. RO upload wizard (calls real API once L1 is live)
4. Run page with SSE consumer (mock SSE stream until backend ready)
5. Prediction view + export download
6. Compare/replay view

**Review agent (continuous)**
1. **[BLOCKING — must land before backend PR #1 opens]** Set up CI: ruff, mypy strict, pytest, vitest. Branch protection on `main` requiring CI pass. Coordinator enforces this sequence.
2. Write `test_canonical_hash.py` and `test_replay.py` first — these gate everything
3. PR review against checklist in §9
4. Owns README + sample data (`tests/fixtures/`) + deploy runbook

---

## 12. Working Agreements Between Agents

- Schema changes are PRs to `packages/schemas/` first, then implementations follow.
- API surface changes require updating §4 in this doc in the same PR.
- No agent merges its own PR; review agent gates `main`.
- Determinism tests must pass on every PR. If they break, that PR is the one that broke them — bisect from there.

---

*End of spec. Questions, ambiguities, or proposed changes go in a PR to this file before code lands.*
