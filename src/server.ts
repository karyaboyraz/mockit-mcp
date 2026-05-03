#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { z } from "zod";

import { generateScreen, activeBackend } from "./claude.js";
import { renderHtml, shutdownRenderer } from "./renderer.js";
import {
  saveScreen,
  getScreen,
  listScreens,
  readHtml,
} from "./storage.js";

// ---------- Tool schemas ----------

const generateInput = z.object({
  prompt: z.string().describe("Detailed brief for the screen: what app, what screen, what content, what UI elements."),
  project: z.string().default("default").describe("Project name (used to group related screens)."),
  name: z.string().describe("Short name for this screen, e.g. 'Main', 'Settings', 'Onboarding'."),
  design_system: z.string().optional().describe("Optional design system spec: colors, fonts, voice. If omitted, the system invents one consistent with the prompt."),
});

const iterateInput = z.object({
  screen_id: z.string().describe("ID of the screen to iterate on (from generate_screen output)."),
  feedback: z.string().describe("What to change: 'make the hero card larger', 'use orange accent instead of blue', etc."),
  name: z.string().optional().describe("Optional new name for the iteration. Defaults to original name + ' (v2)'."),
});

const listInput = z.object({
  project: z.string().optional().describe("Filter by project. Omit to list all."),
});

const getInput = z.object({
  screen_id: z.string(),
  include_html: z.boolean().default(false).describe("Include full HTML in response (large)."),
});

// ---------- Tool definitions ----------

const TOOLS = [
  {
    name: "generate_screen",
    description:
      "Generate a premium iOS mobile UI mockup from a text brief. Outputs both the screenshot (PNG) and the underlying HTML. Use this when the user asks to design, mock up, or visualize a mobile app screen.",
    inputSchema: zodToJson(generateInput),
  },
  {
    name: "iterate_screen",
    description:
      "Refine an existing generated screen based on feedback. Use this for follow-up edits like 'change color', 'add a section', 'make it more spacious'.",
    inputSchema: zodToJson(iterateInput),
  },
  {
    name: "list_screens",
    description: "List all generated screens, optionally filtered by project name.",
    inputSchema: zodToJson(listInput),
  },
  {
    name: "get_screen",
    description: "Get details and metadata for a specific screen. Set include_html=true to also return the HTML source.",
    inputSchema: zodToJson(getInput),
  },
];

function zodToJson(schema: z.ZodType): object {
  // Minimal Zod -> JSON Schema converter for our flat object schemas.
  if (!(schema instanceof z.ZodObject)) {
    throw new Error("zodToJson only handles ZodObject");
  }
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const properties: Record<string, object> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(shape)) {
    properties[key] = zodFieldToJson(value);
    if (!value.isOptional() && !(value instanceof z.ZodDefault)) {
      required.push(key);
    }
  }
  return { type: "object", properties, required };
}

function zodFieldToJson(field: z.ZodTypeAny): object {
  let unwrapped = field;
  while (unwrapped instanceof z.ZodOptional || unwrapped instanceof z.ZodDefault) {
    unwrapped = unwrapped._def.innerType;
  }
  const description = field.description;
  if (unwrapped instanceof z.ZodString) return { type: "string", ...(description && { description }) };
  if (unwrapped instanceof z.ZodNumber) return { type: "number", ...(description && { description }) };
  if (unwrapped instanceof z.ZodBoolean) return { type: "boolean", ...(description && { description }) };
  return { type: "string", ...(description && { description }) };
}

// ---------- Server setup ----------

