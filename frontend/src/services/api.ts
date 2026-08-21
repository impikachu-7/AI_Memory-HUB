/** API boundary for authenticated, user-scoped FastAPI operations. */
import type { AnalyticsRead, AuthUser, ConversationSummary, Message, MemoryRecord, ModelRead, ProfileUpdate, ProviderRead, TokenResponse } from "@/lib/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
const TOKEN_STORAGE_KEY = "ai-memory-hub.access-token";
let accessToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);

export class ApiUnavailableError extends Error { constructor(message = "AI Memory Hub backend is not connected.") { super(message); this.name = "ApiUnavailableError"; } }
export function setAccessToken(token: string | null) { accessToken = token; if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token); else sessionStorage.removeItem(TOKEN_STORAGE_KEY); }
export function getAccessToken() { return accessToken; }

export interface GenerateRequest { message: string; provider: string; model_key: string; }
export interface ProviderModelRead { model_key: string; display_name: string; context_length?: number; is_local: boolean; }
interface ConversationResponse { id: string; title: string; selected_model_id: string | null; is_archived: boolean; created_at: string; }
interface MemoryResponse { id: string; content: string; category: string; source_conversation_id: string | null; importance: number; confidence: number; is_archived: boolean; is_pinned: boolean; created_at: string; }
function toConversationSummary(item: ConversationResponse): ConversationSummary { return { id: item.id, title: item.title, updatedAt: item.created_at, model: item.selected_model_id ?? "No model selected", memoryUsed: false, selected_model_id: item.selected_model_id }; }
function toMemoryRecord(item: MemoryResponse): MemoryRecord { return { id: item.id, title: item.content.slice(0, 56), content: item.content, category: item.category, source: item.source_conversation_id ?? "Manual entry", createdAt: item.created_at, updatedAt: item.created_at, pinned: item.is_pinned, status: item.is_archived ? "archived" : "active" }; }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    const headers = new Headers(init.headers); headers.set("Content-Type", "application/json"); if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: "include" });
    if (!response.ok) {
      if (response.status === 401) { setAccessToken(null); window.dispatchEvent(new Event("ai-memory-hub.auth-expired")); }
      const text = await response.text(); let message = `Request failed (${response.status})`;
      try { const payload = JSON.parse(text); if (payload.detail) message = payload.detail; } catch { /* non-JSON error */ }
      throw new Error(message);
    }
    if (response.status === 204) return null as T;
    return (await response.json()) as T;
  } catch (error) { if (error instanceof Error) throw error; throw new ApiUnavailableError(); }
}

export const api = {
  auth: {
    beginGoogleOAuth: () => request<{ authorization_url: string }>("/auth/google/start"),
    signInWithFirebase: (idToken: string) => request<TokenResponse>("/auth/firebase", { method: "POST", body: JSON.stringify({ id_token: idToken }) }),
    signIn: (email: string, password: string) => request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    register: (email: string, password: string, fullName: string) => request<{ detail: string }>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, full_name: fullName || null }) }),
    verifyEmailOtp: (email: string, otp: string) => request<TokenResponse>("/auth/verify-email", { method: "POST", body: JSON.stringify({ email, otp }) }),
    requestPasswordReset: (email: string) => request<{ detail: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
    me: () => request<AuthUser>("/auth/me"), logout: () => request<void>("/auth/logout", { method: "POST" }),
  },
  profile: { get: () => request<AuthUser>("/users/me"), update: (patch: ProfileUpdate) => request<AuthUser>("/users/me", { method: "PATCH", body: JSON.stringify(patch) }) },
  analytics: { get: () => request<AnalyticsRead>("/analytics") },
  privacy: { export: () => request<Record<string, unknown>>("/privacy/export") },
  models: { listRegistry: () => request<ModelRead[]>("/models") },
  providers: {
    listConfigured: () => request<ProviderRead[]>("/providers"),
    configure: (provider: string, apiKey: string | null, isEnabled: boolean) => request<ProviderRead>("/providers", { method: "POST", body: JSON.stringify({ provider, api_key: apiKey, is_enabled: isEnabled }) }),
    update: (provider: string, patch: { api_key?: string | null; is_enabled?: boolean }) => request<ProviderRead>(`/providers/${provider}`, { method: "PUT", body: JSON.stringify(patch) }),
    remove: (provider: string) => request<void>(`/providers/${provider}`, { method: "DELETE" }),
    listModels: (provider: string) => request<ProviderModelRead[]>(`/providers/${provider}/models`),
  },
  conversations: {
    list: async () => (await request<ConversationResponse[]>("/conversations")).map(toConversationSummary),
    create: async (title?: string) => toConversationSummary(await request<ConversationResponse>("/conversations", { method: "POST", body: JSON.stringify({ title }) })),
    update: async (id: string, patch: { title?: string; selected_model_id?: string | null }) => toConversationSummary(await request<ConversationResponse>(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify(patch) })),
    listMessages: (id: string) => request<Message[]>(`/conversations/${id}/messages`),
    export: () => request<Record<string, unknown>>("/privacy/export/conversations"),
    generate: (id: string, req: GenerateRequest, onChunk: (text: string) => void, onDone: (messageId: string) => void, onError: (error: Error) => void, signal?: AbortSignal): void => {
      const headers = new Headers({ "Content-Type": "application/json" }); if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
      fetch(`${API_BASE_URL}/conversations/${id}/generate`, { method: "POST", headers, body: JSON.stringify(req), credentials: "include", signal }).then(async response => {
        if (!response.ok) { if (response.status === 401) { setAccessToken(null); window.dispatchEvent(new Event("ai-memory-hub.auth-expired")); } const payload = await response.json().catch(() => ({})); throw new Error(payload.detail || `Request failed (${response.status})`); }
        const reader = response.body?.getReader(); if (!reader) throw new Error("Response body is not readable."); const decoder = new TextDecoder(); let buffer = "";
        while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? ""; for (const line of lines) { if (!line.trim()) continue; const event = JSON.parse(line); if (event.type === "chunk") onChunk(event.text); else if (event.type === "done") onDone(event.message_id); else if (event.type === "error") throw new Error(event.detail || "Error during generation"); } }
      }).catch(error => { if (error.name !== "AbortError") onError(error instanceof Error ? error : new Error(String(error))); });
    },
  },
  memories: {
    list: async () => (await request<MemoryResponse[]>("/memories")).map(toMemoryRecord),
    search: async (query: string, limit = 8) => (await request<MemoryResponse[]>(`/memories/search?query=${encodeURIComponent(query)}&limit=${limit}`)).map(toMemoryRecord),
    create: async (body: { content: string; category?: string; source_conversation_id?: string | null; importance?: number; confidence?: number }) => toMemoryRecord(await request<MemoryResponse>("/memories", { method: "POST", body: JSON.stringify(body) })),
    update: async (id: string, patch: Partial<MemoryRecord>) => toMemoryRecord(await request<MemoryResponse>(`/memories/${id}`, { method: "PATCH", body: JSON.stringify(patch) })),
    remove: (id: string) => request<void>(`/memories/${id}`, { method: "DELETE" }),
    archive: async (id: string) => toMemoryRecord(await request<MemoryResponse>(`/memories/${id}/archive`, { method: "POST" })),
    restore: async (id: string) => toMemoryRecord(await request<MemoryResponse>(`/memories/${id}/restore`, { method: "POST" })),
    pin: async (id: string) => toMemoryRecord(await request<MemoryResponse>(`/memories/${id}/pin`, { method: "POST" })),
    export: () => request<Record<string, unknown>>("/privacy/export/memories"),
  },
};
