import { chromium, Browser, BrowserContext } from "playwright";

const VIEWPORT_WIDTH = parseInt(process.env.VIEWPORT_WIDTH ?? "390", 10);
const VIEWPORT_HEIGHT = parseInt(process.env.VIEWPORT_HEIGHT ?? "844", 10);
const DEVICE_SCALE = parseFloat(process.env.DEVICE_SCALE ?? "2");

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserPromise;
}

export async function shutdownRenderer(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
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
