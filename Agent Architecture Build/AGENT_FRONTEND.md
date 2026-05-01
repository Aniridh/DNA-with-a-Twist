# Frontend Agent — Session Brief

**Project:** DNA with a Twist (Provenance Lab)
**Your role:** Frontend agent. You own `apps/web/**`. You do not touch `apps/api/**` or `supabase/**`.
**Source of truth:** `ARCHITECTURE.md` in repo root. Read it before writing code. If anything here conflicts with the architecture doc, the architecture doc wins — flag it and stop.

---

## What you are building

A Next.js 14 app (App Router, TypeScript, Tailwind, shadcn/ui) that lets a scientist upload gene-editing inputs, watch them collapse into a hashed Research Object, kick off a simulation run, watch the event log stream in real time, view the prediction, download a verifiable export pack, and replay the run to prove determinism.

The product's whole pitch is "verifiable AI." The UI must reinforce that on every screen. Hashes are the hero. If a screen doesn't show a hash somewhere, it's wrong.

---

## Scope, in priority order

1. **Auth.** Supabase magic-link sign-in. Wrap the app in an auth gate so unauthenticated users hit `/`.
2. **Dashboard** at `/dashboard` — list of the user's Research Objects and Runs. Empty state CTA: "Create your first Research Object."
3. **RO upload wizard** at `/research-objects/new` — three steps: upload files → review parsed metadata → confirm and create. The third step shows the computed `content_hash` returned by the backend, with a copy button. This is the moment the product earns its name; treat the hash reveal like a feature, not an afterthought.
4. **RO detail** at `/research-objects/:id` — full hash, file refs (download links via signed URLs), list of runs that used this RO.
5. **Run start** at `/runs/new?ro=:id` — prompt textarea, "Start Run" button. On submit, navigate to `/runs/:id`.
6. **Run page** at `/runs/:id` — three stacked panels:
   - Top: run status, RO hash, manifest (git sha, scoring versions, env fingerprint)
   - Middle: live event log via SSE from `GET /api/v1/runs/:id/events`. Color-coded by event_type. Autoscroll. Don't drop events on tab blur.
   - Bottom: when status flips to `done`, render the prediction table — guides ranked by on-target score, with off-target counts, expandable rows showing top-5 off-target hits.
7. **Export button** on the run page — calls `GET /api/v1/runs/:id/export`, follows the signed URL, triggers download. Show the export pack's SHA-256 next to the button.
8. **Compare/replay view** at `/runs/:id/compare/:other` — side-by-side prediction diff. If hashes match, show a giant green "Replayed: hash matches" badge. This is the demo's punchline — make it look good.

---

## Hard rules

- **TypeScript strict.** No `any`. No `as unknown as Foo`. Use the generated types from `packages/schemas/`.
- **No client-side service role key.** Anon key only. The backend handles all privileged operations.
- **No business logic in the frontend.** The frontend is a view layer. Do not compute hashes, do not parse FASTA, do not score guides. If you find yourself wanting to, that work belongs in the backend.
- **Every fetch goes through `lib/api.ts`** with typed request/response. Don't sprinkle raw `fetch` calls across components.
- **Never block the UI on slow operations.** Run start → immediate navigation to run page → SSE shows progress. No spinners that lock the screen.
- **Accessibility:** keyboard nav for the wizard, focus management on route changes, alt text on every visual.

---

## UI primitives that need real care

These are the components the demo lives or dies on. Spend time on them.

- **`<Hash>`** — monospace, truncated middle (`9f3c…e21a`), copy-to-clipboard on click, full hash in tooltip on hover, optional "verify" CTA. Use this everywhere a hash appears.
- **`<EventLog>`** — virtualized list, color per event_type, timestamp per row, autoscroll with a "pause autoscroll" toggle when the user scrolls up. Reconnect SSE on disconnect with exponential backoff.
- **`<PredictionTable>`** — sortable columns, expandable rows, sticky header. Top guide highlighted.
- **`<DeterminismBadge>`** — when on the compare view, animates from gray (checking) to green (match) or red (mismatch). The animation matters. This is the moment the pitch lands.
- **`<ManifestCard>`** — git sha, api version, scoring versions, env fingerprint, started_at. Compact but legible.

---

## Working before the backend is ready

You can and should start day one. Strategy:

1. Read `ARCHITECTURE.md` §3 (data models) and §4 (API contract).
2. Build a `lib/mockApi.ts` that satisfies the same TypeScript interface as `lib/api.ts` and returns hand-written fixtures matching the schema. Use it via an env flag (`NEXT_PUBLIC_USE_MOCK_API=1`).
3. Build every page and every primitive against the mock. Make the SSE mock emit events on a timer so the event log is exercised.
4. The day backend ships its endpoints, flip the flag. If anything breaks, the mock and real API disagreed — fix the mock or file an issue against the backend, don't paper over it.

---

## Tech specifics

- Next.js 14 App Router, React Server Components where they make sense (read-only pages, RO detail).
- Tailwind + shadcn/ui. Don't introduce a second component library.
- `@supabase/ssr` for auth; `@tanstack/react-query` for data fetching and caching.
- SSE: native `EventSource`. If you reach for a library, justify it in the PR.
- Deploy: Vercel. Custom domain config goes in the web `README`.

---

## First three PRs you should open

1. `feat/fe/scaffold-and-auth` — Next.js scaffold, Tailwind, shadcn/ui setup, Supabase auth flow, protected dashboard route. Land day one.
2. `feat/fe/mock-api-and-primitives` — `lib/api.ts` interface, `lib/mockApi.ts` implementation, `<Hash>`, `<EventLog>`, `<ManifestCard>`, `<PredictionTable>`, `<DeterminismBadge>`. Stories or Ladle for each.
3. `feat/fe/ro-wizard-and-run-page` — full RO upload wizard against the mock, run page with mock SSE.

After those, parallelize: replay/compare view and polish work go together.

---

## What "done" looks like for the demo

The demo script in `ARCHITECTURE.md` §10 runs end-to-end on production Vercel with the real backend on Fly/Render. The replay step ends with the green determinism badge. That's the bar. The rest of the UI exists to make that moment land.
