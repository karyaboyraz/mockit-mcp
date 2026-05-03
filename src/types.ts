export interface GenerateInput {
  prompt: string;
  designSystem?: string;
  feedback?: string;
  previousHtml?: string;
}

export interface GenerateResult {
  html: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  model: string;
  costUsd?: number;
  durationMs?: number;
}

export type Backend = "cli" | "api";
