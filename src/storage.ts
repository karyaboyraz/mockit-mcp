import { mkdir, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const DESIGNS_DIR = resolve(process.env.DESIGNS_DIR ?? "./designs");

export interface SavedScreen {
  id: string;
  project: string;
  name: string;
  prompt: string;
  designSystem?: string;
  htmlPath: string;
  pngPath: string;
  createdAt: string;
  parentId?: string;
  tokens: { input: number; output: number; cacheRead: number };
  model: string;
}

export interface SaveInput {
  project: string;
  name: string;
  prompt: string;
  designSystem?: string;
  html: string;
  png: Buffer;
  parentId?: string;
  tokens: { input: number; output: number; cacheRead: number };
  model: string;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function ensureProjectDir(project: string): Promise<string> {
  const dir = join(DESIGNS_DIR, slug(project));
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function saveScreen(input: SaveInput): Promise<SavedScreen> {
  const id = randomUUID();
  const dir = await ensureProjectDir(input.project);
  const base = `${slug(input.name)}-${id.slice(0, 8)}`;
  const htmlPath = join(dir, `${base}.html`);
  const pngPath = join(dir, `${base}.png`);
  const metaPath = join(dir, `${base}.json`);

  const meta: SavedScreen = {
    id,
    project: input.project,
    name: input.name,
    prompt: input.prompt,
    designSystem: input.designSystem,
    htmlPath,
    pngPath,
    createdAt: new Date().toISOString(),
    parentId: input.parentId,
    tokens: input.tokens,
    model: input.model,
  };

  await Promise.all([
    writeFile(htmlPath, input.html, "utf8"),
    writeFile(pngPath, input.png),
    writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8"),
  ]);

  return meta;
}

export async function getScreen(id: string): Promise<SavedScreen | null> {
  // listProjects() returns directory names that are already slugged on disk.
  // Slugging them again is idempotent but misleading — read directly.
  const projects = await listProjects();
  for (const project of projects) {
    const dir = join(DESIGNS_DIR, project);
    const files = await readdir(dir).catch(() => []);
    for (const f of files) {
      if (f.endsWith(".json")) {
        const meta = JSON.parse(await readFile(join(dir, f), "utf8")) as SavedScreen;
        if (meta.id === id) return meta;
      }
    }
  }
  return null;
}

export async function listProjects(): Promise<string[]> {
  const entries = await readdir(DESIGNS_DIR).catch(() => []);
  const projects: string[] = [];
  for (const e of entries) {
    const s = await stat(join(DESIGNS_DIR, e)).catch(() => null);
    if (s?.isDirectory()) projects.push(e);
  }
  return projects;
}

export async function listScreens(project?: string): Promise<SavedScreen[]> {
  const projects = project ? [slug(project)] : await listProjects();
  const result: SavedScreen[] = [];
  for (const p of projects) {
    const dir = join(DESIGNS_DIR, p);
    const files = await readdir(dir).catch(() => []);
    for (const f of files) {
      if (f.endsWith(".json")) {
        const meta = JSON.parse(await readFile(join(dir, f), "utf8")) as SavedScreen;
        result.push(meta);
      }
    }
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function readHtml(screen: SavedScreen): Promise<string> {
  return readFile(screen.htmlPath, "utf8");
}

export { DESIGNS_DIR };
