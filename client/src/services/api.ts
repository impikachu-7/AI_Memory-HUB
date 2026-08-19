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

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model_id?: string;
  created_at: string;
}

export interface GenerateRequest {
  message: string;
  provider: string;
  model_key: string;
}

export interface ProviderRead {
  id: string;
  provider: string;
  is_enabled: boolean;
  created_at: string;
}

export interface ProviderModelRead {
  model_key: string;
  display_name: string;
  context_length?: number;
  is_local: boolean;
}

export interface ModelRead {
  id: string;
  provider: string;
  model_key: string;
  display_name: string;
  is_local: boolean;
  is_active: boolean;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
      credentials: "include",
    });

    if (!response.ok) {
      const text = await response.text();
      let msg = `Request failed (${response.status})`;
      try {
        const payload = JSON.parse(text);
        if (payload.detail) msg = payload.detail;
      } catch {}
      throw new Error(msg);
    }

    if (response.status === 204) return null as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error) throw error;
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
    listRegistry: () => request<ModelRead[]>("/models"),
  },
  providers: {
    listConfigured: () => request<ProviderRead[]>("/providers"),
    configure: (provider: string, apiKey: string | null, isEnabled: boolean) =>
      request<ProviderRead>("/providers", {
        method: "POST",
        body: JSON.stringify({ provider, api_key: apiKey, is_enabled: isEnabled }),
      }),
    update: (provider: string, patch: { api_key?: string | null; is_enabled?: boolean }) =>
      request<ProviderRead>(`/providers/${provider}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    remove: (provider: string) => request<void>(`/providers/${provider}`, { method: "DELETE" }),
    listModels: (provider: string) => request<ProviderModelRead[]>(`/providers/${provider}/models`),
  },
  conversations: {
    list: () => request<ConversationSummary[]>("/conversations"),
    create: (title?: string) => request<ConversationSummary>("/conversations", { method: "POST", body: JSON.stringify({ title }) }),
    update: (conversationId: string, patch: { title?: string; selected_model_id?: string | null }) =>
      request<ConversationSummary>(`/conversations/${conversationId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    listMessages: (conversationId: string) => request<Message[]>(`/conversations/${conversationId}/messages`),
    export: () => request<Blob>("/conversations/export"),

    /**
     * Send a generation request to the conversation, streaming responses via SSE chunk callback.
     * Uses fetch + ReadableStream to support real-time SSE chunk consumption.
     */
    generate: (
      conversationId: string,
      req: GenerateRequest,
      onChunk: (text: string) => void,
      onDone: (messageId: string) => void,
      onError: (err: Error) => void,
      signal?: AbortSignal
    ): void => {
      fetch(`${API_BASE_URL}/conversations/${conversationId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        credentials: "include",
        signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const text = await response.text();
            let msg = `Request failed (${response.status})`;
            try {
              const payload = JSON.parse(text);
              if (payload.detail) msg = payload.detail;
            } catch {}
            throw new Error(msg);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error("Response body is not readable.");
          }

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            // Keep the last partial line in the buffer
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const event = JSON.parse(line);
                if (event.type === "chunk") {
                  onChunk(event.text);
                } else if (event.type === "done") {
                  onDone(event.message_id);
                } else if (event.type === "error") {
                  throw new Error(event.detail || "Error during generation");
                }
              } catch (e) {
                if (e instanceof Error) onError(e);
                else onError(new Error(String(e)));
                return;
              }
            }
          }
        })
        .catch((error) => {
          if (error.name === "AbortError") return;
          onError(error instanceof Error ? error : new Error(String(error)));
        });
    },
  },
  memories: {
    list: () => request<MemoryRecord[]>("/memories"),
    update: (memoryId: string, patch: Partial<MemoryRecord>) =>
      request<MemoryRecord>(`/memories/${memoryId}`, { method: "PATCH", body: JSON.stringify(patch) }),
    remove: (memoryId: string) => request<void>(`/memories/${memoryId}`, { method: "DELETE" }),
    export: () => request<Blob>("/memories/export"),
  },
};
