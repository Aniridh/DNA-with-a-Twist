/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ApiClient, MockEventStream } from "./api";
import type { ResearchObject, Sha256 } from "@schemas/ResearchObject";
import type {
  CreateRORequest,
  CreateRunRequest,
  CreateRunResponse,
  ExportResponse,
  GuideCandidate,
  ProvenanceEvent,
  ProvenanceEventType,
  ReplayResponse,
  Result,
  Run,
  RunStatus,
  UploadResponse,
} from "./types";

// ── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";
const MOCK_RO_ID = "ro-00000000-0000-0000-0000-000000000001";
const MOCK_RUN_ID = "run-00000000-0000-0000-0000-000000000001";

const MOCK_CONTENT_HASH =
  "9f3ca4e2b87d1f605c3a29e4d81f9b0e3c5d7a2f1e8b4c6d9a0f3e7b2c5d8a1f4";

const MOCK_GUIDES: GuideCandidate[] = [
  {
    sequence: "GATAAGCTTAGCGTAACGTA",
    pam: "NGG",
    position: 58,
    strand: "+",
    on_target_score: 0.87,
    off_target_count: 3,
    off_target_top_hits: [
      { sequence: "GATAAGCTTAGCGTAACGTT", position: 1420, mismatches: 1, cfd_score: 0.21 },
      { sequence: "GATAAGCTTAGCCTAACGTA", position: 3890, mismatches: 1, cfd_score: 0.18 },
      { sequence: "GATAAGCTTAGCGTAACGTC", position: 7234, mismatches: 1, cfd_score: 0.09 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "CTAGGCTTAAGCGTACGTAA",
    pam: "CGG",
    position: 142,
    strand: "+",
    on_target_score: 0.72,
    off_target_count: 7,
    off_target_top_hits: [
      { sequence: "CTAGGCTTAAGCGTACGTAC", position: 2100, mismatches: 1, cfd_score: 0.31 },
    ],
    bystander_warnings: ["C at position +5 within editing window"],
  },
  {
    sequence: "TTGACGAATCGGATAGCCAT",
    pam: "TGG",
    position: 301,
    strand: "-",
    on_target_score: 0.65,
    off_target_count: 1,
    off_target_top_hits: [],
    bystander_warnings: [],
  },
  {
    sequence: "AACGTTCAGTACGGACTTAG",
    pam: "AGG",
    position: 450,
    strand: "+",
    on_target_score: 0.54,
    off_target_count: 12,
    off_target_top_hits: [
      { sequence: "AACGTTCAGTACGGACTTAC", position: 890, mismatches: 1, cfd_score: 0.44 },
      { sequence: "AACGTTCAGTATGGACTTAG", position: 5610, mismatches: 1, cfd_score: 0.38 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "GCATTAGCGTAAGGCCTTAT",
    pam: "GGG",
    position: 622,
    strand: "-",
    on_target_score: 0.41,
    off_target_count: 0,
    off_target_top_hits: [],
    bystander_warnings: [],
  },
];

const MOCK_RO: ResearchObject = {
  id: MOCK_RO_ID,
  content_hash: MOCK_CONTENT_HASH as Sha256,
  backbone_ref: { bucket: "uploads", path: "BCL11A_enhancer.fasta" },
  backbone_sha256: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2" as Sha256,
  target_pdb_ref: null,
  target_pdb_sha256: null,
  fastq_ref: null,
  fastq_sha256: null,
  fastq_phred_pass_pct: null,
  pam: "NGG",
  metadata: { organism: "Homo sapiens", gene: "BCL11A", enhancer: "+58" },
  created_at: "2026-04-30T12:00:00Z",
  created_by: MOCK_USER_ID,
};

const SSE_SEQUENCE: Array<{ type: ProvenanceEventType; payload: Record<string, unknown>; delayMs: number }> = [
  { type: "run.preflight.ok", payload: { message: "Inputs validated, hashes recorded" }, delayMs: 600 },
  { type: "run.extract.features", payload: { region: "chr2:60,716,108-60,728,612", guides_candidate_count: 47 }, delayMs: 1200 },
  { type: "run.simulate.tick", payload: { tick: 1, candidates_remaining: 47 }, delayMs: 800 },
  { type: "run.simulate.tick", payload: { tick: 2, candidates_remaining: 30 }, delayMs: 600 },
  { type: "run.simulate.tick", payload: { tick: 3, candidates_remaining: 12 }, delayMs: 600 },
  { type: "run.score.emit", payload: { guide_seq: "GATAAGCTTAGCGTAACGTA", on_target: 0.87, off_target_count: 3 }, delayMs: 400 },
  { type: "run.score.emit", payload: { guide_seq: "CTAGGCTTAAGCGTACGTAA", on_target: 0.72, off_target_count: 7 }, delayMs: 400 },
  { type: "run.score.emit", payload: { guide_seq: "TTGACGAATCGGATAGCCAT", on_target: 0.65, off_target_count: 1 }, delayMs: 400 },
  { type: "run.score.emit", payload: { guide_seq: "AACGTTCAGTACGGACTTAG", on_target: 0.54, off_target_count: 12 }, delayMs: 400 },
  { type: "run.score.emit", payload: { guide_seq: "GCATTAGCGTAAGGCCTTAT", on_target: 0.41, off_target_count: 0 }, delayMs: 400 },
  { type: "run.summary.pending", payload: { guides_scored: 5 }, delayMs: 700 },
  { type: "run.summary.done", payload: { top_score: 0.87, guides_in_result: 5 }, delayMs: 500 },
];

// ── Mutable mock state ───────────────────────────────────────────────────────

let _runStatus: RunStatus = "queued";
let _activeRunId = MOCK_RUN_ID;
let _activeRoId = MOCK_RO_ID;
let _runEventsLog: ProvenanceEvent[] = [];
const _ros: ResearchObject[] = [MOCK_RO];

function makeMockRun(id: string, roId: string, status: RunStatus = "done"): Run {
  return {
    id,
    ro_id: roId,
    prompt: "Disrupt GATA1 binding site at +58 enhancer",
    status,
    manifest: {
      git_sha: "abc1234def5678abc1234def5678abc1234def56",
      api_version: "v1",
      scoring_versions: { doench_rs2: "1.0", cfd: "1.0" },
      started_at: new Date(Date.now() - 75000).toISOString(),
      env_fingerprint:
        "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    },
    created_at: new Date(Date.now() - 75000).toISOString(),
    finished_at: status === "done" ? new Date(Date.now() - 75000 + 75000).toISOString() : null,
  };
}

const MOCK_RESULT: Result = {
  run_id: MOCK_RUN_ID,
  prediction: {
    guides: MOCK_GUIDES,
    summary: {
      top_score: 0.87,
      mean_off_target: 4.6,
      guides_found: 5,
    },
  },
  export_pack_ref: { bucket: "exports", path: `dnatwist_run_${MOCK_RUN_ID}.zip` },
  export_pack_sha256:
    "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
};

// ── SSE mock stream ──────────────────────────────────────────────────────────

function createMockEventStream(
  runId: string,
  onCapture: (e: ProvenanceEvent) => void,
  onComplete: () => void
): MockEventStream {
  return {
    isMock: true,
    subscribe(
      onEvent: (event: ProvenanceEvent) => void,
      onDone: () => void
    ): () => void {
      let cancelled = false;
      let seq = 0;

      (async () => {
        for (const step of SSE_SEQUENCE) {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, step.delayMs));
          if (cancelled) return;
          const event: ProvenanceEvent = {
            id: `mock-event-${seq}`,
            run_id: runId,
            seq: seq++,
            event_type: step.type,
            payload: step.payload,
            emitted_at: new Date().toISOString(),
          };
          onCapture(event);
          onEvent(event);
        }
        if (!cancelled) {
          onComplete();
          onDone();
        }
      })();

      return () => { cancelled = true; };
    },
  };
}

// ── Delay helper ──────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── Mock client ───────────────────────────────────────────────────────────────

export const mockApiClient: ApiClient = {
  async uploadFile(file: File): Promise<UploadResponse> {
    await delay(800);
    const kind = file.name.endsWith(".fastq")
      ? ("fastq" as const)
      : file.name.endsWith(".pdb")
        ? ("pdb" as const)
        : ("fasta" as const);
    return {
      file_id: `upload-${Date.now()}`,
      sha256: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      kind,
    };
  },

  async createResearchObject(req: CreateRORequest): Promise<ResearchObject> {
    await delay(1200);
    const contentHash = (req._demo_content_hash ?? MOCK_CONTENT_HASH) as Sha256;
    const id = `ro-${Date.now()}`;
    const ro: ResearchObject = {
      ...MOCK_RO,
      id,
      content_hash: contentHash,
      metadata: req.metadata,
      created_at: new Date().toISOString(),
    };
    _ros.push(ro);
    _activeRoId = id;
    return ro;
  },

  async getResearchObject(id: string): Promise<ResearchObject> {
    await delay(300);
    const ro = _ros.find((r) => r.id === id) ?? _ros[_ros.length - 1];
    return ro;
  },

  async listResearchObjects(): Promise<ResearchObject[]> {
    await delay(300);
    return _ros;
  },

  async createRun(req: CreateRunRequest): Promise<CreateRunResponse> {
    await delay(500);
    _runStatus = "queued";
    _runEventsLog = [];
    _activeRunId = `run-${Date.now()}`;
    _activeRoId = req.ro_id;
    return { run_id: _activeRunId, status_url: `/runs/${_activeRunId}` };
  },

  async getRun(id: string): Promise<Run> {
    await delay(200);
    return makeMockRun(id, _activeRoId, _runStatus);
  },

  async listRunsForRO(_roId: string): Promise<Run[]> {
    await delay(300);
    return [makeMockRun(MOCK_RUN_ID, _roId, "done")];
  },

  async getResult(_runId: string): Promise<Result> {
    await delay(400);
    return { ...MOCK_RESULT, run_id: _runId };
  },

  async getExport(runId: string): Promise<ExportResponse> {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const run = makeMockRun(runId, _activeRoId, "done");
    const ro = _ros.find((r) => r.id === _activeRoId) ?? MOCK_RO;

    zip.file("manifest.json", JSON.stringify({
      run_id: runId,
      ro_id: _activeRoId,
      git_sha: run.manifest!.git_sha,
      api_version: run.manifest!.api_version,
      scoring_versions: run.manifest!.scoring_versions,
      env_fingerprint: run.manifest!.env_fingerprint,
      started_at: run.manifest!.started_at,
      finished_at: run.finished_at,
    }, null, 2));

    zip.file("research_object.json", JSON.stringify({
      id: ro.id,
      content_hash: ro.content_hash,
      backbone_sha256: ro.backbone_sha256,
      pam: ro.pam,
      metadata: ro.metadata,
      created_at: ro.created_at,
    }, null, 2));

    zip.file("prediction.json", JSON.stringify({
      run_id: runId,
      guides: MOCK_GUIDES,
      summary: MOCK_RESULT.prediction.summary,
    }, null, 2));

    const eventsToLog = _runEventsLog.length > 0 ? _runEventsLog : SSE_SEQUENCE.map((s, i) => ({
      id: `mock-event-${i}`,
      run_id: runId,
      seq: i,
      event_type: s.type,
      payload: s.payload,
      emitted_at: new Date().toISOString(),
    }));
    zip.file("events.jsonl", eventsToLog.map((e) => JSON.stringify(e)).join("\n"));

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);

    return {
      url,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      sha256: MOCK_RESULT.export_pack_sha256!,
    };
  },

  async replayRun(runId: string): Promise<ReplayResponse> {
    await delay(800);
    return { new_run_id: `replay-${runId}` };
  },

  streamRunEvents(runId: string): MockEventStream {
    _runStatus = "running";
    _runEventsLog = [];
    return createMockEventStream(
      runId,
      (e) => { _runEventsLog.push(e); },
      () => { _runStatus = "done"; }
    );
  },
};
