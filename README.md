# DNA with a Twist — Provenance Lab

> Upload a gene editing experiment. Get a verifiable, replayable prediction with a cryptographic audit trail.

**Status:** Active development — MVP in progress.  
**Architecture spec:** [`Agent Architecture Build/ARCHITECTURE.md`](Agent%20Architecture%20Build/ARCHITECTURE.md)

---

## What it does

1. Upload a FASTA/FASTQ backbone and optionally a PDB structure
2. System creates a Research Object with a SHA-256 content hash
3. Run a guide RNA prediction (PAM scan → Doench RS2 on-target → CFD off-target)
4. Export a signed, timestamped provenance pack (manifest + prediction + events)
5. **Replay** the run — identical prediction hash, every time. That's the demo.

---

## Merge authority

> **Reviewer approves. Coordinator merges. No exceptions.**

- Review agent is the only agent that approves PRs.
- Coordinator (`jajajadagoat`) is the only account that merges to `main`.
- No agent merges its own PR.
- CI must be green before any merge. Branch protection enforces this.

If you are the Backend or Frontend agent and your PR is sitting unapproved, ping the Review agent — do not merge unilaterally.

---

## Local setup (15 minutes)

> **Note:** This section will be filled in once the first backend and frontend features land. The structure below is the target state.

### Prerequisites

- Python 3.11+
- Node 20+
- A Supabase project (see `.env.example` when it lands)
- `git clone` this repo

### 1. Python environment

```bash
cd apps/api
pip install -e ".[dev]"
```

### 2. Frontend

```bash
cd apps/web
npm install
```

### 3. Environment variables

```bash
cp .env.example .env.local
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

### 4. Database

```bash
# Apply Supabase migrations
npx supabase db push
```

### 5. Run locally

```bash
# Terminal 1 — API
cd apps/api && uvicorn main:app --reload

# Terminal 2 — Web
cd apps/web && npm run dev
```

### 6. Run tests

```bash
# Unit tests (no backend required)
pytest tests/ -m "not integration"

# Integration tests (requires running backend + Supabase)
pytest tests/ -m integration
```

### 7. Demo script

Follow [`ARCHITECTURE.md §10`](Agent%20Architecture%20Build/ARCHITECTURE.md) — sign in, upload `tests/fixtures/BCL11A_enhancer.fasta`, run, replay. Replay hash must match.

---

## Repository structure

```
dna-with-a-twist/
├── apps/
│   ├── api/          ← Backend (FastAPI, Python 3.11) — Backend agent
│   └── web/          ← Frontend (Next.js 14, TypeScript) — Frontend agent
├── packages/
│   └── schemas/      ← Shared Pydantic/TS types — generated, no hand-edits
├── tests/            ← All tests + fixtures — Review agent
│   └── fixtures/     ← Sample data (FASTA, FASTQ, PDB refs)
├── supabase/
│   └── migrations/   ← DB migrations — Backend agent
├── .github/
│   └── workflows/    ← CI — Review agent
└── pyproject.toml    ← Python tooling config (ruff, mypy, pytest)
```

---

## CI

GitHub Actions runs on every PR to `main`:

| Job | What it checks |
|---|---|
| `python-checks` | ruff lint + format, mypy strict, pytest (unit tests) |
| `frontend-checks` | tsc type-check, vitest (when `apps/web/package.json` exists) |
| `schema-sync` | TS/Python schema mirror consistency |
| `integration-tests` | replay determinism, provenance append-only (main branch only) |

**All jobs must be green before merge.** Red CI = no merge, no exceptions.

---

## Contributing

See `CONTRIBUTING.md` (coming when first features land). Short version: open a PR, wait for Review agent approval, coordinator merges.

---

*For the full architecture, determinism contract, and demo script, read [`ARCHITECTURE.md`](Agent%20Architecture%20Build/ARCHITECTURE.md).*
