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
    clickText: "",
    waitMs: 500,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i];
    else if (a === "--out") args.out = path.resolve(argv[++i]);
    else if (a === "--desktop") args.viewports = ["desktop"];
    else if (a === "--mobile") args.viewports = ["mobile"];
    else if (a === "--both") args.viewports = ["desktop", "mobile"];
    else if (a === "--click-text") args.clickText = argv[++i];
    else if (a === "--wait-ms") args.waitMs = Number(argv[++i] || args.waitMs);
    else if (a === "--help" || a === "-h") args.help = true;
    else if (!a.startsWith("-")) args.url = a;
    else throw new Error(`Unknown option: ${a}`);
  }
  return args;
}

function help() {
  return `Usage:
  tools/zastolom browser [url] [--desktop|--mobile|--both] [--click-text TEXT] [--out DIR]

Examples:
  tools/zastolom browser http://localhost:8000/web/
  tools/zastolom browser http://localhost:8000/web/#/quiz/listen --mobile --click-text "Show caption hint"
`;
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
      await page.goto(opts.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(opts.waitMs);
      const before = await inspectPage(page, `${viewportName}-before`, opts.out);
      let after = null;
      if (opts.clickText) {
        await page.getByText(opts.clickText, { exact: true }).click();
        await page.waitForTimeout(opts.waitMs);
        after = await inspectPage(page, `${viewportName}-after`, opts.out);
      }
      results.push({ viewport: viewportName, url: opts.url, before, after, logs });
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
