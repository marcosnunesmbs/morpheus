import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { StructuredTool } from '@langchain/core/tools';
import type { ToolContext } from '../types.js';
import { truncateOutput } from '../utils.js';
import { registerToolFactory } from '../registry.js';
import { PATHS } from '../../config/paths.js';
import type { Browser, Page } from 'puppeteer-core';

// ─── Module-level browser singleton ────────────────────────────────────────
let browserInstance: Browser | null = null;
let pageInstance: Page | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let installPromise: Promise<string> | null = null;

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Ensures Chromium is downloaded to ~/.morpheus/cache/browser/.
 * Downloads only once; subsequent calls return the cached executablePath.
 */
async function ensureChromium(): Promise<string> {
  const {
    install,
    resolveBuildId,
    detectBrowserPlatform,
    computeExecutablePath,
    Browser: PBrowser,
  } = await import('@puppeteer/browsers');

  const platform = detectBrowserPlatform()!;
  const buildId = await resolveBuildId(PBrowser.CHROME, platform, 'stable');

  // Check if already installed
  const execPath = computeExecutablePath({
    browser: PBrowser.CHROME,
    buildId,
    cacheDir: PATHS.browser,
  });

  const { default: fs } = await import('fs-extra');
  if (await fs.pathExists(execPath)) {
    return execPath;
  }

  // Download with progress indicator
  process.stdout.write('[Morpheus] Installing Chromium for browser tools (first run, ~150MB)...\n');
  const installed = await install({
    browser: PBrowser.CHROME,
    buildId,
    cacheDir: PATHS.browser,
    downloadProgressCallback: (downloaded: number, total: number) => {
      const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
      process.stdout.write(`\r[Morpheus] Downloading Chromium: ${pct}%   `);
    },
  });
  process.stdout.write('\n[Morpheus] Chromium installed successfully.\n');
  return installed.executablePath;
}

/**
 * Returns (or creates) the browser singleton, resetting the idle timer.
 * Handles Chromium lazy-install with a lock to prevent concurrent downloads.
 */
async function acquireBrowser(): Promise<{ browser: Browser; page: Page }> {
  const { launch } = await import('puppeteer-core');

  const needsLaunch = !browserInstance || !browserInstance.connected;

  if (needsLaunch) {
    if (!installPromise) {
      installPromise = ensureChromium().finally(() => {
        installPromise = null;
      });
    }
    const executablePath = await installPromise;

    // Re-check after awaiting (another caller may have launched already)
    if (!browserInstance || !browserInstance.connected) {
      browserInstance = await launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
      });
      pageInstance = await browserInstance.newPage();
    }
  } else if (!pageInstance || pageInstance.isClosed()) {
    pageInstance = await browserInstance!.newPage();
  }

  // Reset idle timeout
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    try { await pageInstance?.close(); } catch { /* ignore */ }
    try { await browserInstance?.close(); } catch { /* ignore */ }
    pageInstance = null;
    browserInstance = null;
    idleTimer = null;
  }, IDLE_TIMEOUT_MS);

  return { browser: browserInstance!, page: pageInstance! };
}

// Best-effort cleanup on process exit
process.on('exit', () => {
  try { (browserInstance as any)?.process()?.kill(); } catch { /* ignore */ }
});

// ─── Tool Definitions ───────────────────────────────────────────────────────

const browserNavigateTool = tool(
  async ({ url, wait_until, timeout_ms, return_html }) => {
    try {
      const { page } = await acquireBrowser();
      await page.goto(url, {
        waitUntil: (wait_until ?? 'domcontentloaded') as any,
        timeout: timeout_ms ?? 30_000,
      });
      const title = await page.title();
      const text: string = await page.evaluate(() => document.body.innerText);
      const result: Record<string, unknown> = {
        success: true,
        url,
        current_url: page.url(),
        title,
        text: truncateOutput(text),
      };
      if (return_html) {
        result.html = truncateOutput(await page.content());
      }
      return JSON.stringify(result);
    } catch (err: any) {
      return JSON.stringify({ success: false, url, error: err.message });
    }
  },
  {
    name: 'browser_navigate',
    description:
      'Navigate to a URL in a real browser (executes JavaScript). Use instead of http_request for SPAs, JS-heavy pages, or sites requiring interaction. Returns page title and text content.',
    schema: z.object({
      url: z.string().describe('Full URL to navigate to (must include https://)'),
      wait_until: z
        .enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2'])
        .optional()
        .describe('Wait condition. Default: domcontentloaded. Use networkidle0 for SPAs.'),
      timeout_ms: z.number().optional().describe('Navigation timeout in ms. Default: 30000'),
      return_html: z
        .boolean()
        .optional()
        .describe('Also return raw HTML in response. Default: false'),
    }),
  }
);

