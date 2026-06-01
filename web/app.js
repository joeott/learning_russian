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
  const VERB_DRILL_CARDS = DATA.verb_drill_cards || [];
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
  const METRICS = window.ZASTOLOM_METRICS || null;
  const STAGE_KEYS = ["recognition", "recall", "conjugate", "cloze", "dictation", "stress", "pronounce", "backtranslate", "contrast", "produce", "listen", "roleplay"];
  const LEGACY_STAGE = { production: "produce", listening: "listen" };
  const SCENARIO_INDEX = Object.create(null);
  SCENARIOS.forEach((s, i) => { SCENARIO_INDEX[s.id] = i; });
  const LISTEN_STEPS = ["no_text", "first_letter", "cloze", "full_caption"];
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
    answers_host_questions: "answers host questions",
    uses_learning_safety_line: "learning-safe line",
    uses_repair_lines: "uses repair lines",
    recovers_from_unknown: "recovers from unclear prompt",
    tells_short_story: "short story",
    handles_follow_up: "follow-up response",
    stays_in_russian: "stays in Russian",
    delivers_full_dinner_arc: "full dinner flow",
    recovers_curveball: "recovers from curveball",
    mentions_host_or_food: "mentions host or food",
  };
  const RESCUE_PHRASES = [
    { ru: "Повтори́те, пожа́луйста.", en: "Please repeat." },
    { ru: "Поме́дленнее, пожа́луйста.", en: "Slower, please." },
    { ru: "Я не понима́ю.", en: "I don't understand." },
    { ru: "Я ещё учу́ ру́сский.", en: "I'm still learning Russian." },
  ];
  const GUIDED_ROLEPLAY_MODES = [
    ["shadow", "Shadow"],
    ["prompted", "Prompted"],
    ["supported", "Supported"],
    ["live", "Live"],
  ];

  const ACUTE = "́";
  const $ = (sel, el = document) => el.querySelector(sel);
  const view = document.getElementById("view");
  const toastEl = document.getElementById("toast");

  /* ---------- persistence ---------- */
  const KEY = COURSE.storage_namespace || "zastolom.russian_family_visit.v2";
  const LEGACY_KEY = "zastolom.v1";
  const LESSON_KEY = KEY + ".lesson_boundary";
  const HISTORY_KEY = KEY + ".analytics_history";
  const LEARN_RATE_KEY = KEY + ".learn_audio_rate";
  const REVIEW_KEY = KEY + ".review_sessions";
  const ADAPTIVE_KEY = KEY + ".adaptive_ratings";
  const ANALYSIS_KEY = KEY + ".analysis_state";
  const SYNC_QUEUE_KEY = KEY + ".sync_queue";
  const DEVICE_KEY = KEY + ".device_id";
  const SYNC_API_KEY = KEY + ".sync_api";
  const LEARNER_ID = (COURSE.learner_profile && COURSE.learner_profile.id) || "joe";
  const SYNC_API = window.ZASTOLOM_SYNC_API || localStorage.getItem(SYNC_API_KEY) || "";
  let store = load();
  let adaptiveRatings = loadAdaptiveRatings();
  let analysisState = loadAnalysisState();
  let reviewSessionStore = loadReviewSessionState();
  let analysisTimer = 0;
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
    if (CURRICULUM.default_lesson_id && LESSON_BY_ID[CURRICULUM.default_lesson_id]) {
      return CURRICULUM.default_lesson_id;
    }
    return LESSONS.length ? LESSONS[0].lesson_id : "";
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
  function loadLearnRate() {
    try {
      const value = Number(localStorage.getItem(LEARN_RATE_KEY));
      return [0.65, 0.85, 1, 1.15, 1.3].includes(value) ? value : 1;
    } catch (e) { return 1; }
  }
  function saveLearnRate(value) {
    try { localStorage.setItem(LEARN_RATE_KEY, String(value)); } catch (e) {}
  }
  function loadReviewSessionState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(REVIEW_KEY)) || {};
      return {
        daily_completed_at: parsed.daily_completed_at || "",
        last_session_at: parsed.last_session_at || "",
      };
    } catch (e) {
      return { daily_completed_at: "", last_session_at: "" };
    }
  }
  function saveReviewSessionState(value) {
    try { localStorage.setItem(REVIEW_KEY, JSON.stringify(value || {})); } catch (e) {}
  }
  function loadAdaptiveRatings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ADAPTIVE_KEY)) || {};
      return parsed && parsed.version ? parsed : (METRICS ? METRICS.emptyRatings() : { version: 1, skills: {}, items: {} });
    } catch (e) {
      return METRICS ? METRICS.emptyRatings() : { version: 1, skills: {}, items: {} };
    }
  }
  function saveAdaptiveRatings() {
    try { localStorage.setItem(ADAPTIVE_KEY, JSON.stringify(adaptiveRatings)); } catch (e) {}
  }
  function loadAnalysisState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ANALYSIS_KEY)) || {};
      return parsed && parsed.version ? parsed : { version: 1, engine_active: false, cycle: 0 };
    } catch (e) {
      return { version: 1, engine_active: false, cycle: 0 };
    }
  }
  function saveAnalysisState() {
    try { localStorage.setItem(ANALYSIS_KEY, JSON.stringify(analysisState)); } catch (e) {}
  }
  function deviceId() {
    try {
      let id = localStorage.getItem(DEVICE_KEY);
      if (!id) {
        id = (window.crypto && crypto.randomUUID && crypto.randomUUID()) || "dev_" + Date.now() + "_" + Math.random().toString(16).slice(2);
        localStorage.setItem(DEVICE_KEY, id);
      }
      return id;
    } catch (e) {
      return "dev_ephemeral";
    }
  }
  function syncQueue() {
    try {
      const rows = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY)) || [];
      return Array.isArray(rows) ? rows : [];
    } catch (e) { return []; }
  }
  function saveSyncQueue(rows) {
    try { localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(rows.slice(-500))); } catch (e) {}
  }
  function queueSyncEvent(event) {
    const rows = syncQueue();
    rows.push(Object.assign({
      event_id: (window.crypto && crypto.randomUUID && crypto.randomUUID()) || "evt_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      learner_id: LEARNER_ID,
      device_id: deviceId(),
      course_id: COURSE.course_id || "russian_family_visit",
      client_created_at: new Date().toISOString(),
    }, event));
    saveSyncQueue(rows);
    flushLearningSync();
  }
  let syncInFlight = false;
  async function flushLearningSync() {
    const rows = syncQueue();
    if (!rows.length || syncInFlight || !SYNC_API) return;
    syncInFlight = true;
    try {
      const response = await fetch(`${SYNC_API}/api/learning/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ learner_id: LEARNER_ID, device_id: deviceId(), events: rows }),
      });
      if (response.ok) saveSyncQueue([]);
    } catch (e) {
      // Offline-first: keep the queue for the next reachable sync server.
    } finally {
      syncInFlight = false;
    }
  }
  window.addEventListener("online", flushLearningSync);
  function emptyRec() { return { seen: 0, correct: 0, known: false, stages: {}, errors: {}, last_seen_at: "" }; }
  function migrateRec(value) {
    const r = Object.assign(emptyRec(), value || {});
    r.stages = r.stages || {};
    Object.keys(LEGACY_STAGE).forEach(oldKey => {
      if (r.stages[oldKey] && !r.stages[LEGACY_STAGE[oldKey]]) r.stages[LEGACY_STAGE[oldKey]] = r.stages[oldKey];
    });
    STAGE_KEYS.forEach(k => { if (typeof r.stages[k] === "number") r.stages[k] = stageSeed(r.stages[k]); });
    r.errors = r.errors || {};
    r.review = r.review || {};
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
  function tokenizeAnswer(s) {
    return normalize(s).split(/\s+/).filter(Boolean);
  }
  function tokenCounts(tokens) {
    return tokens.reduce((acc, token) => {
      acc[token] = (acc[token] || 0) + 1;
      return acc;
    }, {});
  }
  function sameTokenMultiset(aTokens, bTokens) {
    if (aTokens.length !== bTokens.length) return false;
    const aCounts = tokenCounts(aTokens);
    const bCounts = tokenCounts(bTokens);
    return Object.keys(aCounts).every((k) => aCounts[k] === bCounts[k]) &&
      Object.keys(bCounts).every((k) => aCounts[k] === bCounts[k]);
  }
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;
    const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prevDiag = dp[0];
      dp[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const temp = dp[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prevDiag + cost);
        prevDiag = temp;
      }
    }
    return dp[b.length];
  }
  function isCloseToken(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const diff = Math.abs(a.length - b.length);
    if (diff > 2) return false;
    return levenshtein(a, b) <= 2;
  }
  function nearTokenMatch(userTokens, answerTokens) {
    if (userTokens.length !== answerTokens.length) return false;
    const remaining = answerTokens.slice();
    for (const token of userTokens) {
      const hit = remaining.findIndex((candidate) => isCloseToken(token, candidate));
      if (hit < 0) return false;
      remaining.splice(hit, 1);
    }
    return true;
  }
  function answerSimilarity(a, b) {
    const aa = normalize(a);
    const bb = normalize(b);
    const longest = Math.max(aa.length, bb.length);
    if (!longest) return 1;
    return Math.max(0, 1 - (levenshtein(aa, bb) / longest));
  }
  function typedAnswerAssessment(value, accepted) {
    const rawNorm = normalize(value || "");
    const candidates = (accepted || []).filter(Boolean);
    let best = { ok: false, close: false, bestAnswer: candidates[0] || "", similarity: 0 };
    if (!rawNorm || !candidates.length) return best;
    for (const candidate of candidates) {
      const candNorm = normalize(candidate);
      const similarity = answerSimilarity(rawNorm, candNorm);
      if (similarity > best.similarity) {
        best = { ok: false, close: false, bestAnswer: candidate, similarity };
      }
      if (rawNorm === candNorm) return { ok: true, close: false, bestAnswer: candidate, similarity: 1 };
    }
    for (const candidate of candidates) {
      const candNorm = normalize(candidate);
      const userTokens = tokenizeAnswer(rawNorm);
      const answerTokens = tokenizeAnswer(candNorm);
      const tokenClose = userTokens.length > 0 && nearTokenMatch(userTokens, answerTokens);
      const similarity = answerSimilarity(rawNorm, candNorm);
      if (tokenClose || similarity >= 0.72) {
        return { ok: false, close: true, bestAnswer: candidate, similarity };
      }
    }
    return best;
  }
  function inferBacktranslateErrorType(item, raw, stageKey) {
    const allowed = new Set(
      (item && (item.allowed_error_types || item.error_types || [])) || []
    );
    const candidates = (item && item.accepted_answers) || [item && item.ru_plain].filter(Boolean);
    const rawNorm = normalize(raw || "");
    if (!rawNorm) return allowed.has("forgot_phrase") ? "forgot_phrase" : null;
    const rawTokens = tokenizeAnswer(rawNorm);
    for (const candidate of candidates) {
      const candNorm = normalize(candidate || "");
      if (!candNorm) continue;
      if (rawNorm === candNorm) return null;
      const candTokens = tokenizeAnswer(candNorm);
      if (sameTokenMultiset(rawTokens, candTokens) && rawTokens.length > 0) {
        if (rawTokens.join(" ") !== candTokens.join(" ")) {
          return allowed.has("word_order") ? "word_order" : "forgot_phrase";
        }
      }
    }
    for (const candidate of candidates) {
      const candNorm = normalize(candidate || "");
      if (!candNorm) continue;
      const candTokens = tokenizeAnswer(candNorm);
      if (nearTokenMatch(rawTokens, candTokens)) {
        return allowed.has("case_or_inflection") ? "case_or_inflection" : (allowed.has("word_order") ? "word_order" : "forgot_phrase");
      }
    }
    if (allowed.size === 0) return "forgot_phrase";
    if (allowed.has("forgot_phrase")) return "forgot_phrase";
    if (stageKey === "cloze") return allowed.has("register") ? "register" : Array.from(allowed)[0];
    return Array.from(allowed)[0];
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
  function speechAnswerStats() {
    const states = STAGE_KEYS.flatMap(stageKey =>
      stagePool(stageKey).map(it => stageState(it.id, stageKey)).filter(Boolean)
    );
    const totals = states.reduce((acc, st) => {
      acc.count += st.speech_eval_count || 0;
      acc.correct += st.speech_eval_success || 0;
      acc.close += st.close_guesses || 0;
      return acc;
    }, { count: 0, correct: 0, close: 0 });
    totals.successRate = totals.count ? Math.round(totals.correct / totals.count * 100) : 0;
    return totals;
  }
  function oralAdvancementPlan(perf, adaptive) {
    const speech = speechAnswerStats();
    const rows = [];
    if (perf.listenAccuracy < 70) {
      rows.push({ label: "Decode hosts", route: "listen", why: "Run listening until you can pick the meaning from audio first." });
    }
    if (stageAccuracy("pronounce") < 70 || speech.successRate < 70) {
      rows.push({ label: "Say it aloud", route: "pronounce", why: "Use record, play mine, and analyze before relying on any typed answer." });
    }
    if (perf.roleplayPass < 70) {
      rows.push({ label: "Use it at the table", route: "roleplay", why: "Role-play is the closest signal to the actual family visit." });
    }
    if (adaptive.frictionIndex >= 35) {
      rows.push({ label: "Repair weak spots", route: "adaptive", why: "The model sees misses or slow answers; stay in the n+1 drill." });
    }
    if (!rows.length) {
      rows.push({ label: "Advance one notch", route: "adaptive", why: "Your oral signals are stable enough to take the next adaptive item." });
    }
    return rows.slice(0, 3);
  }
  function oralAdvancementHtml(perf, adaptive) {
    const speech = speechAnswerStats();
    const rows = oralAdvancementPlan(perf, adaptive);
    return `<div class="oraladvance rise">
      <div>
        <h3>How to advance</h3>
        <p>Prioritize oral readiness: understand audio, say the phrase, then use it in a role-play. Typing is just a fallback for checking an answer.</p>
      </div>
      <div class="oraladvance__metrics">
        <div><strong>${perf.listenAccuracy}<small>%</small></strong><span>listening</span></div>
        <div><strong>${stageAccuracy("pronounce")}<small>%</small></strong><span>pronunciation</span></div>
        <div><strong>${speech.successRate}<small>%</small></strong><span>speech checks</span></div>
        <div><strong>${perf.roleplayPass}<small>%</small></strong><span>role-play</span></div>
      </div>
      <div class="oraladvance__queue">
        ${rows.map(row => `<button onclick="${row.route === "adaptive" ? "ZS.startAdaptive()" : `location.hash='#/quiz/${row.route}'`}"><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(row.why)}</span></button>`).join("")}
      </div>
    </div>`;
  }
  function adaptiveStats() {
    if (!METRICS) return {
      missionAbility: 1500,
      grammarControl: 1500,
      listeningDiscrimination: 1500,
      productionControl: 1500,
      confidence: 0,
      bottlenecks: [],
      nPlusOneFit: 0,
      frictionIndex: 0,
    };
    const snapshot = METRICS.metricSnapshot(adaptiveRatings);
    const recent = [];
    STAGE_KEYS.forEach(stageKey => {
      stagePool(stageKey).forEach(it => {
        const st = stageState(it.id, stageKey);
        if (!st || !st.seen) return;
        const adaptive = adaptiveItemState(it.id, stageKey);
        recent.push({
          expected: adaptive.expected,
          lapses: st.lapses || 0,
          assisted: st.last_assistance || 0,
          latency: st.last_latency_ms || 0,
          targetLatency: METRICS.targetLatency(stageKey),
        });
      });
    });
    const nPlusOne = recent.filter(row => row.expected >= METRICS.TARGET_LOW && row.expected <= METRICS.TARGET_HIGH).length;
    const friction = recent.filter(row => row.lapses > 0 || row.assisted > 0 || (row.latency && row.latency > row.targetLatency)).length;
    return Object.assign(snapshot, {
      nPlusOneFit: recent.length ? Math.round(nPlusOne / recent.length * 100) : 0,
      frictionIndex: recent.length ? Math.round(friction / recent.length * 100) : 0,
    });
  }
  function skillLabel(key) {
    return String(key || "")
      .replace(/^structure:/, "")
      .replace(/^stage:/, "stage: ")
      .replace(/^mission:/, "mission: ")
      .replace(/[:_]/g, " ");
  }
  function adaptiveRecommendations(limit) {
    if (!METRICS) return [];
    const rows = STAGE_KEYS.flatMap(stageKey => stagePool(stageKey).map(it => {
      const st = stageState(it.id, stageKey);
      const adaptive = adaptiveItemState(it.id, stageKey);
      const due = isDue(st);
      const bucketRank = { rescue: 0, "n+1": 1, consolidate: 2, too_easy: 3 }[adaptive.bucket] || 4;
      const dueRank = due ? 0 : 1;
      const priority = it.priority || adaptive.meta.priority || 3;
      return { item: it, stageKey, st, adaptive, due, sort: [dueRank, bucketRank, priority, Math.abs(adaptive.expected - 0.68)] };
    }));
    return rows.sort((a, b) => {
      for (let i = 0; i < a.sort.length; i++) if (a.sort[i] !== b.sort[i]) return a.sort[i] - b.sort[i];
      return a.item.id.localeCompare(b.item.id);
    }).slice(0, limit || 8);
  }
  function adaptivePanelHtml(stats) {
    const recs = adaptiveRecommendations(4);
    const bottleneck = stats.bottlenecks && stats.bottlenecks.length ? skillLabel(stats.bottlenecks[0].skill_key) : "not enough attempts yet";
    return `<div class="analyticsbox rise adaptivebox">
      <div><h3>Adaptive progress model</h3><p>Elo-style ability and item difficulty estimates choose practice in the n+1 band: hard enough to grow, not so hard it collapses.</p></div>
      <div class="analyticsgrid">
        <div><strong>${stats.missionAbility}</strong><span>mission ability</span></div>
        <div><strong>${stats.grammarControl}</strong><span>grammar control</span></div>
        <div><strong>${stats.nPlusOneFit}<small>%</small></strong><span>n+1 fit</span></div>
        <div><strong>${stats.frictionIndex}<small>%</small></strong><span>friction index</span></div>
        <div><strong>${stats.listeningDiscrimination}</strong><span>listening rating</span></div>
        <div><strong>${stats.productionControl}</strong><span>production rating</span></div>
      </div>
      <div class="adaptivebox__next">
        <strong>Current bottleneck:</strong> ${escapeHtml(bottleneck)}
        ${recs.length ? `<div class="adaptivequeue">${recs.map(row => `<button onclick="location.hash='#/quiz/${row.stageKey}'"><span>${escapeHtml(METRICS.bucketLabel(row.adaptive.bucket))} · ${Math.round(row.adaptive.expected * 100)}%</span>${escapeHtml(row.item.en || row.item.title || row.item.id)}</button>`).join("")}</div>` : ""}
      </div>
    </div>`;
  }
  function analysisFlags(perf, adaptive) {
    const flags = [];
    if (perf.overdue > 0) flags.push(`${perf.overdue} overdue review${perf.overdue === 1 ? "" : "s"} before new material`);
    if (adaptive.frictionIndex >= 35) flags.push("friction is high: slow down and repair misses");
    if (adaptive.nPlusOneFit > 0 && adaptive.nPlusOneFit < 45) flags.push("too little practice is landing in the n+1 band");
    if (adaptive.confidence < 25) flags.push("confidence is still low: collect more attempts");
    if (!flags.length) flags.push("analysis clear: stay in adaptive drill flow");
    return flags.slice(0, 3);
  }
  function runAnalysisCycle(reason) {
    const perf = analytics();
    const adaptive = adaptiveStats();
    const recs = adaptiveRecommendations(8);
    const next = recs[0] || null;
    analysisState = {
      version: 1,
      engine_active: true,
      cycle: (analysisState.cycle || 0) + 1,
      reason: reason || "interval",
      last_run_at: new Date().toISOString(),
      target_band: { low: METRICS ? METRICS.TARGET_LOW : 0.58, high: METRICS ? METRICS.TARGET_HIGH : 0.78 },
      metrics: Object.assign({
        readiness: readiness(),
        due: perf.due,
        overdue: perf.overdue,
        delayedRecall: perf.delayedRecall,
        averageResponseMs: perf.averageResponseMs,
      }, adaptive),
      flags: analysisFlags(perf, adaptive),
      next_action: next ? {
        item_id: next.item.id,
        source_item_id: next.adaptive.meta.source_item_id,
        stage_key: next.stageKey,
        label: next.item.en || next.item.title || next.item.id,
        bucket: next.adaptive.bucket,
        expected_success: Math.round(next.adaptive.expected * 100),
        reason: next.due ? "due adaptive review" : "best n+1 fit inside current lesson lock",
      } : null,
    };
    saveAnalysisState();
    return analysisState;
  }
  function startAnalysisEngine() {
    if (analysisTimer) return;
    runAnalysisCycle("startup");
    analysisTimer = window.setInterval(() => runAnalysisCycle("interval"), 45000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) runAnalysisCycle("visible");
    });
  }
  function analysisPanelHtml(state) {
    state = state && state.engine_active ? state : runAnalysisCycle("render");
    const action = state.next_action;
    const target = state.target_band || { low: 0.58, high: 0.78 };
    const last = state.last_run_at ? new Date(state.last_run_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "now";
    return `<div class="analysisengine rise">
      <div>
        <h3>Analysis engine active</h3>
        <p>Runs every 45 seconds while the app is open. Target n+1 band: ${Math.round(target.low * 100)}-${Math.round(target.high * 100)}% predicted success.</p>
      </div>
      <div class="analysisengine__status">
        <div><strong>${escapeHtml(String(state.cycle || 0))}</strong><span>cycles</span></div>
        <div><strong>${escapeHtml(last)}</strong><span>last analysis</span></div>
        <div><strong>${state.metrics ? state.metrics.confidence : 0}<small>%</small></strong><span>signal confidence</span></div>
      </div>
      <div class="analysisengine__next">
        <strong>Next action:</strong>
        ${action ? `<button onclick="location.hash='#/quiz/${escapeHtml(action.stage_key)}'"><span>${escapeHtml(action.bucket)} · ${action.expected_success}%</span>${escapeHtml(action.stage_key)}: ${escapeHtml(action.label)}</button>` : "collect the first attempt"}
      </div>
      <div class="analysisengine__flags">${(state.flags || []).map(flag => `<span>${escapeHtml(flag)}</span>`).join("")}</div>
    </div>`;
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
    try {
      if (SYNC_API) fetch(`${SYNC_API}/api/learning/snapshots`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ learner_id: LEARNER_ID, snapshot }),
      }).catch(() => {});
    } catch (e) {}
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
    if (errorType === "case_or_inflection") return "conjugate";
    if (errorType === "word_order") return "backtranslate";
    return "produce";
  }
  function recordRepairFocus(id, stageKey, errorTypes) {
    if (!errorTypes || !errorTypes.length) return;
    const r = rec(id);
    const st = stageRec(id, stageKey);
    (errorTypes || []).forEach((err) => {
      if (!err || !ERROR_BY_ID[err]) return;
      st.last_repair_focus = err;
      st.repair_focus_counts = st.repair_focus_counts || {};
      st.repair_focus_counts[err] = (st.repair_focus_counts[err] || 0) + 1;
      r.errors[err] = (r.errors[err] || 0) + 1;
      r.repair_focus_counts = r.repair_focus_counts || {};
      r.repair_focus_counts[err] = (r.repair_focus_counts[err] || 0) + 1;
    });
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
    const candidates = SCENARIOS.filter(s => scenarioLesson(s) <= limit && (s.required_items || []).includes(id));
    if (!candidates.length) return null;
    const lessonFor = (s) => (Number.isFinite(scenarioLesson(s)) ? scenarioLesson(s) : 99);
    return candidates.slice().sort((a, b) => {
      const lessonCmp = lessonFor(b) - lessonFor(a);
      if (lessonCmp !== 0) return lessonCmp;
      const cpa = (a.success_criteria || []).length;
      const cpb = (b.success_criteria || []).length;
      if (cpb !== cpa) return cpb - cpa;
      return (SCENARIO_INDEX[b.id] || 0) - (SCENARIO_INDEX[a.id] || 0);
    })[0];
  }
  function scenarioLesson(s) {
    if (typeof s.lesson_number === "number") return s.lesson_number;
    const lesson = s.lesson_id ? LESSON_BY_ID[s.lesson_id] : null;
    return lesson ? lesson.lesson_number : 999;
  }
  function tutorCardForItem(id) {
    const s = scenarioForItem(id);
    return s ? TUTOR_BY_SCENARIO[s.id] : null;
  }
  function tutorCardForScenarioId(scenarioId) {
    if (!scenarioId) return null;
    return TUTOR_BY_SCENARIO[scenarioId] || null;
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
      SCENARIOS.filter(s => scenarioLesson(s) <= n)
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
  function unlockedVerbDrillCards(cards) {
    return activeLessonStageCards(cards);
  }
  function practiceItem(id) {
    return ITEMS.find(i => i.id === id) || CLOZE_CARDS.find(c => c.id === id) || DICTATION_CARDS.find(c => c.id === id) || STRESS_CARDS.find(c => c.id === id) || PRONUNCIATION_CARDS.find(c => c.id === id) || BACKTRANSLATION_CARDS.find(c => c.id === id) || CONTRAST_CARDS.find(c => c.id === id) || VERB_DRILL_CARDS.find(c => c.id === id);
  }
  function sourceItemFor(item) {
    if (!item) return null;
    return ITEMS_BY_ID[item.item_id] || ITEMS_BY_ID[item.id] || item;
  }
  function itemMeta(id, stageKey) {
    const item = practiceItem(id) || {};
    const source = sourceItemFor(item) || {};
    const structures = new Set([].concat(source.structures || [], item.structures || []));
    const allowedErrorTypes = new Set([].concat(source.allowed_error_types || source.error_types || [], item.allowed_error_types || item.error_types || []));
    return {
      item_id: id,
      source_item_id: source.id || item.item_id || id,
      stage_key: stageKey,
      module: source.module || item.module || "",
      priority: source.priority || item.priority || 3,
      lesson_id: source.lesson_id || item.lesson_id || "",
      lesson_number: source.lesson_number || item.lesson_number || null,
      structures: Array.from(structures).filter(Boolean),
      allowed_error_types: Array.from(allowedErrorTypes).filter(Boolean),
    };
  }
  function adaptiveItemState(id, stageKey) {
    const meta = itemMeta(id, stageKey);
    const itemKey = `${id}:${stageKey}`;
    const itemRating = adaptiveRatings.items && adaptiveRatings.items[itemKey];
    const skillKeys = METRICS ? METRICS.eventSkillKeys(meta, stageKey) : [];
    const ability = skillKeys.length ? skillKeys.reduce((sum, key) => {
      const row = adaptiveRatings.skills && adaptiveRatings.skills[key];
      return sum + (row ? row.rating : METRICS.DEFAULT_RATING);
    }, 0) / skillKeys.length : (METRICS ? METRICS.DEFAULT_RATING : 1500);
    const difficulty = itemRating ? itemRating.difficulty : (METRICS ? METRICS.baseDifficulty(stageKey, meta.priority) : 1500);
    const expected = METRICS ? METRICS.expectedSuccess(ability, difficulty) : 0.5;
    const bucket = METRICS ? METRICS.bucket(expected) : "n+1";
    return { meta, itemKey, skillKeys, ability, difficulty, expected, bucket };
  }
  function applyAdaptiveAttempt(id, stageKey, ok, opts, latencyMs) {
    if (!METRICS) return null;
    const meta = itemMeta(id, stageKey);
    const result = METRICS.applyAttempt(adaptiveRatings, {
      item_id: id,
      stage_key: stageKey,
      ok,
      assisted: !!(opts && opts.assisted),
      latency_ms: latencyMs || 0,
      meta,
      at: new Date().toISOString(),
    });
    adaptiveRatings = result.ratings;
    saveAdaptiveRatings();
    return Object.assign({ meta }, result);
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
    const verbDrillCount = unlockedVerbDrillCards(VERB_DRILL_CARDS).length;
    const options = LESSONS.map(l => `<option value="${escapeHtml(l.lesson_id)}" ${l.lesson_id === lesson.lesson_id ? "selected" : ""}>${String(l.lesson_number).padStart(2, "0")} · ${escapeHtml(l.title)}</option>`).join("");
    return `<div class="lessonlock rise">
      <div>
        <h3>Curriculum lock</h3>
        <p>Practice is constrained to Lesson ${lesson.lesson_number}: ${escapeHtml(lesson.title)} and everything before it.</p>
      </div>
      <label><span>Unlocked through</span><select onchange="ZS.setLesson(this.value)">${options}</select></label>
      <div class="lessonlock__meta">${count}/${ITEMS.length} phrases unlocked · ${clozeCount}/${CLOZE_CARDS.length} cloze · ${dictationCount}/${DICTATION_CARDS.length} dictation · ${stressCount}/${STRESS_CARDS.length} stress · ${pronunciationCount}/${PRONUNCIATION_CARDS.length} pronounce · ${backCount}/${BACKTRANSLATION_CARDS.length} back-translation · ${contrastCount}/${CONTRAST_CARDS.length} contrast · ${verbDrillCount}/${VERB_DRILL_CARDS.length} conjugation · ${(lesson.introduced_structures || []).length} structures in this lesson</div>
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
    if (activeRoute !== "learn") cleanupLearnRecording();
    if (activeRoute !== "quiz") cleanupLiveRoleplay();
    if (activeRoute === "learn") renderLearn(arg);
    else if (activeRoute === "quiz") arg ? renderQuizRun(arg) : renderQuizMenu();
    else if (activeRoute === "review") renderReview(arg);
    else if (activeRoute === "plan") renderPlan();
    else renderHome();
    view.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", router);

  /* ====================================================================
     HOME
     ==================================================================== */
  function dueReviewItems() {
    const now = Date.now();
    return unlockedItems(ITEMS).filter(it => {
      const due = rec(it.id).review && rec(it.id).review.due_at;
      return !due || new Date(due).getTime() <= now;
    });
  }
  function todayPracticeHtml() {
    const due = dueReviewItems().length;
    const speech = adaptiveRecommendations(1).find(row => row.stageKey === "pronounce") || adaptiveRecommendations(1)[0];
    const speechLabel = speech && speech.item ? speech.item.en : "a high-priority phrase";
    const completedToday = (reviewSessionStore.daily_completed_at || "").slice(0, 10) === new Date().toISOString().slice(0, 10);
    return `<section class="todaylane rise" aria-label="Today practice lane">
      <div class="todaylane__head">
        <div>
          <span class="todaylane__eyebrow">Today practice</span>
          <h2>Review, speak, then try the table.</h2>
        </div>
        <span class="todaylane__date">${escapeHtml(todayLabel())}</span>
      </div>
      <div class="todaylane__grid">
        <a class="todaytask" href="#/review">
          <span class="todaytask__step">1</span>
          <strong>Review cards</strong>
          <span>${due} due now${completedToday ? " · daily set done" : ""}</span>
        </a>
        <button class="todaytask" onclick="ZS.startTodaySpeak()">
          <span class="todaytask__step">2</span>
          <strong>Speak one phrase</strong>
          <span>${escapeHtml(speechLabel)}</span>
        </button>
        <button class="todaytask todaytask--strong" onclick="ZS.startGuidedRoleplay()">
          <span class="todaytask__step">3</span>
          <strong>Try guided roleplay</strong>
          <span>Start supported; go live only when ready.</span>
        </button>
      </div>
    </section>`;
  }
  function renderHome() {
    const op = overallProgress();
    const a = analytics();
    const adaptive = adaptiveStats();
    const analysis = runAnalysisCycle("home");
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
      ${todayPracticeHtml()}

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
      ${analysisPanelHtml(analysis)}
      ${oralAdvancementHtml(a, adaptive)}
      ${adaptivePanelHtml(adaptive)}
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
  let learnState = {
    module: "all",
    priority: 0,
    idx: 0,
    list: [],
    hideEn: false,
    audioRate: loadLearnRate(),
    showVoiceLab: false,
    showConjugation: false,
  };
  let learnRecorder = null;
  let learnRecordStream = null;
  let learnRecordChunks = [];
  let learnRecordingUrl = "";
  let learnRecordingBlob = null;
  let learnRecordingItemId = "";
  let learnSpeechEval = null;
  let learnSpectrogramToken = 0;
  function buildLearnList() {
    let list = unlockedItems(ITEMS);
    if (learnState.module !== "all") list = list.filter(i => i.module === learnState.module);
    if (learnState.priority) list = list.filter(i => i.priority === learnState.priority);
    list.sort((a, b) => a.priority - b.priority);
    learnState.list = list;
    if (learnState.idx >= list.length) learnState.idx = 0;
  }
  function cleanupLearnRecording() {
    const activeRecorder = learnRecorder;
    learnRecorder = null;
    if (activeRecorder && activeRecorder.state !== "inactive") {
      activeRecorder.onstop = null;
      try { activeRecorder.stop(); } catch (e) {}
    }
    if (learnRecordStream) {
      learnRecordStream.getTracks().forEach(track => track.stop());
      learnRecordStream = null;
    }
    if (learnRecordingUrl) {
      URL.revokeObjectURL(learnRecordingUrl);
      learnRecordingUrl = "";
    }
    learnRecordingBlob = null;
    learnRecordChunks = [];
    learnRecordingItemId = "";
    learnSpeechEval = null;
  }
  function setLearnStatus(message) {
    const el = $("#learnRecordStatus");
    if (el) el.textContent = message;
  }
  async function blobToBase64(blob) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Unable to read recording"));
      reader.readAsDataURL(blob);
    });
    return dataUrl.split(",", 2)[1] || "";
  }
  function speechTokenDiff(targetTokens, transcriptTokens) {
    const used = new Set();
    const rows = targetTokens.map(target => {
      let bestIndex = -1;
      let bestDistance = Infinity;
      transcriptTokens.forEach((token, index) => {
        if (used.has(index)) return;
        const distance = levenshtein(target, token);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      if (bestIndex >= 0 && bestDistance <= Math.max(1, Math.ceil(target.length * 0.34))) {
        used.add(bestIndex);
        return { target, heard: transcriptTokens[bestIndex], ok: bestDistance === 0, distance: bestDistance };
      }
      return { target, heard: "", ok: false, missing: true };
    });
    transcriptTokens.forEach((token, index) => {
      if (!used.has(index)) rows.push({ target: "", heard: token, ok: false, extra: true });
    });
    return rows;
  }
  function normalizeSpeechText(value) {
    return normalize(value).replace(/[ё]/g, "е").replace(/[^\p{Letter}\p{Number}\s-]+/gu, " ").replace(/\b(э|эм|ну|а)\b/giu, " ").replace(/\s+/g, " ").trim();
  }
  function compareSpeechTranscript(transcript, target) {
    const normalizedTranscript = normalizeSpeechText(transcript);
    const targetNormalized = normalizeSpeechText(target);
    const distance = levenshtein(normalizedTranscript, targetNormalized);
    const maxLen = Math.max(normalizedTranscript.length, targetNormalized.length, 1);
    const charSimilarity = Math.max(0, 1 - distance / maxLen);
    const targetTokens = targetNormalized.split(/\s+/).filter(Boolean);
    const transcriptTokens = normalizedTranscript.split(/\s+/).filter(Boolean);
    const diffTokens = speechTokenDiff(targetTokens, transcriptTokens);
    const matched = diffTokens.filter(row => row.target && row.heard && row.distance <= Math.max(1, Math.ceil(row.target.length * 0.34))).length;
    const tokenSimilarity = targetTokens.length ? matched / targetTokens.length : 0;
    const textSimilarity = Math.round(((charSimilarity * 0.55) + (tokenSimilarity * 0.45)) * 1000) / 1000;
    const verdict = normalizedTranscript && normalizedTranscript === targetNormalized ? "correct" : textSimilarity >= 0.72 ? "close" : "repair";
    return {
      transcript: transcript || "",
      normalized_transcript: normalizedTranscript,
      target_normalized: targetNormalized,
      text_similarity: textSimilarity,
      sample_match_score: textSimilarity,
      verdict,
      suggested_error_type: verdict === "repair" ? "forgot_phrase" : verdict === "close" ? "stress" : "",
      diff_tokens: diffTokens,
      confidence: 0.7,
      provider: "browser",
    };
  }
  function browserRecognizeRussian(statusFn) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return Promise.resolve(null);
    return new Promise((resolve) => {
      const rec = new Recognition();
      let settled = false;
      rec.lang = "ru-RU";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = event => {
        settled = true;
        const result = event.results && event.results[0] && event.results[0][0];
        resolve({ transcript: result ? result.transcript : "", confidence: result ? result.confidence || 0.7 : 0.4 });
      };
      rec.onerror = () => { if (!settled) resolve(null); };
      rec.onend = () => { if (!settled) resolve(null); };
      if (statusFn) statusFn("Listening again for browser transcription...");
      try { rec.start(); } catch (e) { resolve(null); }
    });
  }
  async function evaluateSpeech(opts) {
    const item = opts.item;
    const target = opts.targetOverride || item.ru_plain || stripStress(item.ru || "");
    if (SYNC_API && opts.blob) {
      if (opts.statusFn) opts.statusFn("Analyzing Russian speech...");
      const response = await fetch(`${SYNC_API}/api/speech/evaluate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          learner_id: LEARNER_ID,
          device_id: deviceId(),
          item_id: item.item_id || item.id,
          stage_key: opts.stageKey || "pronounce",
          target_ru: opts.targetRu || item.ru || target,
          target_ru_plain: target,
          mime_type: opts.blob.type || "audio/webm",
          filename: `${item.item_id || item.id || "zastolom"}.webm`,
          audio_base64: await blobToBase64(opts.blob),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Speech analysis failed");
      if (result.provider !== "unavailable") return result;
    }
    const heard = await browserRecognizeRussian(opts.statusFn);
    if (heard && heard.transcript) {
      return Object.assign(compareSpeechTranscript(heard.transcript, target), { confidence: heard.confidence || 0.7 });
    }
    return Object.assign(compareSpeechTranscript("", target), {
      provider: "unavailable",
      confidence: 0,
      error: "Transcription unavailable. Start the sync server with AWS-backed OPENAI_API_KEY, or use manual self-rating.",
    });
  }
  function speechEvalHtml(result, applyId) {
    if (!result) return "";
    const pct = Math.round((result.text_similarity || 0) * 100);
    const title = result.verdict === "correct" ? "Correct" : result.verdict === "close" ? "Close" : "Needs repair";
    const diff = (result.diff_tokens || []).slice(0, 10).map(row => {
      const cls = row.ok ? "ok" : row.missing ? "missing" : row.extra ? "extra" : "near";
      const text = row.ok ? row.target : row.missing ? `-${row.target}` : row.extra ? `+${row.heard}` : `${row.target}→${row.heard}`;
      return `<span class="${cls}">${escapeHtml(text)}</span>`;
    }).join("");
    const actions = applyId ? `<div class="speecheval__actions">
      <button class="btn btn--sm" onclick="ZS.applySpeechVerdict('${applyId}',${result.verdict === "correct"})">Accept ${escapeHtml(title)}</button>
      <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.applySpeechVerdict('${applyId}',false,'${escapeHtml(result.suggested_error_type || "forgot_phrase")}')">Mark repair</button>
    </div>` : "";
    return `<div class="speecheval speecheval--${escapeHtml(result.verdict || "repair")}">
      <div class="speecheval__top"><strong>${escapeHtml(title)}</strong><span>${pct}% · ${escapeHtml(result.provider || "unknown")}</span></div>
      <div><span>Heard</span><p>${escapeHtml(result.transcript || "—")}</p></div>
      <div><span>Target</span><p>${escapeHtml(result.target_normalized || "")}</p></div>
      ${diff ? `<div class="speecheval__diff">${diff}</div>` : ""}
      ${result.error ? `<div class="speecheval__error">${escapeHtml(result.error)}</div>` : ""}
      ${actions}
    </div>`;
  }
  function activeLearnItem() {
    return learnState.list[learnState.idx] || null;
  }
  function speedControlsHtml() {
    return [
      { rate: 0.65, label: "Slow" },
      { rate: 0.85, label: "Careful" },
      { rate: 1, label: "Normal" },
      { rate: 1.15, label: "Table" },
      { rate: 1.3, label: "Fast" },
    ].map(({ rate, label }) =>
      `<button class="chip chip--tight ${learnState.audioRate === rate ? "is-on" : ""}" title="${label} readback" aria-label="${label} readback speed ${rate}x" onclick="ZS.setLearnRate(${rate})">${rate}x</button>`
    ).join("");
  }
  function verbConjugationFor(it) {
    if (!it || it.module !== "verbs") return null;
    const forms = (it.ru || "").split("/").map(s => s.trim()).filter(Boolean);
    if (forms.length < 2) return null;
    const infinitive = (it.en || "").split("—").pop().trim();
    return {
      infinitive: infinitive && infinitive !== it.en ? infinitive : "",
      first: forms[0],
      formal: forms[1],
    };
  }
  function conjugationPanelHtml(it) {
    const data = verbConjugationFor(it);
    if (!data || !learnState.showConjugation) return "";
    return `<div class="conjpanel">
      <div class="conjpanel__head"><strong>Conjugation</strong>${data.infinitive ? `<span>${escapeHtml(data.infinitive)}</span>` : ""}</div>
      <div class="conjgrid">
        <div><span>я</span><strong>${colorStress(data.first)}</strong></div>
        <div><span>вы</span><strong>${colorStress(data.formal)}</strong></div>
      </div>
    </div>`;
  }
  function voiceLabHtml(it) {
    if (!learnState.showVoiceLab) return "";
    const mineReady = learnRecordingUrl && learnRecordingItemId === it.id;
    return `<div class="voicelab">
      <div class="voicelab__head">
        <div><strong>Voice sonograph</strong><span>Compare native audio with your attempt.</span></div>
        <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.renderLearnSpectrograms()">Refresh</button>
      </div>
      <div class="sonorow"><span>Native</span><canvas id="nativeSpectrogram" width="620" height="150"></canvas></div>
      <div class="sonorow"><span>Mine</span><canvas id="mineSpectrogram" width="620" height="150"></canvas></div>
      <div id="learnRecordStatus" class="voicelab__status">${mineReady ? "Recording ready. Play yours or record again." : "Record yourself to compare against the native model."}</div>
      <div id="learnSpeechEvalResult">${learnSpeechEval && learnRecordingItemId === it.id ? speechEvalHtml(learnSpeechEval, "") : ""}</div>
    </div>`;
  }
  function drawEmptySpectrogram(canvas, message) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#0d0b09";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(249,239,210,.6)";
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.fillStyle = "rgba(249,239,210,.76)";
    ctx.font = "13px sans-serif";
    ctx.fillText(message, 14, Math.round(h / 2));
  }
  async function audioBufferFromUrl(url) {
    const response = await fetch(url);
    const data = await response.arrayBuffer();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    try {
      return await ctx.decodeAudioData(data.slice(0));
    } finally {
      if (ctx.close) ctx.close();
    }
  }
  function drawSpectrogramFromBuffer(canvas, buffer) {
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const samples = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const cols = Math.min(w, 240);
    const bins = 52;
    const windowSize = 512;
    const maxHz = 5200;
    ctx.fillStyle = "#050403";
    ctx.fillRect(0, 0, w, h);
    const step = Math.max(1, Math.floor(samples.length / cols));
    for (let x = 0; x < cols; x++) {
      const start = Math.max(0, Math.min(samples.length - windowSize, x * step));
      for (let b = 0; b < bins; b++) {
        const hz = 90 + (b / bins) * maxHz;
        let re = 0;
        let im = 0;
        for (let n = 0; n < windowSize; n++) {
          const sample = samples[start + n] || 0;
          const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (windowSize - 1));
          const angle = 2 * Math.PI * hz * n / sampleRate;
          re += sample * win * Math.cos(angle);
          im -= sample * win * Math.sin(angle);
        }
        const mag = Math.min(1, Math.log10(1 + Math.sqrt(re * re + im * im) * 9));
        const y = h - 18 - Math.round((b / bins) * (h - 30));
        const red = Math.round(24 + mag * 40);
        const green = Math.round(70 + mag * 180);
        const blue = Math.round(130 + mag * 125);
        ctx.fillStyle = `rgb(${red},${green},${blue})`;
        ctx.fillRect(Math.floor(x * w / cols), y, Math.ceil(w / cols), Math.max(2, Math.ceil((h - 30) / bins)));
      }
    }
    ctx.strokeStyle = "rgba(249,239,210,.75)";
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.fillStyle = "rgba(249,239,210,.82)";
    ctx.font = "11px sans-serif";
    ctx.fillText("kHz", 8, 14);
    ctx.fillText("sec", w - 30, h - 8);
  }
  async function renderLearnSpectrograms() {
    if (!learnState.showVoiceLab) return;
    const token = ++learnSpectrogramToken;
    const it = activeLearnItem();
    const nativeCanvas = $("#nativeSpectrogram");
    const mineCanvas = $("#mineSpectrogram");
    if (!it) return;
    drawEmptySpectrogram(nativeCanvas, "Rendering native model...");
    try {
      const src = AUDIO && AUDIO_IDS.has(it.id) ? AUDIO.base + it.id + ".mp3" : "";
      if (!src) throw new Error("No native audio file");
      const buffer = await audioBufferFromUrl(src);
      if (token === learnSpectrogramToken) drawSpectrogramFromBuffer(nativeCanvas, buffer);
    } catch (e) {
      drawEmptySpectrogram(nativeCanvas, "Native spectrogram unavailable on this device.");
    }
    if (learnRecordingUrl && learnRecordingItemId === it.id) {
      drawEmptySpectrogram(mineCanvas, "Rendering your recording...");
      try {
        const buffer = await audioBufferFromUrl(learnRecordingUrl);
        if (token === learnSpectrogramToken) drawSpectrogramFromBuffer(mineCanvas, buffer);
      } catch (e) {
        drawEmptySpectrogram(mineCanvas, "Recording spectrogram unavailable.");
      }
    } else {
      drawEmptySpectrogram(mineCanvas, "Record yourself to render this row.");
    }
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
        <div class="speedctl" aria-label="Learn audio speed">${speedControlsHtml()}</div>
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
    const hasConjugation = !!verbConjugationFor(it);
    slot.innerHTML = `
      <div class="card rise ${learnState.hideEn ? "hidden-en" : ""}">
        <div class="card__meta"><span class="card__mod">${MOD_BY_ID[it.module].icon} ${escapeHtml(MOD_BY_ID[it.module].title)}</span>
          <span class="pill pill--p${it.priority}">P${it.priority}</span></div>
        <div class="card__ru">${colorStress(it.ru)}</div>
        <div class="card__en" title="${learnState.hideEn ? "tap to reveal" : ""}">${escapeHtml(it.en)}</div>
        ${it.hint ? `<div class="card__hint">🔈 ${escapeHtml(it.hint)}</div>` : ""}
        ${it.note ? `<div class="card__note">${escapeHtml(it.note)}</div>` : ""}
        <div class="card__foot">${badges(it)}</div>
        ${conjugationPanelHtml(it)}
        ${voiceLabHtml(it)}
      </div>
      <div class="cardnav">
        <button class="iconbtn" onclick="ZS.prev()" aria-label="Previous">‹</button>
        <button class="iconbtn iconbtn--play" onclick="ZS.say()" aria-label="Play audio">▶</button>
        <span class="cardnav__count">${learnState.idx + 1} / ${list.length}</span>
        <button class="iconbtn" onclick="ZS.known()" aria-label="Mark known" title="Mark as stuck">✓</button>
        <button class="iconbtn" onclick="ZS.next()" aria-label="Next">›</button>
      </div>
      <div class="learnvoice">
        <button id="learnRecordBtn" class="btn btn--sm btn--red" title="Record your pronunciation for this card" onclick="ZS.startLearnRecording()">Record</button>
        <button id="learnStopRecordBtn" class="btn btn--sm btn--ghost ghost-dark" title="Stop recording" onclick="ZS.stopLearnRecording()" disabled>Stop</button>
        <button id="learnPlayRecordBtn" class="btn btn--sm btn--ghost ghost-dark" title="Play your latest recording for this card" onclick="ZS.playLearnRecording()" ${learnRecordingUrl && learnRecordingItemId === it.id ? "" : "disabled"}>Play mine</button>
        <button id="learnAnalyzeBtn" class="btn btn--sm btn--ghost ghost-dark" title="Transcribe and check your Russian" onclick="ZS.analyzeLearnSpeech()" ${learnRecordingUrl && learnRecordingItemId === it.id ? "" : "disabled"}>Analyze</button>
        <button class="btn btn--sm btn--ghost ghost-dark ${learnState.showVoiceLab ? "is-on" : ""}" title="Show native and self-recorded spectrograms" onclick="ZS.toggleVoiceLab()">Sonograph</button>
        ${hasConjugation ? `<button class="btn btn--sm btn--ghost ghost-dark ${learnState.showConjugation ? "is-on" : ""}" title="Show the core verb forms for this card" onclick="ZS.toggleConjugation()">Conjugate</button>` : ""}
      </div>`;
    speak(it, { quiet: true, rate: learnState.audioRate }); // try native audio, but do not show autoplay-blocked TTS warnings
    if (learnState.showVoiceLab) setTimeout(renderLearnSpectrograms, 0);
  }

  /* ====================================================================
     REVIEW  (simple flip cards)
     ==================================================================== */
  let reviewState = {
    module: "all",
    priority: 0,
    idx: 0,
    list: [],
    flipped: false,
    audioRate: loadLearnRate(),
    sessionLimit: 5,
    sessionQueue: [],
    sessionStarted: false,
    sessionDone: false,
    ratings: { know: 0, almost: 0, forgot: 0 },
    repeatCounts: {},
  };
  function reviewDueTime(it) {
    const due = rec(it.id).review && rec(it.id).review.due_at;
    return due ? new Date(due).getTime() : 0;
  }
  function reviewRank(a, b) {
    const now = Date.now();
    const ad = reviewDueTime(a);
    const bd = reviewDueTime(b);
    const aDue = !ad || ad <= now;
    const bDue = !bd || bd <= now;
    if (aDue !== bDue) return aDue ? -1 : 1;
    if (ad !== bd) return ad - bd;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.id.localeCompare(b.id);
  }
  function buildReviewList() {
    let list = unlockedItems(ITEMS);
    if (reviewState.module !== "all") list = list.filter(i => i.module === reviewState.module);
    if (reviewState.priority) list = list.filter(i => i.priority === reviewState.priority);
    list = list.slice().sort(reviewRank);
    if (reviewState.sessionStarted) {
      const byId = Object.fromEntries(list.map(it => [it.id, it]));
      reviewState.list = reviewState.sessionQueue.map(id => byId[id]).filter(Boolean);
    } else {
      reviewState.list = list;
    }
    if (reviewState.idx >= reviewState.list.length) reviewState.idx = 0;
    return reviewState.list;
  }
  function startReviewSession(limit) {
    reviewState.sessionLimit = limit;
    reviewState.sessionStarted = true;
    reviewState.sessionDone = false;
    reviewState.flipped = false;
    reviewState.idx = 0;
    reviewState.ratings = { know: 0, almost: 0, forgot: 0 };
    reviewState.repeatCounts = {};
    let base = unlockedItems(ITEMS);
    if (reviewState.module !== "all") base = base.filter(i => i.module === reviewState.module);
    if (reviewState.priority) base = base.filter(i => i.priority === reviewState.priority);
    base = base.slice().sort(reviewRank);
    if (!limit) {
      const now = Date.now();
      base = base.filter(it => {
        const due = reviewDueTime(it);
        return !due || due <= now;
      });
    }
    const count = limit ? Math.min(limit, base.length) : base.length;
    reviewState.sessionQueue = base.slice(0, count).map(it => it.id);
    buildReviewList();
  }
  function reviewSessionControlsHtml() {
    const due = dueReviewItems().length;
    const buttons = [
      [5, "5 cards"],
      [10, "10 cards"],
      [0, "All due"],
    ].map(([limit, label]) => `<button class="chip ${reviewState.sessionLimit === limit ? "is-on" : ""}" onclick="ZS.setReviewSessionLimit(${limit})">${label}</button>`).join("");
    return `<div class="reviewsession">
      <div><strong>Flashcard session</strong><span>${due} cards due; Forgotten cards repeat before the session closes.</span></div>
      <div class="reviewsession__actions">${buttons}<button class="chip chip--dark" onclick="ZS.startReviewSession()">Start session</button></div>
    </div>`;
  }
  function renderReview(modArg) {
    if (modArg && MOD_BY_ID[modArg]) reviewState.module = modArg;
    buildReviewList();
    const modChips = ['<button class="chip ' + (reviewState.module === "all" ? "is-on" : "") + '" onclick="ZS.setReviewMod(\'all\')">All</button>']
      .concat(MODULES.map(m => `<button class="chip ${reviewState.module === m.id ? "is-on" : ""}" onclick="ZS.setReviewMod('${m.id}')">${m.icon} ${escapeHtml(m.title)}</button>`)).join("");
    const priChips = [0, 1, 2, 3].map(p => `<button class="chip ${reviewState.priority === p ? "is-on" : ""}" onclick="ZS.setReviewPri(${p})">${p ? "P" + p : "Any P"}</button>`).join("");
    view.innerHTML = `
      <div class="section-head"><span class="section-head__num">04</span><span class="section-head__title">Review</span>
        <span class="section-head__sub">Simple flip cards: Russian first, then English. No typing required.</span></div>
      ${lessonLockHtml()}
      <div class="learnbar learnbar--scroll">${modChips}</div>
      <div class="learnbar learnbar--tools">${priChips}<span class="spacer"></span>
        <div class="speedctl" aria-label="Review audio speed">${reviewSpeedControlsHtml()}</div>
        <button class="chip" onclick="ZS.shuffleReview()">Shuffle</button></div>
      ${reviewSessionControlsHtml()}
      <div id="reviewslot"></div>
    `;
    if (!reviewState.sessionStarted) startReviewSession(reviewState.sessionLimit);
    renderReviewCard();
  }
  function reviewSpeedControlsHtml() {
    return [0.65, 0.85, 1, 1.15, 1.3].map(rate =>
      `<button class="chip chip--tight ${reviewState.audioRate === rate ? "is-on" : ""}" title="${rate}x readback" aria-label="review readback speed ${rate}x" onclick="ZS.setReviewRate(${rate})">${rate}x</button>`
    ).join("");
  }
  function renderReviewCard() {
    const slot = $("#reviewslot");
    const list = reviewState.list;
    if (!slot) return;
    if (!list.length) { slot.innerHTML = '<div class="reviewcard"><p>No review cards match this filter.</p></div>'; return; }
    if (reviewState.sessionDone) {
      slot.innerHTML = `<div class="reviewdone rise">
        <div class="reviewdone__mark">✓</div>
        <h3>Review session complete</h3>
        <p>Known ${reviewState.ratings.know} · Almost ${reviewState.ratings.almost} · Forgot ${reviewState.ratings.forgot}</p>
        <div class="selfrate">
          <button class="btn" onclick="ZS.startReviewSession()">Start another set</button>
          <a class="btn btn--ghost ghost-dark" href="#/quiz/roleplay">Try guided roleplay</a>
        </div>
      </div>`;
      return;
    }
    const it = list[reviewState.idx];
    const module = MOD_BY_ID[it.module] || {};
    const review = rec(it.id).review || {};
    const due = review.due_at ? new Date(review.due_at) : null;
    const dueLabel = due && due.getTime() > Date.now() ? `Next due ${due.toLocaleDateString()}` : "Due now";
    slot.innerHTML = `
      <button class="reviewcard rise ${reviewState.flipped ? "is-flipped" : ""}" onclick="ZS.flipReview()" aria-label="Flip review card">
        <div class="reviewcard__meta"><span>${module.icon || ""} ${escapeHtml(module.title || it.module)}</span><span class="pill pill--p${it.priority}">P${it.priority}</span></div>
        <div class="reviewcard__front">
          <div class="reviewcard__label">Russian</div>
          <div class="reviewcard__ru">${colorStress(it.ru)}</div>
          ${it.hint ? `<div class="reviewcard__hint">${escapeHtml(it.hint)}</div>` : ""}
        </div>
        <div class="reviewcard__back">
          <div class="reviewcard__label">English</div>
          <div class="reviewcard__en">${escapeHtml(it.en)}</div>
          ${it.note ? `<div class="reviewcard__note">${escapeHtml(it.note)}</div>` : ""}
        </div>
      </button>
      <div class="reviewmeta">
        <span>${reviewState.sessionStarted ? `Card ${reviewState.idx + 1} of ${list.length}` : `${reviewState.idx + 1} / ${list.length}`}</span>
        <span>${escapeHtml(dueLabel)}</span>
      </div>
      <div class="cardnav">
        <button class="iconbtn" onclick="ZS.prevReview()" aria-label="Previous review card">‹</button>
        <button class="iconbtn iconbtn--play" onclick="ZS.sayReview()" aria-label="Play review audio">▶</button>
        <span class="cardnav__count">${reviewState.idx + 1} / ${list.length}</span>
        <button class="btn btn--sm" onclick="ZS.flipReview()">${reviewState.flipped ? "Show Russian" : "Flip to English"}</button>
        <button class="iconbtn" onclick="ZS.nextReview()" aria-label="Next review card">›</button>
      </div>
      <div class="reviewrate" aria-label="Rate this flashcard">
        <button class="btn btn--sm" onclick="ZS.rateReviewCard('know')">Know it</button>
        <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.rateReviewCard('almost')">Almost</button>
        <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.rateReviewCard('forgot')">Forgot</button>
      </div>`;
  }

  /* ====================================================================
     QUIZ
     ==================================================================== */
  const STAGES = [
    { n: 1, key: "recognition", title: "Recognise", desc: "See Russian → choose the meaning.", instr: "What does this mean?" },
    { n: 2, key: "recall", title: "Recall", desc: "See English → choose the Russian.", instr: "Pick the Russian" },
    { n: 3, key: "conjugate", title: "Conjugate", desc: "Given a pronoun + infinitive, type the spoken form.", instr: "Type the verb form" },
    { n: 4, key: "cloze", title: "Cloze", desc: "Fill the missing Russian word in context.", instr: "Fill the blank" },
    { n: 5, key: "dictation", title: "Dictation", desc: "Hear Russian audio → type the Cyrillic phrase.", instr: "Type what you hear" },
    { n: 6, key: "stress", title: "Stress", desc: "Choose the correct stressed Cyrillic form.", instr: "Where is the stress?" },
    { n: 7, key: "pronounce", title: "Pronounce", desc: "Listen, record yourself, compare, then self-rate.", instr: "Record and compare" },
    { n: 8, key: "backtranslate", title: "Back-translate", desc: "Translate to English, then rebuild the Russian.", instr: "Translate, hide, rebuild" },
    { n: 9, key: "contrast", title: "Contrast", desc: "Choose the culturally safe phrase in context.", instr: "Choose the right phrase" },
    { n: 10, key: "produce", title: "Produce", desc: "See English → type the Russian (stress optional).", instr: "Type it in Russian" },
    { n: 11, key: "listen", title: "Listen", desc: "Hear it → choose the meaning. No text.", instr: "What did you hear?" },
    { n: 12, key: "roleplay", title: "Role-play", desc: "A table prompt → say it, then self-rate.", instr: "Say it out loud" },
  ];
  function stagePool(stageKey) {
    const n = activeLesson().lesson_number || 99;
    const items = unlockedItems(ITEMS);
    if (stageKey === "cloze") return unlockedClozeCards(CLOZE_CARDS);
    if (stageKey === "dictation") return unlockedDictationCards(DICTATION_CARDS);
    if (stageKey === "stress") return unlockedStressCards(STRESS_CARDS);
    if (stageKey === "pronounce") return unlockedPronunciationCards(PRONUNCIATION_CARDS);
    if (stageKey === "backtranslate") return unlockedBacktranslationCards(BACKTRANSLATION_CARDS);
    if (stageKey === "contrast") return unlockedContrastCards(CONTRAST_CARDS);
    if (stageKey === "conjugate") return unlockedVerbDrillCards(VERB_DRILL_CARDS);
    if (stageKey === "listen") return items.filter(i => i.lesson_number <= n && i.syllables >= 1);
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
      ["conjugate", "Verb"],
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
    const topAdaptive = adaptiveRecommendations(1)[0];
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
        <span class="section-head__sub">Graduated difficulty: recognise → recall → conjugate → stress → pronounce → contrast → produce → listen → role-play. Retrieval practice beats re-reading.</span></div>
      ${lessonLockHtml()}
      <div class="mastery rise">${masteryRings()}</div>
      ${oralAdvancementHtml(analytics(), adaptiveStats())}
      <div class="callout">Each round is 10 questions: due reviews first, fragile high-priority phrases next, new cards only after the review load is under control.</div>
      <button class="stagecard stagecard--adaptive rise" onclick="ZS.startAdaptive()">
        <div class="stagecard__n">n+1</div>
        <div class="stagecard__t">Adaptive next drill</div>
        <div class="stagecard__d">${topAdaptive ? `Start ${escapeHtml(topAdaptive.stageKey)} on ${escapeHtml(topAdaptive.item.en || topAdaptive.item.id)} · ${escapeHtml(METRICS ? METRICS.bucketLabel(topAdaptive.adaptive.bucket) : topAdaptive.adaptive.bucket)}` : "Builds after your first attempts."}</div>
        <div class="stagecard__bar"><span style="width:${topAdaptive ? Math.round(topAdaptive.adaptive.expected * 100) : 0}%"></span></div>
      </button>
      <div class="stagegrid">${cards}</div>
      ${repairQueueHtml()}`;
  }

  let quiz = null;
  let recorder = null;
  let recordStream = null;
  let recordChunks = [];
  let recordingUrl = "";
  let recordingBlob = null;
  let pronunciationSpeechEval = null;
  let typedRecorder = null;
  let typedRecordStream = null;
  let typedRecordChunks = [];
  let typedRecordingBlob = null;
  let typedRecordingUrl = "";
  let typedSpeechEval = null;
  let typedSpeechInputId = "";
  let liveRoleplay = null;
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
    recordingBlob = null;
    pronunciationSpeechEval = null;
    recordChunks = [];
  }
  function cleanupTypedRecording() {
    const activeRecorder = typedRecorder;
    typedRecorder = null;
    if (activeRecorder && activeRecorder.state !== "inactive") {
      activeRecorder.onstop = null;
      try { activeRecorder.stop(); } catch (e) {}
    }
    if (typedRecordStream) {
      typedRecordStream.getTracks().forEach(track => track.stop());
      typedRecordStream = null;
    }
    if (typedRecordingUrl) {
      URL.revokeObjectURL(typedRecordingUrl);
      typedRecordingUrl = "";
    }
    typedRecordChunks = [];
    typedRecordingBlob = null;
    typedSpeechEval = null;
    typedSpeechInputId = "";
  }
  function setTypedSpeechStatus(message) {
    const status = $("#typedSpeechStatus");
    if (status) status.textContent = message;
  }
  function typedSpeechControlsHtml(id, inputId) {
    return `<div class="speechanswer">
      <div class="speechanswer__row">
        <button id="typedSpeechRecordBtn" class="btn btn--sm btn--red" onclick="ZS.startTypedSpeech('${id}','${inputId}')">Speak answer</button>
        <button id="typedSpeechStopBtn" class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.stopTypedSpeech()" disabled>Stop</button>
        <button id="typedSpeechPlayBtn" class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.playTypedSpeech()" disabled>Play mine</button>
        <button id="typedSpeechAnalyzeBtn" class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.analyzeTypedSpeech('${id}','${inputId}')" disabled>Analyze</button>
      </div>
      <div id="typedSpeechStatus" class="speechanswer__status">Speak instead of typing; the transcript will be checked against the Russian target.</div>
      <div id="typedSpeechEvalResult"></div>
    </div>`;
  }
  function rescueButtonsHtml(id) {
    return `<div class="rescuelines" aria-label="Rescue phrases">${RESCUE_PHRASES.map((p, idx) => `
      <button class="chip" onclick="ZS.insertRescuePhrase('${id}',${idx})">
        <span class="phrase-ru">${colorStress(p.ru)}</span>
        <small>${escapeHtml(p.en)}</small>
      </button>`).join("")}</div>`;
  }
  function guidedRoleplayPanelHtml(id, scenarioId, mode) {
    const it = ITEMS.find(i => i.id === id);
    const scenario = scenarioForItem(id);
    const card = tutorCardForScenarioId(scenarioId) || tutorCardForItem(id);
    const criteria = scenario && scenario.success_criteria ? scenario.success_criteria : [];
    const phrases = card && card.required_phrases && card.required_phrases.length ? card.required_phrases : [{ ru: it.ru, en: it.en }];
    const modeChips = GUIDED_ROLEPLAY_MODES.map(([key, label]) =>
      `<button class="chip ${mode === key ? "is-on" : ""}" onclick="ZS.showGuidedRoleplay('${id}','${scenarioId || ""}','${key}')">${label}</button>`
    ).join("");
    const targetRows = phrases.map(p => `<li><span class="phrase-ru">${colorStress(p.ru)}</span><span>${escapeHtml(p.en)}</span></li>`).join("");
    const criteriaRows = criteria.length ? criteria.map(c => `<span>${escapeHtml(criterionLabel(c))}</span>`).join("") : "<span>stay in Russian</span><span>recover calmly</span>";
    const modeCopy = {
      shadow: ["Shadow", "Listen first, read the model line aloud, then mark it repeated."],
      prompted: ["Prompted", "See the English goal first; reveal the Russian only after trying it aloud."],
      supported: ["Supported", "Use rescue phrases freely. Assisted recovery counts as useful practice."],
      live: ["Live", "Start the streaming conversation when the target line feels reachable."],
    }[mode] || ["Prompted", "Try the phrase with light support."];
    const target = phrases[0] || { ru: it.ru, en: it.en };
    return `<div class="guidedplay rise">
      <div class="guidedplay__head">
        <div><strong>Guided roleplay</strong><span>${escapeHtml(modeCopy[1])}</span></div>
        <div class="guidedplay__modes">${modeChips}</div>
      </div>
      <div class="guidedplay__scenario">
        <div><span>Role</span><strong>${escapeHtml((card && card.setting) || (scenario && scenario.title) || "Family table")}</strong></div>
        <div><span>Goal</span><strong>${escapeHtml((card && card.goal) || it.en)}</strong></div>
        <div><span>Success</span><div class="guidedplay__criteria">${criteriaRows}</div></div>
      </div>
      <ul class="tutorbox__phrases">${targetRows}</ul>
      ${mode === "shadow" ? `<div class="guidedplay__practice">
        <span>Model line</span>
        <div class="guidedplay__ru">${colorStress(target.ru)}</div>
        <div class="selfrate">
          <button class="iconbtn iconbtn--play" onclick="ZS.sayItem('${it.id}')" aria-label="Play model audio">▶</button>
          <button class="btn" onclick="ZS.rateRP('${id}','criteria',true)">I repeated it</button>
        </div>
      </div>` : ""}
      ${mode === "prompted" ? `<div class="guidedplay__practice">
        <span>Try aloud first</span>
        <div class="guidedplay__en">${escapeHtml(target.en)}</div>
        <div class="selfrate">
          <button class="btn btn--ghost ghost-dark" onclick="ZS.revealRP('${id}')">Reveal model answer</button>
          <button class="btn" onclick="ZS.rateRP('${id}','criteria',false)">I could say it</button>
        </div>
      </div>` : ""}
      ${mode === "supported" ? `<div class="guidedplay__practice">
        <span>Repair lines</span>
        ${rescueButtonsHtml(id)}
        <div class="selfrate">
          <button class="btn" onclick="ZS.rateRP('${id}','criteria',true)">Recovered with support</button>
          <button class="btn btn--red" onclick="ZS.showLiveRoleplay('${id}','${scenarioId || ""}')">Start live conversation</button>
        </div>
      </div>` : ""}
      ${mode === "live" ? `<div class="guidedplay__practice">
        <span>Ready for live</span>
        <div class="guidedplay__en">Keep it short. Use a rescue line if the tutor surprises you.</div>
        <div class="selfrate"><button class="btn btn--red" onclick="ZS.showLiveRoleplay('${id}','${scenarioId || ""}')">Start live conversation</button></div>
      </div>` : ""}
      <div id="guidedRescueStatus" class="guidedplay__status"></div>
    </div>`;
  }
  function liveRoleplayPanelHtml(id, scenarioId) {
    return `<div id="liveRoleplayPanel" class="liveplay">
      <div class="liveplay__head">
        <div><strong>Live conversation</strong><span id="liveRoleplayStatus">Ready for streaming role-play.</span></div>
        <div class="liveplay__actions">
          <button id="liveRoleplayStartBtn" class="btn btn--sm btn--red" onclick="ZS.startLiveRoleplay('${id}','${scenarioId || ""}')">Start conversation</button>
          <button id="liveRoleplayMuteBtn" class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.toggleLiveRoleplayMute()" disabled>Mute</button>
          <button id="liveRoleplayEndBtn" class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.endLiveRoleplay()" disabled>Finish & get feedback</button>
          <button id="liveRoleplayDisconnectBtn" class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.disconnectLiveRoleplay()" disabled>Disconnect</button>
        </div>
      </div>
      ${rescueButtonsHtml(id)}
      <div id="liveRoleplayTranscript" class="liveplay__transcript"><p class="liveplay__empty">Conversation transcript will appear here.</p></div>
      <div id="liveRoleplayDebrief" class="liveplay__debrief"></div>
    </div>`;
  }
  function setLiveStatus(message) {
    const el = $("#liveRoleplayStatus");
    if (el) el.textContent = message;
  }
  function appendLiveTranscript(role, text, isDelta) {
    if (!text) return;
    const box = $("#liveRoleplayTranscript");
    if (!box) return;
    const empty = box.querySelector(".liveplay__empty");
    if (empty) empty.remove();
    const cls = role === "assistant" ? "assistant" : role === "system" ? "system" : "user";
    let row = isDelta ? box.querySelector(`.liveplay__row.${cls}.is-delta:last-child`) : null;
    if (!row) {
      row = document.createElement("div");
      row.className = `liveplay__row ${cls}${isDelta ? " is-delta" : ""}`;
      row.innerHTML = `<strong>${cls === "assistant" ? "Tutor" : cls === "system" ? "System" : "Joe"}</strong><span></span>`;
      box.appendChild(row);
    }
    const span = row.querySelector("span");
    span.textContent = isDelta ? span.textContent + text : text;
    if (!isDelta) row.classList.remove("is-delta");
    box.scrollTop = box.scrollHeight;
  }
  function cleanupLiveRoleplay() {
    const state = liveRoleplay;
    liveRoleplay = null;
    if (!state) return;
    try { if (state.dataChannel) state.dataChannel.close(); } catch (e) {}
    try { if (state.peer) state.peer.close(); } catch (e) {}
    if (state.stream) state.stream.getTracks().forEach(track => track.stop());
    const audio = $("#liveRoleplayAudio");
    if (audio) audio.remove();
  }
  function liveApiBase() {
    return SYNC_API || "http://127.0.0.1:8787";
  }
  function liveSetConnected(connected) {
    const start = $("#liveRoleplayStartBtn");
    const mute = $("#liveRoleplayMuteBtn");
    const end = $("#liveRoleplayEndBtn");
    const disconnect = $("#liveRoleplayDisconnectBtn");
    if (start) start.disabled = connected;
    if (mute) mute.disabled = !connected;
    if (end) end.disabled = !connected;
    if (disconnect) disconnect.disabled = !connected;
  }
  function liveSend(event) {
    if (!liveRoleplay || !liveRoleplay.dataChannel || liveRoleplay.dataChannel.readyState !== "open") return false;
    liveRoleplay.dataChannel.send(JSON.stringify(event));
    return true;
  }
  function liveRequestResponse(extra) {
    liveSend({ type: "response.create", response: Object.assign({ output_modalities: ["audio"] }, extra || {}) });
  }
  function liveHandleScore(args) {
    if (!liveRoleplay || liveRoleplay.scored) return;
    liveRoleplay.scored = true;
    const id = liveRoleplay.itemId;
    const it = ITEMS.find(i => i.id === id);
    const scenario = scenarioForItem(id);
    const criteria = scenario && scenario.success_criteria ? scenario.success_criteria : [];
    const met = (args.met || []).filter(c => criteria.includes(c));
    const missed = (args.missed || []).filter(c => criteria.includes(c) && !met.includes(c));
    const ok = criteria.length ? missed.length === 0 && met.length > 0 : !missed.length;
    const errorType = missed.length ? criterionErrorType(missed[0]) : (args.repair_focus || null);
    gradeItem(id, ok, "roleplay", ok ? null : errorType, {
        roleplay: {
          scenario_id: scenario ? scenario.id : "",
          met,
          missed,
          live_realtime: true,
          assisted_rescue: !!liveRoleplay.assisted,
          summary: args.summary || "",
          pronunciation_issues: args.pronunciation_issues || [],
          missed_phrases: args.missed_phrases || [],
        replay_prompt: args.replay_prompt || "",
      },
    });
    if (missed.length) {
      const r = rec(id);
      r.roleplay_criteria_misses = r.roleplay_criteria_misses || {};
      missed.forEach(c => { r.roleplay_criteria_misses[c] = (r.roleplay_criteria_misses[c] || 0) + 1; });
      recordRepairFocus(id, "roleplay", missed.map(c => criterionErrorType(c)));
      save();
    }
    const debrief = $("#liveRoleplayDebrief");
    if (debrief) {
      const landed = met.length ? met.map(criterionLabel).join(", ") : (ok ? "You kept the exchange moving." : "You stayed in the task.");
      const broke = missed.length ? missed.map(criterionLabel).join(", ") : "No major criteria missed.";
      const pronunciation = (args.pronunciation_issues || []).join(", ") || "Keep stress clear and vowels relaxed.";
      const repair = (args.missed_phrases || [args.replay_prompt || "Повтори́те, пожа́луйста."]).filter(Boolean)[0];
      debrief.innerHTML = `<div class="feedback ${ok ? "good" : "close"} rise roledebrief">
        <div class="roledebrief__title">${ok ? "Live role-play passed" : "Live role-play repair"}</div>
        <div class="roledebrief__grid">
          <div><strong>What landed</strong><span>${escapeHtml(landed)}</span></div>
          <div><strong>What broke</strong><span>${escapeHtml(broke)}</span></div>
          <div><strong>Pronunciation target</strong><span>${escapeHtml(pronunciation)}</span></div>
          <div><strong>One repair drill</strong><span>${escapeHtml(repair)}</span></div>
          <div><strong>Replay this next</strong><span>${escapeHtml(args.replay_prompt || "Run the same scene once more with one rescue line ready.")}</span></div>
        </div>
        <div class="selfrate">
          <button class="btn btn--sm" onclick="ZS.showGuidedRoleplay('${id}','${scenario ? scenario.id : ""}','prompted')">Replay easier</button>
          <button class="btn btn--sm btn--red" onclick="ZS.showLiveRoleplay('${id}','${scenario ? scenario.id : ""}')">Replay live</button>
        </div>
      </div>`;
    }
    quiz.answered = true;
    if (ok) quiz.correct++;
    setLiveStatus(ok ? "Debrief complete. Role-play passed." : "Debrief complete. Repair scheduled.");
  }
  function liveHandleEvent(event) {
    if (!event || !event.type) return;
    const type = event.type;
    if (type === "error") {
      setLiveStatus(event.error && event.error.message ? event.error.message : "Realtime error.");
      return;
    }
    if (type.includes("input_audio_transcription") && type.endsWith(".delta")) appendLiveTranscript("user", event.delta || "", true);
    if (type.includes("input_audio_transcription") && (type.endsWith(".completed") || type.endsWith(".done"))) appendLiveTranscript("user", event.transcript || event.text || "", false);
    if ((type.includes("audio_transcript") || type.includes("output_text")) && type.endsWith(".delta")) appendLiveTranscript("assistant", event.delta || "", true);
    if ((type.includes("audio_transcript") || type.includes("output_text")) && (type.endsWith(".done") || type.endsWith(".completed"))) appendLiveTranscript("assistant", event.transcript || event.text || "", false);
    if (type === "response.function_call_arguments.delta") {
      liveRoleplay.functionArgs = (liveRoleplay.functionArgs || "") + (event.delta || "");
    }
    if (type === "response.function_call_arguments.done") {
      try { liveHandleScore(JSON.parse(event.arguments || liveRoleplay.functionArgs || "{}")); } catch (e) { setLiveStatus("Could not parse role-play score."); }
    }
    if (type === "response.output_item.done" && event.item && event.item.type === "function_call" && event.item.name === "submit_roleplay_score") {
      try { liveHandleScore(JSON.parse(event.item.arguments || "{}")); } catch (e) { setLiveStatus("Could not parse role-play score."); }
    }
    if (type === "response.done") {
      if (liveRoleplay && liveRoleplay.scored) return;
      setLiveStatus(liveRoleplay && liveRoleplay.scoring ? "Waiting for score..." : "Listening.");
    }
  }
  function acceptedAnswersForTypedStage(it, stageKey) {
    if (stageKey === "cloze") return it.accepted_answers || [it.answer];
    if (stageKey === "conjugate") return it.accepted_answers || [it.answer || it.ru_plain];
    return it.accepted_answers || [it.ru_plain || stripStress(it.ru || "")];
  }
  function typedSpeechTarget(it, stageKey) {
    const accepted = acceptedAnswersForTypedStage(it, stageKey).filter(Boolean);
    return accepted[0] || it.ru_plain || stripStress(it.ru || "");
  }
  function typedSpeechErrorType(it, value, stageKey) {
    if (stageKey === "dictation") return "listening_misparse";
    if (stageKey === "conjugate") return "case_or_inflection";
    if (stageKey === "cloze" || stageKey === "backtranslate") return inferBacktranslateErrorType(it, value, stageKey);
    return inferredErrorType(it, stageKey);
  }
  function closeGuessErrorType(it, stageKey, fallback) {
    const allowed = new Set((it && (it.allowed_error_types || it.error_types || [])) || []);
    const preferred = {
      cloze: ["case_or_inflection", "word_order", "register", "forgot_phrase"],
      backtranslate: ["case_or_inflection", "word_order", "register", "forgot_phrase"],
      conjugate: ["case_or_inflection", "stress", "forgot_phrase"],
      dictation: ["listening_misparse", "stress", "vowel_reduction", "forgot_phrase"],
      produce: ["case_or_inflection", "word_order", "gendered_form", "stress", "forgot_phrase"],
    }[stageKey] || ["case_or_inflection", "forgot_phrase"];
    for (const id of preferred) {
      if (id === "forgot_phrase" || id === "case_or_inflection" || allowed.has(id)) return id;
    }
    return fallback || inferredErrorType(it, stageKey);
  }
  function closeGuessHint(value, target, prefix) {
    return `<div class="card__hint"><strong>Close guess:</strong> ${escapeHtml(prefix || "You wrote")}: <em>${escapeHtml(value || "—")}</em>; target: <strong>${escapeHtml(target || "—")}</strong></div>`;
  }
  function gradeTypedSpeech(id, inputId, result) {
    if (quiz.answered) return;
    const it = practiceItem(id);
    const transcript = result.transcript || "";
    const input = $("#" + inputId);
    if (input) input.value = transcript;
    const accepted = acceptedAnswersForTypedStage(it, quiz.stageKey);
    const assessment = typedAnswerAssessment(transcript, accepted);
    const ok = assessment.ok || result.verdict === "correct";
    const close = !ok && (assessment.close || result.verdict === "close");
    const errorType = ok ? null : close ? closeGuessErrorType(it, quiz.stageKey, result.suggested_error_type) : typedSpeechErrorType(it, transcript, quiz.stageKey);
    gradeItem(id, ok, quiz.stageKey, errorType, { speech_eval: result, close_guess: close, answer_similarity: assessment.similarity || result.text_similarity || 0 });
    const target = typedSpeechTarget(it, quiz.stageKey);
    const hint = ok
      ? speechEvalHtml(result, "")
      : speechEvalHtml(result, "") + (close
        ? closeGuessHint(transcript, assessment.bestAnswer || target, "Heard")
        : `<div class="card__hint">Heard: <em>${escapeHtml(transcript || "—")}</em>; target: <strong>${escapeHtml(target)}</strong></div>`);
    showFeedback(ok, it, hint, errorType, close ? { close: true, label: "≈ Close guess" } : null);
  }
  function renderQuizRun(stageKey) {
    if (stageKey === "adaptive") {
      const rec = adaptiveRecommendations(1)[0];
      location.hash = rec ? `#/quiz/${rec.stageKey}` : "#/quiz/recognition";
      return;
    }
    const stage = STAGES.find(s => s.key === stageKey);
    if (!stage) { location.hash = "#/quiz"; return; }
    if (!quiz || quiz.stageKey !== stageKey) {
      const pool = stagePool(stageKey);
      // Due reviews first, then fragile high-priority items, then new/unmastered.
      const ranked = pool.slice().sort((a, b) => {
        const as = stageScore(a, stageKey);
        const bs = stageScore(b, stageKey);
        const aa = METRICS ? adaptiveItemState(a.id, stageKey) : null;
        const ba = METRICS ? adaptiveItemState(b.id, stageKey) : null;
        const ar = aa ? ({ rescue: 0, "n+1": 1, consolidate: 2, too_easy: 3 }[aa.bucket] || 4) : 0;
        const br = ba ? ({ rescue: 0, "n+1": 1, consolidate: 2, too_easy: 3 }[ba.bucket] || 4) : 0;
        for (let i = 0; i < as.length; i++) if (as[i] !== bs[i]) return as[i] - bs[i];
        if (ar !== br) return ar - br;
        if (aa && ba && Math.abs(aa.expected - 0.68) !== Math.abs(ba.expected - 0.68)) {
          return Math.abs(aa.expected - 0.68) - Math.abs(ba.expected - 0.68);
        }
        return a.id.localeCompare(b.id);
      });
      const head = ranked.slice(0, 16);
      quiz = { stageKey, stage, q: shuffle(head).slice(0, Math.min(10, head.length)), i: 0, correct: 0, answered: false, listenHintLevel: 0, listenStep: "no_text", listenAssistance: 0 };
    }
    drawQuestion();
  }
  function drawQuestion() {
    cleanupRecording();
    cleanupTypedRecording();
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

  let scenario = null;

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
        ${typedSpeechControlsHtml(it.id, "clozeIn")}
        <div style="margin-top:8px"><button class="btn btn--sm btn--ghost" style="color:var(--ink);border-color:var(--ink)" onclick="ZS.giveUp('${it.id}')">Show answer</button></div>`;
    } else if (stage.key === "conjugate") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-en">${escapeHtml(it.prompt)}</div><div class="card__hint">${escapeHtml(it.en)}</div>`;
      body = `<div class="answerbox"><input id="conjIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Verb form…" />
        <button class="btn btn--red" onclick="ZS.checkConjugate('${it.id}')">Check</button></div>
        ${typedSpeechControlsHtml(it.id, "conjIn")}
        <div style="margin-top:8px"><button class="btn btn--sm btn--ghost" style="color:var(--ink);border-color:var(--ink)" onclick="ZS.giveUp('${it.id}')">Show answer</button></div>`;
    } else if (stage.key === "dictation") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-ru" style="font-size:2.6rem">🔊</div><div class="q-en">${escapeHtml(it.en)}</div>`;
      body = `<div style="text-align:center;margin-bottom:14px"><button class="iconbtn iconbtn--play" onclick="ZS.sayItem('${it.id}')">▶</button></div>
        <div class="answerbox"><input id="dictIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Печатайте по-русски…" />
        <button class="btn btn--red" onclick="ZS.checkDictation('${it.id}')">Check</button></div>
        ${typedSpeechControlsHtml(it.id, "dictIn")}
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
          <button id="analyzeSpeechBtn" class="btn btn--ghost ghost-dark" onclick="ZS.analyzePronunciation('${it.id}')" disabled>Analyze</button>
        </div>
        <div id="pronStatus" class="pronbox__status">Play the native audio, record yourself, then compare stress and vowel reduction.</div>
        <div id="speechEvalResult"></div>
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
        ${typedSpeechControlsHtml(it.id, "btRu")}
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
        ${typedSpeechControlsHtml(it.id, "prodIn")}
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
      scenario = scenarioForItem(it.id);
      promptHtml = `<div class="q-instr">${stage.instr}</div>${scenarioCard(it)}<div class="q-en">${escapeHtml(it.en)}</div>`;
      const tutor = tutorCardForItem(it.id);
      body = `<div style="text-align:center;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn--red" onclick="ZS.showGuidedRoleplay('${it.id}','${scenario ? scenario.id : ""}','prompted')">Guided roleplay</button>
        <button class="btn btn--ghost ghost-dark" onclick="ZS.showLiveRoleplay('${it.id}','${scenario ? scenario.id : ""}')">Live conversation</button>
        ${tutor ? `<button class="btn btn--red" onclick="ZS.openTutor('${it.id}','${scenario ? scenario.id : ""}')">Tutor setup</button>` : ""}
        <button class="btn" onclick="ZS.revealRP('${it.id}')">Reveal model answer</button>
      </div><div id="guidedRoleplayMount"></div><div id="tutorPanel"></div><div id="liveRoleplayMount"></div><div id="rpReveal"></div>`;
    }

    $("#view").innerHTML = `
      <div class="section-head"><span class="section-head__num">${String(stage.n).padStart(2, "0")}</span><span class="section-head__title">${stage.title}</span>
        <span class="section-head__sub"><a href="#/quiz" style="color:var(--red)">← all drills</a></span></div>
      <div class="quiz" data-stage="${escapeHtml(stage.key)}" data-item-id="${escapeHtml(it.id)}" data-scenario-id="${scenario ? escapeHtml(scenario.id) : ""}" data-lesson-number="${escapeHtml(String(it.lesson_number || ""))}">
        <div class="quiz__progress">${dots}</div>
        <div class="quiz__prompt">${promptHtml}</div>
        <div id="qbody">${body}</div>
        <div id="qfeedback"></div>
      </div>`;
    if (stage.key === "listen") setTimeout(() => speak(it), 250);
    if (stage.key === "dictation" || stage.key === "pronounce") setTimeout(() => speak(ITEMS.find(i => i.id === it.item_id) || it, { quiet: true }), 250);
    if (stage.key === "produce") setTimeout(() => { const el = $("#prodIn"); if (el) { el.focus(); el.addEventListener("keydown", e => { if (e.key === "Enter") ZS.checkProd(it.id); }); } }, 50);
    if (stage.key === "conjugate") setTimeout(() => { const el = $("#conjIn"); if (el) { el.focus(); el.addEventListener("keydown", e => { if (e.key === "Enter") ZS.checkConjugate(it.id); }); } }, 50);
    if (stage.key === "cloze") setTimeout(() => { const el = $("#clozeIn"); if (el) { el.focus(); el.addEventListener("keydown", e => { if (e.key === "Enter") ZS.checkCloze(it.id); }); } }, 50);
    if (stage.key === "dictation") setTimeout(() => { const el = $("#dictIn"); if (el) { el.focus(); el.addEventListener("keydown", e => { if (e.key === "Enter") ZS.checkDictation(it.id); }); } }, 50);
    if (stage.key === "backtranslate") setTimeout(() => { const el = $("#btEn"); if (el) { el.focus(); el.addEventListener("keydown", e => { if (e.key === "Enter") ZS.startBack(it.id); }); } }, 50);
    if (stage.key === "roleplay" && sessionStorage.getItem(KEY + ".open_guided_roleplay") === "1") {
      sessionStorage.removeItem(KEY + ".open_guided_roleplay");
      setTimeout(() => ZS.showGuidedRoleplay(it.id, scenario ? scenario.id : "", "prompted"), 0);
    }
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
    const adaptive = applyAdaptiveAttempt(id, stageKey, ok, opts, latencyMs);
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
    } else if (opts.close_guess) {
      st.lapses = (st.lapses || 0) + 1;
      st.close_guesses = (st.close_guesses || 0) + 1;
      r.close_guesses = (r.close_guesses || 0) + 1;
      st.success_sessions = 0;
      st.stability = Math.max(0.5, (st.stability || 1) * 0.8);
      st.difficulty = Math.min(10, (st.difficulty || 5) + 0.3);
      st.retrievability = 0.45;
      st.last_grade = "close";
      st.mastered = false;
      st.last_answer_similarity = opts.answer_similarity || 0;
      st.last_error_type = errorType || st.last_error_type || "case_or_inflection";
      r.errors[st.last_error_type] = (r.errors[st.last_error_type] || 0) + 1;
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
    if (opts.speech_eval) {
      st.last_speech_transcript = opts.speech_eval.transcript || "";
      st.last_speech_score = opts.speech_eval.text_similarity || 0;
      st.last_speech_verdict = opts.speech_eval.verdict || "";
      st.speech_eval_count = (st.speech_eval_count || 0) + 1;
      if (opts.speech_eval.verdict === "correct") st.speech_eval_success = (st.speech_eval_success || 0) + 1;
    }
    if (!opts.assisted) st.due_at = nextDue(st, ok);
    save();
    runAnalysisCycle("attempt");
    const meta = adaptive ? adaptive.meta : itemMeta(id, stageKey);
    queueSyncEvent({
      item_id: id,
      stage_key: stageKey,
      ok,
      assisted: !!opts.assisted,
      latency_ms: latencyMs || 0,
      error_type: errorType || "",
      lesson_id: meta.lesson_id || "",
      scenario_id: opts.roleplay ? opts.roleplay.scenario_id || "" : "",
      due_at: st.due_at || "",
      payload: {
        adaptive: adaptive ? {
          expected_success: adaptive.expected,
          outcome: adaptive.outcome,
          bucket: adaptive.bucket,
          skill_keys: adaptive.skill_keys,
          item_difficulty: adaptive.item.difficulty,
        } : null,
        item_meta: meta,
        assistance_level: opts.listen_ladder ? opts.listen_ladder.assistance : (opts.assisted ? 1 : 0),
        listen_ladder: opts.listen_ladder || null,
        roleplay: opts.roleplay || null,
        close_guess: !!opts.close_guess,
        answer_similarity: opts.answer_similarity || 0,
        speech_eval: opts.speech_eval ? {
          transcript: opts.speech_eval.transcript || "",
          normalized_transcript: opts.speech_eval.normalized_transcript || "",
          target_normalized: opts.speech_eval.target_normalized || "",
          text_similarity: opts.speech_eval.text_similarity || 0,
          sample_match_score: opts.speech_eval.sample_match_score || 0,
          verdict: opts.speech_eval.verdict || "",
          provider: opts.speech_eval.provider || "",
          confidence: opts.speech_eval.confidence || 0,
          suggested_error_type: opts.speech_eval.suggested_error_type || "",
        } : null,
        repair_focus: st.last_repair_focus || "",
        last_grade: st.last_grade || "",
      },
    });
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
      conjugate: ["case_or_inflection", "forgot_phrase", "stress"],
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
    if (stageKey === "conjugate") return "case_or_inflection";
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
  function showFeedback(ok, it, extra, errorType, opts) {
    opts = opts || {};
    quiz.answered = true;
    if (ok) quiz.correct++;
    const repair = ok ? "" : repairFocusHtml(errorType || inferredErrorType(it, quiz.stageKey));
    const tone = ok ? "good" : opts.close ? "close" : "bad";
    const label = opts.label || (ok ? "✓ Correct" : "✗ Not quite");
    $("#qfeedback").innerHTML = `<div class="feedback ${tone} rise">
        <div style="font-family:var(--font-display);text-transform:uppercase;letter-spacing:.08em;font-size:.8rem">${escapeHtml(label)}</div>
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
    return ["./", "./index.html", "./styles.css", "./app.js", "./learning_metrics.js", "./content.js", "./audio.js", "./manifest.webmanifest", "./assets/icon.svg"];
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
    setMod(m) { cleanupLearnRecording(); learnState.module = m; learnState.idx = 0; renderLearn(); },
    setPri(p) { cleanupLearnRecording(); learnState.priority = p; learnState.idx = 0; renderLearn(); },
    setLesson(id) {
      if (!LESSON_BY_ID[id]) return;
      cleanupLearnRecording();
      activeLessonId = id;
      learnState.idx = 0;
      quiz = null;
      saveLessonBoundary();
      queueSyncEvent({
        item_id: "__lesson_boundary__",
        stage_key: "lesson_boundary",
        ok: true,
        lesson_id: id,
        payload: { active_lesson_id: id },
      });
      router();
    },
    startAdaptive() {
      const rec = adaptiveRecommendations(1)[0];
      location.hash = rec ? `#/quiz/${rec.stageKey}` : "#/quiz/recognition";
    },
    startTodaySpeak() {
      location.hash = "#/quiz/pronounce";
    },
    startGuidedRoleplay() {
      sessionStorage.setItem(KEY + ".open_guided_roleplay", "1");
      location.hash = "#/quiz/roleplay";
    },
    toggleEn() { learnState.hideEn = !learnState.hideEn; renderLearn(); },
    setLearnRate(rate) {
      if (![0.65, 0.85, 1, 1.15, 1.3].includes(rate)) return;
      learnState.audioRate = rate;
      saveLearnRate(rate);
      renderLearn();
    },
    toggleVoiceLab() {
      learnState.showVoiceLab = !learnState.showVoiceLab;
      renderCard();
    },
    toggleConjugation() {
      learnState.showConjugation = !learnState.showConjugation;
      renderCard();
    },
    next() { cleanupLearnRecording(); learnState.idx = (learnState.idx + 1) % learnState.list.length; renderCard(); },
    prev() { cleanupLearnRecording(); learnState.idx = (learnState.idx - 1 + learnState.list.length) % learnState.list.length; renderCard(); },
    say() { speak(learnState.list[learnState.idx], { rate: learnState.audioRate }); },
    setReviewMod(m) { reviewState.module = m; reviewState.idx = 0; reviewState.flipped = false; reviewState.sessionStarted = false; renderReview(); },
    setReviewPri(p) { reviewState.priority = p; reviewState.idx = 0; reviewState.flipped = false; reviewState.sessionStarted = false; renderReview(); },
    setReviewSessionLimit(limit) {
      reviewState.sessionLimit = limit;
      startReviewSession(limit);
      renderReview();
    },
    startReviewSession() {
      startReviewSession(reviewState.sessionLimit);
      renderReviewCard();
    },
    setReviewRate(rate) {
      if (![0.65, 0.85, 1, 1.15, 1.3].includes(rate)) return;
      reviewState.audioRate = rate;
      renderReview();
    },
    flipReview() { reviewState.flipped = !reviewState.flipped; renderReviewCard(); },
    nextReview() {
      if (!reviewState.list.length) return;
      reviewState.idx = (reviewState.idx + 1) % reviewState.list.length;
      reviewState.flipped = false;
      renderReviewCard();
    },
    prevReview() {
      if (!reviewState.list.length) return;
      reviewState.idx = (reviewState.idx - 1 + reviewState.list.length) % reviewState.list.length;
      reviewState.flipped = false;
      renderReviewCard();
    },
    sayReview() { speak(reviewState.list[reviewState.idx], { rate: reviewState.audioRate }); },
    shuffleReview() {
      reviewState.list = shuffle(reviewState.list.slice());
      reviewState.sessionQueue = reviewState.list.map(it => it.id);
      reviewState.idx = 0;
      reviewState.flipped = false;
      renderReviewCard();
    },
    rateReviewCard(grade) {
      if (!reviewState.list.length || reviewState.sessionDone) return;
      const it = reviewState.list[reviewState.idx];
      const r = rec(it.id);
      const now = new Date().toISOString();
      const dueMs = grade === "know" ? 3 * 86400000 : grade === "almost" ? 86400000 : 10 * 60000;
      r.review = Object.assign({}, r.review || {}, {
        last_grade: grade,
        last_seen_at: now,
        due_at: new Date(Date.now() + dueMs).toISOString(),
        confidence: grade === "know" ? 1 : grade === "almost" ? 0.55 : 0.15,
        review_count: ((r.review && r.review.review_count) || 0) + 1,
      });
      reviewState.ratings[grade] = (reviewState.ratings[grade] || 0) + 1;
      if (grade === "forgot") {
        reviewState.repeatCounts[it.id] = (reviewState.repeatCounts[it.id] || 0) + 1;
        if (reviewState.repeatCounts[it.id] <= 1) reviewState.sessionQueue.push(it.id);
      }
      reviewState.sessionQueue.splice(reviewState.idx, 1);
      save();
      queueSyncEvent({
        item_id: it.id,
        stage_key: "flashcard_review",
        ok: grade === "know",
        lesson_id: it.lesson_id || "",
        payload: { review_grade: grade, due_at: r.review.due_at, confidence: r.review.confidence },
      });
      buildReviewList();
      if (!reviewState.list.length) {
        reviewState.sessionDone = true;
        reviewSessionStore = Object.assign({}, reviewSessionStore, {
          daily_completed_at: now,
          last_session_at: now,
        });
        saveReviewSessionState(reviewSessionStore);
      }
      reviewState.flipped = false;
      renderReviewCard();
    },
    sayItem(id) {
      const it = practiceItem(id);
      speak(it && it.item_id ? ITEMS.find(i => i.id === it.item_id) : it);
    },
    async startLearnRecording() {
      const it = activeLearnItem();
      if (!it) return;
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        setLearnStatus("Recording is not available in this browser.");
        return;
      }
      cleanupLearnRecording();
      try {
        learnRecordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const activeRecorder = new MediaRecorder(learnRecordStream);
        learnRecorder = activeRecorder;
        learnRecordChunks = [];
        learnRecordingItemId = it.id;
        activeRecorder.ondataavailable = event => {
          if (event.data && event.data.size) learnRecordChunks.push(event.data);
        };
        activeRecorder.onstop = () => {
          if (learnRecordingUrl) URL.revokeObjectURL(learnRecordingUrl);
          const blob = new Blob(learnRecordChunks, { type: activeRecorder.mimeType || "audio/webm" });
          learnRecordingBlob = blob;
          learnSpeechEval = null;
          learnRecordingUrl = URL.createObjectURL(blob);
          learnRecorder = null;
          if (learnRecordStream) {
            learnRecordStream.getTracks().forEach(track => track.stop());
            learnRecordStream = null;
          }
          const playBtn = $("#learnPlayRecordBtn");
          if (playBtn) playBtn.removeAttribute("disabled");
          const analyzeBtn = $("#learnAnalyzeBtn");
          if (analyzeBtn) analyzeBtn.removeAttribute("disabled");
          const recordBtn = $("#learnRecordBtn");
          const stopBtn = $("#learnStopRecordBtn");
          if (recordBtn) recordBtn.removeAttribute("disabled");
          if (stopBtn) stopBtn.setAttribute("disabled", "");
          setLearnStatus("Recording ready. Play yours or open the sonograph comparison.");
          if (learnState.showVoiceLab) renderLearnSpectrograms();
        };
        activeRecorder.start();
        const recordBtn = $("#learnRecordBtn");
        const stopBtn = $("#learnStopRecordBtn");
        const playBtn = $("#learnPlayRecordBtn");
        const analyzeBtn = $("#learnAnalyzeBtn");
        if (recordBtn) recordBtn.setAttribute("disabled", "");
        if (stopBtn) stopBtn.removeAttribute("disabled");
        if (playBtn) playBtn.setAttribute("disabled", "");
        if (analyzeBtn) analyzeBtn.setAttribute("disabled", "");
        setLearnStatus("Recording... keep it short and natural.");
      } catch (e) {
        setLearnStatus("Microphone permission was not available.");
      }
    },
    stopLearnRecording() {
      if (!learnRecorder || learnRecorder.state === "inactive") return;
      const activeRecorder = learnRecorder;
      activeRecorder.stop();
    },
    playLearnRecording() {
      if (!learnRecordingUrl || learnRecordingItemId !== (activeLearnItem() || {}).id) {
        setLearnStatus("Record yourself first.");
        return;
      }
      const audio = new Audio(learnRecordingUrl);
      audio.play().catch(() => setLearnStatus("Playback was blocked. Tap Play mine again."));
    },
    async analyzeLearnSpeech() {
      const it = activeLearnItem();
      if (!it || !learnRecordingBlob || learnRecordingItemId !== it.id) {
        setLearnStatus("Record yourself first.");
        return;
      }
      const btn = $("#learnAnalyzeBtn");
      if (btn) btn.setAttribute("disabled", "");
      try {
        learnSpeechEval = await evaluateSpeech({
          blob: learnRecordingBlob,
          item: it,
          stageKey: "pronounce",
          statusFn: setLearnStatus,
        });
        if (!learnState.showVoiceLab) learnState.showVoiceLab = true;
        renderCard();
        setLearnStatus(learnSpeechEval.verdict === "correct" ? "Speech check: correct." : learnSpeechEval.verdict === "close" ? "Speech check: close." : "Speech check: needs repair.");
      } catch (e) {
        setLearnStatus(e.message || "Speech analysis failed.");
      } finally {
        const nextBtn = $("#learnAnalyzeBtn");
        if (nextBtn) nextBtn.removeAttribute("disabled");
      }
    },
    renderLearnSpectrograms,
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
      queueSyncEvent({
        item_id: it.id,
        stage_key: "learn_known",
        ok: true,
        lesson_id: it.lesson_id || "",
        payload: { known: true },
      });
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
      const accepted = acceptedAnswersForTypedStage(it, quiz.stageKey);
      const assessment = typedAnswerAssessment(val, accepted);
      const ok = assessment.ok;
      const errorType = ok ? null : assessment.close ? closeGuessErrorType(it, quiz.stageKey) : inferredErrorType(it, quiz.stageKey);
      gradeItem(id, ok, quiz.stageKey, errorType, { close_guess: assessment.close, answer_similarity: assessment.similarity });
      showFeedback(ok, it, ok ? "" : assessment.close ? closeGuessHint(val, assessment.bestAnswer || typedSpeechTarget(it, quiz.stageKey)) : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em></div>`, errorType, assessment.close ? { close: true, label: "≈ Close guess" } : null);
    },
    checkCloze(id) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const val = $("#clozeIn") ? $("#clozeIn").value : "";
      const accepted = it.accepted_answers || [it.answer];
      const assessment = typedAnswerAssessment(val, accepted);
      const ok = assessment.ok;
      const errorType = ok ? null : assessment.close ? closeGuessErrorType(it, quiz.stageKey) : inferBacktranslateErrorType(it, val, quiz.stageKey);
      gradeItem(id, ok, quiz.stageKey, errorType, { close_guess: assessment.close, answer_similarity: assessment.similarity });
      showFeedback(ok, it, ok ? "" : assessment.close ? closeGuessHint(val, assessment.bestAnswer || it.answer) : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em>; answer: <strong>${escapeHtml(it.answer)}</strong></div>`, errorType, assessment.close ? { close: true, label: "≈ Close guess" } : null);
    },
    checkConjugate(id) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const val = $("#conjIn") ? $("#conjIn").value : "";
      const accepted = it.accepted_answers || [it.answer || it.ru_plain];
      const assessment = typedAnswerAssessment(val, accepted);
      const ok = assessment.ok;
      const errorType = ok ? null : "case_or_inflection";
      gradeItem(id, ok, quiz.stageKey, errorType, { close_guess: assessment.close, answer_similarity: assessment.similarity });
      showFeedback(ok, it, ok ? "" : assessment.close ? closeGuessHint(val, assessment.bestAnswer || typedSpeechTarget(it, quiz.stageKey)) : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em>; answer: <strong>${colorStress(it.ru)}</strong></div>`, errorType, assessment.close ? { close: true, label: "≈ Close guess" } : null);
    },
    checkDictation(id) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const val = $("#dictIn") ? $("#dictIn").value : "";
      const accepted = it.accepted_answers || [it.ru_plain];
      const assessment = typedAnswerAssessment(val, accepted);
      const ok = assessment.ok;
      const errorType = ok ? null : "listening_misparse";
      gradeItem(id, ok, quiz.stageKey, errorType, { close_guess: assessment.close, answer_similarity: assessment.similarity });
      showFeedback(ok, it, ok ? "" : assessment.close ? closeGuessHint(val, assessment.bestAnswer || typedSpeechTarget(it, quiz.stageKey)) : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em>; target: <strong>${colorStress(it.ru)}</strong></div>`, errorType, assessment.close ? { close: true, label: "≈ Close guess" } : null);
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
          recordingBlob = blob;
          pronunciationSpeechEval = null;
          recordingUrl = URL.createObjectURL(blob);
          const playBtn = $("#playRecordBtn");
          if (playBtn) playBtn.removeAttribute("disabled");
          const analyzeBtn = $("#analyzeSpeechBtn");
          if (analyzeBtn) analyzeBtn.removeAttribute("disabled");
          setPronunciationStatus("Recording ready. Play yours, analyze it, then accept or self-rate.");
          if (recordStream) {
            recordStream.getTracks().forEach(track => track.stop());
            recordStream = null;
          }
        };
        activeRecorder.start();
        const startBtn = $("#recordBtn");
        const stopBtn = $("#stopRecordBtn");
        const playBtn = $("#playRecordBtn");
        const analyzeBtn = $("#analyzeSpeechBtn");
        if (startBtn) startBtn.setAttribute("disabled", "");
        if (stopBtn) stopBtn.removeAttribute("disabled");
        if (playBtn) playBtn.setAttribute("disabled", "");
        if (analyzeBtn) analyzeBtn.setAttribute("disabled", "");
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
    async startTypedSpeech(id, inputId) {
      if (quiz.answered) return;
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        setTypedSpeechStatus("Recording is not available in this browser. Type the answer instead.");
        return;
      }
      cleanupTypedRecording();
      typedSpeechInputId = inputId;
      try {
        typedRecordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const activeRecorder = new MediaRecorder(typedRecordStream);
        typedRecorder = activeRecorder;
        typedRecordChunks = [];
        activeRecorder.ondataavailable = event => {
          if (event.data && event.data.size) typedRecordChunks.push(event.data);
        };
        activeRecorder.onstop = () => {
          if (typedRecordingUrl) URL.revokeObjectURL(typedRecordingUrl);
          typedRecordingBlob = new Blob(typedRecordChunks, { type: activeRecorder.mimeType || "audio/webm" });
          typedRecordingUrl = URL.createObjectURL(typedRecordingBlob);
          typedRecorder = null;
          if (typedRecordStream) {
            typedRecordStream.getTracks().forEach(track => track.stop());
            typedRecordStream = null;
          }
          const recordBtn = $("#typedSpeechRecordBtn");
          const stopBtn = $("#typedSpeechStopBtn");
          const playBtn = $("#typedSpeechPlayBtn");
          const analyzeBtn = $("#typedSpeechAnalyzeBtn");
          if (recordBtn) recordBtn.removeAttribute("disabled");
          if (stopBtn) stopBtn.setAttribute("disabled", "");
          if (playBtn) playBtn.removeAttribute("disabled");
          if (analyzeBtn) analyzeBtn.removeAttribute("disabled");
          setTypedSpeechStatus("Recording ready. Analyze it to fill and check the Russian answer.");
        };
        activeRecorder.start();
        const recordBtn = $("#typedSpeechRecordBtn");
        const stopBtn = $("#typedSpeechStopBtn");
        const playBtn = $("#typedSpeechPlayBtn");
        const analyzeBtn = $("#typedSpeechAnalyzeBtn");
        if (recordBtn) recordBtn.setAttribute("disabled", "");
        if (stopBtn) stopBtn.removeAttribute("disabled");
        if (playBtn) playBtn.setAttribute("disabled", "");
        if (analyzeBtn) analyzeBtn.setAttribute("disabled", "");
        setTypedSpeechStatus("Recording... say only the Russian answer.");
      } catch (e) {
        setTypedSpeechStatus("Microphone permission was not available. Type the answer instead.");
      }
    },
    stopTypedSpeech() {
      if (!typedRecorder || typedRecorder.state === "inactive") return;
      const activeRecorder = typedRecorder;
      typedRecorder = null;
      activeRecorder.stop();
      const recordBtn = $("#typedSpeechRecordBtn");
      const stopBtn = $("#typedSpeechStopBtn");
      if (recordBtn) recordBtn.removeAttribute("disabled");
      if (stopBtn) stopBtn.setAttribute("disabled", "");
    },
    playTypedSpeech() {
      if (!typedRecordingUrl) {
        setTypedSpeechStatus("Record yourself first.");
        return;
      }
      const audio = new Audio(typedRecordingUrl);
      audio.play().catch(() => setTypedSpeechStatus("Playback was blocked. Tap Play mine again."));
    },
    async analyzeTypedSpeech(id, inputId) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      if (!typedRecordingBlob) {
        setTypedSpeechStatus("Record yourself first.");
        return;
      }
      const btn = $("#typedSpeechAnalyzeBtn");
      if (btn) btn.setAttribute("disabled", "");
      try {
        const target = typedSpeechTarget(it, quiz.stageKey);
        typedSpeechEval = await evaluateSpeech({
          blob: typedRecordingBlob,
          item: it,
          stageKey: quiz.stageKey,
          targetOverride: target,
          targetRu: target,
          statusFn: setTypedSpeechStatus,
        });
        const input = $("#" + inputId);
        if (input) input.value = typedSpeechEval.transcript || "";
        const result = $("#typedSpeechEvalResult");
        if (result) result.innerHTML = speechEvalHtml(typedSpeechEval, "");
        setTypedSpeechStatus(typedSpeechEval.verdict === "correct" ? "Speech check: correct. Scoring this answer." : typedSpeechEval.verdict === "close" ? "Speech check: close. Scoring this as a repair." : "Speech check: needs repair.");
        gradeTypedSpeech(id, inputId, typedSpeechEval);
      } catch (e) {
        setTypedSpeechStatus(e.message || "Speech analysis failed.");
      } finally {
        const nextBtn = $("#typedSpeechAnalyzeBtn");
        if (nextBtn) nextBtn.removeAttribute("disabled");
      }
    },
    async analyzePronunciation(id) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      if (!recordingBlob) {
        setPronunciationStatus("Record yourself first.");
        return;
      }
      const btn = $("#analyzeSpeechBtn");
      if (btn) btn.setAttribute("disabled", "");
      try {
        pronunciationSpeechEval = await evaluateSpeech({
          blob: recordingBlob,
          item: it,
          stageKey: "pronounce",
          statusFn: setPronunciationStatus,
        });
        const target = $("#speechEvalResult");
        if (target) target.innerHTML = speechEvalHtml(pronunciationSpeechEval, id);
        setPronunciationStatus(pronunciationSpeechEval.verdict === "correct" ? "Speech check: correct. Accept it to score this card." : pronunciationSpeechEval.verdict === "close" ? "Speech check: close. Accept or mark repair." : "Speech check: needs repair.");
      } catch (e) {
        setPronunciationStatus(e.message || "Speech analysis failed.");
      } finally {
        const nextBtn = $("#analyzeSpeechBtn");
        if (nextBtn) nextBtn.removeAttribute("disabled");
      }
    },
    applySpeechVerdict(id, ok, errorType) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const inferred = ok ? null : (errorType || (pronunciationSpeechEval && pronunciationSpeechEval.suggested_error_type) || "forgot_phrase");
      gradeItem(id, ok, quiz.stageKey, inferred, {
        assisted: false,
        speech_eval: pronunciationSpeechEval || null,
      });
      showFeedback(ok, it, speechEvalHtml(pronunciationSpeechEval, ""), inferred);
    },
    ratePronunciation(id, ok, assisted, errorType) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const inferred = ok ? null : (errorType || "stress");
      gradeItem(id, ok, quiz.stageKey, inferred, { assisted, speech_eval: pronunciationSpeechEval || null });
      showFeedback(ok, it, assisted ? `<div class="card__hint">Used the model during comparison: scheduled as a hard pronunciation review.</div>` : `<div class="card__hint">Target: compare stress placement and unstressed vowel reduction against the native audio.</div>`, inferred);
    },
    startBack(id) {
      if (quiz.answered) return;
      const note = $("#btEn") ? $("#btEn").value.trim() : "";
      if (!note) {
        showFeedback(false, practiceItem(id), "<div class=\"card__hint\">Write an English note first, then hide the Russian.</div>", "forgot_phrase");
        return;
      }
      $("#btSource").style.display = "none";
      $("#btStep1").style.display = "none";
      $("#btStep2").style.display = "";
      $("#btNote").textContent = note;
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
      const assessment = typedAnswerAssessment(val, accepted);
      const ok = assessment.ok;
      const errorType = ok ? null : assessment.close ? closeGuessErrorType(it, quiz.stageKey) : inferBacktranslateErrorType(it, val, quiz.stageKey);
      gradeItem(id, ok, quiz.stageKey, errorType, { close_guess: assessment.close, answer_similarity: assessment.similarity });
      showFeedback(ok, it, ok ? "" : assessment.close ? closeGuessHint(val, assessment.bestAnswer || typedSpeechTarget(it, quiz.stageKey)) : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em>; target: <strong>${colorStress(it.ru)}</strong></div>`, errorType, assessment.close ? { close: true, label: "≈ Close guess" } : null);
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
    showGuidedRoleplay(id, scenarioId, mode) {
      const mount = $("#guidedRoleplayMount");
      if (!mount) return;
      if (mode === "live") {
        mount.innerHTML = guidedRoleplayPanelHtml(id, scenarioId, "live");
      } else {
        mount.innerHTML = guidedRoleplayPanelHtml(id, scenarioId, mode || "prompted");
      }
      mount.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
    insertRescuePhrase(id, index) {
      const phrase = RESCUE_PHRASES[index];
      if (!phrase) return;
      const status = $("#guidedRescueStatus");
      if (status) status.innerHTML = `<strong>Assisted rescue:</strong> <span class="phrase-ru">${colorStress(phrase.ru)}</span> · ${escapeHtml(phrase.en)}`;
      appendLiveTranscript("user", phrase.ru, false);
      if (liveRoleplay) liveRoleplay.assisted = true;
      liveSend({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: phrase.ru }],
        },
      });
      if (liveRoleplay && liveRoleplay.dataChannel && liveRoleplay.dataChannel.readyState === "open") liveRequestResponse();
      queueSyncEvent({
        item_id: id,
        stage_key: "roleplay_rescue",
        ok: true,
        lesson_id: (ITEMS_BY_ID[id] && ITEMS_BY_ID[id].lesson_id) || "",
        payload: { rescue_phrase: phrase.ru, assisted: true },
      });
      toast("Rescue line ready");
    },
    listenHint(id) {
      if (!quiz || quiz.stageKey !== "listen") return;
      const it = practiceItem(id);
  const order = LISTEN_STEPS.slice();
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
    showLiveRoleplay(id, scenarioId) {
      const mount = $("#liveRoleplayMount");
      if (!mount) return;
      mount.innerHTML = liveRoleplayPanelHtml(id, scenarioId);
      mount.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
    async startLiveRoleplay(id, scenarioId) {
      if (!window.RTCPeerConnection || !navigator.mediaDevices) {
        setLiveStatus("Live role-play needs WebRTC and microphone support.");
        return;
      }
      cleanupLiveRoleplay();
      ZS.showLiveRoleplay(id, scenarioId);
      liveSetConnected(false);
      const startBtn = $("#liveRoleplayStartBtn");
      if (startBtn) startBtn.disabled = true;
      try {
        setLiveStatus("Requesting microphone...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const peer = new RTCPeerConnection();
        const audio = document.createElement("audio");
        audio.id = "liveRoleplayAudio";
        audio.autoplay = true;
        document.body.appendChild(audio);
        peer.ontrack = event => { audio.srcObject = event.streams[0]; };
        stream.getAudioTracks().forEach(track => peer.addTrack(track, stream));
        const dataChannel = peer.createDataChannel("oai-events");
        liveRoleplay = { itemId: id, scenarioId, peer, stream, dataChannel, muted: false, scoring: false, scored: false, functionArgs: "" };
        dataChannel.addEventListener("open", () => {
          setLiveStatus("Live. Speak Russian; the tutor will answer aloud.");
          liveSetConnected(true);
          liveSend({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "Begin the role-play now. Start in character with one short Russian line." }],
            },
          });
          liveRequestResponse();
        });
        dataChannel.addEventListener("message", event => {
          try { liveHandleEvent(JSON.parse(event.data)); } catch (e) {}
        });
        dataChannel.addEventListener("close", () => setLiveStatus("Disconnected."));
        setLiveStatus("Connecting to OpenAI Realtime...");
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        const params = new URLSearchParams({ item_id: id, scenario_id: scenarioId || "", learner_id: LEARNER_ID, device_id: deviceId() });
        const response = await fetch(`${liveApiBase()}/api/realtime/call?${params.toString()}`, {
          method: "POST",
          headers: { "content-type": "application/sdp" },
          body: offer.sdp,
        });
        const sdp = await response.text();
        if (!response.ok) {
          let message = sdp;
          try {
            const payload = JSON.parse(sdp);
            message = payload.error || message;
          } catch (e) {}
          throw new Error(message || "Realtime connection failed.");
        }
        await peer.setRemoteDescription({ type: "answer", sdp });
      } catch (e) {
        cleanupLiveRoleplay();
        liveSetConnected(false);
        const btn = $("#liveRoleplayStartBtn");
        if (btn) btn.disabled = false;
        setLiveStatus(e.message || "Live role-play failed.");
      }
    },
    toggleLiveRoleplayMute() {
      if (!liveRoleplay || !liveRoleplay.stream) return;
      liveRoleplay.muted = !liveRoleplay.muted;
      liveRoleplay.stream.getAudioTracks().forEach(track => { track.enabled = !liveRoleplay.muted; });
      const btn = $("#liveRoleplayMuteBtn");
      if (btn) btn.textContent = liveRoleplay.muted ? "Unmute" : "Mute";
      setLiveStatus(liveRoleplay.muted ? "Muted." : "Live. Speak Russian; the tutor will answer aloud.");
    },
    endLiveRoleplay() {
      if (!liveRoleplay) return;
      liveRoleplay.scoring = true;
      setLiveStatus("Asking tutor for debrief and score...");
      liveSend({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "End the live role-play now. Switch to debrief mode, give brief feedback, then call submit_roleplay_score with the final criteria." }],
        },
      });
      liveRequestResponse({ tool_choice: "auto" });
    },
    disconnectLiveRoleplay() {
      cleanupLiveRoleplay();
      liveSetConnected(false);
      setLiveStatus("Disconnected.");
      const btn = $("#liveRoleplayStartBtn");
      if (btn) btn.disabled = false;
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
    openTutor(id, scenarioId) {
      const it = ITEMS.find(i => i.id === id);
      const card = tutorCardForScenarioId(scenarioId) || tutorCardForItem(id);
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
      const boxes = Array.from(document.querySelectorAll(".rpcrit"));
      const checked = new Set(Array.from(document.querySelectorAll(".rpcrit:checked")).map(el => el.value));
      const met = mode === "missed" ? [] : (boxes.length ? criteria.filter(c => checked.has(c)) : criteria.slice());
      const missed = mode === "missed" ? criteria.slice() : (boxes.length ? criteria.filter(c => !checked.has(c)) : []);
      const ok = mode !== "missed" && missed.length === 0;
      const errorType = missed.length ? criterionErrorType(missed[0]) : null;
      gradeItem(id, ok, (quiz && quiz.stageKey) || "roleplay", errorType, {
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
        const missErrorTypes = [];
        missed.forEach(c => {
          r.roleplay_criteria_misses[c] = (r.roleplay_criteria_misses[c] || 0) + 1;
          missErrorTypes.push(criterionErrorType(c));
        });
        if (missErrorTypes.length) {
          const extras = missErrorTypes.filter((_, idx) => idx > 0);
          if (extras.length) {
            recordRepairFocus(id, (quiz && quiz.stageKey) || "roleplay", extras);
          }
        }
      }
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
  startAnalysisEngine();
  router();
  updateCountdown();
  setInterval(updateCountdown, 60000);
})();
