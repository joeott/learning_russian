/* ============================================================
   ЗА СТОЛО́М — app logic (vanilla, no build step)
   Reads window.CONTENT_DATA (from content.js).
   ============================================================ */
(function () {
  "use strict";

  const DATA = window.CONTENT_DATA;
  if (!DATA) { document.getElementById("view").innerHTML = "<p>Content failed to load.</p>"; return; }
  const COURSE = DATA.course || {};
  const MISSION = COURSE.mission || {};
  const ITEMS = DATA.items;
  const CLOZE_CARDS = DATA.cloze_cards || [];
  const DICTATION_CARDS = DATA.dictation_cards || [];
  const STRESS_CARDS = DATA.stress_cards || [];
  const PRONUNCIATION_CARDS = DATA.pronunciation_cards || [];
  const BACKTRANSLATION_CARDS = DATA.backtranslation_cards || [];
  const TUTOR_CARDS = DATA.tutor_cards || [];
  const CONTRAST_CARDS = DATA.contrast_cards || [];
  const MODULES = DATA.modules;
  const CURRICULUM = DATA.curriculum || {};
  const LESSONS = (CURRICULUM.lessons || []).slice().sort((a, b) => a.lesson_number - b.lesson_number);
  const MOD_BY_ID = Object.fromEntries(MODULES.map(m => [m.id, m]));
  const LESSON_BY_ID = Object.fromEntries(LESSONS.map(l => [l.lesson_id, l]));
  const ITEMS_BY_ID = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
  const TARGET = MISSION.target_date ? new Date(MISSION.target_date + "T00:00:00") : new Date(2026, 5, 15);
  const ERROR_TYPES = DATA.error_types || [];
  const ERROR_BY_ID = Object.fromEntries(ERROR_TYPES.map(e => [e.id, e]));
  const LISTENING_LADDER = DATA.listening_ladder || [];
  const LADDER_BY_ID = Object.fromEntries(LISTENING_LADDER.map(step => [step.id, step]));
  const ROLEPLAY_CRITERIA = DATA.roleplay_criteria || {};
  const SCENARIOS = DATA.scenarios || [];
  const TUTOR_BY_SCENARIO = Object.fromEntries(TUTOR_CARDS.map(c => [c.scenario_id, c]));
  const STAGE_KEYS = ["recognition", "recall", "cloze", "dictation", "stress", "pronounce", "backtranslate", "contrast", "produce", "listen", "roleplay"];
  const LEGACY_STAGE = { production: "produce", listening: "listen" };
  const CRITERIA_LABELS = {
    uses_formal_greeting: "formal greeting",
    introduces_self: "introduces self",
    thanks_hosts: "thanks hosts",
    compliments_food: "compliments food",
    declines_politely: "declines politely",
    uses_correct_male_form: "male form",
    uses_za_toast_formula: "safe toast formula",
    avoids_na_zdorovie_misfire: "avoids false toast reply",
    keeps_stress_clear: "clear stress",
  };

  const ACUTE = "́";
  const $ = (sel, el = document) => el.querySelector(sel);
  const view = document.getElementById("view");
  const toastEl = document.getElementById("toast");

  /* ---------- persistence ---------- */
  const KEY = COURSE.storage_namespace || "zastolom.russian_family_visit.v2";
  const LEGACY_KEY = "zastolom.v1";
  const LESSON_KEY = KEY + ".lesson_boundary";
  const HISTORY_KEY = KEY + ".analytics_history";
  let store = load();
  let activeLessonId = loadLessonBoundary();
  function load() {
    try {
      const current = JSON.parse(localStorage.getItem(KEY)) || {};
      if (Object.keys(current).length) return current;
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY)) || {};
      if (Object.keys(legacy).length) {
        const migrated = {};
        Object.keys(legacy).forEach(id => { migrated[id] = migrateRec(legacy[id]); });
        localStorage.setItem(KEY, JSON.stringify(migrated));
        return migrated;
      }
      return {};
    }
    catch (e) { return {}; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function loadLessonBoundary() {
    try {
      const saved = localStorage.getItem(LESSON_KEY);
      if (saved && LESSON_BY_ID[saved]) return saved;
    } catch (e) {}
    return CURRICULUM.default_lesson_id || (LESSONS.length ? LESSONS[LESSONS.length - 1].lesson_id : "");
  }
  function saveLessonBoundary() { try { localStorage.setItem(LESSON_KEY, activeLessonId); } catch (e) {} }
  function loadAnalyticsHistory() {
    try {
      const rows = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
      return Array.isArray(rows) ? rows : [];
    } catch (e) { return []; }
  }
  function saveAnalyticsHistory(rows) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(rows.slice(-14))); } catch (e) {}
  }
  function emptyRec() { return { seen: 0, correct: 0, known: false, stages: {}, errors: {}, last_seen_at: "" }; }
  function migrateRec(value) {
    const r = Object.assign(emptyRec(), value || {});
    r.stages = r.stages || {};
    Object.keys(LEGACY_STAGE).forEach(oldKey => {
      if (r.stages[oldKey] && !r.stages[LEGACY_STAGE[oldKey]]) r.stages[LEGACY_STAGE[oldKey]] = r.stages[oldKey];
    });
    STAGE_KEYS.forEach(k => { if (typeof r.stages[k] === "number") r.stages[k] = stageSeed(r.stages[k]); });
    r.errors = r.errors || {};
    return r;
  }
  function stageSeed(count) {
    return {
      seen: count,
      correct: count,
      success_sessions: count,
      due_at: count ? new Date(Date.now() + 86400000).toISOString() : new Date().toISOString(),
      stability: Math.max(1, count),
      difficulty: 5,
      retrievability: count ? 0.9 : 0,
      lapses: 0,
      last_grade: count ? "good" : "",
      last_error_type: "",
      last_seen_at: "",
      delayed_attempts: 0,
      delayed_success: 0,
      mastered: count >= 2,
    };
  }
  function rec(id) { store[id] = migrateRec(store[id]); return store[id]; }
  function stageRec(id, stageKey) {
    const r = rec(id);
    r.stages[stageKey] = r.stages[stageKey] && typeof r.stages[stageKey] === "object" ? r.stages[stageKey] : stageSeed(0);
    return r.stages[stageKey];
  }

  /* ---------- helpers ---------- */
  function colorStress(ru) {
    // wrap the stressed letter (vowel + combining acute) for accent color
    return escapeHtml(ru).replace(new RegExp("(.)" + ACUTE, "g"),
      '<span class="stress">$1' + ACUTE + "</span>");
  }
  function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function normalize(s) {
    return (s || "").normalize("NFC").replace(new RegExp(ACUTE, "g"), "")
      .toLowerCase().replace(/[.!?,…]+$/g, "").replace(/[«»"]/g, "").replace(/\s+/g, " ").trim();
  }
  function stripStress(s) {
    return (s || "").normalize("NFC").replace(new RegExp(ACUTE, "g"), "");
  }
  function listeningCloze(ru) {
    return stripStress(ru).split(/(\s+)/).map(part => {
      if (!part.trim()) return part;
      let seenLetter = false;
      return Array.from(part).map(ch => {
        if (!/\p{L}/u.test(ch)) return ch;
        if (!seenLetter) { seenLetter = true; return ch; }
        return "·";
      }).join("");
    }).join("");
  }
  function firstLetterHint(ru) {
    return stripStress(ru).split(/(\s+)/).map(part => {
      if (!part.trim()) return part;
      let shown = false;
      return Array.from(part).map(ch => {
        if (!/\p{L}/u.test(ch)) return ch;
        if (!shown) { shown = true; return ch; }
        return "_";
      }).join("");
    }).join("");
  }
  function ladderLabel(stepId) {
    return (LADDER_BY_ID[stepId] && LADDER_BY_ID[stepId].label) || stepId;
  }
  function ladderAssistance(stepId) {
    return (LADDER_BY_ID[stepId] && LADDER_BY_ID[stepId].assistance) || 0;
  }
  function listeningHintHtml(it) {
    if (!quiz || quiz.stageKey !== "listen") return "";
    const step = quiz.listenStep || "no_text";
    if (step === "no_text" || step === "slow_audio" || step === "table_speed" || step === "room_noise") return "";
    const text = step === "first_letter" ? escapeHtml(firstLetterHint(it.ru)) : step === "cloze" ? escapeHtml(listeningCloze(it.ru)) : colorStress(it.ru);
    return `<div class="listenhint" aria-live="polite"><span>${escapeHtml(ladderLabel(step))}</span><div>${text}</div></div>`;
  }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
  function sample(arr, n, exclude) { return shuffle(arr.filter(x => x !== exclude)).slice(0, n); }
  function daysLeft() { const ms = TARGET - new Date(); return Math.max(0, Math.ceil(ms / 86400000)); }
  function targetLabel() {
    return TARGET.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove("show"), 1800); }
  function stageState(id, stageKey) {
    const r = store[id] ? migrateRec(store[id]) : null;
    return r && r.stages ? r.stages[stageKey] : null;
  }
  function isDue(state) { return !state || !state.due_at || new Date(state.due_at) <= new Date(); }
  function stageScore(it, stageKey) {
    const st = stageState(it.id, stageKey);
    const due = isDue(st) ? 0 : 1;
    const lapses = st ? st.lapses || 0 : 0;
    const correct = st ? st.correct || 0 : 0;
    return [due, it.priority, correct - lapses];
  }
  function dueItems(stageKey) {
    return stagePool(stageKey).filter(it => isDue(stageState(it.id, stageKey)));
  }
  function fragileItems() {
    return ITEMS.filter(it => {
      const r = store[it.id] ? migrateRec(store[it.id]) : null;
      if (!r) return it.priority === 1;
      return STAGE_KEYS.some(k => {
        const st = r.stages[k];
        return st && (st.lapses || 0) > 0 && isDue(st);
      });
    });
  }
  function readiness() {
    const requiredStages = STAGE_KEYS.map(stageKey =>
      stagePool(stageKey).filter(it => !it.priority || it.priority <= 2).map(it => [it, stageKey])
    ).flat();
    const total = requiredStages.length;
    const mastered = requiredStages.filter(([it, stageKey]) => {
      const st = stageState(it.id, stageKey);
      return st && st.mastered;
    }).length;
    return total ? Math.round(mastered / total * 100) : 0;
  }
  function stageAccuracy(stageKey) {
    const states = stagePool(stageKey).map(it => stageState(it.id, stageKey)).filter(Boolean);
    const seen = states.reduce((n, st) => n + (st.seen || 0), 0);
    const correct = states.reduce((n, st) => n + (st.correct || 0), 0);
    return seen ? Math.round(correct / seen * 100) : 0;
  }
  function delayedRecallRate() {
    const states = STAGE_KEYS.flatMap(stageKey =>
      stagePool(stageKey).map(it => stageState(it.id, stageKey)).filter(Boolean)
    );
    const attempts = states.reduce((n, st) => n + (st.delayed_attempts || 0), 0);
    const success = states.reduce((n, st) => n + (st.delayed_success || 0), 0);
    return attempts ? Math.round(success / attempts * 100) : 0;
  }
  function averageResponseMs() {
    const states = STAGE_KEYS.flatMap(stageKey =>
      stagePool(stageKey).map(it => stageState(it.id, stageKey)).filter(Boolean)
    );
    const totals = states.reduce((acc, st) => {
      acc.ms += st.latency_ms_total || 0;
      acc.count += st.latency_count || 0;
      return acc;
    }, { ms: 0, count: 0 });
    return totals.count ? Math.round(totals.ms / totals.count) : 0;
  }
  function formatLatency(ms) {
    return ms ? `${Math.max(0.1, Math.round(ms / 100) / 10)}s` : "0s";
  }
  function analytics() {
    const now = Date.now();
    const day = 86400000;
    const due = STAGE_KEYS.reduce((n, stageKey) => n + stagePool(stageKey).filter(it => {
      const st = stageState(it.id, stageKey);
      return st && isDue(st);
    }).length, 0);
    const overdue = STAGE_KEYS.reduce((n, stageKey) => n + stagePool(stageKey).filter(it => {
      const st = stageState(it.id, stageKey);
      return st && st.due_at && new Date(st.due_at).getTime() < now - day;
    }).length, 0);
    return {
      due,
      overdue,
      delayedRecall: delayedRecallRate(),
      listenAccuracy: stageAccuracy("listen"),
      productionAccuracy: stageAccuracy("produce"),
      roleplayPass: stageAccuracy("roleplay"),
      roleplayMisses: roleplayMisses(),
      dictationAccuracy: stageAccuracy("dictation"),
      contrastAccuracy: stageAccuracy("contrast"),
      averageResponseMs: averageResponseMs(),
    };
  }
  function todayKey() { return new Date().toISOString().slice(0, 10); }
  function analyticsSnapshot(metrics) {
    const snapshot = {
      date: todayKey(),
      readiness: readiness(),
      delayedRecall: metrics.delayedRecall,
      due: metrics.due,
      overdue: metrics.overdue,
      roleplayMisses: metrics.roleplayMisses,
      averageResponseMs: metrics.averageResponseMs,
      touched: overallProgress().done,
    };
    const rows = loadAnalyticsHistory().filter(row => row && row.date !== snapshot.date);
    rows.push(snapshot);
    saveAnalyticsHistory(rows);
    return rows;
  }
  function delta(current, previous, key) {
    if (!previous || typeof previous[key] !== "number") return "new";
    const d = current[key] - previous[key];
    return d === 0 ? "0" : (d > 0 ? "+" : "") + d;
  }
  function analyticsHistoryHtml(rows) {
    const current = rows[rows.length - 1];
    const previous = rows[rows.length - 2];
    if (!current) return "";
    return `<div class="trendbox rise">
      <div><h3>Readiness trend</h3><p>Daily local snapshot. Stored only in this browser.</p></div>
      <div class="trendgrid">
        <div><strong>${current.readiness}<small>%</small></strong><span>readiness</span><em>${delta(current, previous, "readiness")}</em></div>
        <div><strong>${current.delayedRecall}<small>%</small></strong><span>delayed recall</span><em>${delta(current, previous, "delayedRecall")}</em></div>
        <div><strong>${current.touched}</strong><span>phrases touched</span><em>${delta(current, previous, "touched")}</em></div>
        <div><strong>${current.overdue}</strong><span>overdue</span><em>${delta(current, previous, "overdue")}</em></div>
        <div><strong>${formatLatency(current.averageResponseMs || 0)}</strong><span>avg response</span><em>${delta(current, previous, "averageResponseMs")}</em></div>
      </div>
    </div>`;
  }
  function roleplayMisses() {
    return stagePool("roleplay").reduce((n, it) => {
      const st = stageState(it.id, "roleplay");
      return n + (st && st.last_roleplay_missed ? st.last_roleplay_missed.length : 0);
    }, 0);
  }
  function roleplayFailureSignals() {
    const counts = {};
    stagePool("roleplay").forEach(it => {
      const r = store[it.id] || {};
      const historical = r.roleplay_criteria_misses || null;
      const st = stageState(it.id, "roleplay");
      const missed = historical ? Object.keys(historical) : (st && st.last_roleplay_missed ? st.last_roleplay_missed : []);
      missed.forEach(criterionId => {
        const criterion = ROLEPLAY_CRITERIA[criterionId] || {};
        const key = criterionId;
        counts[key] = counts[key] || {
          id: key,
          label: criterion.label || criterionId,
          errorType: criterion.error_type || "forgot_phrase",
          count: 0,
        };
        counts[key].count += historical ? historical[criterionId] : 1;
      });
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 4);
  }
  function roleplaySignalsHtml(signals) {
    const rows = signals.length ? signals.map(row => `<div class="signals__row">
      <strong>${escapeHtml(row.label)}</strong>
      <span>${row.count} missed · ${escapeHtml((ERROR_BY_ID[row.errorType] && ERROR_BY_ID[row.errorType].label) || row.errorType)}</span>
      <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.startRepair('${escapeHtml(row.errorType)}')">Repair</button>
    </div>`).join("") : `<div class="signals__empty">No missed role-play criteria logged yet. Run a role-play round and self-rate it.</div>`;
    return `<div class="signals rise">
      <div>
        <h3>Role-play failure signals</h3>
        <p>Recent missed scenario criteria become targeted repair drills.</p>
      </div>
      <div class="signals__list">${rows}</div>
    </div>`;
  }
  function repairStageFor(errorType) {
    if (errorType === "listening_misparse") return "dictation";
    if (errorType === "stress") return "stress";
    if (errorType === "vowel_reduction") return "pronounce";
    if (errorType === "cultural_usage") return "contrast";
    if (errorType === "register") return "roleplay";
    if (["case_or_inflection", "word_order"].includes(errorType)) return "backtranslate";
    return "produce";
  }
  function repairProfile() {
    const rows = [];
    Object.keys(store).forEach(id => {
      const it = practiceItem(id);
      if (!it || (it.lesson_number && it.lesson_number > (activeLesson().lesson_number || 99))) return;
      const r = migrateRec(store[id]);
      Object.entries(r.errors || {}).forEach(([errorType, count]) => {
        if (!ERROR_BY_ID[errorType] || !count) return;
        rows.push({ id, item: it, errorType, count });
      });
    });
    return rows.sort((a, b) => b.count - a.count || a.errorType.localeCompare(b.errorType));
  }
  function repairFocusSummary() {
    const grouped = {};
    Object.keys(store).forEach(id => {
      const it = practiceItem(id);
      if (!it || (it.lesson_number && it.lesson_number > (activeLesson().lesson_number || 99))) return;
      const r = migrateRec(store[id]);
      Object.entries(r.repair_focus_counts || {}).forEach(([errorType, count]) => {
        if (!ERROR_BY_ID[errorType] || !count) return;
        grouped[errorType] = grouped[errorType] || { errorType, count: 0, examples: [] };
        grouped[errorType].count += count;
        if (grouped[errorType].examples.length < 2) grouped[errorType].examples.push(it);
      });
    });
    return Object.values(grouped)
      .sort((a, b) => b.count - a.count || a.errorType.localeCompare(b.errorType))
      .slice(0, 4);
  }
  function repairProfileHtml(rows) {
    const body = rows.length ? rows.map(row => {
      const e = ERROR_BY_ID[row.errorType];
      const examples = row.examples.map(it => `<span>${escapeHtml(it.en)}</span>`).join("");
      return `<div class="repairprofile__row">
        <strong>${escapeHtml(e.label)}</strong>
        <span>${row.count} focused miss${row.count === 1 ? "" : "es"}</span>
        <div>${examples}</div>
        <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.startRepair('${row.errorType}')">Repair</button>
      </div>`;
    }).join("") : `<div class="repairprofile__empty">No focused misses logged yet. Wrong cloze, dictation, back-translation, and production answers will appear here.</div>`;
    return `<div class="repairprofile rise">
      <div>
        <h3>Repair profile</h3>
        <p>Top error patterns from targeted feedback, constrained to the current lesson boundary.</p>
      </div>
      <div class="repairprofile__list">${body}</div>
    </div>`;
  }
  function repairQueueHtml() {
    const rows = repairProfile();
    if (!rows.length) {
      return `<div class="repairbox rise">
        <div><h3>Repair queue</h3><p>No error patterns logged yet. Missed answers will appear here as focused repair work.</p></div>
      </div>`;
    }
    const grouped = {};
    rows.forEach(row => {
      grouped[row.errorType] = grouped[row.errorType] || { count: 0, examples: [] };
      grouped[row.errorType].count += row.count;
      if (grouped[row.errorType].examples.length < 2) grouped[row.errorType].examples.push(row.item);
    });
    const cards = Object.entries(grouped)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 4)
      .map(([errorType, data]) => {
        const e = ERROR_BY_ID[errorType];
        const examples = data.examples.map(it => `<span>${escapeHtml(it.en)}</span>`).join("");
        return `<div class="repaircard">
          <div class="repaircard__top"><strong>${escapeHtml(e.label)}</strong><span>${data.count}</span></div>
          <p>${escapeHtml(e.repair)}</p>
          <div class="repaircard__examples">${examples}</div>
          <button class="btn btn--sm" onclick="ZS.startRepair('${errorType}')">Repair now</button>
        </div>`;
      }).join("");
    return `<div class="repairbox rise"><div><h3>Repair queue</h3><p>Logged mistakes are grouped into targeted repair drills.</p></div><div class="repairgrid">${cards}</div></div>`;
  }
  function scenarioForItem(id) {
    const limit = activeLesson().lesson_number || 99;
    return SCENARIOS.find(s => (s.lesson_number || 0) <= limit && (s.required_items || []).includes(id));
  }
  function tutorCardForItem(id) {
    const s = scenarioForItem(id);
    return s ? TUTOR_BY_SCENARIO[s.id] : null;
  }
  function criterionLabel(id) {
    return (ROLEPLAY_CRITERIA[id] && ROLEPLAY_CRITERIA[id].label) || CRITERIA_LABELS[id] || id.replace(/_/g, " ");
  }
  function criterionErrorType(id) {
    return (ROLEPLAY_CRITERIA[id] && ROLEPLAY_CRITERIA[id].error_type) || "forgot_phrase";
  }
  function scenarioCard(it) {
    const s = scenarioForItem(it.id);
    if (!s) return "";
    const criteria = (s.success_criteria || []).slice(0, 3)
      .map(c => `<span>${escapeHtml(criterionLabel(c))}</span>`).join("");
    return `<div class="scenario">
      <div class="scenario__setting">${escapeHtml(s.setting || "Scenario")}</div>
      <div class="scenario__goal">${escapeHtml(s.goal || "")}</div>
      ${criteria ? `<div class="scenario__criteria">${criteria}</div>` : ""}
    </div>`;
  }

  function moduleProgress(modId) {
    const items = unlockedItems(ITEMS.filter(i => i.module === modId));
    const done = items.filter(i => { const r = store[i.id]; return r && (r.known || (r.stages && Object.keys(r.stages).length)); }).length;
    return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
  }
  function overallProgress() {
    const items = unlockedItems(ITEMS);
    const done = items.filter(i => { const r = store[i.id]; return r && (r.known || (r.stages && Object.keys(r.stages).length)); }).length;
    return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
  }
  function activeLesson() {
    return LESSON_BY_ID[activeLessonId] || LESSONS[LESSONS.length - 1] || { lesson_number: 99, title: "All lessons" };
  }
  function unlockedItems(items) {
    const n = activeLesson().lesson_number || 99;
    return items.filter(i => !i.lesson_number || i.lesson_number <= n);
  }
  function activeLessonStageCards(cards) {
    const n = activeLesson().lesson_number || 99;
    return cards.filter((card) => {
      if (!card || !card.item_id) return false;
      const source = ITEMS_BY_ID[card.item_id];
      if (!source) return false;
      const lessonNumber = card.lesson_number != null ? card.lesson_number : source.lesson_number;
      return lessonNumber != null && lessonNumber <= n;
    });
  }
  function activeRoleplayItemIds() {
    const n = activeLesson().lesson_number || 99;
    return new Set(
      SCENARIOS.filter(s => (s.lesson_number || 0) <= n)
        .flatMap(s => s.required_items || [])
    );
  }
  function unlockedClozeCards(cards) {
    return activeLessonStageCards(cards);
  }
  function unlockedDictationCards(cards) {
    return activeLessonStageCards(cards);
  }
  function unlockedStressCards(cards) {
    return activeLessonStageCards(cards);
  }
  function unlockedPronunciationCards(cards) {
    return activeLessonStageCards(cards);
  }
  function unlockedBacktranslationCards(cards) {
    return activeLessonStageCards(cards);
  }
  function unlockedContrastCards(cards) {
    const n = activeLesson().lesson_number || 99;
    return cards.filter((card) => {
      const item = ITEMS_BY_ID[card.item_id];
      const lessonNumber = card.lesson_number != null ? card.lesson_number : (item && item.lesson_number);
      return lessonNumber != null && lessonNumber <= n;
    });
  }
  function practiceItem(id) {
    return ITEMS.find(i => i.id === id) || CLOZE_CARDS.find(c => c.id === id) || DICTATION_CARDS.find(c => c.id === id) || STRESS_CARDS.find(c => c.id === id) || PRONUNCIATION_CARDS.find(c => c.id === id) || BACKTRANSLATION_CARDS.find(c => c.id === id) || CONTRAST_CARDS.find(c => c.id === id);
  }
  function lessonLockHtml() {
    if (!LESSONS.length) return "";
    const lesson = activeLesson();
    const count = unlockedItems(ITEMS).length;
    const clozeCount = unlockedClozeCards(CLOZE_CARDS).length;
    const dictationCount = unlockedDictationCards(DICTATION_CARDS).length;
    const stressCount = unlockedStressCards(STRESS_CARDS).length;
    const pronunciationCount = unlockedPronunciationCards(PRONUNCIATION_CARDS).length;
    const backCount = unlockedBacktranslationCards(BACKTRANSLATION_CARDS).length;
    const contrastCount = unlockedContrastCards(CONTRAST_CARDS).length;
    const options = LESSONS.map(l => `<option value="${escapeHtml(l.lesson_id)}" ${l.lesson_id === lesson.lesson_id ? "selected" : ""}>${String(l.lesson_number).padStart(2, "0")} · ${escapeHtml(l.title)}</option>`).join("");
    return `<div class="lessonlock rise">
      <div>
        <h3>Curriculum lock</h3>
        <p>Practice is constrained to Lesson ${lesson.lesson_number}: ${escapeHtml(lesson.title)} and everything before it.</p>
      </div>
      <label><span>Unlocked through</span><select onchange="ZS.setLesson(this.value)">${options}</select></label>
      <div class="lessonlock__meta">${count}/${ITEMS.length} phrases unlocked · ${clozeCount}/${CLOZE_CARDS.length} cloze · ${dictationCount}/${DICTATION_CARDS.length} dictation · ${stressCount}/${STRESS_CARDS.length} stress · ${pronunciationCount}/${PRONUNCIATION_CARDS.length} pronounce · ${backCount}/${BACKTRANSLATION_CARDS.length} back-translation · ${contrastCount}/${CONTRAST_CARDS.length} contrast · ${(lesson.introduced_structures || []).length} structures in this lesson</div>
    </div>`;
  }

  /* ---------- text-to-speech ---------- */
  let RU_VOICE = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const vs = speechSynthesis.getVoices();
    RU_VOICE = vs.find(v => /ru[-_]RU/i.test(v.lang)) || vs.find(v => /^ru/i.test(v.lang)) || null;
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  // Real ElevenLabs MP3 (Elena, native Russian) if available; else browser TTS.
  const AUDIO = window.AUDIO || null;
  const AUDIO_IDS = AUDIO ? new Set(AUDIO.ids) : new Set();
  let curAudio = null;
  let noiseCtx = null;
  let noiseSource = null;
  let noiseTimer = null;
  function stopRoomNoise() {
    if (noiseTimer) {
      clearTimeout(noiseTimer);
      noiseTimer = null;
    }
    if (noiseSource) {
      try { noiseSource.stop(); } catch (e) {}
      try { noiseSource.disconnect(); } catch (e) {}
      noiseSource = null;
    }
  }
  function playRoomNoise(item) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    stopRoomNoise();
    noiseCtx = noiseCtx || new AudioContext();
    const seconds = Math.max(2.2, Math.min(4.5, ((item.ru_plain || item.ru || "").length || 20) * 0.095));
    const sampleRate = noiseCtx.sampleRate;
    const buffer = noiseCtx.createBuffer(1, Math.floor(sampleRate * seconds), sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 1729;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = ((seed / 4294967295) * 2 - 1) * 0.055;
    }
    const source = noiseCtx.createBufferSource();
    const filter = noiseCtx.createBiquadFilter();
    const gain = noiseCtx.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 1400;
    gain.gain.value = 0.22;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(noiseCtx.destination);
    noiseSource = source;
    source.start();
    noiseTimer = setTimeout(stopRoomNoise, seconds * 1000 + 120);
  }
  function speakTTS(item, opts) {
    if (!("speechSynthesis" in window)) { toast("No audio on this device — use Forvo"); return; }
    opts = opts || {};
    speechSynthesis.cancel();
    if (opts.noise) playRoomNoise(item);
    const u = new SpeechSynthesisUtterance(item.ru_plain || item.ru);
    u.lang = "ru-RU"; u.rate = opts.rate || 0.85; if (RU_VOICE) u.voice = RU_VOICE;
    if (!RU_VOICE) toast("No Russian voice installed — using default");
    speechSynthesis.speak(u);
  }
  function speak(item, opts) {
    if (!item) return;
    opts = opts || {};
    if (AUDIO && AUDIO_IDS.has(item.id)) {
      try {
        if (curAudio) { curAudio.pause(); }
        stopRoomNoise();
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        curAudio = new Audio(AUDIO.base + item.id + ".mp3");
        if (opts.rate) curAudio.playbackRate = opts.rate;
        if (opts.noise) {
          playRoomNoise(item);
          curAudio.addEventListener("ended", stopRoomNoise, { once: true });
        }
        curAudio.play().catch(() => { if (!opts.quiet) speakTTS(item, opts); });
        return;
      } catch (e) { /* fall through */ }
    }
    if (!opts.quiet) speakTTS(item, opts);
  }

  /* ---------- badges ---------- */
  function badges(it) {
    let h = "";
    if (it.recognize) h += '<span class="badge badge--listen">understand by ear</span>';
    if (it.gender === "m") h += '<span class="badge badge--male">male form</span>';
    if (it.conf === "med") h += '<span class="badge badge--low">verify</span>';
    if (it.rehearse) h += '<span class="badge badge--rehearse">★ rehearse with Kadriya</span>';
    return h;
  }

  /* ====================================================================
     ROUTER
     ==================================================================== */
  function router() {
    const hash = location.hash || "#/home";
    const [, route, arg] = hash.split("/");
    const activeRoute = route === "drill" ? "quiz" : (route || "home");
    document.querySelectorAll(".tabs a").forEach(a => a.classList.toggle("is-active", a.dataset.tab === activeRoute));
    view.scrollTop = 0; window.scrollTo(0, 0);
    if (activeRoute === "learn") renderLearn(arg);
    else if (activeRoute === "quiz") arg ? renderQuizRun(arg) : renderQuizMenu();
    else if (activeRoute === "plan") renderPlan();
    else renderHome();
    view.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", router);

  /* ====================================================================
     HOME
     ==================================================================== */
  function renderHome() {
    const op = overallProgress();
    const a = analytics();
    const history = analyticsSnapshot(a);
    const roleSignals = roleplayFailureSignals();
    const repairFocusRows = repairFocusSummary();
    const d = daysLeft();
    const mods = MODULES.map((m, i) => {
      const p = moduleProgress(m.id);
      return `<button class="modcard rise" onclick="location.hash='#/learn/${m.id}'">
        <div class="modcard__top"><span class="modcard__icon">${m.icon}</span>
          <span class="pill pill--p${m.priority}">P${m.priority}</span></div>
        <div class="modcard__title">${escapeHtml(m.title)}</div>
        <div class="modcard__why">${escapeHtml(m.why)}</div>
        <div class="modcard__bar"><span style="width:${p.pct}%"></span></div>
      </button>`;
    }).join("");

    view.innerHTML = `
      <section class="hero rise">
        <h1>Hold your own at <em>Kadriya's</em> family table.</h1>
        <p>${escapeHtml(DATA.meta.goal)} ${d} day${d === 1 ? "" : "s"} to go — light on weekdays, heavier on weekends. Cyrillic + stress marks + audio, no romanization.</p>
        <div class="hero__row">
          <a class="btn" href="#/learn">▶ Start learning</a>
          <a class="btn btn--ghost" href="#/quiz">Drill yourself</a>
          <a class="btn btn--ghost" href="#/plan">See the 16-day plan</a>
        </div>
      </section>
      ${lessonLockHtml()}

      <div class="stats">
        <div class="stat rise"><div class="stat__num">${op.done}<small>/${op.total}</small></div><div class="stat__label">Phrases touched</div>
          <div class="progressbar"><span style="width:${op.pct}%"></span></div></div>
        <div class="stat rise"><div class="stat__num">${a.due}</div><div class="stat__label">Due reviews</div></div>
        <div class="stat rise"><div class="stat__num">${a.overdue}</div><div class="stat__label">Overdue reviews</div></div>
        <div class="stat rise"><div class="stat__num">${readiness()}<small>%</small></div><div class="stat__label">Dinner readiness</div></div>
        <div class="stat rise"><div class="stat__num">${d}</div><div class="stat__label">Days to ${escapeHtml(targetLabel())}</div></div>
      </div>
      <div class="analyticsbox rise">
        <div><h3>Performance signals</h3><p>Readiness now includes delayed recall, cloze, dictation, stress, pronunciation, back-translation, contrast, production, listening, and role-play mastery.</p></div>
        <div class="analyticsgrid">
          <div><strong>${a.delayedRecall}<small>%</small></strong><span>delayed recall</span></div>
          <div><strong>${a.dictationAccuracy}<small>%</small></strong><span>dictation accuracy</span></div>
          <div><strong>${stageAccuracy("stress")}<small>%</small></strong><span>stress accuracy</span></div>
          <div><strong>${stageAccuracy("pronounce")}<small>%</small></strong><span>pronunciation accuracy</span></div>
          <div><strong>${a.contrastAccuracy}<small>%</small></strong><span>contrast accuracy</span></div>
          <div><strong>${a.productionAccuracy}<small>%</small></strong><span>production accuracy</span></div>
          <div><strong>${a.listenAccuracy}<small>%</small></strong><span>listening accuracy</span></div>
          <div><strong>${a.roleplayPass}<small>%</small></strong><span>role-play pass rate</span></div>
          <div><strong>${a.roleplayMisses}</strong><span>role-play missed criteria</span></div>
          <div><strong>${fragileItems().length}</strong><span>fragile high-priority phrases</span></div>
          <div><strong>${formatLatency(a.averageResponseMs)}</strong><span>avg response time</span></div>
        </div>
      </div>
      ${repairProfileHtml(repairFocusRows)}
      ${roleplaySignalsHtml(roleSignals)}
      ${analyticsHistoryHtml(history)}

      <div class="section-head"><span class="section-head__num">★</span><span class="section-head__title">The Table, module by module</span>
        <span class="section-head__sub">Tap a card to study it. Start with the red P1 cards — that's the moment you walk in the door.</span></div>
      <div class="modgrid">${mods}</div>

      <div class="footer-note">Built from Ekaterina's original guide + verified family-table research. Add the deck to your phone (see <code>/anki</code>) and rehearse the ★ items with Kadriya.</div>
    `;
    updateCountdown();
  }

  /* ====================================================================
     LEARN  (flashcards)
     ==================================================================== */
  let learnState = { module: "all", priority: 0, idx: 0, list: [], hideEn: false };
  function buildLearnList() {
    let list = unlockedItems(ITEMS);
    if (learnState.module !== "all") list = list.filter(i => i.module === learnState.module);
    if (learnState.priority) list = list.filter(i => i.priority === learnState.priority);
    list.sort((a, b) => a.priority - b.priority);
    learnState.list = list;
    if (learnState.idx >= list.length) learnState.idx = 0;
  }
  function renderLearn(modArg) {
    if (modArg && MOD_BY_ID[modArg]) learnState.module = modArg;
    buildLearnList();
    const modChips = ['<button class="chip ' + (learnState.module === "all" ? "is-on" : "") + '" onclick="ZS.setMod(\'all\')">All</button>']
      .concat(MODULES.map(m => `<button class="chip ${learnState.module === m.id ? "is-on" : ""}" onclick="ZS.setMod('${m.id}')">${m.icon} ${escapeHtml(m.title)}</button>`)).join("");
    const priChips = [0, 1, 2, 3].map(p => `<button class="chip ${learnState.priority === p ? "is-on" : ""}" onclick="ZS.setPri(${p})">${p ? "P" + p : "Any P"}</button>`).join("");

    view.innerHTML = `
      <div class="section-head"><span class="section-head__num">02</span><span class="section-head__title">Learn</span>
        <span class="section-head__sub">Hear it, say it aloud, then flip for the meaning. Mark what's stuck.</span></div>
      ${lessonLockHtml()}
      <div class="learnbar learnbar--scroll">${modChips}</div>
      <div class="learnbar learnbar--tools">${priChips}<span class="spacer"></span>
        <button class="chip ${learnState.hideEn ? "is-on" : ""}" onclick="ZS.toggleEn()">🙈 Hide English</button></div>
      <div id="cardslot"></div>
    `;
    renderCard();
  }
  function renderCard() {
    const slot = $("#cardslot");
    const list = learnState.list;
    if (!list.length) { slot.innerHTML = '<div class="card"><p>No cards match this filter.</p></div>'; return; }
    const it = list[learnState.idx];
    rec(it.id).seen++;
    save();
    slot.innerHTML = `
      <div class="card rise ${learnState.hideEn ? "hidden-en" : ""}">
        <div class="card__meta"><span class="card__mod">${MOD_BY_ID[it.module].icon} ${escapeHtml(MOD_BY_ID[it.module].title)}</span>
          <span class="pill pill--p${it.priority}">P${it.priority}</span></div>
        <div class="card__ru">${colorStress(it.ru)}</div>
        <div class="card__en" title="${learnState.hideEn ? "tap to reveal" : ""}">${escapeHtml(it.en)}</div>
        ${it.hint ? `<div class="card__hint">🔈 ${escapeHtml(it.hint)}</div>` : ""}
        ${it.note ? `<div class="card__note">${escapeHtml(it.note)}</div>` : ""}
        <div class="card__foot">${badges(it)}</div>
      </div>
      <div class="cardnav">
        <button class="iconbtn" onclick="ZS.prev()" aria-label="Previous">‹</button>
        <button class="iconbtn iconbtn--play" onclick="ZS.say()" aria-label="Play audio">▶</button>
        <span class="cardnav__count">${learnState.idx + 1} / ${list.length}</span>
        <button class="iconbtn" onclick="ZS.known()" aria-label="Mark known" title="Mark as stuck">✓</button>
        <button class="iconbtn" onclick="ZS.next()" aria-label="Next">›</button>
      </div>`;
    speak(it, { quiet: true }); // try native audio, but do not show autoplay-blocked TTS warnings
  }

  /* ====================================================================
     QUIZ
     ==================================================================== */
  const STAGES = [
    { n: 1, key: "recognition", title: "Recognise", desc: "See Russian → choose the meaning.", instr: "What does this mean?" },
    { n: 2, key: "recall", title: "Recall", desc: "See English → choose the Russian.", instr: "Pick the Russian" },
    { n: 3, key: "cloze", title: "Cloze", desc: "Fill the missing Russian word in context.", instr: "Fill the blank" },
    { n: 4, key: "dictation", title: "Dictation", desc: "Hear Russian audio → type the Cyrillic phrase.", instr: "Type what you hear" },
    { n: 5, key: "stress", title: "Stress", desc: "Choose the correct stressed Cyrillic form.", instr: "Where is the stress?" },
    { n: 6, key: "pronounce", title: "Pronounce", desc: "Listen, record yourself, compare, then self-rate.", instr: "Record and compare" },
    { n: 7, key: "backtranslate", title: "Back-translate", desc: "Translate to English, then rebuild the Russian.", instr: "Translate, hide, rebuild" },
    { n: 8, key: "contrast", title: "Contrast", desc: "Choose the culturally safe phrase in context.", instr: "Choose the right phrase" },
    { n: 9, key: "produce", title: "Produce", desc: "See English → type the Russian (stress optional).", instr: "Type it in Russian" },
    { n: 10, key: "listen", title: "Listen", desc: "Hear it → choose the meaning. No text.", instr: "What did you hear?" },
    { n: 11, key: "roleplay", title: "Role-play", desc: "A table prompt → say it, then self-rate.", instr: "Say it out loud" },
  ];
  function stagePool(stageKey) {
    const items = unlockedItems(ITEMS);
    if (stageKey === "cloze") return unlockedClozeCards(CLOZE_CARDS);
    if (stageKey === "dictation") return unlockedDictationCards(DICTATION_CARDS);
    if (stageKey === "stress") return unlockedStressCards(STRESS_CARDS);
    if (stageKey === "pronounce") return unlockedPronunciationCards(PRONUNCIATION_CARDS);
    if (stageKey === "backtranslate") return unlockedBacktranslationCards(BACKTRANSLATION_CARDS);
    if (stageKey === "contrast") return unlockedContrastCards(CONTRAST_CARDS);
    if (stageKey === "listen") return items.filter(i => i.syllables >= 1);
    if (stageKey === "roleplay" && SCENARIOS.length) {
      const scenarioIds = activeRoleplayItemIds();
      return items.filter(i => scenarioIds.has(i.id));
    }
    if (stageKey === "roleplay") return items.filter(i => i.priority <= 2 && (i.ru_plain.includes(" ") || i.tags.includes("toast")));
    return items;
  }
  function stageProgress(stageKey) {
    const pool = stagePool(stageKey);
    const done = pool.filter(i => {
      const st = stageState(i.id, stageKey);
      return st && st.mastered;
    }).length;
    return { done, total: pool.length, pct: pool.length ? Math.round(done / pool.length * 100) : 0 };
  }
  function masteryRings() {
    const labels = [
      ["recognition", "Know"],
      ["recall", "Recall"],
      ["cloze", "Fill"],
      ["dictation", "Write"],
      ["stress", "Stress"],
      ["pronounce", "Speak"],
      ["backtranslate", "Rebuild"],
      ["contrast", "Choose"],
      ["listen", "Hear"],
      ["produce", "Say"],
      ["roleplay", "Use"],
    ];
    return labels.map(([key, label]) => {
      const p = stageProgress(key);
      return `<div class="ring" style="--pct:${p.pct}"><div class="ring__dial">${p.pct}<small>%</small></div><div class="ring__label">${label}</div></div>`;
    }).join("");
  }
  function renderQuizMenu() {
    const cards = STAGES.map(s => {
      const p = stageProgress(s.key);
      return `<button class="stagecard rise" onclick="location.hash='#/quiz/${s.key}'">
        <div class="stagecard__n">${String(s.n).padStart(2, "0")}</div>
        <div class="stagecard__t">${s.title}</div>
        <div class="stagecard__d">${escapeHtml(s.desc)}</div>
        <div class="stagecard__bar"><span style="width:${p.pct}%"></span></div>
      </button>`;
    }).join("");
    view.innerHTML = `
      <div class="section-head"><span class="section-head__num">03</span><span class="section-head__title">Drill</span>
        <span class="section-head__sub">Graduated difficulty: recognise → recall → stress → pronounce → contrast → produce → listen → role-play. Retrieval practice beats re-reading.</span></div>
      ${lessonLockHtml()}
      <div class="mastery rise">${masteryRings()}</div>
      <div class="callout">Each round is 10 questions: due reviews first, fragile high-priority phrases next, new cards only after the review load is under control.</div>
      ${repairQueueHtml()}
      <div class="stagegrid">${cards}</div>`;
  }

  let quiz = null;
  let recorder = null;
  let recordStream = null;
  let recordChunks = [];
  let recordingUrl = "";
  function listenStepButtons() {
    const steps = [
      ["no_text", "No text"],
      ["first_letter", "First letters"],
      ["cloze", "Cloze"],
      ["full_caption", "Full caption"],
    ];
    return `<div class="listenladder" aria-label="Listening ladder">${steps.map(([id, label]) => `<button id="listenStep_${id}" class="chip ${quiz.listenStep === id ? "is-on" : ""}" onclick="ZS.setListenStep('${id}')">${label}</button>`).join("")}</div>`;
  }
  function setPronunciationStatus(message) {
    const status = $("#pronStatus");
    if (status) status.textContent = message;
  }
  function cleanupRecording() {
    const activeRecorder = recorder;
    recorder = null;
    if (activeRecorder && activeRecorder.state !== "inactive") {
      activeRecorder.onstop = null;
      try { activeRecorder.stop(); } catch (e) {}
    }
    if (recordStream) {
      recordStream.getTracks().forEach(track => track.stop());
      recordStream = null;
    }
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      recordingUrl = "";
    }
    recordChunks = [];
  }
  function renderQuizRun(stageKey) {
    const stage = STAGES.find(s => s.key === stageKey);
    if (!stage) { location.hash = "#/quiz"; return; }
    if (!quiz || quiz.stageKey !== stageKey) {
      const pool = stagePool(stageKey);
      // Due reviews first, then fragile high-priority items, then new/unmastered.
      const ranked = pool.slice().sort((a, b) => {
        const as = stageScore(a, stageKey);
        const bs = stageScore(b, stageKey);
        for (let i = 0; i < as.length; i++) if (as[i] !== bs[i]) return as[i] - bs[i];
        return a.id.localeCompare(b.id);
      });
      const head = ranked.slice(0, 16);
      quiz = { stageKey, stage, q: shuffle(head).slice(0, Math.min(10, head.length)), i: 0, correct: 0, answered: false, listenHintLevel: 0, listenStep: "no_text", listenAssistance: 0 };
    }
    drawQuestion();
  }
  function drawQuestion() {
    cleanupRecording();
    const { stage } = quiz;
    if (quiz.i >= quiz.q.length) return drawSummary();
    const it = quiz.q[quiz.i];
    quiz.answered = false;
    quiz.questionStartedAt = Date.now();
    if (stage.key === "listen") {
      quiz.listenStep = quiz.listenStep || "no_text";
      quiz.listenAssistance = quiz.listenAssistance || 0;
    }
    const optionPool = stagePool(stage.key);
    const dots = quiz.q.map((_, k) => `<span class="${k < quiz.i ? "done" : k === quiz.i ? "cur" : ""}"></span>`).join("");
    let promptHtml = "", body = "";

    if (stage.key === "recognition") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-ru">${colorStress(it.ru)}</div>`;
      const opts = shuffle([it].concat(sample(optionPool, 3, it)));
      body = `<div class="options">${opts.map(o => `<button class="opt" onclick="ZS.answer('${o.id}','${it.id}',this)">${escapeHtml(o.en)}</button>`).join("")}</div>`;
    } else if (stage.key === "recall") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-en">${escapeHtml(it.en)}</div>`;
      const opts = shuffle([it].concat(sample(optionPool, 3, it)));
      body = `<div class="options">${opts.map(o => `<button class="opt" onclick="ZS.answer('${o.id}','${it.id}',this)">${colorStress(o.ru)}</button>`).join("")}</div>`;
    } else if (stage.key === "cloze") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-ru">${escapeHtml(it.prompt_ru)}</div><div class="q-en">${escapeHtml(it.en)}</div>`;
      body = `<div class="answerbox"><input id="clozeIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Missing word…" />
        <button class="btn btn--red" onclick="ZS.checkCloze('${it.id}')">Check</button></div>
        <div style="margin-top:8px"><button class="btn btn--sm btn--ghost" style="color:var(--ink);border-color:var(--ink)" onclick="ZS.giveUp('${it.id}')">Show answer</button></div>`;
    } else if (stage.key === "dictation") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-ru" style="font-size:2.6rem">🔊</div><div class="q-en">${escapeHtml(it.en)}</div>`;
      body = `<div style="text-align:center;margin-bottom:14px"><button class="iconbtn iconbtn--play" onclick="ZS.sayItem('${it.id}')">▶</button></div>
        <div class="answerbox"><input id="dictIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Печатайте по-русски…" />
        <button class="btn btn--red" onclick="ZS.checkDictation('${it.id}')">Check</button></div>
        <div style="margin-top:8px"><button class="btn btn--sm btn--ghost" style="color:var(--ink);border-color:var(--ink)" onclick="ZS.giveUp('${it.id}')">Show answer</button></div>`;
    } else if (stage.key === "stress") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-ru">${escapeHtml(it.ru_plain)}</div><div class="q-en">${escapeHtml(it.en)}</div>`;
      const opts = shuffle(it.options || []);
      body = `<div class="options">${opts.map(o => `<button class="opt" onclick="ZS.checkStress('${it.id}','${escapeHtml(o)}',this)">${colorStress(o)}</button>`).join("")}</div>`;
    } else if (stage.key === "pronounce") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-ru">${colorStress(it.ru)}</div><div class="q-en">${escapeHtml(it.en)}</div>`;
      body = `<div class="pronbox">
        <div class="pronbox__row">
          <button class="iconbtn iconbtn--play" onclick="ZS.sayItem('${it.id}')" aria-label="Play native audio">▶</button>
          <button id="recordBtn" class="btn btn--red" onclick="ZS.startPronunciation('${it.id}')">Record</button>
          <button id="stopRecordBtn" class="btn btn--ghost ghost-dark" onclick="ZS.stopPronunciation()" disabled>Stop</button>
          <button id="playRecordBtn" class="btn btn--ghost ghost-dark" onclick="ZS.playPronunciation()" disabled>Play mine</button>
        </div>
        <div id="pronStatus" class="pronbox__status">Play the native audio, record yourself, then compare stress and vowel reduction.</div>
        <div class="pronbox__targets">${(it.feedback_targets || []).map(t => `<span>${escapeHtml((ERROR_BY_ID[t] && ERROR_BY_ID[t].label) || t)}</span>`).join("")}</div>
        <div class="selfrate">
          <button class="btn btn--sm" onclick="ZS.ratePronunciation('${it.id}',true,false)">Close enough</button>
          <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.ratePronunciation('${it.id}',true,true)">Close with model</button>
          <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.ratePronunciation('${it.id}',false,false,'stress')">Stress off</button>
          <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.ratePronunciation('${it.id}',false,false,'vowel_reduction')">Vowels off</button>
        </div>
      </div>`;
    } else if (stage.key === "backtranslate") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-ru" id="btSource">${colorStress(it.ru)}</div>`;
      body = `<div id="btStep1">
        <div class="answerbox"><input id="btEn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="English meaning note…" />
        <button class="btn btn--red" onclick="ZS.startBack('${it.id}')">Hide Russian</button></div>
        <div class="card__hint">First write what it means. Then rebuild the Russian from your own note.</div>
      </div>
      <div id="btStep2" style="display:none">
        <div class="q-en" id="btNote" style="margin-bottom:10px"></div>
        <div class="answerbox"><input id="btRu" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Rebuild in Russian…" />
        <button class="btn btn--red" onclick="ZS.checkBack('${it.id}')">Check</button></div>
        <div style="margin-top:8px"><button class="btn btn--sm btn--ghost" style="color:var(--ink);border-color:var(--ink)" onclick="ZS.giveUp('${it.id}')">Show answer</button></div>
      </div>`;
    } else if (stage.key === "contrast") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="scenario"><div class="scenario__setting">${escapeHtml(it.title)}</div><div class="scenario__goal">${escapeHtml(it.usage_note)}</div></div><div class="q-en">${escapeHtml(it.prompt)}</div>`;
      const opts = shuffle(it.options || []);
      body = `<div class="options">${opts.map(o => `<button class="opt" onclick="ZS.checkContrast('${it.id}','${o.id}',this)">${colorStress(o.ru)}<span class="opt__hint">${escapeHtml(o.en)}</span></button>`).join("")}</div>`;
    } else if (stage.key === "produce") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-en">${escapeHtml(it.en)}</div>`;
      body = `<div class="answerbox"><input id="prodIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Печатайте по-русски…" />
        <button class="btn btn--red" onclick="ZS.checkProd('${it.id}')">Check</button></div>
        <div style="margin-top:8px"><button class="btn btn--sm btn--ghost" style="color:var(--ink);border-color:var(--ink)" onclick="ZS.giveUp('${it.id}')">Show answer</button></div>`;
    } else if (stage.key === "listen") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-ru" style="font-size:2.6rem">🔊</div><div id="listenHint">${listeningHintHtml(it)}</div>`;
      const opts = shuffle([it].concat(sample(optionPool, 3, it)));
      body = `<div style="text-align:center;margin-bottom:14px"><button class="iconbtn iconbtn--play" onclick="ZS.sayItem('${it.id}')">▶</button></div>
        ${listenStepButtons()}
        <div class="listenactions">
          <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.playListenAudio('${it.id}','slow_audio')">Slow pass</button>
          <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.playListenAudio('${it.id}','table_speed')">Table speed</button>
          <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.playListenAudio('${it.id}','room_noise')">Room noise</button>
          <button id="listenHintBtn" class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.listenHint('${it.id}')">Next hint</button>
        </div>
        <div class="options">${opts.map(o => `<button class="opt" onclick="ZS.answer('${o.id}','${it.id}',this)">${escapeHtml(o.en)}</button>`).join("")}</div>`;
    } else { // roleplay
      promptHtml = `<div class="q-instr">${stage.instr}</div>${scenarioCard(it)}<div class="q-en">${escapeHtml(it.en)}</div>`;
      const tutor = tutorCardForItem(it.id);
      body = `<div style="text-align:center;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${tutor ? `<button class="btn btn--red" onclick="ZS.openTutor('${it.id}')">Tutor setup</button>` : ""}
        <button class="btn" onclick="ZS.revealRP('${it.id}')">Reveal model answer</button>
      </div><div id="tutorPanel"></div><div id="rpReveal"></div>`;
    }

    $("#view").innerHTML = `
      <div class="section-head"><span class="section-head__num">${String(stage.n).padStart(2, "0")}</span><span class="section-head__title">${stage.title}</span>
        <span class="section-head__sub"><a href="#/quiz" style="color:var(--red)">← all drills</a></span></div>
      <div class="quiz" data-stage="${escapeHtml(stage.key)}" data-item-id="${escapeHtml(it.id)}" data-lesson-number="${escapeHtml(String(it.lesson_number || ""))}">
        <div class="quiz__progress">${dots}</div>
        <div class="quiz__prompt">${promptHtml}</div>
        <div id="qbody">${body}</div>
        <div id="qfeedback"></div>
      </div>`;
    if (stage.key === "listen") setTimeout(() => speak(it), 250);
    if (stage.key === "dictation" || stage.key === "pronounce") setTimeout(() => speak(ITEMS.find(i => i.id === it.item_id) || it, { quiet: true }), 250);
    if (stage.key === "produce") setTimeout(() => { const el = $("#prodIn"); if (el) { el.focus(); el.addEventListener("keydown", e => { if (e.key === "Enter") ZS.checkProd(it.id); }); } }, 50);
    if (stage.key === "cloze") setTimeout(() => { const el = $("#clozeIn"); if (el) { el.focus(); el.addEventListener("keydown", e => { if (e.key === "Enter") ZS.checkCloze(it.id); }); } }, 50);
    if (stage.key === "dictation") setTimeout(() => { const el = $("#dictIn"); if (el) { el.focus(); el.addEventListener("keydown", e => { if (e.key === "Enter") ZS.checkDictation(it.id); }); } }, 50);
    if (stage.key === "backtranslate") setTimeout(() => { const el = $("#btEn"); if (el) { el.focus(); el.addEventListener("keydown", e => { if (e.key === "Enter") ZS.startBack(it.id); }); } }, 50);
  }

  function nextDue(st, ok) {
    const minutes = ok ? [240, 1440, 4320, 10080, 21600] : [10, 30, 240];
    const index = ok ? Math.min(st.success_sessions || 0, minutes.length - 1) : Math.min(st.lapses || 0, minutes.length - 1);
    return new Date(Date.now() + minutes[index] * 60000).toISOString();
  }
  function gradeItem(id, ok, stageKey, errorType, opts) {
    opts = opts || {};
    const st = stageRec(id, stageKey);
    const r = store[id];
    const latencyMs = opts.latency_ms || (quiz && quiz.questionStartedAt ? Date.now() - quiz.questionStartedAt : 0);
    const wasDelayedReview = (st.seen || 0) > 0 && isDue(st);
    r.seen++;
    r.last_seen_at = new Date().toISOString();
    st.seen++;
    st.last_seen_at = r.last_seen_at;
    if (latencyMs > 0) {
      const boundedLatency = Math.min(300000, Math.round(latencyMs));
      st.last_latency_ms = boundedLatency;
      st.latency_ms_total = (st.latency_ms_total || 0) + boundedLatency;
      st.latency_count = (st.latency_count || 0) + 1;
    }
    if (wasDelayedReview) {
      st.delayed_attempts = (st.delayed_attempts || 0) + 1;
      if (ok && !opts.assisted) st.delayed_success = (st.delayed_success || 0) + 1;
    }
    if (!ok && errorType) {
      st.last_repair_focus = errorType;
      st.repair_focus_counts = st.repair_focus_counts || {};
      st.repair_focus_counts[errorType] = (st.repair_focus_counts[errorType] || 0) + 1;
      r.repair_focus_counts = r.repair_focus_counts || {};
      r.repair_focus_counts[errorType] = (r.repair_focus_counts[errorType] || 0) + 1;
    }
    if (ok && opts.assisted) {
      r.correct++;
      st.correct++;
      st.stability = Math.min(30, (st.stability || 1) + 0.25);
      st.difficulty = Math.min(10, (st.difficulty || 5) + 0.15);
      st.retrievability = 0.65;
      st.last_grade = "hard";
      st.mastered = false;
      st.due_at = new Date(Date.now() + 1800000).toISOString();
    } else if (ok) {
      r.correct++;
      st.correct++;
      st.success_sessions = (st.success_sessions || 0) + 1;
      st.stability = Math.min(30, (st.stability || 1) + 0.7 + (st.success_sessions * 0.2));
      st.difficulty = Math.max(1, (st.difficulty || 5) - 0.25);
      st.retrievability = 0.95;
      st.last_grade = "good";
      st.mastered = st.success_sessions >= 2;
    } else {
      st.lapses = (st.lapses || 0) + 1;
      st.success_sessions = 0;
      st.stability = Math.max(0.5, (st.stability || 1) * 0.55);
      st.difficulty = Math.min(10, (st.difficulty || 5) + 0.7);
      st.retrievability = 0.25;
      st.last_grade = "again";
      st.mastered = false;
      st.last_error_type = errorType || st.last_error_type || "forgot_phrase";
      r.errors[st.last_error_type] = (r.errors[st.last_error_type] || 0) + 1;
    }
    if (opts.listen_ladder) {
      st.last_ladder_step = opts.listen_ladder.step;
      st.last_assistance = opts.listen_ladder.assistance;
    }
    if (opts.roleplay) {
      st.last_roleplay_scenario = opts.roleplay.scenario_id || "";
      st.last_roleplay_met = opts.roleplay.met || [];
      st.last_roleplay_missed = opts.roleplay.missed || [];
      st.last_roleplay_assisted = !!opts.assisted;
    }
    if (!opts.assisted) st.due_at = nextDue(st, ok);
    save();
  }
  function errorButtons(it) {
    const itemErrors = it.error_types && it.error_types.length ? it.error_types : [];
    const byStage = {
      recognition: ["forgot_phrase", "cultural_usage", "register"],
      recall: ["forgot_phrase", "word_order", "register"],
      cloze: ["forgot_phrase", "case_or_inflection", "word_order", "register"],
      dictation: ["listening_misparse", "stress", "vowel_reduction", "forgot_phrase"],
      stress: ["stress", "vowel_reduction", "forgot_phrase"],
      pronounce: ["stress", "vowel_reduction", "forgot_phrase"],
      backtranslate: ["forgot_phrase", "case_or_inflection", "word_order", "register"],
      contrast: ["cultural_usage", "register", "forgot_phrase"],
      produce: ["forgot_phrase", "stress", "gendered_form", "case_or_inflection", "word_order"],
      listen: ["listening_misparse", "stress", "vowel_reduction", "forgot_phrase"],
      roleplay: ["forgot_phrase", "register", "cultural_usage", "gendered_form"],
    };
    const preferred = byStage[quiz.stageKey] || ["forgot_phrase"];
    let ids = preferred
      .filter(id => id === "forgot_phrase" || itemErrors.includes(id))
      .filter((id, idx, all) => all.indexOf(id) === idx && ERROR_BY_ID[id])
      .slice(0, 5);
    if (!ids.length) ids = ["forgot_phrase"];
    return `<div class="errorpick"><span>What failed?</span>${ids.map(id => `<button class="chip" onclick="ZS.markError('${it.id}','${quiz.stageKey}','${id}')">${escapeHtml((ERROR_BY_ID[id] && ERROR_BY_ID[id].label) || id)}</button>`).join("")}</div>`;
  }
  function inferredErrorType(it, stageKey) {
    const allowed = new Set(it && (it.allowed_error_types || it.error_types || []));
    if (stageKey === "dictation" || stageKey === "listen") return "listening_misparse";
    if (stageKey === "stress" || stageKey === "pronounce") return "stress";
    if (stageKey === "contrast") return "cultural_usage";
    if (stageKey === "cloze" && allowed.has("case_or_inflection")) return "case_or_inflection";
    if (stageKey === "backtranslate" && allowed.has("word_order")) return "word_order";
    if (stageKey === "produce" && allowed.has("gendered_form")) return "gendered_form";
    if (stageKey === "produce" && allowed.has("case_or_inflection")) return "case_or_inflection";
    return "forgot_phrase";
  }
  function repairFocusHtml(errorType) {
    const e = ERROR_BY_ID[errorType] || ERROR_BY_ID.forgot_phrase;
    if (!e) return "";
    return `<div class="repairfocus"><strong>Repair focus: ${escapeHtml(e.label)}</strong><span>${escapeHtml(e.repair)}</span></div>`;
  }
  function showFeedback(ok, it, extra, errorType) {
    quiz.answered = true;
    if (ok) quiz.correct++;
    const repair = ok ? "" : repairFocusHtml(errorType || inferredErrorType(it, quiz.stageKey));
    $("#qfeedback").innerHTML = `<div class="feedback ${ok ? "good" : "bad"} rise">
        <div style="font-family:var(--font-display);text-transform:uppercase;letter-spacing:.08em;font-size:.8rem">${ok ? "✓ Correct" : "✗ Not quite"}</div>
        <div class="fb-ru">${colorStress(it.ru)}</div>
        <div style="font-style:italic;font-family:var(--font-serif)">${escapeHtml(it.en)}</div>
        ${it.hint ? `<div class="card__hint">🔈 ${escapeHtml(it.hint)}</div>` : ""}
        ${extra || ""}
        ${repair}
        ${ok ? "" : errorButtons(it)}
        <div style="margin-top:12px"><button class="iconbtn iconbtn--play" onclick="ZS.sayItem('${it.id}')">▶</button>
          <button class="btn" style="margin-left:8px" onclick="ZS.nextQ()">Next →</button></div>
      </div>`;
    $("#qfeedback").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function drawSummary() {
    const pct = Math.round(quiz.correct / quiz.q.length * 100);
    const msg = pct >= 80 ? "Отли́чно! That'll land at the table." : pct >= 50 ? "Хорошо́ — solid. Run it again to lock it in." : "Keep going — review these in Learn, then retry.";
    $("#view").innerHTML = `
      <div class="section-head"><span class="section-head__num">${String(quiz.stage.n).padStart(2, "0")}</span><span class="section-head__title">${quiz.stage.title} — done</span></div>
      <div class="hero rise"><h1>${quiz.correct}<em>/${quiz.q.length}</em></h1><p>${msg}</p>
        <div class="hero__row">
          <button class="btn" onclick="ZS.retry()">Again</button>
          <a class="btn btn--ghost" href="#/quiz">Other drills</a>
          <a class="btn btn--ghost" href="#/learn">Back to Learn</a>
        </div></div>`;
    quiz = null;
  }

  /* ====================================================================
     PLAN  (condensed 16-day schedule, highlights today)
     ==================================================================== */
  const PLAN = [
    [1, "May 30", "Sat", "2 hrs", "🚪 First contact: formal greeting, your name, “nice to meet you”, thank-you."],
    [2, "May 31", "Sun", "1.5 hrs", "🥂 Your first toast + complimenting the food. Full table survival."],
    [3, "Jun 1", "Mon", "30 min", "👪 Family & «вы»: in-law terms, formal verb endings."],
    [4, "Jun 2", "Tue", "30 min", "🍽️ Food & drink: “pass the…”, “I'm full, thank you.”"],
    [5, "Jun 3", "Wed", "30 min", "👂 Listening: decoding rapid host questions."],
    [6, "Jun 4", "Thu", "30 min", "🗣️ Small talk: lawyer, Missouri, how you met Kadriya."],
    [7, "Jun 5", "Fri", "20 min", "♻️ Light review + Anki only (busy-day cadence)."],
    [8, "Jun 6", "Sat", "2 hrs", "🎭 Weekend role-play: full intro + toast with the AI tutor."],
    [9, "Jun 7", "Sun", "2 hrs", "🎭 Rehearse with Kadriya: patronymics, ★ items, mock dinner."],
    [10, "Jun 8", "Mon", "30 min", "Interleave: mix all modules in the Drill (stages 1–3)."],
    [11, "Jun 9", "Tue", "30 min", "Listening stage + toasts polish."],
    [12, "Jun 10", "Wed", "30 min", "Production stage: type/say the P1 + P2 phrases."],
    [13, "Jun 11", "Thu", "30 min", "Weak-items review (whatever the Drill flags)."],
    [14, "Jun 12", "Fri", "20 min", "Light: Anki + passive listening on the commute."],
    [15, "Jun 13", "Sat", "1 hr", "🧊 Taper: no new material. Confident run-through + role-play."],
    [16, "Jun 14", "Sun", "45 min", "🧊 Rehearse toast aloud, the doorway lines, breathe."],
    [17, "Jun 15", "Mon", "—", "🎉 Meeting day. Здра́вствуйте! Слу́шай, улыба́йся, и за встре́чу!"],
  ];
  function renderPlan() {
    const d = daysLeft();
    const rows = PLAN.map(p => {
      const today = (p[1] + " 2026") === todayLabel();
      return `<tr${today ? ' style="outline:3px solid var(--amber)"' : ""}><td><strong>${p[0]}</strong></td><td>${p[1]}</td><td>${p[2]}</td><td>${p[3]}</td><td>${p[4]}${today ? ' &nbsp;<span class="pill pill--p1">TODAY</span>' : ""}</td></tr>`;
    }).join("");
    view.innerHTML = `
      <div class="section-head"><span class="section-head__num">04</span><span class="section-head__title">The 16-day plan</span>
        <span class="section-head__sub">Risk-first, evidence-based, oral. ${d} days left.</span></div>
      <div class="callout"><strong>If you only have 10 minutes:</strong> (1) clear your Anki reviews to protect the spacing curve, (2) listen to one audio/podcast passively. <em>No new material on 10-minute days — protect the foundation.</em></div>
      ${renderOfflinePanel()}
      <div class="prose"><table>
        <thead><tr><th>Day</th><th>Date</th><th></th><th>Budget</th><th>Focus</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <div class="section-head" style="margin-top:30px"><span class="section-head__num">★</span><span class="section-head__title">Your toolkit</span></div>
      <div class="linkrow">
        <a class="btn" href="../schedule/16_day_plan.md" target="_blank">📅 Full day-by-day plan</a>
        <a class="btn" href="../printable/cheatsheet.html" target="_blank">🖨️ Printable cheat sheet</a>
        <a class="btn" href="../tutor/roleplay_protocol.md" target="_blank">🎭 AI-tutor role-plays</a>
        <a class="btn" href="../RESOURCES.md" target="_blank">🔗 Videos, podcasts & apps</a>
        <a class="btn" href="../anki/README.md" target="_blank">📱 Phone deck (Anki)</a>
      </div>
      <div class="footer-note">Open links work when the app is served (e.g. <code>python3 -m http.server</code> from the repo root, then open <code>/web/</code>).</div>`;
    setTimeout(() => ZS.updateOfflineStatus(), 50);
  }
  function renderOfflinePanel() {
    const native = AUDIO_IDS.size;
    return `<div class="offlinebox rise">
      <div>
        <h3>Offline packs</h3>
        <p>Cache the app shell plus native audio before travel. Browser storage limits vary, so high-priority audio is the safest phone pack.</p>
      </div>
      <div class="offlinebox__actions">
        <button class="btn btn--sm" onclick="ZS.cachePack('core')">Core course</button>
        <button class="btn btn--sm" onclick="ZS.cachePack('p1')">P1 audio</button>
        <button class="btn btn--sm" onclick="ZS.cachePack('all')">All audio (${native})</button>
        <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.updateOfflineStatus()">Check readiness</button>
        <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.clearOffline()">Clear media</button>
      </div>
      <div id="offlineStatus" class="offlinebox__status">Checking offline readiness...</div>
    </div>`;
  }
  function coreOfflineUrls() {
    return ["./", "./index.html", "./styles.css", "./app.js", "./content.js", "./audio.js", "./manifest.webmanifest", "./assets/icon.svg"];
  }
  function p1AudioIds() {
    return ITEMS.filter(i => i.priority === 1 && AUDIO_IDS.has(i.id)).map(i => i.id);
  }
  function packUrls(kind) {
    const ids = kind === "all" ? Array.from(AUDIO_IDS) : kind === "p1" ? p1AudioIds() : [];
    return coreOfflineUrls().concat(ids.map(id => AUDIO.base + id + ".mp3"));
  }
  async function cachedCount(urls) {
    let count = 0;
    for (const url of urls) {
      const absolute = new URL(url, location.href).href;
      if (await caches.match(absolute)) count++;
    }
    return count;
  }
  function formatStorage(bytes) {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  }

  function todayLabel() {
    const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const t = new Date();
    return `${m[t.getMonth()]} ${t.getDate()} ${t.getFullYear()}`;
  }
  function updateCountdown() {
    const el = document.getElementById("cd-num");
    if (el) el.textContent = daysLeft();
  }

  /* ====================================================================
     public handlers (referenced from inline onclick)
     ==================================================================== */
  window.ZS = {
    setMod(m) { learnState.module = m; learnState.idx = 0; renderLearn(); },
    setPri(p) { learnState.priority = p; learnState.idx = 0; renderLearn(); },
    setLesson(id) {
      if (!LESSON_BY_ID[id]) return;
      activeLessonId = id;
      learnState.idx = 0;
      quiz = null;
      saveLessonBoundary();
      router();
    },
    toggleEn() { learnState.hideEn = !learnState.hideEn; renderLearn(); },
    next() { learnState.idx = (learnState.idx + 1) % learnState.list.length; renderCard(); },
    prev() { learnState.idx = (learnState.idx - 1 + learnState.list.length) % learnState.list.length; renderCard(); },
    say() { speak(learnState.list[learnState.idx]); },
    sayItem(id) {
      const it = practiceItem(id);
      speak(it && it.item_id ? ITEMS.find(i => i.id === it.item_id) : it);
    },
    known() {
      const it = learnState.list[learnState.idx];
      const r = rec(it.id);
      r.known = true;
      ["recognition", "recall"].forEach(k => {
        const st = stageRec(it.id, k);
        st.correct = Math.max(st.correct || 0, 2);
        st.success_sessions = Math.max(st.success_sessions || 0, 2);
        st.mastered = true;
        st.due_at = new Date(Date.now() + 432000000).toISOString();
      });
      save();
      toast("Marked ✓ — " + it.en);
      ZS.next();
    },
    answer(chosen, correctId, btn) {
      if (quiz.answered) return;
      const it = ITEMS.find(i => i.id === correctId);
      const ok = chosen === correctId;
      const buttons = Array.from(document.querySelectorAll(".opt"));
      buttons.forEach(o => o.setAttribute("disabled", ""));
      btn.classList.add(ok ? "correct" : "wrong");
      if (!ok) { // also light up the right answer in green
        const want = quiz.stage.key === "recall" ? normalize(it.ru) : normalize(it.en);
        const right = buttons.find(o => normalize(o.textContent) === want);
        if (right) right.classList.add("correct");
      }
      const listenAssistance = quiz.stageKey === "listen" ? (quiz.listenAssistance || ladderAssistance(quiz.listenStep || "no_text")) : 0;
      const assisted = ok && quiz.stageKey === "listen" && listenAssistance > 0;
      const errorType = ok ? null : inferredErrorType(it, quiz.stageKey);
      gradeItem(correctId, ok, quiz.stageKey, errorType, {
        assisted,
        listen_ladder: quiz.stageKey === "listen" ? { step: quiz.listenStep || "no_text", assistance: listenAssistance } : null,
      });
      showFeedback(ok, it, assisted ? `<div class="card__hint">Listening ladder assistance (${escapeHtml(ladderLabel(quiz.listenStep || "no_text"))}): scheduled as a hard review.</div>` : "", errorType);
    },
    checkProd(id) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const val = $("#prodIn") ? $("#prodIn").value : "";
      const ok = normalize(val) === normalize(it.ru);
      const errorType = ok ? null : inferredErrorType(it, quiz.stageKey);
      gradeItem(id, ok, quiz.stageKey, errorType);
      showFeedback(ok, it, ok ? "" : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em></div>`, errorType);
    },
    checkCloze(id) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const val = $("#clozeIn") ? $("#clozeIn").value : "";
      const accepted = it.accepted_answers || [it.answer];
      const ok = accepted.some(answer => normalize(val) === normalize(answer));
      const errorType = ok ? null : inferredErrorType(it, quiz.stageKey);
      gradeItem(id, ok, quiz.stageKey, errorType);
      showFeedback(ok, it, ok ? "" : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em>; answer: <strong>${escapeHtml(it.answer)}</strong></div>`, errorType);
    },
    checkDictation(id) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const val = $("#dictIn") ? $("#dictIn").value : "";
      const accepted = it.accepted_answers || [it.ru_plain];
      const ok = accepted.some(answer => normalize(val) === normalize(answer));
      const errorType = ok ? null : "listening_misparse";
      gradeItem(id, ok, quiz.stageKey, errorType);
      showFeedback(ok, it, ok ? "" : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em>; target: <strong>${colorStress(it.ru)}</strong></div>`, errorType);
    },
    checkStress(id, chosen, btn) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const ok = chosen === it.answer;
      const buttons = Array.from(document.querySelectorAll(".opt"));
      buttons.forEach(o => o.setAttribute("disabled", ""));
      btn.classList.add(ok ? "correct" : "wrong");
      if (!ok) {
        const right = buttons.find(o => normalize(o.textContent) === normalize(it.answer));
        if (right) right.classList.add("correct");
      }
      const errorType = ok ? null : "stress";
      gradeItem(id, ok, quiz.stageKey, errorType);
      showFeedback(ok, it, ok ? `<div class="card__hint">Stress locked: <strong>${colorStress(it.answer)}</strong></div>` : `<div class="card__hint">Correct stress: <strong>${colorStress(it.answer)}</strong></div>`, errorType);
    },
    async startPronunciation(id) {
      if (quiz.answered) return;
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        setPronunciationStatus("Recording is not available in this browser. Use the self-rating buttons after saying it aloud.");
        return;
      }
      cleanupRecording();
      try {
        recordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const activeRecorder = new MediaRecorder(recordStream);
        recorder = activeRecorder;
        recordChunks = [];
        activeRecorder.ondataavailable = event => {
          if (event.data && event.data.size) recordChunks.push(event.data);
        };
        activeRecorder.onstop = () => {
          if (recordingUrl) URL.revokeObjectURL(recordingUrl);
          const blob = new Blob(recordChunks, { type: activeRecorder.mimeType || "audio/webm" });
          recordingUrl = URL.createObjectURL(blob);
          const playBtn = $("#playRecordBtn");
          if (playBtn) playBtn.removeAttribute("disabled");
          setPronunciationStatus("Recording ready. Play yours, compare to native audio, then self-rate.");
          if (recordStream) {
            recordStream.getTracks().forEach(track => track.stop());
            recordStream = null;
          }
        };
        activeRecorder.start();
        const startBtn = $("#recordBtn");
        const stopBtn = $("#stopRecordBtn");
        if (startBtn) startBtn.setAttribute("disabled", "");
        if (stopBtn) stopBtn.removeAttribute("disabled");
        setPronunciationStatus("Recording... keep it short and natural.");
      } catch (e) {
        setPronunciationStatus("Microphone permission was not available. Say it aloud and self-rate manually.");
      }
    },
    stopPronunciation() {
      if (!recorder || recorder.state === "inactive") return;
      const activeRecorder = recorder;
      recorder = null;
      activeRecorder.stop();
      const startBtn = $("#recordBtn");
      const stopBtn = $("#stopRecordBtn");
      if (startBtn) startBtn.removeAttribute("disabled");
      if (stopBtn) stopBtn.setAttribute("disabled", "");
    },
    playPronunciation() {
      if (!recordingUrl) {
        setPronunciationStatus("Record yourself first, or use manual self-rating if the microphone is unavailable.");
        return;
      }
      const audio = new Audio(recordingUrl);
      audio.play().catch(() => setPronunciationStatus("Playback was blocked. Tap Play mine again."));
    },
    ratePronunciation(id, ok, assisted, errorType) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const inferred = ok ? null : (errorType || "stress");
      gradeItem(id, ok, quiz.stageKey, inferred, { assisted });
      showFeedback(ok, it, assisted ? `<div class="card__hint">Used the model during comparison: scheduled as a hard pronunciation review.</div>` : `<div class="card__hint">Target: compare stress placement and unstressed vowel reduction against the native audio.</div>`, inferred);
    },
    startBack(id) {
      if (quiz.answered) return;
      const note = $("#btEn") ? $("#btEn").value.trim() : "";
      $("#btSource").style.display = "none";
      $("#btStep1").style.display = "none";
      $("#btStep2").style.display = "";
      $("#btNote").textContent = note || "Your English note was blank. Rebuild the Russian from memory.";
      const el = $("#btRu");
      if (el) {
        el.focus();
        el.addEventListener("keydown", e => { if (e.key === "Enter") ZS.checkBack(id); }, { once: true });
      }
    },
    checkBack(id) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const val = $("#btRu") ? $("#btRu").value : "";
      const accepted = it.accepted_answers || [it.ru_plain];
      const ok = accepted.some(answer => normalize(val) === normalize(answer));
      const errorType = ok ? null : inferredErrorType(it, quiz.stageKey);
      gradeItem(id, ok, quiz.stageKey, errorType);
      showFeedback(ok, it, ok ? "" : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em>; target: <strong>${colorStress(it.ru)}</strong></div>`, errorType);
    },
    checkContrast(id, chosenId, btn) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const ok = chosenId === it.answer_id;
      const buttons = Array.from(document.querySelectorAll(".opt"));
      buttons.forEach(o => o.setAttribute("disabled", ""));
      btn.classList.add(ok ? "correct" : "wrong");
      if (!ok) {
        const right = buttons.find(o => normalize(o.textContent).includes(normalize(it.ru_plain)));
        if (right) right.classList.add("correct");
      }
      const errorType = ok ? null : "cultural_usage";
      gradeItem(id, ok, quiz.stageKey, errorType);
      showFeedback(ok, it, `<div class="card__hint">${escapeHtml(it.usage_note || "")}</div>`, errorType);
    },
    giveUp(id) { const it = practiceItem(id); const errorType = inferredErrorType(it, quiz.stageKey); gradeItem(id, false, quiz.stageKey, errorType); showFeedback(false, it, "", errorType); },
    listenHint(id) {
      if (!quiz || quiz.stageKey !== "listen") return;
      const it = practiceItem(id);
      const order = ["no_text", "first_letter", "cloze", "full_caption"];
      const current = Math.max(0, order.indexOf(quiz.listenStep || "no_text"));
      quiz.listenStep = order[Math.min(current + 1, order.length - 1)];
      quiz.listenAssistance = Math.max(quiz.listenAssistance || 0, ladderAssistance(quiz.listenStep));
      ZS.setListenStep(quiz.listenStep);
      if (it) toast(ladderLabel(quiz.listenStep));
    },
    setListenStep(stepId) {
      if (!quiz || quiz.stageKey !== "listen") return;
      quiz.listenStep = stepId;
      quiz.listenAssistance = Math.max(quiz.listenAssistance || 0, ladderAssistance(stepId));
      const it = quiz.q[quiz.i];
      const el = $("#listenHint");
      if (it && el) el.innerHTML = listeningHintHtml(it);
      document.querySelectorAll(".listenladder .chip").forEach(btn => btn.classList.toggle("is-on", btn.id === "listenStep_" + stepId));
      const btn = $("#listenHintBtn");
      if (btn) {
        btn.textContent = stepId === "full_caption" ? "Caption shown" : "Next hint";
        if (stepId === "full_caption") btn.setAttribute("disabled", "");
        else btn.removeAttribute("disabled");
      }
    },
    playListenAudio(id, stepId) {
      if (!quiz || quiz.stageKey !== "listen") return;
      const it = practiceItem(id);
      quiz.listenStep = stepId;
      quiz.listenAssistance = Math.max(quiz.listenAssistance || 0, ladderAssistance(stepId));
      const rate = stepId === "slow_audio" ? 0.72 : stepId === "table_speed" ? 1.15 : stepId === "room_noise" ? 1.05 : 1;
      speak(it, { rate, noise: stepId === "room_noise" });
      toast(ladderLabel(stepId));
    },
    markError(id, stageKey, errorType) {
      const st = stageRec(id, stageKey);
      const r = rec(id);
      st.last_error_type = errorType;
      r.errors[errorType] = (r.errors[errorType] || 0) + 1;
      save();
      const label = (ERROR_BY_ID[errorType] && ERROR_BY_ID[errorType].label) || errorType;
      toast("Repair queued: " + label);
    },
    startRepair(errorType) {
      const stageKey = repairStageFor(errorType);
      const stage = STAGES.find(s => s.key === stageKey);
      const erroredIds = new Set(
        repairProfile()
          .filter(row => row.errorType === errorType)
          .map(row => row.id)
      );
      const pool = stagePool(stageKey);
      const candidates = pool.filter(it =>
        erroredIds.has(it.id) ||
        erroredIds.has(it.item_id) ||
        ((it.allowed_error_types || it.error_types || []).includes(errorType))
      );
      const q = (candidates.length ? candidates : pool).slice().sort((a, b) => {
        const as = stageScore(a, stageKey);
        const bs = stageScore(b, stageKey);
        for (let i = 0; i < as.length; i++) if (as[i] !== bs[i]) return as[i] - bs[i];
        return a.id.localeCompare(b.id);
      });
      quiz = { stageKey, stage, q: shuffle(q).slice(0, Math.min(10, q.length)), i: 0, correct: 0, answered: false, listenHintLevel: 0, listenStep: "no_text", listenAssistance: 0, repairErrorType: errorType };
      history.pushState(null, "", "#/quiz/" + stageKey);
      drawQuestion();
    },
    revealRP(id) {
      const it = ITEMS.find(i => i.id === id);
      const scenario = scenarioForItem(id);
      const criteria = scenario && scenario.success_criteria ? scenario.success_criteria : [];
      const checklist = criteria.length ? `<div class="rpcriteria">
        <div class="rpcriteria__title">Success criteria</div>
        ${criteria.map(c => `<label><input type="checkbox" class="rpcrit" value="${escapeHtml(c)}" checked> <span>${escapeHtml(criterionLabel(c))}</span></label>`).join("")}
      </div>` : "";
      $("#rpReveal").innerHTML = `<div class="feedback good rise"><div class="fb-ru">${colorStress(it.ru)}</div>
        ${it.hint ? `<div class="card__hint">🔈 ${escapeHtml(it.hint)}</div>` : ""}
        <div style="margin:10px 0"><button class="iconbtn iconbtn--play" onclick="ZS.sayItem('${it.id}')">▶</button></div>
        <div style="font-family:var(--font-display);text-transform:uppercase;font-size:.78rem;letter-spacing:.06em">How did you do, out loud?</div>
        ${checklist}
        <div class="selfrate">
          <button class="btn btn--sm" onclick="ZS.rateRP('${id}','criteria',false)">Pass selected</button>
          <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.rateRP('${id}','criteria',true)">Close with model</button>
          <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.rateRP('${id}','missed',false)">Needs repair</button>
        </div></div>`;
      speak(it);
    },
    openTutor(id) {
      const it = ITEMS.find(i => i.id === id);
      const card = tutorCardForItem(id);
      if (!it || !card) return;
      const r = rec(id);
      r.tutor_prompt_opens = (r.tutor_prompt_opens || 0) + 1;
      r.last_seen_at = new Date().toISOString();
      save();
      const phrases = (card.required_phrases || []).map(p => `<li><span class="phrase-ru">${colorStress(p.ru)}</span><span>${escapeHtml(p.en)}</span></li>`).join("");
      $("#tutorPanel").innerHTML = `<div class="tutorbox feedback good rise">
        <div class="tutorbox__head">
          <div>
            <div class="tutorbox__eyebrow">Lesson-constrained AI tutor</div>
            <h3>${escapeHtml(card.setting)} · Lesson ${card.lesson_number}</h3>
          </div>
          <button class="btn btn--sm" onclick="ZS.copyTutorPrompt()">Copy prompt</button>
        </div>
        <p>${escapeHtml(card.goal)}</p>
        <ul class="tutorbox__phrases">${phrases}</ul>
        <textarea id="tutorPromptText" readonly>${escapeHtml(card.prompt)}</textarea>
      </div>`;
      $("#tutorPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
    async copyTutorPrompt() {
      const el = $("#tutorPromptText");
      if (!el) return;
      try {
        await navigator.clipboard.writeText(el.value);
        toast("Tutor prompt copied");
      } catch (e) {
        el.focus();
        el.select();
        document.execCommand("copy");
        toast("Tutor prompt selected");
      }
    },
    rateRP(id, mode, assisted) {
      const it = ITEMS.find(i => i.id === id);
      const scenario = scenarioForItem(id);
      const criteria = scenario && scenario.success_criteria ? scenario.success_criteria : [];
      const checked = new Set(Array.from(document.querySelectorAll(".rpcrit:checked")).map(el => el.value));
      const met = mode === "missed" ? [] : criteria.filter(c => checked.has(c));
      const missed = mode === "missed" ? criteria.slice() : criteria.filter(c => !checked.has(c));
      const ok = mode !== "missed" && missed.length === 0;
      const errorType = missed.length ? criterionErrorType(missed[0]) : null;
      gradeItem(id, ok, quiz.stageKey, errorType, {
        assisted,
        roleplay: {
          scenario_id: scenario ? scenario.id : "",
          met,
          missed,
        },
      });
      if (missed.length) {
        const r = rec(id);
        r.roleplay_criteria_misses = r.roleplay_criteria_misses || {};
        missed.forEach(c => {
          r.roleplay_criteria_misses[c] = (r.roleplay_criteria_misses[c] || 0) + 1;
        });
      }
      missed.slice(1).forEach(c => {
        const r = rec(id);
        const err = criterionErrorType(c);
        r.errors[err] = (r.errors[err] || 0) + 1;
      });
      save();
      quiz.answered = true;
      if (ok && !assisted) quiz.correct++;
      if (assisted) toast("Hard role-play review scheduled");
      if (missed.length) toast("Role-play repair queued");
      ZS.nextQ();
    },
    nextQ() { quiz.i++; quiz.listenHintLevel = 0; quiz.listenStep = "no_text"; quiz.listenAssistance = 0; drawQuestion(); },
    retry() { const k = location.hash.split("/")[2]; quiz = null; renderQuizRun(k); },
    async updateOfflineStatus() {
      const status = $("#offlineStatus");
      if (!status) return;
      if (!("caches" in window)) {
        status.textContent = "Offline cache unavailable in this browser.";
        return;
      }
      const coreUrls = coreOfflineUrls();
      const p1Urls = p1AudioIds().map(id => AUDIO.base + id + ".mp3");
      const allAudioUrls = Array.from(AUDIO_IDS).map(id => AUDIO.base + id + ".mp3");
      try {
        const [coreCached, p1Cached, audioCached, estimate] = await Promise.all([
          cachedCount(coreUrls),
          cachedCount(p1Urls),
          cachedCount(allAudioUrls),
          navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve({}),
        ]);
        const storage = estimate && estimate.usage ? ` · storage ${formatStorage(estimate.usage)} used` : "";
        const ready = coreCached === coreUrls.length && p1Cached === p1Urls.length;
        status.innerHTML = `<span class="${ready ? "is-ready" : "is-partial"}">${ready ? "Travel core ready" : "Offline pack incomplete"}</span> · core ${coreCached}/${coreUrls.length} · P1 audio ${p1Cached}/${p1Urls.length} · all audio ${audioCached}/${allAudioUrls.length}${storage}`;
      } catch (e) {
        status.textContent = "Could not inspect offline readiness.";
      }
    },
    async cachePack(kind) {
      if (!("caches" in window)) { toast("Offline cache unavailable"); return; }
      const status = $("#offlineStatus");
      if (status) status.textContent = "Caching…";
      const urls = packUrls(kind);
      try {
        const cache = await caches.open("zastolom-offline-pack");
        await cache.addAll(urls);
        await ZS.updateOfflineStatus();
        toast("Offline pack cached");
      } catch (e) {
        if (status) status.textContent = "Caching failed; try the smaller P1 pack.";
        toast("Caching failed");
      }
    },
    async clearOffline() {
      if (!("caches" in window)) return;
      await caches.delete("zastolom-offline-pack");
      const status = $("#offlineStatus");
      if (status) status.textContent = "Offline media pack cleared.";
      await ZS.updateOfflineStatus();
      toast("Offline media cleared");
    },
  };

  /* ---------- service worker ---------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
  }

  /* ---------- go ---------- */
  router();
  updateCountdown();
  setInterval(updateCountdown, 60000);
})();
