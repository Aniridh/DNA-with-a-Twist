import type { ApiClient, MockEventStream } from "./api";
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
    return apiFetch("/api/v1/research-objects", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  getResearchObject(id: string): Promise<ResearchObject> {
    return apiFetch(`/api/v1/research-objects/${id}`);
  },

  listResearchObjects(): Promise<ResearchObject[]> {
    return apiFetch("/api/v1/research-objects");
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

  getResult(runId: string): Promise<Result> {
    return apiFetch(`/api/v1/runs/${runId}/result`);
  },

  getExport(runId: string): Promise<ExportResponse> {
    return apiFetch(`/api/v1/runs/${runId}/export`);
  },

  replayRun(runId: string): Promise<ReplayResponse> {
    return apiFetch(`/api/v1/runs/${runId}/replay`, { method: "POST" });
  },

  streamRunEvents(runId: string): EventSource | MockEventStream {
    return new EventSource(`${BASE}/api/v1/runs/${runId}/events`);
  },
};
