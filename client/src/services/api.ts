/** API boundary - no persistence, credentials, or user data is fabricated in the browser. */

import type {
  ConversationSummary,
  Message,
  MemoryRecord,
  AuthUser,
  TokenResponse,
  AnalyticsRead,
  ProfileUpdate,
} from "@/lib/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
const TOKEN_STORAGE_KEY = "ai-memory-hub.access-token";

let accessToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);

export class ApiUnavailableError extends Error {
  constructor(message = "AI Memory Hub backend is not connected.") {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  else sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getAccessToken() {
  return accessToken;
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

interface ConversationResponse {
  id: string;
  title: string;
  selected_model_id: string | null;
  is_archived: boolean;
  created_at: string;
}

interface MemoryResponse {
  id: string;
  content: string;
  category: string;
  source_conversation_id: string | null;
  importance: number;
  confidence: number;
  is_archived: boolean;
  is_pinned: boolean;
  created_at: string;
}

interface MemorySearchResponse extends MemoryResponse {
  score: number;
}

export interface MemoryCreateRequest {
  content: string;
  category?: string;
  source_conversation_id?: string | null;
  importance?: number;
  confidence?: number;
}

export interface MemoryUpdateRequest {
  content?: string;
  category?: string;
  importance?: number;
  confidence?: number;
  is_archived?: boolean;
  is_pinned?: boolean;
}

function toConversationSummary(item: ConversationResponse): ConversationSummary {
  return {
    id: item.id,
    title: item.title,
    updatedAt: item.created_at,
    model: item.selected_model_id ?? "No model selected",
    memoryUsed: false,
    selected_model_id: item.selected_model_id,
  };
}

function toMemoryRecord(item: MemoryResponse): MemoryRecord {
  return {
    id: item.id,
    title: item.content.slice(0, 56),
    content: item.content,
    category: item.category,
    source: item.source_conversation_id ?? "Manual entry",
    createdAt: item.created_at,
    updatedAt: item.created_at,
    pinned: item.is_pinned,
    status: item.is_archived ? "archived" : "active",
  };
}

function handleUnauthorized() {
  setAccessToken(null);
  window.dispatchEvent(new Event("ai-memory-hub.auth-expired"));
}

async function request<T>(path: string, init: RequestInit = {}, responseType: "json" | "blob" = "json"): Promise<T> {
  try {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) handleUnauthorized();
      const text = await response.text();
      let msg = `Request failed (${response.status})`;
      try {
        const payload = JSON.parse(text);
        if (payload.detail) msg = payload.detail;
      } catch {}
      throw new Error(msg);
    }

    if (response.status === 204) return null as T;
    if (responseType === "blob") return (await response.blob()) as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new ApiUnavailableError();
  }
}

export const api = {
  auth: {
    beginGoogleOAuth: () => request<{ authorization_url: string }>("/auth/google/start"),
    signIn: (email: string, password: string) =>
      request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    register: (email: string, password: string, fullName: string) =>
      request<{ detail: string }>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, full_name: fullName || null }) }),
    verifyEmailOtp: (email: string, otp: string) =>
      request<TokenResponse>("/auth/verify-email", { method: "POST", body: JSON.stringify({ email, otp }) }),
    resendVerification: (email: string) =>
      request<{ detail: string }>("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) }),
    requestPasswordReset: (email: string) =>
      request<{ detail: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
    verifyReset: (email: string, otp: string) =>
      request<{ reset_token: string }>("/auth/verify-reset", { method: "POST", body: JSON.stringify({ email, otp }) }),
    resetPassword: (resetToken: string, newPassword: string) =>
      request<void>("/auth/reset-password", { method: "POST", body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }) }),
    me: () => request<AuthUser>("/auth/me"),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
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
      request<ProviderRead>(`/providers/${provider}`, { method: "PUT", body: JSON.stringify(patch) }),
    remove: (provider: string) => request<void>(`/providers/${provider}`, { method: "DELETE" }),
    listModels: (provider: string) => request<ProviderModelRead[]>(`/providers/${provider}/models`),
  },
  conversations: {
    list: async () => (await request<ConversationResponse[]>("/conversations")).map(toConversationSummary),
    create: async (title?: string) => toConversationSummary(await request<ConversationResponse>("/conversations", { method: "POST", body: JSON.stringify({ title }) })),
    update: (conversationId: string, patch: { title?: string; selected_model_id?: string | null }) =>
      request<ConversationResponse>(`/conversations/${conversationId}`, { method: "PATCH", body: JSON.stringify(patch) }).then(toConversationSummary),
    listMessages: (conversationId: string) => request<Message[]>(`/conversations/${conversationId}/messages`),
    export: () => request<Blob>("/privacy/export/conversations", {}, "blob"),
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
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(req),
        credentials: "include",
        signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            if (response.status === 401) handleUnauthorized();
            const text = await response.text();
            let msg = `Request failed (${response.status})`;
            try {
              const payload = JSON.parse(text);
              if (payload.detail) msg = payload.detail;
            } catch {}
            throw new Error(msg);
          }
          const reader = response.body?.getReader();
          if (!reader) throw new Error("Response body is not readable.");
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const event = JSON.parse(line);
                if (event.type === "chunk") onChunk(event.text);
                else if (event.type === "done") onDone(event.message_id);
                else if (event.type === "error") throw new Error(event.detail || "Error during generation");
              } catch (error) {
                onError(error instanceof Error ? error : new Error(String(error)));
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
    list: async () => (await request<MemoryResponse[]>("/memories")).map(toMemoryRecord),
    create: (payload: MemoryCreateRequest) =>
      request<MemoryResponse>("/memories", { method: "POST", body: JSON.stringify(payload) }).then(toMemoryRecord),
    update: (memoryId: string, patch: MemoryUpdateRequest) =>
      request<MemoryResponse>(`/memories/${memoryId}`, { method: "PATCH", body: JSON.stringify(patch) }).then(toMemoryRecord),
    remove: (memoryId: string) => request<void>(`/memories/${memoryId}`, { method: "DELETE" }),
    archive: (memoryId: string) => request<MemoryResponse>(`/memories/${memoryId}/archive`, { method: "POST" }).then(toMemoryRecord),
    restore: (memoryId: string) => request<MemoryResponse>(`/memories/${memoryId}/restore`, { method: "POST" }).then(toMemoryRecord),
    pin: (memoryId: string) => request<MemoryResponse>(`/memories/${memoryId}/pin`, { method: "POST" }).then(toMemoryRecord),
    search: async (query: string, limit = 8) => {
      const boundedLimit = Math.min(Math.max(limit, 1), 20);
      return (await request<MemorySearchResponse[]>(`/memories/search?query=${encodeURIComponent(query)}&limit=${boundedLimit}`)).map(toMemoryRecord);
    },
    export: () => request<Blob>("/privacy/export/memories", {}, "blob"),
  },
  profile: {
    get: () => request<AuthUser>("/users/me"),
    update: (patch: ProfileUpdate) => request<AuthUser>("/users/me", { method: "PATCH", body: JSON.stringify(patch) }),
  },
  analytics: {
    get: () => request<AnalyticsRead>("/analytics"),
  },
  privacy: {
    export: () => request<Record<string, unknown>>("/privacy/export"),
  },
};
