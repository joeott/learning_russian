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
  const firstValue = await page.locator(".lessonlock select option").first().getAttribute("value");
  const lessonSummaryById = async (lessonId) => await page.evaluate((lessonId) => {
    const { items = [], cloze_cards = [], dictation_cards = [], stress_cards = [], pronunciation_cards = [], backtranslation_cards = [], contrast_cards = [], scenarios = [] } = window.CONTENT_DATA;
    const { lessons = [] } = window.CONTENT_DATA.curriculum || {};
    const target = lessons.find((lesson) => lesson.lesson_id === lessonId);
    const lessonNumber = target ? target.lesson_number : (lessons[0] || {}).lesson_number || 1;
    const hasLessonAccess = (card) => !card.lesson_number || card.lesson_number <= lessonNumber;
    const unlockedItems = items.filter((item) => item.lesson_number <= lessonNumber);
    const scenarioIds = new Set((scenarios || []).flatMap((s) => s.required_items || []));
    const hasScenarios = (scenarios || []).length > 0;
    const isRoleplay = hasScenarios
      ? (it) => scenarioIds.has(it.id)
      : (it) => it.priority <= 2 && (it.ru_plain.includes(" ") || it.tags.includes("toast"));
    return {
      lessonNumber,
      phrasesUnlocked: unlockedItems.length,
      phrasesTotal: items.length,
      recognition: unlockedItems.length,
      recall: unlockedItems.length,
      produce: unlockedItems.length,
      listen: unlockedItems.filter((it) => it.syllables >= 1).length,
      roleplay: unlockedItems.filter(isRoleplay).length,
      cloze: cloze_cards.filter(hasLessonAccess).length,
      dictation: dictation_cards.filter(hasLessonAccess).length,
      stress: stress_cards.filter(hasLessonAccess).length,
      pronounce: pronunciation_cards.filter(hasLessonAccess).length,
      backtranslate: backtranslation_cards.filter(hasLessonAccess).length,
      contrast: contrast_cards.filter(hasLessonAccess).length,
      totals: {
        cloze: cloze_cards.length,
        dictation: dictation_cards.length,
        stress: stress_cards.length,
        pronounce: pronunciation_cards.length,
        backtranslate: backtranslation_cards.length,
        contrast: contrast_cards.length,
      },
    };
  }, lessonId);

  await assertText(page, "Practice is constrained to Lesson 1");
  const expected = await lessonSummaryById(firstValue);
  await assertText(page, `${expected.phrasesUnlocked}/${expected.phrasesTotal} PHRASES UNLOCKED`);

  const metaText = (await page.locator(".lessonlock__meta").innerText()).toLowerCase();
  if (!metaText.includes(`${expected.phrasesUnlocked}/${expected.phrasesTotal} phrases unlocked`)) {
    throw new Error(`Lesson lock meta mismatch: phrases unlocked expected ${expected.phrasesUnlocked}/${expected.phrasesTotal}`);
  }
  if (!metaText.includes(`${expected.cloze}/${expected.totals.cloze} cloze`)) {
    throw new Error(`Lesson lock meta mismatch: cloze unlocked expected ${expected.cloze}/${expected.totals.cloze}`);
  }
  if (!metaText.includes(`${expected.dictation}/${expected.totals.dictation} dictation`)) {
    throw new Error(`Lesson lock meta mismatch: dictation unlocked expected ${expected.dictation}/${expected.totals.dictation}`);
  }
  if (!metaText.includes(`${expected.stress}/${expected.totals.stress} stress`)) {
    throw new Error(`Lesson lock meta mismatch: stress unlocked expected ${expected.stress}/${expected.totals.stress}`);
  }
  if (!metaText.includes(`${expected.pronounce}/${expected.totals.pronounce} pronounce`)) {
    throw new Error(`Lesson lock meta mismatch: pronounce unlocked expected ${expected.pronounce}/${expected.totals.pronounce}`);
  }
  if (!metaText.includes(`${expected.backtranslate}/${expected.totals.backtranslate} back-translation`)) {
    throw new Error(`Lesson lock meta mismatch: back-translation unlocked expected ${expected.backtranslate}/${expected.totals.backtranslate}`);
  }
  if (!metaText.includes(`${expected.contrast}/${expected.totals.contrast} contrast`)) {
    throw new Error(`Lesson lock meta mismatch: contrast unlocked expected ${expected.contrast}/${expected.totals.contrast}`);
  }
  const optionCount = await page.locator(".lessonlock select option").count();
  if (optionCount > 1) {
    const secondValue = await page.locator(".lessonlock select option").nth(1).getAttribute("value");
    await select.selectOption(secondValue);
    const second = await lessonSummaryById(secondValue);
    const secondMetaText = (await page.locator(".lessonlock__meta").innerText()).toLowerCase();
    if (!secondMetaText.includes(`${second.phrasesUnlocked}/${second.phrasesTotal} phrases unlocked`)) {
      throw new Error(`Lesson lock meta mismatch: lesson ${second.lessonNumber} expected ${second.phrasesUnlocked}/${second.phrasesTotal}`);
    }
    if (second.phrasesUnlocked < expected.phrasesUnlocked) {
      throw new Error(`Lesson boundary regression: lesson ${second.lessonNumber} unlocked ${second.phrasesUnlocked} < lesson ${expected.lessonNumber} ${expected.phrasesUnlocked}`);
    }
    await assertText(page, `Practice is constrained to Lesson ${second.lessonNumber}`);
    await select.selectOption(firstValue);
    await assertText(page, `Practice is constrained to Lesson ${expected.lessonNumber}`);
    const resetMetaText = (await page.locator(".lessonlock__meta").innerText()).toLowerCase();
    if (!resetMetaText.includes(`${expected.phrasesUnlocked}/${expected.phrasesTotal} phrases unlocked`)) {
      throw new Error(`Lesson lock meta mismatch after reset: phrases unlocked expected ${expected.phrasesUnlocked}/${expected.phrasesTotal}`);
    }
  }

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

  for (const stageKey of ["recognition", "recall", "cloze", "dictation", "stress", "pronounce", "backtranslate", "contrast", "produce", "listen", "roleplay"]) {
    const available = expected[stageKey];
    if (!available) {
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
    const sourceLesson = await page.evaluate(({ stage, itemId }) => {
      const DATA = window.CONTENT_DATA;
      const items = DATA.items || [];
      const sourceCardByStage = {
        cloze: DATA.cloze_cards || [],
        dictation: DATA.dictation_cards || [],
        stress: DATA.stress_cards || [],
        pronounce: DATA.pronunciation_cards || [],
        backtranslate: DATA.backtranslation_cards || [],
        contrast: DATA.contrast_cards || [],
      };
      if (sourceCardByStage[stage]) {
        const card = sourceCardByStage[stage].find((c) => c.id === itemId);
        if (!card) return null;
        const source = items.find((it) => it.id === card.item_id);
        return source ? source.lesson_number : null;
      }
      if (stage === "roleplay") {
        const source = items.find((it) => it.id === itemId);
        return source ? source.lesson_number : null;
      }
      const source = items.find((it) => it.id === itemId);
      return source ? source.lesson_number : null;
    }, { stage: stageKey, itemId: promptedStage.id });
    if (Number.isFinite(sourceLesson) && sourceLesson > expected.lessonNumber) {
      throw new Error(`Lesson source mismatch: ${promptedStage.id} in ${stageKey} uses source lesson ${sourceLesson}, expected <= ${expected.lessonNumber}`);
    }
  }

  await page.goto(withHash(baseUrl, "#/quiz"), { waitUntil: "networkidle" });
  const lastValue = await page.locator(".lessonlock select option").last().getAttribute("value");
  await select.selectOption(lastValue);
  const terminal = await lessonSummaryById(lastValue);
  const terminalMetaText = (await page.locator(".lessonlock__meta").innerText()).toLowerCase();
  if (!terminalMetaText.includes(`${terminal.phrasesUnlocked}/${terminal.phrasesTotal} phrases unlocked`)) {
    throw new Error(`Lesson lock terminal meta mismatch: phrases unlocked expected ${terminal.phrasesUnlocked}/${terminal.phrasesTotal}`);
  }
  if (terminal.phrasesUnlocked !== terminal.phrasesTotal) {
    throw new Error(`Terminal lesson should unlock all phrases at selected boundary ${terminal.lessonNumber}, got ${terminal.phrasesUnlocked}/${terminal.phrasesTotal}`);
  }
  return prompted;
}

