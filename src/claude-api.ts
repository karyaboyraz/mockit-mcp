import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserPrompt } from "./system-prompt.js";
import type { GenerateInput, GenerateResult } from "./types.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7";

export async function generateScreenViaApi(input: GenerateInput): Promise<GenerateResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("CLAUDE_BACKEND=api requires ANTHROPIC_API_KEY env var");
  }
  const userPrompt = buildUserPrompt(input);

  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        } as unknown as { type: "text"; text: string },
      ],
      messages: [{ role: "user", content: userPrompt }],
    },
    {
      headers: { "anthropic-beta": "prompt-caching-2024-07-31" },
    }
  );

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Model returned no text content");
  }

  const html = extractHtml(textBlock.text);
  const usage = response.usage as Anthropic.Usage & {
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };

  return {
    html,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    model: response.model,
  };
}

function extractHtml(raw: string): string {
  let s = raw.trim();
  const fenceMatch = s.match(/^```(?:html)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) s = fenceMatch[1].trim();
  const start = s.indexOf("<");
  const end = s.lastIndexOf(">");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("API output did not contain valid HTML");
  }
  return s.slice(start, end + 1);
}
