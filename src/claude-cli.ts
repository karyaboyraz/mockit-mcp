import { spawn } from "node:child_process";
import { SYSTEM_PROMPT, buildUserPrompt } from "./system-prompt.js";
import type { GenerateInput, GenerateResult } from "./types.js";

const CLI_PATH = process.env.CLAUDE_CLI_PATH ?? "claude";
const CLI_MODEL = process.env.CLAUDE_CLI_MODEL; // optional override
const TIMEOUT_MS = parseInt(process.env.CLAUDE_CLI_TIMEOUT_MS ?? "180000", 10);

/**
 * Generate a screen by spawning the `claude` CLI in headless mode.
 * Uses the user's existing Claude Code login (no API key needed).
 */
export async function generateScreenViaCli(input: GenerateInput): Promise<GenerateResult> {
  const userPrompt = buildUserPrompt(input);

  // Note: do NOT use --bare here. --bare disables OAuth/keychain auth
  // and forces ANTHROPIC_API_KEY, defeating the purpose of using the CLI.
  const args = [
    "-p", // headless / non-interactive
    "--no-session-persistence", // don't save these one-shot calls to history
    "--output-format", "json",
    "--append-system-prompt", SYSTEM_PROMPT,
    "--disable-slash-commands", // skip skill loading for speed
  ];
  if (CLI_MODEL) args.push("--model", CLI_MODEL);

  const stdout = await runCli(args, userPrompt);

  // Parse JSON envelope. Claude CLI's --output-format json returns
  // a result object with the assistant text in `result` (or `result.content`
  // depending on version). Handle both.
  let html: string;
  let costUsd = 0;
  let durationMs = 0;
  let model = "claude-cli";
  try {
    const parsed = JSON.parse(stdout) as {
      result?: string;
      total_cost_usd?: number;
      duration_ms?: number;
      model?: string;
    };
    if (typeof parsed.result === "string") {
      html = extractHtml(parsed.result);
    } else {
      throw new Error("CLI JSON envelope missing 'result' string");
    }
    costUsd = parsed.total_cost_usd ?? 0;
    durationMs = parsed.duration_ms ?? 0;
    model = parsed.model ?? model;
  } catch {
    // Fallback: treat raw stdout as the response text.
    html = extractHtml(stdout);
  }

  return {
    html,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    model,
    costUsd,
    durationMs,
  };
}

function runCli(args: string[], stdinText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(CLI_PATH, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000);
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn '${CLI_PATH}': ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        return reject(new Error(`Claude CLI timed out after ${TIMEOUT_MS}ms`));
      }
      if (code !== 0) {
        return reject(
          new Error(`Claude CLI exited with code ${code}\nstderr: ${stderr.slice(0, 2000)}`)
        );
      }
      resolve(stdout);
    });

    child.stdin.write(stdinText);
    child.stdin.end();
  });
}

function extractHtml(raw: string): string {
  let s = raw.trim();
  const fenceMatch = s.match(/^```(?:html)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) s = fenceMatch[1].trim();
  const start = s.indexOf("<");
  const end = s.lastIndexOf(">");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("CLI output did not contain valid HTML");
  }
  return s.slice(start, end + 1);
}
