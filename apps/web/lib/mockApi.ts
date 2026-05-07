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
const MOCK_RO_ID = "ro-bcl11a-demo";
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
  created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
  created_by: MOCK_USER_ID,
};

const ENV_FINGERPRINT = "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
const GIT_SHA = "abc1234def5678abc1234def5678abc1234def56";

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

interface StoredRun {
  id: string;
  ro_id: string;
  prompt: string;
  status: RunStatus;
  created_at: string;
}

const _ros: ResearchObject[] = [MOCK_RO];
const _runStore = new Map<string, StoredRun>();
let _eventsLog: ProvenanceEvent[] = [];
let _lastRunId: string | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockRun(stored: StoredRun): Run {
  const durationMs = stored.status === "done" ? 6200 : 0;
  return {
    id: stored.id,
    ro_id: stored.ro_id,
    prompt: stored.prompt,
    status: stored.status,
    manifest: {
      git_sha: GIT_SHA,
      api_version: "v1",
      scoring_versions: { doench_rs2: "1.0", cfd: "1.0" },
      started_at: stored.created_at,
      env_fingerprint: ENV_FINGERPRINT,
    },
    created_at: stored.created_at,
    finished_at: stored.status === "done"
      ? new Date(new Date(stored.created_at).getTime() + durationMs).toISOString()
      : null,
  };
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function createMockEventStream(
  runId: string,
  onCapture: (e: ProvenanceEvent) => void,
  onComplete: () => void
): MockEventStream {
  return {
    isMock: true,
    subscribe(onEvent, onDone) {
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
    return ro;
  },

  async getResearchObject(id: string): Promise<ResearchObject> {
    await delay(150);
    return _ros.find((r) => r.id === id) ?? _ros[_ros.length - 1];
  },

  async listResearchObjects(): Promise<ResearchObject[]> {
    await delay(200);
    return [..._ros].reverse();
  },

  async createRun(req: CreateRunRequest): Promise<CreateRunResponse> {
    await delay(500);
    const id = `run-${Date.now()}`;
    const stored: StoredRun = {
      id,
      ro_id: req.ro_id,
      prompt: req.prompt,
      status: "queued",
      created_at: new Date().toISOString(),
    };
    _runStore.set(id, stored);
    _lastRunId = id;
    _eventsLog = [];
    return { run_id: id, status_url: `/runs/${id}` };
  },

  async getRun(id: string): Promise<Run> {
    await delay(100);
    const stored = _runStore.get(id);
    if (stored) return makeMockRun(stored);
    // Fallback for replay runs that haven't been created yet
    return makeMockRun({
      id,
      ro_id: _lastRunId ? (_runStore.get(_lastRunId)?.ro_id ?? MOCK_RO_ID) : MOCK_RO_ID,
      prompt: "Replay run",
      status: "done",
      created_at: new Date().toISOString(),
    });
  },

  async listRunsForRO(roId: string): Promise<Run[]> {
    await delay(200);
    return Array.from(_runStore.values())
      .filter((r) => r.ro_id === roId)
      .reverse()
      .map(makeMockRun);
  },

  async listRuns(): Promise<Run[]> {
    await delay(200);
    return Array.from(_runStore.values()).reverse().map(makeMockRun);
  },

  async getResult(runId: string): Promise<Result> {
    await delay(400);
    return {
      run_id: runId,
      prediction: {
        guides: MOCK_GUIDES,
        summary: { top_score: 0.87, mean_off_target: 4.6, guides_found: 5 },
      },
      export_pack_ref: { bucket: "exports", path: `dnatwist_run_${runId}.zip` },
      export_pack_sha256: "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
    };
  },

  async getExport(runId: string): Promise<ExportResponse> {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const stored = _runStore.get(runId);
    const ro = _ros.find((r) => r.id === stored?.ro_id) ?? _ros[_ros.length - 1];
    const run = stored ? makeMockRun(stored) : { manifest: { git_sha: GIT_SHA, api_version: "v1", scoring_versions: {}, started_at: new Date().toISOString(), env_fingerprint: ENV_FINGERPRINT }, finished_at: new Date().toISOString() };

    zip.file("manifest.json", JSON.stringify({
      run_id: runId,
      ro_id: ro.id,
      git_sha: run.manifest!.git_sha,
      api_version: run.manifest!.api_version,
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
      guides: MOCK_GUIDES,
      summary: { top_score: 0.87, mean_off_target: 4.6, guides_found: 5 },
    }, null, 2));

    const eventsToLog = _eventsLog.length > 0 ? _eventsLog : SSE_SEQUENCE.map((s, i) => ({
      id: `mock-event-${i}`,
      run_id: runId,
      seq: i,
      event_type: s.type,
      payload: s.payload,
      emitted_at: new Date().toISOString(),
    }));
    zip.file("events.jsonl", eventsToLog.map((e) => JSON.stringify(e)).join("\n"));

    const blob = await zip.generateAsync({ type: "blob" });
    return {
      url: URL.createObjectURL(blob),
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      sha256: "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
    };
  },

  async replayRun(runId: string): Promise<ReplayResponse> {
    await delay(800);
    const original = _runStore.get(runId);
    const replayId = `replay-${runId}`;
    _runStore.set(replayId, {
      id: replayId,
      ro_id: original?.ro_id ?? MOCK_RO_ID,
      prompt: original?.prompt ?? "Replay",
      status: "queued",
      created_at: new Date().toISOString(),
    });
    _lastRunId = replayId;
    _eventsLog = [];
    return { new_run_id: replayId };
  },

  streamRunEvents(runId: string): MockEventStream {
    const stored = _runStore.get(runId);
    if (stored) stored.status = "running";
    _eventsLog = [];
    return createMockEventStream(
      runId,
      (e) => { _eventsLog.push(e); },
      () => {
        const s = _runStore.get(runId);
        if (s) s.status = "done";
      }
    );
  },
};