const browserGetDomTool = tool(
  async ({ selector, include_attributes }) => {
    try {
      const { page } = await acquireBrowser();
      const includeAttrs = include_attributes ?? true;

      const dom = await page.evaluate(
        ({ sel, attrs }: { sel: string | null; attrs: boolean }) => {
          const root: Element | null = sel
            ? document.querySelector(sel)
            : document.body;
          if (!root) return null;

          const RELEVANT_ATTRS = [
            'href', 'src', 'type', 'name', 'value',
            'placeholder', 'action', 'id', 'role', 'aria-label',
          ];

          function serialize(el: Element, depth: number): object {
            const hasChildren = el.children.length > 0;
            const node: Record<string, unknown> = {
              tag: el.tagName.toLowerCase(),
            };
            if (el.id) node.id = el.id;
            if (el.className) node.class = el.className;
            if (!hasChildren) {
              const txt = el.textContent?.trim();
              if (txt) node.text = txt.slice(0, 120);
            }
            if (attrs && el.attributes.length > 0) {
              const attrMap: Record<string, string> = {};
              for (const attr of el.attributes) {
                if (RELEVANT_ATTRS.includes(attr.name)) {
                  attrMap[attr.name] = attr.value;
                }
              }
              if (Object.keys(attrMap).length) node.attrs = attrMap;
            }
            if (depth < 6 && hasChildren) {
              node.children = Array.from(el.children)
                .slice(0, 40)
                .map((c) => serialize(c, depth + 1));
            }
            return node;
          }

          return serialize(root, 0);
        },
        { sel: selector ?? null, attrs: includeAttrs }
      );

      if (!dom) {
        return JSON.stringify({ success: false, error: `Element not found: ${selector}` });
      }

      return JSON.stringify({ success: true, current_url: page.url(), dom: truncateOutput(JSON.stringify(dom, null, 2)) });
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  },
  {
    name: 'browser_get_dom',
    description:
      'Get a simplified DOM tree of the current page or a specific element. ' +
      'ALWAYS call this BEFORE browser_click or browser_fill to inspect page structure and identify the correct CSS selectors. ' +
      'Never guess selectors — analyze the DOM first.',
    schema: z.object({
      selector: z
        .string()
        .optional()
        .describe('CSS selector to scope the DOM tree to. Omit to get the full body.'),
      include_attributes: z
        .boolean()
        .optional()
        .describe(
          'Include relevant attributes (href, src, type, name, value, placeholder, role, aria-label). Default: true'
        ),
    }),
  }
);

const browserClickTool = tool(
  async ({ selector, text, timeout_ms, wait_after_ms }) => {
    try {
      const { page } = await acquireBrowser();

      if (!selector && !text) {
        return JSON.stringify({ success: false, error: 'Provide either selector or text' });
      }

      const clickTimeout = timeout_ms ?? 10_000;
      if (text) {
        // Use Puppeteer pseudo-selector to find element by visible text
        await page.locator(`::-p-text(${text})`).setTimeout(clickTimeout).click();
      } else {
        await page.locator(selector!).setTimeout(clickTimeout).click();
      }

      if (wait_after_ms) {
        await new Promise((r) => setTimeout(r, wait_after_ms));
      }

      return JSON.stringify({
        success: true,
        current_url: page.url(),
        title: await page.title(),
      });
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  },
  {
    name: 'browser_click',
    description:
      'Click an element on the current browser page by CSS selector or visible text. ' +
      'The page must already be loaded via browser_navigate. ' +
      'Always inspect the DOM with browser_get_dom first to find the correct selector.',
    schema: z.object({
      selector: z
        .string()
        .optional()
        .describe('CSS selector of the element to click (e.g. "button#submit", ".btn-login")'),
      text: z
        .string()
        .optional()
        .describe('Click element containing this visible text (alternative to selector)'),
      timeout_ms: z
        .number()
        .optional()
        .describe('Timeout to wait for the element in ms. Default: 10000'),
      wait_after_ms: z
        .number()
        .optional()
        .describe('Wait this many ms after clicking (for page transitions/animations). Default: 0'),
    }),
  }
);

const browserFillTool = tool(
  async ({ selector, value, press_enter, timeout_ms }) => {
    try {
      const { page } = await acquireBrowser();
      await page.locator(selector).setTimeout(timeout_ms ?? 10_000).fill(value);
      if (press_enter) {
        await page.keyboard.press('Enter');
      }
      return JSON.stringify({ success: true, selector, filled: true });
    } catch (err: any) {
      return JSON.stringify({ success: false, selector, error: err.message });
    }
  },
  {
    name: 'browser_fill',
    description:
      'Fill a form input or textarea field with a value. Clears any existing content first. ' +
      'Always inspect the DOM with browser_get_dom first to identify the correct CSS selector.',
    schema: z.object({
      selector: z.string().describe('CSS selector of the input/textarea element'),
      value: z.string().describe('Value to type into the field'),
      press_enter: z
        .boolean()
        .optional()
        .describe('Press Enter after filling (triggers form submit in many cases). Default: false'),
      timeout_ms: z
        .number()
        .optional()
        .describe('Timeout to find the element in ms. Default: 10000'),
    }),
  }
);

/**
 * Search via DuckDuckGo Lite (plain HTML, no JS, no bot detection).
 * Uses a simple POST fetch — no browser required, much faster and more reliable
 * than headless browser scraping of Google.
 *
 * DDG Lite returns results as: href="URL" class='result-link'>TITLE</a>
 * and <td class='result-snippet'>SNIPPET</td>, paired by index.
 * Sponsored links have URLs starting with "https://duckduckgo.com/y.js" and are filtered out.
 */
const browserSearchTool = tool(
  async ({ query, num_results, language }) => {
    try {
      const max = num_results ?? 10;

      // DDG region codes: "br-pt" for Brazil/Portuguese, "us-en" for US/English, etc.
      // Map from simple lang code to DDG kl param
      const regionMap: Record<string, string> = {
        pt: 'br-pt', br: 'br-pt',
        en: 'us-en', us: 'us-en',
        es: 'es-es', fr: 'fr-fr',
        de: 'de-de', it: 'it-it',
        jp: 'jp-jp', ar: 'ar-es',
      };
      const lang = language ?? 'pt';
      const kl = regionMap[lang] ?? lang;

      const body = new URLSearchParams({ q: query, kl }).toString();

      const res = await fetch('https://lite.duckduckgo.com/lite/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        body,
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        return JSON.stringify({ success: false, query, error: `HTTP ${res.status}` });
      }

      const html = await res.text();

      // Extract all result-link anchors (href uses double quotes, class uses single quotes)
      const linkPattern = /href="(https?:\/\/[^"]+)"[^>]*class='result-link'>([^<]+)<\/a>/g;
      const snippetPattern = /class='result-snippet'>([\s\S]*?)<\/td>/g;

      const allLinks = [...html.matchAll(linkPattern)];
      const allSnippets = [...html.matchAll(snippetPattern)];

      // Pair links with snippets by index, filtering sponsored (DDG y.js redirect URLs)
      const results: { title: string; url: string; snippet: string }[] = [];
      for (let i = 0; i < allLinks.length && results.length < max; i++) {
        const url = allLinks[i][1];
        const title = allLinks[i][2].trim();
        // Skip sponsored ads (redirected through duckduckgo.com/y.js)
        if (url.startsWith('https://duckduckgo.com/')) continue;
        const snippet = allSnippets[i]
          ? allSnippets[i][1].replace(/<[^>]+>/g, '').trim()
          : '';
        results.push({ title, url, snippet });
      }

      if (results.length === 0) {
        return JSON.stringify({
          success: false,
          query,
          error: 'No results found. The query may be too specific or DDG returned an unexpected response.',
        });
      }

      return JSON.stringify({ success: true, query, results });
    } catch (err: any) {
      return JSON.stringify({ success: false, query, error: err.message });
    }
  },
  {
    name: 'browser_search',
    description:
      'Search the internet using DuckDuckGo and return structured results (title, URL, snippet). ' +
      'Use this when you need to find current information, news, articles, documentation, or any web content. ' +
      'Returns up to 10 results by default. Does NOT require browser_navigate first — it is self-contained and fast.',
    schema: z.object({
      query: z.string().describe('Search query'),
      num_results: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe('Number of results to return. Default: 10, max: 20'),
      language: z
        .string()
        .optional()
        .describe('Language/region code (e.g. "pt" for Portuguese/Brazil, "en" for English). Default: "pt"'),
    }),
  }
);

// ─── Factory ────────────────────────────────────────────────────────────────

export function createBrowserTools(_ctx: ToolContext): StructuredTool[] {
  if (process.env.MORPHEUS_BROWSER_ENABLED === 'false') {
    return [];
  }
  return [
    browserNavigateTool,
    browserGetDomTool,
    browserClickTool,
    browserFillTool,
    browserSearchTool,
  ];
}

registerToolFactory(createBrowserTools);
