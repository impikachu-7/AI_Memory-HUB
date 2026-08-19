/** API boundary — Quiet Intelligence Console: no persistence, credentials, or user data is fabricated in the browser. */

import type {
  AvailableModel,
  ConversationSummary,
  MemoryRecord,
  ProviderSummary,
} from "@/lib/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export class ApiUnavailableError extends Error {
  constructor(message = "AI Memory Hub backend is not connected.") {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
      credentials: "include",
    });

    if (!response.ok) {
      throw new ApiUnavailableError(`Request unavailable (${response.status}).`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiUnavailableError) throw error;
    throw new ApiUnavailableError();
  }
}

export const api = {
  auth: {
    beginGoogleOAuth: () => request<{ authorizationUrl: string }>("/auth/google/start"),
    signIn: (email: string, password: string) =>
      request<void>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    register: (email: string, password: string, fullName: string) =>
      request<void>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, fullName }) }),
    verifyEmailOtp: (email: string, otp: string) =>
      request<void>("/auth/verify-email", { method: "POST", body: JSON.stringify({ email, otp }) }),
    requestPasswordReset: (email: string) =>
      request<void>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  },
  models: {
    listAvailable: () => request<AvailableModel[]>("/models/available"),
    listProviders: () => request<ProviderSummary[]>("/providers"),
    select: (modelId: string) => request<void>("/models/selection", { method: "PUT", body: JSON.stringify({ modelId }) }),
  },
  conversations: {
    list: () => request<ConversationSummary[]>("/conversations"),
    create: () => request<ConversationSummary>("/conversations", { method: "POST" }),
    export: () => request<Blob>("/conversations/export"),
  },
  memories: {
    list: () => request<MemoryRecord[]>("/memories"),
    update: (memoryId: string, patch: Partial<MemoryRecord>) =>
      request<MemoryRecord>(`/memories/${memoryId}`, { method: "PATCH", body: JSON.stringify(patch) }),
    remove: (memoryId: string) => request<void>(`/memories/${memoryId}`, { method: "DELETE" }),
    export: () => request<Blob>("/memories/export"),
  },
};
