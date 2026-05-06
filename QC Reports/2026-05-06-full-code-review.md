# Full Code Review — DNA with a Twist
**Date:** 2026-05-06
**Reviewer:** Reviewer Agent (commit d0097e3)
**Scope:** All files on `main` against ARCHITECTURE.md §9 checklist

---

## Fixed in this session (Reviewer scope)

| Commit | Change |
|--------|--------|
| `8bdaa85` | All 35 ruff lint + format violations in `tests/**` resolved |
| `d0097e3` | `pyproject.toml` ruff config: removed zombie ANN101/ANN102 rules, added ANN401 suppression for canonical.py + SSE generator |

---

## P0 — Blocks demo (Frontend agent action required)

### 1. Compare page proves the wrong thing
**File:** `apps/web/app/(protected)/runs/[id]/compare/[other]/page.tsx:29-32`

```typescript
const match =
  a.manifest?.env_fingerprint === b.manifest?.env_fingerprint &&
  a.manifest?.git_sha === b.manifest?.git_sha;
```

The determinism badge shows "Prediction hash matches bit-for-bit" but never compares predictions.
A non-deterministic pipeline producing different guides under the same environment would still
show the green badge. False positive on the core demo claim.

**Fix:** Fetch both results via `apiClient.getResult()`, compare `export_pack_sha256` or
`prediction.guides` directly. The manifest check can stay as a secondary check, but prediction
equality must be the primary assertion.

---

### 2. RO wizard displays wrong hash + incompatible with real API
**File:** `apps/web/app/(protected)/research-objects/new/page.tsx:22-27, 129-138`

`computeHash()` computes `sha256(stripped_fasta_sequence)`. The UI labels this
"SHA-256 content hash." But `content_hash` is actually `sha256(canonical_json({backbone_sha256, pam, metadata, ...}))` — completely different values.

Also: the wizard passes `backbone_upload_id: "demo"` to the real API. The real API returns 422
`upload_not_found`. The wizard has no file upload step, making it entirely incompatible with
the real API path.

**Fix:**
- Add a file upload step (call `POST /api/v1/uploads`, get `file_id`)
- Remove client-side `computeHash` — the server returns the real `content_hash` in the response
- If mock mode must show a preview hash, label it "preview (not final)" until server confirms

---

## P1 — §9 Checklist violations

### 3. `dict[str, Any]` in public responses (Backend agent)
**File:** `apps/api/routers/runs.py:83, 87, 109`

```python
class RunResponse(BaseModel):
    manifest: dict[str, Any] | None        # should be RunManifestOut
    recent_events: list[dict[str, Any]]    # should be list[ProvenanceEventOut]

class PredictionPayloadOut(BaseModel):
    summary: dict[str, Any]               # should be typed PredictionSummary
```

ARCHITECTURE.md §9: "All public response types are Pydantic models, not `dict`."

**Fix:** Define `RunManifestOut`, `ProvenanceEventOut`, and `PredictionSummary` Pydantic models.
Use them in the response classes. `packages/schemas/` already has the TS mirror — Pydantic
models just need to match.

---

### 4. SSE stream missing Authorization header (Frontend agent)
**File:** `apps/web/lib/realApi.ts:97-99`

```typescript
streamRunEvents(runId: string): EventSource | MockEventStream {
  return new EventSource(`${BASE}/api/v1/runs/${runId}/events`);
}
```

`EventSource` does not support custom headers. The backend SSE endpoint requires
`Authorization: Bearer {token}`. This returns 401 on the real API. Hidden by mock mode
(`NEXT_PUBLIC_USE_MOCK_API=true` in `.env.local`).

**Fix:** Replace `EventSource` with `fetch()` + `ReadableStream` (or the `eventsource` npm
package which accepts a `headers` option).

---

### 5. CI ruff/mypy guards still bypassed (Backend agent — then Reviewer removes guards)
**File:** `.github/workflows/ci.yml:42, 46, 52, 54`

The `|| true` guards were placeholders until `apps/api/pyproject.toml` shipped. Backend has
shipped. Running `ruff check apps/api` today finds **14 errors**:

```
apps/api/canonical.py:39           UP017  Use datetime.UTC alias
apps/api/pipeline/run.py:267       B007   Loop var `label` unused (use `_`)
apps/api/pipeline/run.py:317       F841   Local var `exc` unused
apps/api/routers/research_objects.py:3   F401   uuid.UUID unused
apps/api/routers/research_objects.py:8   F401   StorageRef unused
apps/api/routers/research_objects.py:191 E501   Line too long
apps/api/routers/runs.py:52        E501   Line too long
apps/api/routers/runs.py:141       E501   Line too long
apps/api/routers/uploads.py:3      F401   uuid unused
apps/api/routers/uploads.py:12     F401   StorageRef unused
apps/api/routers/uploads.py:113    E501   Line too long
apps/api/scoring/cfd.py:18         F401   re unused
apps/api/scoring/cfd.py:112        B905   zip() without strict=
apps/api/scoring/cfd.py:128        B905   zip() without strict=
```

Also: `ruff format --check apps/api` would reformat 16 files.

**Backend fix:** Run `ruff check apps/api --fix` for the auto-fixable ones, manually fix B007
and E501. **Reviewer will then remove the `|| true` guards from CI.**

---

## P2 — Code quality

### 6. `mockApi.ts` injects `run_id` into `prediction.json` (Frontend agent)
**File:** `apps/web/lib/mockApi.ts:327-330`

```javascript
zip.file("prediction.json", JSON.stringify({
  run_id: runId,  // §6 rule 4 violation
  guides: MOCK_GUIDES,
  summary: { ... },
}))
```

§6 rule 4: prediction must be timestamp-free and contain no run IDs. The real backend is
correct. The mock export teaches the wrong shape to anyone building against it.

**Fix:** Remove `run_id` from the mock's `prediction.json`.

---

### 7. Auth dependency triplicated (Backend agent)
`get_current_user_id` is defined identically in `uploads.py`, `research_objects.py`, and
`runs.py`. One auth bug needs three fixes.

**Fix:** Extract to `apps/api/auth.py`, import from there.

---

### 8. `# noqa: BLE001` without issue link (Backend agent)
**File:** `apps/api/pipeline/run.py:317`

Policy (AGENT_REVIEWER.md): any `# noqa` without an issue link is a rejection criterion.
The suppression is correct (top-level except in BackgroundTask); it needs documentation.

**Fix:** Add inline comment: `# noqa: BLE001 — top-level catch in BackgroundTask; re-raises after status update`

---

### 9. Missing list endpoints in real API client (Backend or Frontend agent)
**File:** `apps/web/lib/realApi.ts:65-68, 77-78`

`listResearchObjects()` calls `GET /api/v1/research-objects` and `listRuns()` calls
`GET /api/v1/runs`. Neither endpoint exists in the backend. Both return 404 in production.

**Fix (Backend):** Add the list endpoints.
OR **Fix (Frontend):** Remove the calls from `realApi.ts` until backend ships them.

---

## Pending Reviewer work

- [ ] Remove `|| true` guards from CI once backend fixes ruff (blocked)
- [ ] `test_scoring.py` — add Doench RS2 reference values from 2016 paper + CFD matrix spot-checks
- [ ] `scripts/seed_demo.py` — demo user, RO, and run for screen-record
- [ ] `CONTRIBUTING.md`
