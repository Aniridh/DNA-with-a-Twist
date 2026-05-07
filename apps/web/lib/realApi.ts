import type { ApiClient, MockEventStream } from "./api";
import type { ResearchObject } from "@schemas/ResearchObject";
import type {
  CreateRORequest,
  CreateRunRequest,
  CreateRunResponse,
  ExportResponse,
  ProvenanceEvent,
  ReplayResponse,
  Result,
  Run,
  UploadResponse,
} from "./types";
import { createClient } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function getAuthToken(): Promise<string> {
  const { data } = await createClient().auth.getSession();
  if (!data.session?.access_token) throw new Error("Not authenticated");
  return data.session.access_token;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const realApiClient: ApiClient = {
  async uploadFile(file: File): Promise<UploadResponse> {
    const token = await getAuthToken();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/api/v1/uploads`, {
      method: "POST",
      body: form,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json() as Promise<UploadResponse>;
  },

  createResearchObject(req: CreateRORequest): Promise<ResearchObject> {
    // Map frontend field names → backend API field names
    const { backbone_upload_id, fastq_upload_id, pdb_upload_id, _demo_content_hash: _ignored, ...rest } = req;
    return apiFetch("/api/v1/research-objects", {
      method: "POST",
      body: JSON.stringify({
        ...rest,
        backbone_id: backbone_upload_id,
        ...(fastq_upload_id != null && { fastq_id: fastq_upload_id }),
        ...(pdb_upload_id != null && { pdb_id: pdb_upload_id }),
      }),
    });
  },

  getResearchObject(id: string): Promise<ResearchObject> {
    return apiFetch(`/api/v1/research-objects/${id}`);
  },

  listResearchObjects(): Promise<ResearchObject[]> {
    return apiFetch<ResearchObject[]>("/api/v1/research-objects").catch((e: unknown) => {
      if (e instanceof Error && e.message.includes("404")) return [];
      throw e;
    });
  },

  createRun(req: CreateRunRequest): Promise<CreateRunResponse> {
    return apiFetch("/api/v1/runs", { method: "POST", body: JSON.stringify(req) });
  },

  getRun(id: string): Promise<Run> {
    return apiFetch(`/api/v1/runs/${id}`);
  },

  listRunsForRO(roId: string): Promise<Run[]> {
    return apiFetch(`/api/v1/runs?ro_id=${roId}`);
  },

  listRuns(): Promise<Run[]> {
    return apiFetch<Run[]>("/api/v1/runs").catch((e: unknown) => {
      if (e instanceof Error && e.message.includes("404")) return [];
      throw e;
    });
  },

  getResult(runId: string): Promise<Result> {
    return apiFetch(`/api/v1/runs/${runId}/result`);
  },

  getExport(runId: string): Promise<ExportResponse> {
    return apiFetch(`/api/v1/runs/${runId}/export`);
  },

  replayRun(runId: string): Promise<ReplayResponse> {
    return apiFetch(`/api/v1/runs/${runId}/replay`, { method: "POST" });
  },

  streamRunEvents(runId: string): MockEventStream {
    return {
      isMock: true as const,
      subscribe(
        onEvent: (event: ProvenanceEvent) => void,
        onDone: () => void
      ): () => void {
        const controller = new AbortController();

        void (async () => {
          try {
            const token = await getAuthToken();
            const res = await fetch(`${BASE}/api/v1/runs/${runId}/events`, {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            });

            if (!res.ok || !res.body) { onDone(); return; }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = "";

            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split("\n");
              buf = lines.pop() ?? "";
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  const raw = line.slice(5).trim();
                  if (raw) {
                    try { onEvent(JSON.parse(raw) as ProvenanceEvent); }
                    catch { /* malformed event — skip */ }
                  }
                }
              }
            }
            onDone();
          } catch (err) {
            if (!(err instanceof DOMException && err.name === "AbortError")) onDone();
          }
        })();

        return () => controller.abort();
      },
    };
  },
};
