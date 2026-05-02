import type { ResearchObject } from "@schemas/ResearchObject";
import type {
  CreateRORequest,
  CreateRunRequest,
  CreateRunResponse,
  ExportResponse,
  ReplayResponse,
  Result,
  Run,
  UploadResponse,
} from "./types";

export interface ApiClient {
  // L1 — uploads
  uploadFile(file: File): Promise<UploadResponse>;

  // L2 — research objects
  createResearchObject(req: CreateRORequest): Promise<ResearchObject>;
  getResearchObject(id: string): Promise<ResearchObject>;
  listResearchObjects(): Promise<ResearchObject[]>;

  // L3 — runs
  createRun(req: CreateRunRequest): Promise<CreateRunResponse>;
  getRun(id: string): Promise<Run>;
  listRunsForRO(roId: string): Promise<Run[]>;
  listRuns(): Promise<Run[]>;

  // L4 — results
  getResult(runId: string): Promise<Result>;

  // L5 — export + replay
  getExport(runId: string): Promise<ExportResponse>;
  replayRun(runId: string): Promise<ReplayResponse>;

  // SSE — returns an EventSource-compatible URL or a mock AsyncGenerator
  streamRunEvents(runId: string): EventSource | MockEventStream;
}

// Sentinel type for the mock SSE stream
export interface MockEventStream {
  readonly isMock: true;
  subscribe(
    onEvent: (event: import("./types").ProvenanceEvent) => void,
    onDone: () => void
  ): () => void; // returns unsubscribe fn
}
