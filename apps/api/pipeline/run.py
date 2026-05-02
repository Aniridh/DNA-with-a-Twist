"""
L3-L5 pipeline execution — called from BackgroundTasks.

Flow:
  1. Set run status → running, build + store RunManifest.
  2. Emit run.preflight.ok
  3. Download backbone, parse sequences → emit run.extract.features
  4. PAM scan → one run.simulate.tick per guide candidate
  5. Score each guide (Doench RS2 + CFD off-target) → one run.score.emit per guide
  6. Emit run.summary.pending
  7. Build PredictionPayload (timestamp-free — replay-stable)
  8. Build export zip, upload, compute SHA-256
  9. Write Result row
 10. Emit run.summary.done
 11. Set run status → done

On any exception: set status → failed (does not re-raise).

HARD RULES (ARCHITECTURE.md §6):
  - No datetime.now(), random, uuid4() inside PredictionPayload or canonical paths.
  - Guides sorted deterministically before serialisation.
  - prediction.json must be timestamp-free and replay-identical for same RO + prompt.
"""
import hashlib
import io
import json
import os
import subprocess
import zipfile
from datetime import UTC, datetime

from Bio import SeqIO  # type: ignore[import-untyped]

from canonical import canonical_json
from models.db import service_client
from scoring.cfd import __version__ as cfd_version
from scoring.cfd import scan_off_targets
from scoring.doench_rs2 import __version__ as rs2_version
from scoring.doench_rs2 import score as rs2_score
from scoring.pam import __version__ as pam_version
from scoring.pam import scan as pam_scan

_EXPORTS_BUCKET = "exports"


# ── Manifest helpers ──────────────────────────────────────────────────────────


def _git_sha() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL, text=True
        ).strip()
    except Exception:
        return "unknown"


def _env_fingerprint() -> str:
    """sha256(uv.lock) — changes when any pinned dep changes."""
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "..", "uv.lock"),
        os.path.join(os.path.dirname(__file__), "..", "uv.lock"),
    ]
    for path in candidates:
        try:
            with open(os.path.abspath(path), "rb") as f:
                return hashlib.sha256(f.read()).hexdigest()
        except FileNotFoundError:
            continue
    return hashlib.sha256(b"").hexdigest()


def _build_manifest(started_at: datetime) -> dict[str, object]:
    return {
        "git_sha": _git_sha(),
        "api_version": "0.1.0",
        "scoring_versions": {
            "pam": pam_version,
            "doench_rs2": rs2_version,
            "cfd": cfd_version,
        },
        "started_at": started_at.isoformat(),
        "env_fingerprint": _env_fingerprint(),
    }


# ── Storage helpers ───────────────────────────────────────────────────────────


def _download(bucket: str, path: str) -> bytes:
    return service_client().storage.from_(bucket).download(path)  # type: ignore[no-any-return]


def _filename_from_path(path: str) -> str:
    return os.path.basename(path)


# ── Main execution ────────────────────────────────────────────────────────────


