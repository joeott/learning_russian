#!/usr/bin/env node
/*
 * End-to-end learner-flow verification for the За столо́м PWA.
 *
 * This is intentionally deterministic and local: it drives the browser like a
 * learner, checks localStorage mastery/error state, and fails on console errors.
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
    out: path.join(ROOT, "tmp", "flow-check"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i];
    else if (a === "--out") args.out = path.resolve(argv[++i]);
    else if (a === "--help" || a === "-h") args.help = true;
    else if (!a.startsWith("-")) args.url = a;
    else throw new Error(`Unknown option: ${a}`);
  }
  return args;
}

function help() {
  return `Usage:
  tools/zastolom flow [url] [--out DIR]

Examples:
  tools/zastolom flow http://localhost:8000/web/
`;
}

function withHash(baseUrl, hash) {
  const url = new URL(baseUrl);
  url.hash = hash;
  return url.href;
}

async function assertText(page, text) {
  await page.waitForFunction((needle) => document.body.innerText.includes(needle), text);
  const body = await page.evaluate(() => document.body.innerText);
  if (!body || !body.includes(text)) throw new Error(`Expected page text: ${text}`);
}

async function stageSeen(page, stageKey) {
  return await page.evaluate((key) => {
    const ns = window.CONTENT_DATA.course.storage_namespace;
    const store = JSON.parse(localStorage.getItem(ns) || "{}");
    return Object.values(store).some((rec) => {
      const st = rec && rec.stages && rec.stages[key];
      return st && st.seen > 0 && st.latency_count > 0;
    });
  }, stageKey);
}

async function roleplayCriteriaMissed(page) {
  return await page.evaluate(() => {
    const ns = window.CONTENT_DATA.course.storage_namespace;
    const store = JSON.parse(localStorage.getItem(ns) || "{}");
    return Object.values(store).some((rec) =>
      rec && rec.roleplay_criteria_misses && Object.keys(rec.roleplay_criteria_misses).length > 0
    );
  });
}

async function assertLessonLockedRecognition(page, baseUrl) {
  await page.goto(withHash(baseUrl, "#/quiz"), { waitUntil: "networkidle" });
  const select = page.locator(".lessonlock select");
  await select.selectOption({ index: 0 });
  await assertText(page, "Practice is constrained to Lesson 1");
  const expected = await page.evaluate(() => {
    const first = window.CONTENT_DATA.curriculum.lessons[0];
    const unlocked = window.CONTENT_DATA.items.filter((item) => item.lesson_number <= first.lesson_number);
    return {
      lessonNumber: first.lesson_number,
      unlocked: unlocked.length,
      total: window.CONTENT_DATA.items.length,
    };
  });
  await assertText(page, `${expected.unlocked}/${expected.total} PHRASES UNLOCKED`);

  await page.goto(withHash(baseUrl, "#/quiz/recognition"), { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  const prompted = await page.evaluate(() => {
    const prompt = document.querySelector(".quiz__prompt")?.innerText || "";
    const item = window.CONTENT_DATA.items.find((candidate) => prompt.includes(candidate.ru));
    return item ? { id: item.id, lesson_number: item.lesson_number, ru: item.ru } : null;
  });
  if (!prompted) throw new Error("Could not map lesson-locked recognition prompt to a content item");
  if (prompted.lesson_number > expected.lessonNumber) {
    throw new Error(`Lesson lock violated: ${prompted.id} is lesson ${prompted.lesson_number}, expected <= ${expected.lessonNumber}`);
  }

  await page.goto(withHash(baseUrl, "#/quiz"), { waitUntil: "networkidle" });
  const lastValue = await page.locator(".lessonlock select option").last().getAttribute("value");
  await select.selectOption(lastValue);
  return prompted;
}

async function checkStage(page, baseUrl, stageKey, interact) {
  await page.goto(withHash(baseUrl, `#/quiz/${stageKey}`), { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  await interact();
  await page.waitForTimeout(200);
  if (!(await stageSeen(page, stageKey))) {
    throw new Error(`${stageKey} did not update stage mastery/latency state`);
  }
}

async function checkRepairFocus(page) {
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("repair focus:"));
}

export async function runFlowCheck(opts) {
  const { chromium } = await importPlaywright();
  await fs.mkdir(opts.out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const logs = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") logs.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => logs.push({ type: "pageerror", text: err.message }));

  const completed = [];
  try {
    await page.goto(withHash(opts.url, "#/home"), { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await assertText(page, "CURRICULUM LOCK");
    await assertText(page, "PERFORMANCE SIGNALS");
    completed.push("home");

    await page.goto(withHash(opts.url, "#/learn"), { waitUntil: "networkidle" });
    await assertText(page, "CURRICULUM LOCK");
    completed.push("learn");

    await assertLessonLockedRecognition(page, opts.url);
    completed.push("lesson-lock");

    await checkStage(page, opts.url, "recognition", async () => {
      await page.locator(".opt").first().click();
    });
    completed.push("recognition");

    await checkStage(page, opts.url, "recall", async () => {
      await page.locator(".opt").first().click();
    });
    completed.push("recall");

    await checkStage(page, opts.url, "cloze", async () => {
      await page.locator("#clozeIn").fill("x");
      await page.getByRole("button", { name: /^Check$/i }).click();
      await checkRepairFocus(page);
    });
    completed.push("cloze");

    await checkStage(page, opts.url, "dictation", async () => {
      await page.locator("#dictIn").fill("x");
      await page.getByRole("button", { name: /^Check$/i }).click();
      await checkRepairFocus(page);
    });
    completed.push("dictation");

    await checkStage(page, opts.url, "stress", async () => {
      await page.locator(".opt").first().click();
    });
    completed.push("stress");

    await checkStage(page, opts.url, "pronounce", async () => {
      await page.getByRole("button", { name: /Stress off/i }).click();
    });
    completed.push("pronounce");

    await checkStage(page, opts.url, "backtranslate", async () => {
      await page.locator("#btEn").fill("rough meaning");
      await page.getByRole("button", { name: /Hide Russian/i }).click();
      await page.locator("#btRu").fill("x");
      await page.getByRole("button", { name: /^Check$/i }).click();
      await checkRepairFocus(page);
    });
    completed.push("backtranslate");

    await checkStage(page, opts.url, "contrast", async () => {
      await page.locator(".opt").first().click();
    });
    completed.push("contrast");

    await checkStage(page, opts.url, "produce", async () => {
      await page.locator("#prodIn").fill("x");
      await page.getByRole("button", { name: /^Check$/i }).click();
      await checkRepairFocus(page);
    });
    completed.push("produce");

    await checkStage(page, opts.url, "listen", async () => {
      await page.locator(".opt").first().click();
    });
    completed.push("listen");

    await checkStage(page, opts.url, "roleplay", async () => {
      await page.getByRole("button", { name: /Reveal model answer/i }).click();
      await page.getByRole("button", { name: /Needs repair/i }).click();
    });
    if (!(await roleplayCriteriaMissed(page))) {
      throw new Error("roleplay did not persist criterion-level miss history");
    }
    completed.push("roleplay");

    await page.goto(withHash(opts.url, "#/home"), { waitUntil: "networkidle" });
    await assertText(page, "AVG RESPONSE TIME");
    await assertText(page, "ROLE-PLAY FAILURE SIGNALS");
    await page.screenshot({ path: path.join(opts.out, "home-after-flow.png"), fullPage: true });
    completed.push("analytics");

    if (logs.length) throw new Error(`Browser errors:\n${logs.map((l) => `${l.type}: ${l.text}`).join("\n")}`);

    const report = { generated_at: new Date().toISOString(), url: opts.url, completed, logs };
    await fs.writeFile(path.join(opts.out, "report.json"), JSON.stringify(report, null, 2));
    return report;
  } finally {
    await browser.close();
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(help());
    return;
  }
  const report = await runFlowCheck(opts);
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.stack || e.message);
    process.exit(1);
  });
}