const server = new Server(
  { name: "mockit", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    switch (name) {
      case "generate_screen":
        return await handleGenerate(generateInput.parse(args));
      case "iterate_screen":
        return await handleIterate(iterateInput.parse(args));
      case "list_screens":
        return await handleList(listInput.parse(args));
      case "get_screen":
        return await handleGet(getInput.parse(args));
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

// ---------- Tool handlers ----------

async function handleGenerate(input: z.infer<typeof generateInput>) {
  const result = await generateScreen({
    prompt: input.prompt,
    designSystem: input.design_system,
  });
  const render = await renderHtml(result.html);
  const saved = await saveScreen({
    project: input.project,
    name: input.name,
    prompt: input.prompt,
    designSystem: input.design_system,
    html: result.html,
    png: render.png,
    tokens: {
      input: result.inputTokens,
      output: result.outputTokens,
      cacheRead: result.cacheReadTokens,
    },
    model: result.model,
  });

  return {
    content: [
      {
        type: "image" as const,
        data: render.png.toString("base64"),
        mimeType: "image/png",
      },
      {
        type: "text" as const,
        text: summarize(saved, render, { result }),
      },
    ],
  };
}

async function handleIterate(input: z.infer<typeof iterateInput>) {
  const original = await getScreen(input.screen_id);
  if (!original) throw new Error(`Screen not found: ${input.screen_id}`);
  const previousHtml = await readHtml(original);

  const result = await generateScreen({
    prompt: original.prompt,
    designSystem: original.designSystem,
    feedback: input.feedback,
    previousHtml,
  });
  const render = await renderHtml(result.html);
  const saved = await saveScreen({
    project: original.project,
    name: input.name ?? `${original.name} (v2)`,
    prompt: original.prompt,
    designSystem: original.designSystem,
    html: result.html,
    png: render.png,
    parentId: original.id,
    tokens: {
      input: result.inputTokens,
      output: result.outputTokens,
      cacheRead: result.cacheReadTokens,
    },
    model: result.model,
  });

  return {
    content: [
      {
        type: "image" as const,
        data: render.png.toString("base64"),
        mimeType: "image/png",
      },
      {
        type: "text" as const,
        text: summarize(saved, render, { iteratedFrom: original.id, result }),
      },
    ],
  };
}

async function handleList(input: z.infer<typeof listInput>) {
  const screens = await listScreens(input.project);
  if (screens.length === 0) {
    return {
      content: [{ type: "text" as const, text: "No screens found." }],
    };
  }
  const lines = screens.map(
    (s) =>
      `- [${s.id}] ${s.project} / ${s.name}  (${s.createdAt})${s.parentId ? `  ← ${s.parentId.slice(0, 8)}` : ""}`
  );
  return {
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}

async function handleGet(input: z.infer<typeof getInput>) {
  const screen = await getScreen(input.screen_id);
  if (!screen) throw new Error(`Screen not found: ${input.screen_id}`);
  const meta = {
    id: screen.id,
    project: screen.project,
    name: screen.name,
    createdAt: screen.createdAt,
    prompt: screen.prompt,
    designSystem: screen.designSystem,
    parentId: screen.parentId,
    tokens: screen.tokens,
    model: screen.model,
    htmlPath: screen.htmlPath,
    pngPath: screen.pngPath,
  };
  const out: Array<{ type: "text"; text: string }> = [
    { type: "text", text: JSON.stringify(meta, null, 2) },
  ];
  if (input.include_html) {
    const html = await readHtml(screen);
    out.push({ type: "text", text: "```html\n" + html + "\n```" });
  }
  return { content: out };
}

function summarize(
  saved: { id: string; project: string; name: string; htmlPath: string; pngPath: string; tokens: { input: number; output: number; cacheRead: number }; model: string },
  render: { width: number; height: number },
  extra?: { iteratedFrom?: string; result?: { costUsd?: number; durationMs?: number } }
): string {
  const lines = [
    `✓ Generated: ${saved.project} / ${saved.name}`,
    `  ID: ${saved.id}`,
    `  Size: ${render.width}×${render.height}`,
    `  HTML: ${saved.htmlPath}`,
    `  PNG:  ${saved.pngPath}`,
    `  Model: ${saved.model}  (backend: ${activeBackend()})`,
  ];
  if (saved.tokens.input || saved.tokens.output) {
    lines.push(`  Tokens: in=${saved.tokens.input} out=${saved.tokens.output} cache=${saved.tokens.cacheRead}`);
  }
  if (extra?.result?.costUsd) {
    lines.push(`  Cost: $${extra.result.costUsd.toFixed(4)}`);
  }
  if (extra?.result?.durationMs) {
    lines.push(`  Duration: ${(extra.result.durationMs / 1000).toFixed(1)}s`);
  }
  if (extra?.iteratedFrom) lines.push(`  Iterated from: ${extra.iteratedFrom}`);
  return lines.join("\n");
}

// ---------- Transport ----------

async function main() {
  const backend = activeBackend();
  if (backend === "api" && !process.env.ANTHROPIC_API_KEY) {
    console.error("Error: CLAUDE_BACKEND=api but ANTHROPIC_API_KEY not set");
    process.exit(1);
  }
  process.stderr.write(`[mockit-mcp] backend=${backend}\n`);

  const transport = process.env.MCP_TRANSPORT ?? "stdio";

  if (transport === "stdio") {
    const t = new StdioServerTransport();
    await server.connect(t);
    process.stderr.write("[mockit-mcp] stdio transport ready\n");
  } else if (transport === "http") {
    const port = parseInt(process.env.HTTP_PORT ?? "7821", 10);
    const app = express();
    app.use(express.json({ limit: "10mb" }));

    const httpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    await server.connect(httpTransport);

    app.post("/mcp", async (req, res) => {
      await httpTransport.handleRequest(req, res, req.body);
    });
    app.get("/health", (_req, res) => res.json({ ok: true, transport: "http" }));

    app.listen(port, () => {
      process.stderr.write(`[mockit-mcp] http transport ready on :${port}/mcp\n`);
    });
  } else {
    console.error(`Unknown MCP_TRANSPORT: ${transport}`);
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  await shutdownRenderer();
  process.exit(0);
});
process.on("SIGINT", async () => {
  await shutdownRenderer();
  process.exit(0);
});

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
