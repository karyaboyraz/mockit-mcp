import { chromium, Browser, BrowserContext } from "playwright";

const VIEWPORT_WIDTH = parseInt(process.env.VIEWPORT_WIDTH ?? "390", 10);
const VIEWPORT_HEIGHT = parseInt(process.env.VIEWPORT_HEIGHT ?? "844", 10);
const DEVICE_SCALE = parseFloat(process.env.DEVICE_SCALE ?? "2");
const NO_SANDBOX = (process.env.PLAYWRIGHT_NO_SANDBOX ?? "auto").toLowerCase();

let browserPromise: Promise<Browser> | null = null;

function shouldDisableSandbox(): boolean {
  if (NO_SANDBOX === "true" || NO_SANDBOX === "1") return true;
  if (NO_SANDBOX === "false" || NO_SANDBOX === "0") return false;
  // 'auto' → only disable inside containers (Docker/Kubernetes/CI), where the
  // setuid sandbox is unavailable. Outside containers we keep Chromium's
  // default sandbox to limit blast radius if model output contains malicious HTML.
  if (process.env.MOCKIT_IN_CONTAINER === "1") return true;
  if (process.env.GITHUB_ACTIONS === "true") return true;
  return false;
}

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const args: string[] = [];
    if (shouldDisableSandbox()) {
      args.push("--no-sandbox", "--disable-setuid-sandbox");
    }
    browserPromise = chromium.launch({ args }).catch((err: Error) => {
      browserPromise = null;
      const hint = err.message.includes("Executable doesn't exist")
        ? "\n→ Run: npx playwright install chromium"
        : "";
      throw new Error(`Failed to launch Chromium: ${err.message}${hint}`);
    });
  }
  return browserPromise;
}

export async function shutdownRenderer(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b) await b.close();
    browserPromise = null;
  }
}

export interface RenderResult {
  png: Buffer;
  width: number;
  height: number;
}

/**
 * Render an HTML string to a PNG screenshot at the configured mobile viewport.
 * Waits for fonts and Tailwind JIT to settle before capturing.
 */
export async function renderHtml(html: string, opts?: { fullPage?: boolean }): Promise<RenderResult> {
  const browser = await getBrowser();
  const context: BrowserContext = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    deviceScaleFactor: DEVICE_SCALE,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  try {
    const page = await context.newPage();

    // Restrict network access to the assets the system prompt actually allows
    // (Tailwind CDN, Google Fonts). Anything else the model produces — tracking
    // pixels, third-party scripts, exfil endpoints — is blocked.
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("data:")) return route.continue();
      try {
        const host = new URL(url).hostname;
        if (
          host === "cdn.tailwindcss.com" ||
          host === "fonts.googleapis.com" ||
          host === "fonts.gstatic.com"
        ) {
          return route.continue();
        }
      } catch {
        /* fallthrough to abort */
      }
      return route.abort();
    });

    await page.setContent(html, { waitUntil: "networkidle", timeout: 30000 });

    // Tailwind CDN compiles classes via JS; wait one tick for JIT.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);

    const png = await page.screenshot({
      type: "png",
      fullPage: opts?.fullPage ?? false,
      omitBackground: false,
    });

    return {
      png,
      width: VIEWPORT_WIDTH * DEVICE_SCALE,
      height: VIEWPORT_HEIGHT * DEVICE_SCALE,
    };
  } finally {
    await context.close();
  }
}
