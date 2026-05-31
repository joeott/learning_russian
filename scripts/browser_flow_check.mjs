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

async function stageRepairFocusSeen(page, stageKey) {
  return await page.evaluate((key) => {
    const ns = window.CONTENT_DATA.course.storage_namespace;
    const store = JSON.parse(localStorage.getItem(ns) || "{}");
    return Object.values(store).some((rec) => {
      const st = rec && rec.stages && rec.stages[key];
      return st && st.last_repair_focus && st.repair_focus_counts && rec.repair_focus_counts;
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

async function assertRepairQueueStartsRound(page, baseUrl) {
  await page.goto(withHash(baseUrl, "#/quiz"), { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("repair queue"));
  const cards = await page.locator(".repaircard").count();
  if (cards < 1) throw new Error("repair queue did not render logged error patterns");
  await page.locator(".repaircard").first().getByRole("button", { name: /Repair now/i }).click();
  await page.waitForFunction(() => location.hash.startsWith("#/quiz/"));
  const hash = await page.evaluate(() => location.hash);
  if (hash === "#/quiz" || !hash.match(/^#\/quiz\/(produce|dictation|stress|pronounce|contrast|roleplay|backtranslate)$/)) {
    throw new Error(`repair queue opened an unexpected target: ${hash}`);
  }
}

async function assertOfflinePackCachesCore(page, baseUrl) {
  await page.goto(withHash(baseUrl, "#/plan"), { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("offline packs"));
  await page.evaluate(async () => {
    if ("caches" in window) await caches.delete("zastolom-offline-pack");
  });
  await page.getByRole("button", { name: /^Core course$/i }).click();
  await page.waitForFunction(() => {
    const text = (document.querySelector("#offlineStatus")?.innerText || "").toLowerCase();
    return text.includes("core 8/8");
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

  const unlockedByStage = await page.evaluate((lessonNumber) => {
    const { items = [], cloze_cards = [], dictation_cards = [], stress_cards = [], pronunciation_cards = [], backtranslation_cards = [], contrast_cards = [] } = window.CONTENT_DATA;
    const hasLessonAccess = (card) => !card.lesson_number || card.lesson_number <= lessonNumber;
    const unlockedItems = items.filter((it) => hasLessonAccess(it));
    const scenarioIds = new Set((window.CONTENT_DATA.scenarios || []).flatMap((s) => s.required_items || []));
    const hasScenarios = (window.CONTENT_DATA.scenarios || []).length > 0;
    const isRoleplay = hasScenarios
      ? (it) => scenarioIds.has(it.id)
      : (it) => it.priority <= 2 && (it.ru_plain.includes(" ") || it.tags.includes("toast"));
    return {
      recognition: unlockedItems.length,
      recall: unlockedItems.length,
      produce: unlockedItems.length,
      listen: unlockedItems.filter((it) => it.syllables >= 1).length,
      roleplay: unlockedItems.filter(isRoleplay).length,
      cloze: cloze_cards.filter(hasLessonAccess),
      dictation: dictation_cards.filter(hasLessonAccess),
      stress: stress_cards.filter(hasLessonAccess),
      pronounce: pronunciation_cards.filter(hasLessonAccess),
      backtranslate: backtranslation_cards.filter(hasLessonAccess),
      contrast: contrast_cards.filter(hasLessonAccess),
    };
  }, expected.lessonNumber);

  for (const stageKey of ["recognition", "recall", "cloze", "dictation", "stress", "pronounce", "backtranslate", "contrast", "produce", "listen", "roleplay"]) {
    const available = unlockedByStage[stageKey];
    const count = Array.isArray(available) ? available.length : available;
    if (!count) {
      continue;
    }
    await page.goto(withHash(baseUrl, `#/quiz/${stageKey}`), { waitUntil: "networkidle" });
    await page.waitForSelector(".quiz[data-item-id][data-lesson-number]", { timeout: 5000 });
    const promptedStage = await page.locator(".quiz").evaluate((el) => ({
      stage: el.dataset.stage,
      id: el.dataset.itemId,
      lessonNumber: Number(el.dataset.lessonNumber || 0),
    }));
    if (promptedStage.stage !== stageKey) {
      throw new Error(`Expected ${stageKey} stage, got ${promptedStage.stage}`);
    }
    if (promptedStage.lessonNumber > expected.lessonNumber) {
      throw new Error(`Lesson lock violated: ${promptedStage.id} in ${stageKey} is lesson ${promptedStage.lessonNumber}, expected <= ${expected.lessonNumber}`);
    }
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

async function checkRepairFocusState(page, stageKey) {
  if (!(await stageRepairFocusSeen(page, stageKey))) {
    throw new Error(`${stageKey} did not persist repair focus state`);
  }
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

    await assertOfflinePackCachesCore(page, opts.url);
    completed.push("offline-pack");

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
      await checkRepairFocusState(page, "cloze");
    });
    completed.push("cloze");

    await checkStage(page, opts.url, "dictation", async () => {
      await page.locator("#dictIn").fill("x");
      await page.getByRole("button", { name: /^Check$/i }).click();
      await checkRepairFocus(page);
      await checkRepairFocusState(page, "dictation");
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
      await checkRepairFocusState(page, "backtranslate");
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
      await checkRepairFocusState(page, "produce");
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

    await assertRepairQueueStartsRound(page, opts.url);
    completed.push("repair-queue");

    await page.goto(withHash(opts.url, "#/home"), { waitUntil: "networkidle" });
    await assertText(page, "AVG RESPONSE TIME");
    await assertText(page, "REPAIR PROFILE");
    const repairProfileRows = await page.locator(".repairprofile__row").count();
    if (repairProfileRows < 1) throw new Error("repair profile did not render persisted repair-focus history");
    await assertText(page, "ROLE-PLAY FAILURE SIGNALS");
    await page.waitForTimeout(1900);
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
