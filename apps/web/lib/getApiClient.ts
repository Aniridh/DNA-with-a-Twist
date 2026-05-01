import type { ApiClient } from "./api";
import { mockApiClient } from "./mockApi";
import { realApiClient } from "./realApi";

export function getApiClient(): ApiClient {
  return process.env.NEXT_PUBLIC_USE_MOCK_API === "true" ? mockApiClient : realApiClient;
}

export const apiClient: ApiClient = getApiClient();