def execute(run_id: str) -> None:
    """Pipeline entry point — called from FastAPI BackgroundTasks."""
    db = service_client()

    seq_counter = 0  # tracks monotonic seq for provenance_events inserts

    def emit(event_type: str, payload: dict[str, object]) -> None:
        nonlocal seq_counter
        seq_counter += 1
        db.table("provenance_events").insert(
            {
                "run_id": run_id,
                "seq": seq_counter,
                "event_type": event_type,
                "payload": payload,
            }
        ).execute()

    started_at = datetime.now(UTC)

    try:
        # ── Step 1: transition to running ─────────────────────────────────────
        manifest = _build_manifest(started_at)
        db.table("runs").update(
            {"status": "running", "manifest": manifest}
        ).eq("id", run_id).execute()

        # ── Step 2: fetch run + RO ────────────────────────────────────────────
        run_row = db.table("runs").select("*").eq("id", run_id).single().execute().data
        ro_row = (
            db.table("research_objects")
            .select("*")
            .eq("id", run_row["ro_id"])
            .single()
            .execute()
            .data
        )

        # ── Step 3: preflight ─────────────────────────────────────────────────
        emit(
            "run.preflight.ok",
            {
                "run_id": run_id,
                "ro_id": str(ro_row["id"]),
                "content_hash": ro_row["content_hash"],
            },
        )

        # ── Step 4: download + parse backbone ─────────────────────────────────
        backbone_ref: dict[str, str] = ro_row["backbone_ref"]
        backbone_bytes = _download(backbone_ref["bucket"], backbone_ref["path"])
        fasta_records = list(
            SeqIO.parse(io.StringIO(backbone_bytes.decode("utf-8", errors="replace")), "fasta")
        )
        backbone_seq = "".join(str(r.seq) for r in fasta_records)

        emit(
            "run.extract.features",
            {
                "sequence_count": len(fasta_records),
                "total_length": len(backbone_seq),
                "backbone_sha256": ro_row["backbone_sha256"],
            },
        )

        # ── Step 5: PAM scan → simulate.tick per candidate ────────────────────
        pam_hits = pam_scan(backbone_seq)

        for hit in pam_hits:
            emit(
                "run.simulate.tick",
                {
                    "sequence": hit.sequence,
                    "pam": hit.pam,
                    "position": hit.position,
                    "strand": hit.strand,
                },
            )

        # ── Step 6: score + off-target scan → score.emit per guide ───────────
        scored_guides: list[dict[str, object]] = []

        for hit in pam_hits:
            on_target = rs2_score(hit.sequence)
            off_hits = scan_off_targets(hit.sequence, backbone_seq)

            guide_data: dict[str, object] = {
                "sequence": hit.sequence,
                "pam": hit.pam,
                "position": hit.position,
                "strand": hit.strand,
                "on_target_score": on_target,
                "off_target_count": len(off_hits),
                "off_target_top_hits": [
                    {
                        "sequence": h.sequence,
                        "position": h.position,
                        "mismatches": h.mismatches,
                        "cfd_score": h.cfd_score,
                    }
                    for h in off_hits
                ],
                "bystander_warnings": [],  # MVP: empty; base-editor parsing deferred
            }
            scored_guides.append(guide_data)
            emit("run.score.emit", guide_data)

        # ── Step 7: summary.pending ───────────────────────────────────────────
        emit("run.summary.pending", {"guide_count": len(scored_guides)})

        # ── Step 8: build PredictionPayload (TIMESTAMP-FREE — replay-stable) ──
        # Sort guides deterministically: position asc, then strand, then sequence.
        scored_guides.sort(key=lambda g: (g["position"], g["strand"], g["sequence"]))  # type: ignore[arg-type]

        top_score = max((g["on_target_score"] for g in scored_guides), default=0.0)  # type: ignore[misc]
        mean_off = (
            sum(g["off_target_count"] for g in scored_guides) / len(scored_guides)  # type: ignore[arg-type]
            if scored_guides
            else 0.0
        )

        prediction_payload: dict[str, object] = {
            "guides": scored_guides,
            "summary": {
                "guide_count": len(scored_guides),
                "top_on_target_score": top_score,
                "mean_off_target_count": mean_off,
            },
        }

        # canonical JSON of the prediction — used for SHA-256 and export
        prediction_json_bytes = canonical_json(prediction_payload).encode("utf-8")

        # ── Step 9: build RO JSON (replay-stable; no runtime-generated fields) ─
        ro_export: dict[str, object] = {
            "id": str(ro_row["id"]),
            "content_hash": ro_row["content_hash"],
            "backbone_sha256": ro_row["backbone_sha256"],
            "target_pdb_sha256": ro_row["target_pdb_sha256"],
            "fastq_sha256": ro_row["fastq_sha256"],
            "fastq_phred_pass_pct": ro_row["fastq_phred_pass_pct"],
            "pam": ro_row["pam"],
            "metadata": ro_row["metadata"],
        }
        ro_json_bytes = canonical_json(ro_export).encode("utf-8")

        # ── Step 10: fetch events for events.jsonl ────────────────────────────
        events_rows = (
            db.table("provenance_events")
            .select("*")
            .eq("run_id", run_id)
            .order("seq")
            .execute()
            .data
        )
        events_jsonl = "\n".join(json.dumps(e, default=str) for e in events_rows).encode("utf-8")

        # ── Step 11: build export zip ─────────────────────────────────────────
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("manifest.json", json.dumps(manifest, indent=2))
            zf.writestr("research_object.json", ro_json_bytes.decode("utf-8"))
            zf.writestr("prediction.json", prediction_json_bytes.decode("utf-8"))
            zf.writestr("events.jsonl", events_jsonl.decode("utf-8"))

            # inputs/ — raw uploaded files
            for label, ref_key in (
                ("backbone", "backbone_ref"),
                ("fastq", "fastq_ref"),
                ("structure", "target_pdb_ref"),
            ):
                ref = ro_row.get(ref_key)
                if ref:
                    try:
                        file_bytes = _download(ref["bucket"], ref["path"])  # type: ignore[index]
                        fname = _filename_from_path(ref["path"])  # type: ignore[arg-type]
                        zf.writestr(f"inputs/{fname}", file_bytes)
                    except Exception:
                        pass  # non-fatal: input file may have been GC'd

        zip_bytes = zip_buf.getvalue()
        zip_sha256 = hashlib.sha256(zip_bytes).hexdigest()

        # ── Step 12: upload export zip ────────────────────────────────────────
        export_path = f"{run_row['ro_id']}/{run_id}/export.zip"
        service_client().storage.from_(_EXPORTS_BUCKET).upload(
            path=export_path,
            file=zip_bytes,
            file_options={"content-type": "application/zip", "upsert": "false"},
        )

        # ── Step 13: write Result ─────────────────────────────────────────────
        db.table("results").insert(
            {
                "run_id": run_id,
                "prediction": json.loads(prediction_json_bytes),
                "export_pack_ref": {"bucket": _EXPORTS_BUCKET, "path": export_path},
                "export_pack_sha256": zip_sha256,
            }
        ).execute()

        # ── Step 14: summary.done ─────────────────────────────────────────────
        emit(
            "run.summary.done",
            {
                "export_pack_sha256": zip_sha256,
                "guide_count": len(scored_guides),
                "top_on_target_score": top_score,
            },
        )

        # ── Step 15: mark done ────────────────────────────────────────────────
        db.table("runs").update(
            {"status": "done", "finished_at": datetime.now(UTC).isoformat()}
        ).eq("id", run_id).execute()

    except Exception as exc:  # noqa: BLE001
        db.table("runs").update(
            {"status": "failed", "finished_at": datetime.now(UTC).isoformat()}
        ).eq("id", run_id).execute()
        raise  # let BackgroundTasks log it
