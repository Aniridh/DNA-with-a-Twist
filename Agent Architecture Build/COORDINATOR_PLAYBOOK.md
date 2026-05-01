# Coordinator Playbook — DNA with a Twist

Your job (Ani) across the three Claude Code sessions: bootstrap them, hold the architecture doc as authoritative, merge PRs the reviewer approves, and resolve genuine cross-agent conflicts. You are not writing code. You are the conductor.

---

## Pre-flight (before opening any session)

1. Create a fresh GitHub repo: `dna-with-a-twist`. Private to start.
2. Push the four spec files to `main` in a single commit:
   - `ARCHITECTURE.md` (the architecture doc)
   - `AGENT_BACKEND.md`
   - `AGENT_FRONTEND.md`
   - `AGENT_REVIEWER.md`
3. Create a Supabase project. Save the URL, anon key, and service role key in a password manager. Do not commit them.
4. Reserve domains/accounts:
   - Vercel project `dna-with-a-twist`
   - Fly.io or Render account ready
   - (Optional) custom domain pointed at Vercel

This is 30 minutes of prep that saves hours of agent confusion later.

---

## Session 1: Backend agent

**Open Claude Code in the repo.** First message:

> You are the Backend agent for DNA with a Twist. Read `ARCHITECTURE.md` and `AGENT_BACKEND.md` in the repo root. Confirm you understand your scope, the determinism contract, and your first three PRs. Then open PR #1: `feat/be/canonical-and-hash`. Do not write product code outside `apps/api/**`, `packages/schemas/**`, or `supabase/**`. Do not merge your own PRs.

Give them the Supabase URL and service role key when they ask. Provide a `.env.example` template for the API.

**Headstart:** let backend run for ~15 minutes alone before opening other sessions. Goal: schemas package exists in some form.

---

## Session 2: Frontend agent

**Open a separate Claude Code session in the same repo.** First message:

> You are the Frontend agent for DNA with a Twist. Read `ARCHITECTURE.md` and `AGENT_FRONTEND.md` in the repo root. Confirm you understand your scope, the UI primitives that matter, and your first three PRs. Open PR #1: `feat/fe/scaffold-and-auth`. You own only `apps/web/**`. Build against a mock API until backend ships real endpoints.

Give them the Supabase URL and anon key. Same `.env.example` discipline.

---

## Session 3: Reviewer agent

**Open a third Claude Code session.** First message:

> You are the Reviewer agent for DNA with a Twist. Read `ARCHITECTURE.md` and `AGENT_REVIEWER.md` in the repo root. Confirm you understand your scope and the rejection rules. Open PR #1: `chore/ci-and-tooling` to set up CI before any feature code lands. You own only `tests/**`, CI config, and the README. You do not write product code.

The reviewer never has Supabase credentials. They review code, run tests in CI against a Supabase test project (separate from prod), and write the runbook.

---

## How merges actually work

You are the only one with merge rights to `main`. Workflow:

1. An agent opens a PR.
2. Reviewer agent reviews against `AGENT_REVIEWER.md` rules.
3. If reviewer approves → you merge.
4. If reviewer rejects → the original agent fixes and re-requests review.
5. If two agents disagree on a contract change (e.g., backend wants to change an API surface, frontend depends on the current shape) → both PRs pause, you arbitrate by editing `ARCHITECTURE.md` directly.

Three honest patterns you will hit:

- **Schema drift.** Backend changes a Pydantic model without updating `packages/schemas/` TS mirror. Reviewer should catch this — if they don't, you do.
- **Mock-real mismatch.** Frontend's mock returns `{ hash: string }`, backend returns `{ content_hash: string }`. The reviewer's integration test catches it. The fix is in whichever side diverged from `ARCHITECTURE.md` §3.
- **Determinism regression.** Someone adds `datetime.now()` to a hashed payload. The reviewer's `test_canonical_hash.py` or `test_replay.py` fails. Revert immediately — do not "fix forward."

---

## What to watch for (failure modes)

1. **Reviewer too lenient.** If they're approving everything, push back: "show me the last three PRs where you found a real issue." If they can't, recalibrate by re-reading `AGENT_REVIEWER.md` §"What you reject" out loud to them in their next message.
2. **Backend over-engineering.** They might reach for Celery, K8s, gRPC. Pull them back: "MVP only. `BackgroundTasks` and Fly.io. Read `ARCHITECTURE.md` §1."
3. **Frontend stalling on backend.** They should be 100% productive against the mock for the first 3-4 days. If they say "blocked on backend," they aren't using the mock layer correctly — point them at `AGENT_FRONTEND.md` §"Working before the backend is ready."
4. **Scope creep on scoring.** Backend will be tempted to add AlphaFold or fancy ML. Push back hard: PAM + RS2 + CFD. Anything beyond that is v0.2.
5. **Demo polish in week one.** Avoid this. Week one is plumbing. Polish in week two.

---

## Two-week timeline (aggressive but doable)

**Week 1**
- Day 1: All three sessions opened. Reviewer ships CI. Backend ships canonicalization. Frontend ships scaffold + auth.
- Day 2-3: L1 ingestion endpoints. RO wizard against mock. Determinism tests landed (failing, then passing).
- Day 4-5: L2 RO endpoint. Scoring modules (PAM, RS2, CFD). RO detail and run start pages.
- Day 6-7: L3-L5 wiring. Run page with real SSE. Export pack.

**Week 2**
- Day 8-9: Replay endpoint and compare/replay UI. Determinism badge.
- Day 10: First end-to-end demo on staging. Find what's broken.
- Day 11-12: Polish — hash component, event log animation, prediction table sorting, error states.
- Day 13: Deploy to production Vercel + Fly/Render. Custom domain. Smoke test.
- Day 14: Record the demo. File issues for v0.2 work.

If you slip, cut: the compare view's diff polish, the leaderboard, anything beyond the five required events. Do not cut: the determinism contract, the replay button, the export pack hash. Those *are* the demo.

---

## Daily check-in pattern

Once a day, ask each agent: "What did you ship in the last 24 hours? What's blocking you? What does your next PR look like?" Keep this short — five minutes per agent. The point is to catch drift early, not to micromanage.

---

## Final note

You are running an unusually disciplined build for a student MVP — three agents, hard contracts, append-only tests, deterministic hashing, no scope creep on scoring. The discipline is the moat. The pitch is "we are the system of record for gene editing." If the build itself isn't disciplined, the pitch falls apart in any technical Q&A. Keep the bar high. The reviewer is your ally — back them up when they reject something.
