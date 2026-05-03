import type { GenerateInput, GenerateResult, Backend } from "./types.js";
import { generateScreenViaCli } from "./claude-cli.js";

const BACKEND = (process.env.CLAUDE_BACKEND ?? "cli") as Backend;

export async function generateScreen(input: GenerateInput): Promise<GenerateResult> {
  if (BACKEND === "cli") {
    return generateScreenViaCli(input);
  }
  if (BACKEND === "api") {
    // Lazy import so SDK is not required when CLI backend is used.
    const { generateScreenViaApi } = await import("./claude-api.js");
    return generateScreenViaApi(input);
  }
  throw new Error(`Unknown CLAUDE_BACKEND: ${BACKEND} (expected 'cli' or 'api')`);
}

export function activeBackend(): Backend {
  return BACKEND;
}
