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
  const BACKTRANSLATION_CARDS = DATA.backtranslation_cards || [];
  const MODULES = DATA.modules;
  const CURRICULUM = DATA.curriculum || {};
  const LESSONS = (CURRICULUM.lessons || []).slice().sort((a, b) => a.lesson_number - b.lesson_number);
  const MOD_BY_ID = Object.fromEntries(MODULES.map(m => [m.id, m]));
  const LESSON_BY_ID = Object.fromEntries(LESSONS.map(l => [l.lesson_id, l]));
  const TARGET = MISSION.target_date ? new Date(MISSION.target_date + "T00:00:00") : new Date(2026, 5, 15);
  const ERROR_TYPES = DATA.error_types || [];
  const ERROR_BY_ID = Object.fromEntries(ERROR_TYPES.map(e => [e.id, e]));
  const SCENARIOS = DATA.scenarios || [];
  const STAGE_KEYS = ["recognition", "recall", "produce", "listen", "roleplay"];
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
  function listeningHintHtml(it) {
    if (!quiz || quiz.stageKey !== "listen" || !(quiz.listenHintLevel || 0)) return "";
    const level = quiz.listenHintLevel || 0;
    const label = level === 1 ? "Caption hint" : "Full caption";
    const text = level === 1 ? escapeHtml(listeningCloze(it.ru)) : colorStress(it.ru);
    return `<div class="listenhint" aria-live="polite"><span>${label}</span><div>${text}</div></div>`;
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
    const required = ITEMS.filter(i => i.priority <= 2);
    const total = required.length * STAGE_KEYS.length;
    const mastered = required.reduce((n, it) => n + STAGE_KEYS.filter(k => {
      const st = stageState(it.id, k);
      return st && st.mastered;
    }).length, 0);
    return total ? Math.round(mastered / total * 100) : 0;
  }
  function scenarioForItem(id) {
    return SCENARIOS.find(s => (s.required_items || []).includes(id));
  }
  function criterionLabel(id) {
    return CRITERIA_LABELS[id] || id.replace(/_/g, " ");
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
  function unlockedClozeCards(cards) {
    const n = activeLesson().lesson_number || 99;
    return cards.filter(c => !c.lesson_number || c.lesson_number <= n);
  }
  function unlockedDictationCards(cards) {
    const n = activeLesson().lesson_number || 99;
    return cards.filter(c => !c.lesson_number || c.lesson_number <= n);
  }
  function unlockedBacktranslationCards(cards) {
    const n = activeLesson().lesson_number || 99;
    return cards.filter(c => !c.lesson_number || c.lesson_number <= n);
  }
  function practiceItem(id) {
    return ITEMS.find(i => i.id === id) || CLOZE_CARDS.find(c => c.id === id) || DICTATION_CARDS.find(c => c.id === id) || BACKTRANSLATION_CARDS.find(c => c.id === id);
  }
  function lessonLockHtml() {
    if (!LESSONS.length) return "";
    const lesson = activeLesson();
    const count = unlockedItems(ITEMS).length;
    const clozeCount = unlockedClozeCards(CLOZE_CARDS).length;
    const dictationCount = unlockedDictationCards(DICTATION_CARDS).length;
    const backCount = unlockedBacktranslationCards(BACKTRANSLATION_CARDS).length;
    const options = LESSONS.map(l => `<option value="${escapeHtml(l.lesson_id)}" ${l.lesson_id === lesson.lesson_id ? "selected" : ""}>${String(l.lesson_number).padStart(2, "0")} · ${escapeHtml(l.title)}</option>`).join("");
    return `<div class="lessonlock rise">
      <div>
        <h3>Curriculum lock</h3>
        <p>Practice is constrained to Lesson ${lesson.lesson_number}: ${escapeHtml(lesson.title)} and everything before it.</p>
      </div>
      <label><span>Unlocked through</span><select onchange="ZS.setLesson(this.value)">${options}</select></label>
      <div class="lessonlock__meta">${count}/${ITEMS.length} phrases unlocked · ${clozeCount}/${CLOZE_CARDS.length} cloze · ${dictationCount}/${DICTATION_CARDS.length} dictation · ${backCount}/${BACKTRANSLATION_CARDS.length} back-translation · ${(lesson.introduced_structures || []).length} structures in this lesson</div>
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
  function speakTTS(item) {
    if (!("speechSynthesis" in window)) { toast("No audio on this device — use Forvo"); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(item.ru_plain || item.ru);
    u.lang = "ru-RU"; u.rate = 0.85; if (RU_VOICE) u.voice = RU_VOICE;
    if (!RU_VOICE) toast("No Russian voice installed — using default");
    speechSynthesis.speak(u);
  }
  function speak(item, opts) {
    if (!item) return;
    opts = opts || {};
    if (AUDIO && AUDIO_IDS.has(item.id)) {
      try {
        if (curAudio) { curAudio.pause(); }
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        curAudio = new Audio(AUDIO.base + item.id + ".mp3");
        curAudio.play().catch(() => { if (!opts.quiet) speakTTS(item); });
        return;
      } catch (e) { /* fall through */ }
    }
    if (!opts.quiet) speakTTS(item);
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

      <div class="stats">
        <div class="stat rise"><div class="stat__num">${op.done}<small>/${op.total}</small></div><div class="stat__label">Phrases touched</div>
          <div class="progressbar"><span style="width:${op.pct}%"></span></div></div>
        <div class="stat rise"><div class="stat__num">${dueItems("recall").length}</div><div class="stat__label">Recall due now</div></div>
        <div class="stat rise"><div class="stat__num">${fragileItems().length}</div><div class="stat__label">Fragile phrases</div></div>
        <div class="stat rise"><div class="stat__num">${readiness()}<small>%</small></div><div class="stat__label">Dinner readiness</div></div>
        <div class="stat rise"><div class="stat__num">${d}</div><div class="stat__label">Days to ${escapeHtml(targetLabel())}</div></div>
      </div>

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
    { n: 5, key: "backtranslate", title: "Back-translate", desc: "Translate to English, then rebuild the Russian.", instr: "Translate, hide, rebuild" },
    { n: 6, key: "produce", title: "Produce", desc: "See English → type the Russian (stress optional).", instr: "Type it in Russian" },
    { n: 7, key: "listen", title: "Listen", desc: "Hear it → choose the meaning. No text.", instr: "What did you hear?" },
    { n: 8, key: "roleplay", title: "Role-play", desc: "A table prompt → say it, then self-rate.", instr: "Say it out loud" },
  ];
  function stagePool(stageKey) {
    const items = unlockedItems(ITEMS);
    if (stageKey === "cloze") return unlockedClozeCards(CLOZE_CARDS);
    if (stageKey === "dictation") return unlockedDictationCards(DICTATION_CARDS);
    if (stageKey === "backtranslate") return unlockedBacktranslationCards(BACKTRANSLATION_CARDS);
    if (stageKey === "listen") return items.filter(i => i.syllables >= 1);
    if (stageKey === "roleplay" && SCENARIOS.length) {
      const scenarioIds = new Set(SCENARIOS.flatMap(s => s.required_items || []));
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
      ["backtranslate", "Rebuild"],
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
        <div class="stagecard__n">0${s.n}</div>
        <div class="stagecard__t">${s.title}</div>
        <div class="stagecard__d">${escapeHtml(s.desc)}</div>
        <div class="stagecard__bar"><span style="width:${p.pct}%"></span></div>
      </button>`;
    }).join("");
    view.innerHTML = `
      <div class="section-head"><span class="section-head__num">03</span><span class="section-head__title">Drill</span>
        <span class="section-head__sub">Graduated difficulty: recognise → recall → produce → listen → role-play. Retrieval practice beats re-reading.</span></div>
      ${lessonLockHtml()}
      <div class="mastery rise">${masteryRings()}</div>
      <div class="callout">Each round is 10 questions: due reviews first, fragile high-priority phrases next, new cards only after the review load is under control.</div>
      <div class="stagegrid">${cards}</div>`;
  }

  let quiz = null;
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
      quiz = { stageKey, stage, q: shuffle(head).slice(0, Math.min(10, head.length)), i: 0, correct: 0, answered: false, listenHintLevel: 0 };
    }
    drawQuestion();
  }
  function drawQuestion() {
    const { stage } = quiz;
    if (quiz.i >= quiz.q.length) return drawSummary();
    const it = quiz.q[quiz.i];
    quiz.answered = false;
    if (stage.key === "listen") quiz.listenHintLevel = quiz.listenHintLevel || 0;
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
    } else if (stage.key === "produce") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-en">${escapeHtml(it.en)}</div>`;
      body = `<div class="answerbox"><input id="prodIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Печатайте по-русски…" />
        <button class="btn btn--red" onclick="ZS.checkProd('${it.id}')">Check</button></div>
        <div style="margin-top:8px"><button class="btn btn--sm btn--ghost" style="color:var(--ink);border-color:var(--ink)" onclick="ZS.giveUp('${it.id}')">Show answer</button></div>`;
    } else if (stage.key === "listen") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-ru" style="font-size:2.6rem">🔊</div><div id="listenHint">${listeningHintHtml(it)}</div>`;
      const opts = shuffle([it].concat(sample(optionPool, 3, it)));
      body = `<div style="text-align:center;margin-bottom:14px"><button class="iconbtn iconbtn--play" onclick="ZS.sayItem('${it.id}')">▶</button></div>
        <div class="listenactions"><button id="listenHintBtn" class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.listenHint('${it.id}')">Show caption hint</button></div>
        <div class="options">${opts.map(o => `<button class="opt" onclick="ZS.answer('${o.id}','${it.id}',this)">${escapeHtml(o.en)}</button>`).join("")}</div>`;
    } else { // roleplay
      promptHtml = `<div class="q-instr">${stage.instr}</div>${scenarioCard(it)}<div class="q-en">${escapeHtml(it.en)}</div>`;
      body = `<div style="text-align:center"><button class="btn" onclick="ZS.revealRP('${it.id}')">Reveal model answer</button></div><div id="rpReveal"></div>`;
    }

    $("#view").innerHTML = `
      <div class="section-head"><span class="section-head__num">0${stage.n}</span><span class="section-head__title">${stage.title}</span>
        <span class="section-head__sub"><a href="#/quiz" style="color:var(--red)">← all drills</a></span></div>
      <div class="quiz">
        <div class="quiz__progress">${dots}</div>
        <div class="quiz__prompt">${promptHtml}</div>
        <div id="qbody">${body}</div>
        <div id="qfeedback"></div>
      </div>`;
    if (stage.key === "listen") setTimeout(() => speak(it), 250);
    if (stage.key === "dictation") setTimeout(() => speak(ITEMS.find(i => i.id === it.item_id) || it, { quiet: true }), 250);
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
    const r = rec(id);
    const st = stageRec(id, stageKey);
    r.seen++;
    r.last_seen_at = new Date().toISOString();
    st.seen++;
    st.last_seen_at = r.last_seen_at;
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
      backtranslate: ["forgot_phrase", "case_or_inflection", "word_order", "register"],
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
  function showFeedback(ok, it, extra) {
    quiz.answered = true;
    if (ok) quiz.correct++;
    $("#qfeedback").innerHTML = `<div class="feedback ${ok ? "good" : "bad"} rise">
        <div style="font-family:var(--font-display);text-transform:uppercase;letter-spacing:.08em;font-size:.8rem">${ok ? "✓ Correct" : "✗ Not quite"}</div>
        <div class="fb-ru">${colorStress(it.ru)}</div>
        <div style="font-style:italic;font-family:var(--font-serif)">${escapeHtml(it.en)}</div>
        ${it.hint ? `<div class="card__hint">🔈 ${escapeHtml(it.hint)}</div>` : ""}
        ${extra || ""}
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
      <div class="section-head"><span class="section-head__num">0${quiz.stage.n}</span><span class="section-head__title">${quiz.stage.title} — done</span></div>
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
        <button class="btn btn--sm btn--ghost ghost-dark" onclick="ZS.clearOffline()">Clear media</button>
      </div>
      <div id="offlineStatus" class="offlinebox__status">Ready to cache.</div>
    </div>`;
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
      const assisted = ok && quiz.stageKey === "listen" && (quiz.listenHintLevel || 0) > 0;
      gradeItem(correctId, ok, quiz.stageKey, null, { assisted });
      showFeedback(ok, it, assisted ? `<div class="card__hint">Caption used: scheduled as a hard listening review.</div>` : "");
    },
    checkProd(id) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const val = $("#prodIn") ? $("#prodIn").value : "";
      const ok = normalize(val) === normalize(it.ru);
      gradeItem(id, ok, quiz.stageKey);
      showFeedback(ok, it, ok ? "" : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em></div>`);
    },
    checkCloze(id) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const val = $("#clozeIn") ? $("#clozeIn").value : "";
      const accepted = it.accepted_answers || [it.answer];
      const ok = accepted.some(answer => normalize(val) === normalize(answer));
      gradeItem(id, ok, quiz.stageKey);
      showFeedback(ok, it, ok ? "" : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em>; answer: <strong>${escapeHtml(it.answer)}</strong></div>`);
    },
    checkDictation(id) {
      if (quiz.answered) return;
      const it = practiceItem(id);
      const val = $("#dictIn") ? $("#dictIn").value : "";
      const accepted = it.accepted_answers || [it.ru_plain];
      const ok = accepted.some(answer => normalize(val) === normalize(answer));
      gradeItem(id, ok, quiz.stageKey, ok ? null : "listening_misparse");
      showFeedback(ok, it, ok ? "" : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em>; target: <strong>${colorStress(it.ru)}</strong></div>`);
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
      gradeItem(id, ok, quiz.stageKey, ok ? null : "forgot_phrase");
      showFeedback(ok, it, ok ? "" : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em>; target: <strong>${colorStress(it.ru)}</strong></div>`);
    },
    giveUp(id) { const it = practiceItem(id); gradeItem(id, false, quiz.stageKey); showFeedback(false, it); },
    listenHint(id) {
      if (!quiz || quiz.stageKey !== "listen") return;
      const it = practiceItem(id);
      quiz.listenHintLevel = Math.min((quiz.listenHintLevel || 0) + 1, 2);
      const el = $("#listenHint");
      if (it && el) el.innerHTML = listeningHintHtml(it);
      const btn = $("#listenHintBtn");
      if (btn) {
        btn.textContent = quiz.listenHintLevel >= 2 ? "Caption shown" : "Show full caption";
        if (quiz.listenHintLevel >= 2) btn.setAttribute("disabled", "");
      }
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
    revealRP(id) {
      const it = ITEMS.find(i => i.id === id);
      $("#rpReveal").innerHTML = `<div class="feedback good rise"><div class="fb-ru">${colorStress(it.ru)}</div>
        ${it.hint ? `<div class="card__hint">🔈 ${escapeHtml(it.hint)}</div>` : ""}
        <div style="margin:10px 0"><button class="iconbtn iconbtn--play" onclick="ZS.sayItem('${it.id}')">▶</button></div>
        <div style="font-family:var(--font-display);text-transform:uppercase;font-size:.78rem;letter-spacing:.06em">How did you do, out loud?</div>
        <div class="selfrate">
          <button class="btn btn--sm" onclick="ZS.rateRP('${id}',true,false)">😊 Nailed it</button>
          <button class="btn btn--sm btn--ghost" style="color:var(--ink);border-color:var(--ink)" onclick="ZS.rateRP('${id}',true,true)">Close with model</button>
          <button class="btn btn--sm btn--ghost" style="color:var(--ink);border-color:var(--ink)" onclick="ZS.rateRP('${id}',false,false)">😬 Needs work</button>
        </div></div>`;
      speak(it);
    },
    rateRP(id, ok, assisted) {
      const it = ITEMS.find(i => i.id === id);
      gradeItem(id, ok, quiz.stageKey, null, { assisted });
      quiz.answered = true;
      if (ok && !assisted) quiz.correct++;
      if (assisted) toast("Hard role-play review scheduled");
      ZS.nextQ();
    },
    nextQ() { quiz.i++; quiz.listenHintLevel = 0; drawQuestion(); },
    retry() { const k = location.hash.split("/")[2]; quiz = null; renderQuizRun(k); },
    async cachePack(kind) {
      if (!("caches" in window)) { toast("Offline cache unavailable"); return; }
      const status = $("#offlineStatus");
      if (status) status.textContent = "Caching…";
      const core = ["./", "./index.html", "./styles.css", "./app.js", "./content.js", "./audio.js", "./manifest.webmanifest", "./assets/icon.svg"];
      const ids = kind === "all" ? Array.from(AUDIO_IDS) : kind === "p1" ? ITEMS.filter(i => i.priority === 1 && AUDIO_IDS.has(i.id)).map(i => i.id) : [];
      const urls = core.concat(ids.map(id => AUDIO.base + id + ".mp3"));
      try {
        const cache = await caches.open("zastolom-offline-pack");
        await cache.addAll(urls);
        if (status) status.textContent = `Cached ${urls.length} files for ${kind === "all" ? "all audio" : kind === "p1" ? "P1 audio" : "the core course"}.`;
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
