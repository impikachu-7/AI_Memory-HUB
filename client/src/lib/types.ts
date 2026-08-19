/** AI Memory Hub interface types — Quiet Intelligence Console: explicit ownership and user-scoped boundaries. */

export type ProviderId =
  | "google"
  | "openai"
  | "anthropic"
  | "ollama"
  | "deepseek"
  | "groq"
  | "openrouter";

export type MemoryStatus = "active" | "archived";

export interface ProviderSummary {
  id: ProviderId;
  name: string;
  connected: boolean;
  local?: boolean;
  modelCount: number;
}

export interface AvailableModel {
  id: string;
  providerId: ProviderId;
  providerName: string;
  name: string;
  context: string;
  local?: boolean;
}

export interface MemoryRecord {
  id: string;
  title: string;
  content: string;
  category: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  status: MemoryStatus;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  model: string;
  memoryUsed: boolean;
}

export interface ApiErrorPayload {
  message: string;
  code?: string;
  status?: number;
}
