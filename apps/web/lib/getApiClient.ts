import type { ApiClient } from "./api";

export function getApiClient(): ApiClient {
  if (process.env.NEXT_PUBLIC_USE_MOCK_API === "true") {
    // Dynamic import so the mock bundle is tree-shaken in production
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mockApiClient } = require("./mockApi") as { mockApiClient: ApiClient };
    return mockApiClient;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { realApiClient } = require("./realApi") as { realApiClient: ApiClient };
  return realApiClient;
}

export const apiClient: ApiClient = getApiClient();
