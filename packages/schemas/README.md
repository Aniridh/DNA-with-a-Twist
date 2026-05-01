# packages/schemas

Shared type contract between the Python API and the TypeScript frontend.

## Source of truth

**Pydantic is the source of truth.** TypeScript mirrors are hand-maintained for
MVP. Codegen (`datamodel-code-generator`) is a v0.2 task.

| File | Language | Status |
|---|---|---|
| `ResearchObject.py` | Python (Pydantic v2) | Source of truth |
| `ResearchObject.ts` | TypeScript | Hand-mirrored |
| `Run.py` / `Run.ts` | — | Lands in PR #2 (schema-and-migrations) |
| `ProvenanceEvent.py` / `.ts` | — | Lands in PR #2 |
| `Result.py` / `.ts` | — | Lands in PR #2 |

## Drift policy

Drift between `.py` and `.ts` is caught by the Reviewer agent's CI type-check
(schema-sync job in `.github/workflows/ci.yml`).

Rules:
1. Schema changes are PRs to `packages/schemas/` **first**. Implementations follow.
2. Any change to a `.py` file here must be mirrored in the corresponding `.ts`
   file in the same PR.
3. API surface changes require updating `ARCHITECTURE.md §4` in the same PR.

## TypeScript branding

Hash fields use an opaque brand type (`Sha256`) to catch confusion bugs at
compile time. This is a frontend-only convention — it is not mirrored back to
Pydantic.

```typescript
type Sha256 = string & { readonly __brand: "Sha256" };
```

Branded fields in `ResearchObject`:
- `content_hash: Sha256`
- `backbone_sha256: Sha256`
- `target_pdb_sha256: Sha256 | null`
- `fastq_sha256: Sha256 | null`
