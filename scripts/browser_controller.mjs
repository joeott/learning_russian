#!/usr/bin/env node
/*
 * Repo-local browser controller for the iterative improvement loop.
 *
 * The Codex in-app Browser tool is not always exposed to worker sessions, so
 * this script provides the same basic inspection surface through Playwright:
 * open URLs, set desktop/mobile viewports, collect console/page errors,
 * snapshot DOM text/rects, and write screenshots.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function importPlaywright() {
  const candidates = [
    "playwright",
    path.join(ROOT, "node_modules", "playwright", "index.mjs"),
    "/tmp/zastolom-loop/node_modules/playwright/index.mjs",
  ];
  for (const candidate of candidates) {
    try {
      if (candidate === "playwright") return await import(candidate);
      await fs.access(candidate);
      return await import(pathToFileURL(candidate).href);
    } catch (_) {}
  }
  throw new Error("Playwright not found. Install repo dev dependencies with `npm install`.");
}

function parseArgs(argv) {
  const args = {
    url: "http://localhost:8000/web/",
    out: path.join(ROOT, "tmp", "browser"),
    viewports: ["desktop", "mobile"],
    clickTexts: [],
    waitMs: 500,
    strict: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i];
    else if (a === "--out") args.out = path.resolve(argv[++i]);
    else if (a === "--desktop") args.viewports = ["desktop"];
    else if (a === "--mobile") args.viewports = ["mobile"];
    else if (a === "--both") args.viewports = ["desktop", "mobile"];
    else if (a === "--click-text") args.clickTexts.push(argv[++i]);
    else if (a === "--wait-ms") args.waitMs = Number(argv[++i] || args.waitMs);
    else if (a === "--strict") args.strict = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (!a.startsWith("-")) args.url = a;
    else throw new Error(`Unknown option: ${a}`);
  }
  return args;
}

function help() {
  return `Usage:
  tools/zastolom browser [url] [--desktop|--mobile|--both] [--click-text TEXT ...] [--strict] [--out DIR]

Examples:
  tools/zastolom browser http://localhost:8000/web/
  tools/zastolom browser http://localhost:8000/web/#/quiz/listen --mobile --click-text "Show caption hint"
  tools/zastolom browser http://localhost:8000/web/#/quiz/roleplay --mobile --click-text "Reveal model answer" --click-text "Close with model"
`;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTextForMatch(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripDecorations(value) {
  const text = normalizeTextForMatch(value);
  return text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenMatchNeedle(needle, candidate) {
  const needleTokens = stripDecorations(needle)
    .split(" ")
    .filter(Boolean)
    .filter((token) => token.length > 1 && !["open", "go", "start", "show"].includes(token));
  if (!needleTokens.length) {
    return false;
  }
  const candidateTokens = new Set(stripDecorations(candidate).split(" ").filter(Boolean));
  if (!candidateTokens.size) {
    return false;
  }
  const shared = needleTokens.filter((token) => candidateTokens.has(token));
  return shared.length >= Math.min(1, needleTokens.length) && shared.length >= Math.ceil(needleTokens.length / 2);
}

function makeLooseTextPattern(value) {
  return normalizeTextForMatch(value).split(/\s+/).map(escapeRegex).join("\\s+");
}

async function clickByText(page, clickText, logs) {
  const cleanText = String(clickText || "").trim();
  if (!cleanText) {
    return false;
  }
  const directNeedle = normalizeTextForMatch(cleanText);
  const directCandidates = await page.locator("button, [role='button'], a, [role='link']").all();
  for (const candidate of directCandidates) {
    const texts = await candidate.evaluate((el) => {
      const primary = (el.textContent || "").trim();
      const aria = el.getAttribute("aria-label") || "";
      const placeholder = el.getAttribute("placeholder") || "";
      const value = el.getAttribute("value") || "";
      const href = el.getAttribute("href") || "";
      return [primary, aria, placeholder, value, href].filter(Boolean);
    });
    const matches = texts.some((text) => {
      const normalized = normalizeTextForMatch(text);
      return normalized === directNeedle || normalized.includes(directNeedle) || directNeedle.includes(normalized);
    });
    const tokenMatch = tokenMatchNeedle(cleanText, texts.join(" "));
    if (!matches && !tokenMatch) {
      continue;
    }
    try {
      await candidate.scrollIntoViewIfNeeded();
      await candidate.click({ timeout: 2000 });
      logs.push({ type: "controller", text: `clicked '${cleanText}' via direct element scan` });
      return true;
    } catch (err) {
      logs.push({
        type: "controller",
        text: `direct element scan click failed for '${cleanText}': ${(err && err.message) ? err.message : String(err)}`,
      });
    }
  }
  const patterns = [
    {
      label: "exact text",
      locator: () => page.getByText(new RegExp(`^${makeLooseTextPattern(cleanText)}$`, "i")),
    },
    {
      label: "exact link",
      locator: () => page.getByRole("link", { name: new RegExp(`^${makeLooseTextPattern(cleanText)}$`, "i") }),
    },
    {
      label: "exact button",
      locator: () => page.getByRole("button", { name: new RegExp(`^${makeLooseTextPattern(cleanText)}$`, "i") }),
    },
    {
      label: "fuzzy",
      locator: () => page.getByText(new RegExp(makeLooseTextPattern(cleanText), "i")),
    },
    {
      label: "link fuzzy",
      locator: () => page.getByRole("link", { name: new RegExp(makeLooseTextPattern(cleanText), "i") }),
    },
    {
      label: "button fuzzy",
      locator: () => page.getByRole("button", { name: new RegExp(makeLooseTextPattern(cleanText), "i") }),
    },
  ];

  for (const { label, locator } of patterns) {
    try {
      const candidate = locator();
      const count = await candidate.count();
      if (count <= 0) continue;
      const target = candidate.first();
      const visible = await target.isVisible().catch(() => true);
      if (!visible) {
        logs.push({ type: "controller", text: `${label} candidate not visible for '${cleanText}', trying fallback` });
      }
      await target.scrollIntoViewIfNeeded();
      await target.click({ timeout: 2000 });
      logs.push({ type: "controller", text: `clicked '${cleanText}' via ${label} (${count} match) -> ${await target.evaluate((el) => (el.innerText || "").trim().slice(0, 120))}` });
      return true;
    } catch (err) {
      logs.push({
        type: "controller",
        text: `${label} click attempt failed for '${cleanText}': ${(err && err.message) ? err.message : String(err)}`,
      });
    }
  }

  try {
    const fallbackNeedle = normalizeTextForMatch(cleanText);
    const allCandidates = await page.locator("button, [role='button'], a, [role='link']").all();
    for (const candidate of allCandidates) {
      const candidateTexts = await candidate.evaluate((el) => {
        return [
          (el.textContent || "").trim(),
          el.getAttribute("aria-label") || "",
          el.getAttribute("placeholder") || "",
          el.getAttribute("value") || "",
          el.getAttribute("href") || "",
        ].filter(Boolean);
      });
      const matchesNeedle = candidateTexts.some((text) => {
        const normalized = normalizeTextForMatch(text);
        return normalized === fallbackNeedle || normalized.includes(fallbackNeedle) || fallbackNeedle.includes(normalized);
      });
      const tokenMatch = tokenMatchNeedle(cleanText, candidateTexts.join(" "));
      if (!matchesNeedle && !tokenMatch) continue;
      try {
        const visible = await candidate.isVisible().catch(() => true);
        if (!visible) {
          logs.push({ type: "controller", text: `fallback candidate not visible for '${cleanText}', forcing click attempt` });
        }
        await candidate.scrollIntoViewIfNeeded();
        await candidate.click({ timeout: 3000 });
        logs.push({ type: "controller", text: `clicked '${cleanText}' via fallback element match` });
        return true;
      } catch (fallbackErr) {
        logs.push({
          type: "controller",
          text: `fallback click attempt failed for '${cleanText}': ${(fallbackErr && fallbackErr.message) ? fallbackErr.message : String(fallbackErr)}`,
        });
      }
    }
  } catch (fallbackErr) {
    logs.push({
      type: "controller",
      text: `fallback search failed for '${cleanText}': ${(fallbackErr && fallbackErr.message) ? fallbackErr.message : String(fallbackErr)}`,
    });
  }
  return false;
}

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
};

export async function inspectPage(page, name, outDir) {
  const screenshot = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const data = await page.evaluate(() => {
    const text = (sel) => document.querySelector(sel)?.innerText || "";
    const selector = [
      "button", "a", "input", ".card", ".stagecard", ".ring", ".stat",
      ".quiz__prompt", ".feedback", ".listenhint", ".scenario", ".opt",
      ".offlinebox", ".offlinebox__status", ".lessonlock", "select",
    ].join(",");
    const rects = [...document.querySelectorAll(selector)].slice(0, 120).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        cls: String(el.className || ""),
        text: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").slice(0, 160),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    });
    return {
      title: document.title,
      hash: location.hash,
      section: text(".section-head"),
      prompt: text(".quiz__prompt"),
      feedback: text("#qfeedback"),
      bodyStart: document.body.innerText.slice(0, 1400),
      rects,
    };
  });
  return { screenshot, data };
}

export async function runInspection(opts) {
  const { chromium } = await importPlaywright();
  await fs.mkdir(opts.out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const viewportName of opts.viewports) {
      const page = await browser.newPage({ viewport: VIEWPORTS[viewportName] });
      const logs = [];
      page.on("console", (msg) => logs.push({ type: msg.type(), text: msg.text() }));
      page.on("pageerror", (err) => logs.push({ type: "pageerror", text: err.message }));
      page.on("requestfailed", (req) => {
        const errorText = req.failure()?.errorText || "failed";
        logs.push({ type: "requestfailed", text: `${req.method()} ${req.url()} -> ${errorText}` });
      });
      await page.setDefaultTimeout(12000);
      await page.goto(opts.url, { waitUntil: "networkidle" });
      await page.waitForFunction(() => Boolean(document.body && document.body.innerText !== undefined));
      await page.waitForTimeout(opts.waitMs);
      const before = await inspectPage(page, `${viewportName}-before`, opts.out);
      const steps = [];
      for (const [index, clickText] of opts.clickTexts.entries()) {
        const step = { clickText };
        try {
          const clicked = await clickByText(page, clickText, logs);
          if (!clicked) {
            logs.push({ type: "controller", text: `Could not click '${clickText}'` });
            step.error = `Could not click '${clickText}'`;
            steps.push(step);
            continue;
          }
        } catch (err) {
          logs.push({ type: "controller", text: `click error for '${clickText}': ${(err && err.message) || err}` });
          step.error = `Could not click '${clickText}'`;
          steps.push(step);
          continue;
        }
        await page.waitForFunction(() => Boolean(document.body));
        await page.waitForTimeout(Math.max(200, opts.waitMs));
        step.snapshot = await inspectPage(page, `${viewportName}-step-${index + 1}`, opts.out);
        steps.push(step);
      }
      if (opts.strict && steps.some((step) => step.error)) {
        const failures = steps.filter((step) => step.error).length;
        throw new Error(`browser controller strict mode failed: ${failures}/${steps.length} click steps failed`);
      }
      results.push({ viewport: viewportName, url: opts.url, before, steps, after: steps.length ? steps[steps.length - 1].snapshot : null, logs });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  const reportPath = path.join(opts.out, "report.json");
  await fs.writeFile(reportPath, JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2));
  return { reportPath, results };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(help());
    return;
  }
  const result = await runInspection(opts);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.stack || e.message);
    process.exit(1);
  });
}