async function checkStage(page, baseUrl, stageKey, interact) {
  await page.goto(withHash(baseUrl, `#/quiz/${stageKey}`), { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  const hasQuiz = await page.locator(".quiz").count();
  if (!hasQuiz) {
    await page.waitForTimeout(250);
    const headerText = await page.locator("#view").innerText();
    if (!headerText.toLowerCase().includes(`${stageKey} — done`) && !headerText.toLowerCase().includes("done")) {
      throw new Error(`${stageKey} did not render a drill question or completion screen`);
    }
    return;
  }
  await interact();
  await page.waitForTimeout(200);
  if (!(await stageSeen(page, stageKey))) {
    throw new Error(`${stageKey} did not update stage mastery/latency state`);
  }
}


async function stageStateFor(page, itemId, stageKey) {
  return await page.evaluate(({ itemId, stageKey }) => {
    const ns = window.CONTENT_DATA.course.storage_namespace;
    const store = JSON.parse(localStorage.getItem(ns) || "{}");
    const st = store[itemId] && store[itemId].stages && store[itemId].stages[stageKey];
    return {
      seen: (st && st.seen) || 0,
      correct: (st && st.correct) || 0,
      success: (st && st.success_sessions) || 0,
      mastered: !!(st && st.mastered),
    };
  }, { itemId, stageKey });
}

async function assertDictationAcceptedResponse(page, baseUrl) {
  await page.goto(withHash(baseUrl, "#/quiz"), { waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await page.goto(withHash(baseUrl, "#/quiz/dictation"), { waitUntil: "networkidle" });
  await page.waitForSelector(".quiz[data-item-id][data-lesson-number]", { timeout: 5000 });

  const dictationCard = await page.locator(".quiz").evaluate((el) => ({
    itemId: el.dataset.itemId,
  }));
  if (!dictationCard.itemId) {
    throw new Error("Dictation card missing item id for accepted-answer verification");
  }

  const cardData = await page.evaluate((itemId) => {
    const card = (window.CONTENT_DATA.dictation_cards || []).find((c) => c.id === itemId);
    if (!card) return null;
    const accepted = (card.accepted_answers && card.accepted_answers[0]) || card.ru_plain || card.ru;
    return {
      itemId: card.id,
      accepted,
      en: card.en || "",
    };
  }, dictationCard.itemId);
  if (!cardData || !cardData.accepted) {
    throw new Error(`Dictation accepted-answer metadata missing for ${dictationCard.itemId}`);
  }

  const before = await stageStateFor(page, cardData.itemId, "dictation");
  await page.locator("#dictIn").fill(cardData.accepted);
  await page.getByRole("button", { name: /^Check$/i }).click();
  await page.waitForTimeout(250);

  const stillOpen = await page.locator("#dictIn").count();
  if (stillOpen && await page.locator("#qfeedback").innerText() !== "") {
    const nextBtn = page.getByRole("button", { name: /^Next/i });
    if (await nextBtn.count()) {
      await nextBtn.first().click();
      await page.waitForTimeout(150);
      await page.goto(withHash(baseUrl, "#/quiz"), { waitUntil: "networkidle" });
      await page.waitForTimeout(120);
      await page.goto(withHash(baseUrl, "#/quiz/dictation"), { waitUntil: "networkidle" });
      await page.waitForSelector(".quiz[data-item-id][data-lesson-number]", { timeout: 5000 });
      await page.locator("#dictIn").fill(cardData.accepted);
      await page.getByRole("button", { name: /^Check$/i }).click();
      await page.waitForTimeout(250);
    }
  }

  const after = await stageStateFor(page, cardData.itemId, "dictation");
  if (after.correct <= before.correct) {
    throw new Error(`Dictation accepted response did not increase correct count for ${cardData.itemId}: ${before.correct} -> ${after.correct}`);
  }
  await page.waitForTimeout(120);
  const nextBtn = page.getByRole("button", { name: /^Next/i });
  if (await nextBtn.count()) {
    await nextBtn.first().click();
  }
}

async function assertBacktranslateAcceptedResponse(page, baseUrl) {
  await page.goto(withHash(baseUrl, "#/quiz"), { waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await page.goto(withHash(baseUrl, "#/quiz/backtranslate"), { waitUntil: "networkidle" });
  await page.waitForSelector(".quiz[data-item-id][data-lesson-number]", { timeout: 5000 });

  const backCard = await page.locator(".quiz").evaluate((el) => ({
    itemId: el.dataset.itemId,
  }));
  if (!backCard.itemId) {
    throw new Error("Back-translation card missing item id for accepted-answer verification");
  }

  const cardData = await page.evaluate((itemId) => {
    const card = (window.CONTENT_DATA.backtranslation_cards || []).find((c) => c.id === itemId);
    if (!card) return null;
    const accepted = (card.accepted_answers && card.accepted_answers[0]) || card.ru_plain || card.ru;
    return {
      itemId: card.id,
      accepted,
      en: card.en || "",
    };
  }, backCard.itemId);
  if (!cardData || !cardData.accepted) {
    throw new Error(`Back-translation accepted-answer metadata missing for ${backCard.itemId}`);
  }

  const before = await stageStateFor(page, cardData.itemId, "backtranslate");
  const enNote = cardData.en || "";
  await page.locator("#btEn").fill(enNote);
  await page.getByRole("button", { name: /Hide Russian/i }).click();
  await page.locator("#btStep2").waitFor({ state: "visible", timeout: 5000 });
  await page.locator("#btRu").fill(cardData.accepted);
  await page.getByRole("button", { name: /^Check$/i }).click();
  await page.waitForTimeout(250);

  if (await page.locator("#btRu").count()) {
    const nextBtn = page.getByRole("button", { name: /^Next/i });
    if (await nextBtn.count()) {
      await nextBtn.first().click();
      await page.waitForTimeout(150);
      await page.goto(withHash(baseUrl, "#/quiz"), { waitUntil: "networkidle" });
      await page.waitForTimeout(120);
      await page.goto(withHash(baseUrl, "#/quiz/backtranslate"), { waitUntil: "networkidle" });
      await page.waitForSelector(".quiz[data-item-id][data-lesson-number]", { timeout: 5000 });
      const retriedCard = await page.locator(".quiz").evaluate((el) => el.dataset.itemId);
      if (retriedCard === cardData.itemId) {
        const retriedData = await page.evaluate((itemId) => {
          const card = (window.CONTENT_DATA.backtranslation_cards || []).find((c) => c.id === itemId);
          if (!card) return null;
          return (card.accepted_answers && card.accepted_answers[0]) || card.ru_plain || card.ru;
        }, cardData.itemId);
        if (retriedData) {
          await page.locator("#btEn").fill(enNote);
          await page.getByRole("button", { name: /Hide Russian/i }).click();
          await page.locator("#btStep2").waitFor({ state: "visible", timeout: 5000 });
          await page.locator("#btRu").fill(retriedData);
          await page.getByRole("button", { name: /^Check$/i }).click();
          await page.waitForTimeout(250);
        }
      }
    }
  }

  const after = await stageStateFor(page, cardData.itemId, "backtranslate");
  if (after.correct <= before.correct) {
    throw new Error(`Back-translation accepted response did not increase correct count for ${cardData.itemId}: ${before.correct} -> ${after.correct}`);
  }
  const nextBtn = page.getByRole("button", { name: /^Next/i });
  if (await nextBtn.count()) {
    await nextBtn.first().click();
  }
}

async function assertDueFirstOrdering(page, baseUrl, { stageKey, dueItemId }) {
  if (!dueItemId) {
    throw new Error("adaptive-ordering requires a due item id");
  }
  const seed = await page.evaluate(({ stage, dueItemIdValue }) => {
    const ns = window.CONTENT_DATA.course.storage_namespace;
    const lessons = window.CONTENT_DATA.curriculum.lessons || [];
    const lessonNumber = (lessons[0] || {}).lesson_number || 1;
    const cards = window.CONTENT_DATA.items.filter((it) => it.lesson_number <= lessonNumber);
    const now = Date.now();
    const store = JSON.parse(localStorage.getItem(ns) || "{}");
    cards.forEach((it) => {
      const existing = store[it.id] || { seen: 0, correct: 0, errors: {}, stages: {} };
      const isDue = it.id === dueItemIdValue;
      existing.seen = Math.max(existing.seen || 0, 1);
      existing.correct = existing.correct || 0;
      existing.stages = existing.stages || {};
      existing.stages[stage] = {
        seen: 1,
        correct: 1,
        success_sessions: 1,
        due_at: isDue ? new Date(now - 60_000).toISOString() : new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        stability: 1,
        difficulty: 5,
        retrievability: isDue ? 0.9 : 0.4,
        lapses: 0,
        last_grade: isDue ? "good" : "",
        last_error_type: "",
        last_seen_at: new Date(now).toISOString(),
        delayed_attempts: 0,
        delayed_success: 0,
        mastered: false,
      };
      store[it.id] = existing;
    });
    localStorage.setItem(ns, JSON.stringify(store));
    return { lessonNumber, cardCount: cards.length };
  }, { stage: stageKey, dueItemIdValue: dueItemId });

  await page.evaluate(() => {
    if (!window.__orderedRandom) {
      window.__orderedRandom = Math.random;
    }
    Math.random = () => 0.999;
  });

  try {
    const select = page.locator(".lessonlock select");
    await select.selectOption({ index: 0 });
    await page.reload({ waitUntil: "networkidle" });
    await page.evaluate(() => {
      if (!window.__orderedRandom) {
        window.__orderedRandom = Math.random;
      }
      Math.random = () => 0.999;
    });
    await page.goto(withHash(baseUrl, "#/quiz/produce"), { waitUntil: "networkidle" });
    await page.goto(withHash(baseUrl, `#/quiz/${stageKey}`), { waitUntil: "networkidle" });
    await page.waitForSelector(".quiz[data-item-id][data-lesson-number]", { timeout: 5000 });

    const actual = await page.locator(".quiz").evaluate((el) => el.dataset.itemId);
    const expected = await page.evaluate(({ stage, seedLessonNumber }) => {
      const { items = [] } = window.CONTENT_DATA;
      const ns = window.CONTENT_DATA.course.storage_namespace;
      const pool = items.filter((it) => it.lesson_number <= seedLessonNumber).filter(Boolean);
      const store = JSON.parse(localStorage.getItem(ns) || "{}");
      const isDue = (it) => {
        const state = store[it.id] && store[it.id].stages && store[it.id].stages[stage];
        return !state || !state.due_at || new Date(state.due_at) <= new Date();
      };
      const score = (it) => {
        const state = store[it.id] && store[it.id].stages && store[it.id].stages[stage];
        const due = isDue(it) ? 0 : 1;
        const lapses = state ? state.lapses || 0 : 0;
        const correct = state ? state.correct || 0 : 0;
        return [due, it.priority, correct - lapses];
      };
      const ranked = pool.slice().sort((a, b) => {
        const as = score(a);
        const bs = score(b);
        for (let i = 0; i < as.length; i++) if (as[i] !== bs[i]) return as[i] - bs[i];
        return a.id.localeCompare(b.id);
      });
      const shuffle = (a) => {
        a = a.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };
      const head = ranked.slice(0, 16);
      const q = shuffle(head).slice(0, Math.min(10, head.length));
      return q.map((item) => ({
        id: item.id,
        due: isDue(item),
      }));
    }, { stage: stageKey, seedLessonNumber: seed.lessonNumber });

    if (!expected.length) {
      throw new Error(`adaptive-ordering could not compute expected order for stage ${stageKey}`);
    }
    if (!expected[0].due) {
      throw new Error(`adaptive-ordering expected due item first in ${stageKey}, got non-due ${expected[0].id}`);
    }
    if (actual !== expected[0].id) {
      throw new Error(`adaptive-ordering mismatch for ${stageKey}: rendered ${actual}, expected ${expected[0].id}`);
    }
  } finally {
    await page.evaluate(() => {
      if (window.__orderedRandom) {
        Math.random = window.__orderedRandom;
        window.__orderedRandom = null;
      }
    });
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

async function assertRoleplayTutorPanel(page, baseUrl) {
  await page.goto(withHash(baseUrl, "#/quiz/roleplay"), { waitUntil: "networkidle" });
  await page.waitForSelector(".quiz[data-item-id][data-lesson-number]", { timeout: 5000 });
  const roleplayState = await page.locator(".quiz").evaluate((el) => ({
    itemId: el.dataset.itemId,
    lessonNumber: Number(el.dataset.lessonNumber || 0),
  }));
  if (!roleplayState.itemId) {
    throw new Error("Role-play card missing item id for tutor setup verification");
  }
  const beforeOpenCount = await page.evaluate((itemId) => {
    const ns = window.CONTENT_DATA.course.storage_namespace;
    const store = JSON.parse(localStorage.getItem(ns) || "{}");
    return (store[itemId] && store[itemId].tutor_prompt_opens) || 0;
  }, roleplayState.itemId);
  const tutorButton = page.getByRole("button", { name: /Tutor setup/i });
  if (!(await tutorButton.count())) {
    throw new Error("Role-play tutor button missing; lesson-constrained tutor prompt unavailable");
  }
  await tutorButton.click();
  await page.waitForFunction(() => {
    const panel = document.querySelector("#tutorPanel .tutorbox");
    return panel && panel.innerText.toLowerCase().includes("lesson-constrained ai tutor");
  }, { timeout: 3000 });
  const panelText = (await page.locator("#tutorPanel").innerText()).toLowerCase();
  const promptText = (await page.locator("#tutorPromptText").inputValue()).toLowerCase();
  const expectedBoundary = `lesson ${roleplayState.lessonNumber || 1}`;
  if (!panelText.includes(expectedBoundary)) {
    throw new Error(`Tutor prompt did not include lesson boundary ${expectedBoundary}`);
  }
  if (!promptText.includes("curriculum boundary")) {
    throw new Error("Tutor prompt did not preserve curriculum-boundary constraint");
  }
  const afterOpenCount = await page.evaluate((itemId) => {
    const ns = window.CONTENT_DATA.course.storage_namespace;
    const store = JSON.parse(localStorage.getItem(ns) || "{}");
    return (store[itemId] && store[itemId].tutor_prompt_opens) || 0;
  }, roleplayState.itemId);
  if (afterOpenCount <= beforeOpenCount) {
    throw new Error(`Tutor setup did not persist open count for ${roleplayState.itemId}`);
  }
  if (!(await page.locator("#tutorPromptText").count())) {
    throw new Error("Tutor panel did not render raw prompt text");
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
    await assertDueFirstOrdering(page, opts.url, { stageKey: "recognition", dueItemId: "firs002" });
    completed.push("adaptive-ordering");

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
    await assertDictationAcceptedResponse(page, opts.url);
    completed.push("dictation-accepted");

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
    await assertBacktranslateAcceptedResponse(page, opts.url);
    completed.push("backtranslate-accepted");

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
      await assertRoleplayTutorPanel(page, opts.url);
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
