/* ============================================================
   ЗА СТОЛО́М — app logic (vanilla, no build step)
   Reads window.CONTENT_DATA (from content.js).
   ============================================================ */
(function () {
  "use strict";

  const DATA = window.CONTENT_DATA;
  if (!DATA) { document.getElementById("view").innerHTML = "<p>Content failed to load.</p>"; return; }
  const ITEMS = DATA.items;
  const MODULES = DATA.modules;
  const MOD_BY_ID = Object.fromEntries(MODULES.map(m => [m.id, m]));
  const TARGET = new Date(2026, 5, 15); // June 15, 2026 (month is 0-indexed)

  const ACUTE = "́";
  const $ = (sel, el = document) => el.querySelector(sel);
  const view = document.getElementById("view");
  const toastEl = document.getElementById("toast");

  /* ---------- persistence ---------- */
  const KEY = "zastolom.v1";
  let store = load();
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function rec(id) { return (store[id] = store[id] || { seen: 0, correct: 0, stages: {}, known: false }); }

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
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
  function sample(arr, n, exclude) { return shuffle(arr.filter(x => x !== exclude)).slice(0, n); }
  function daysLeft() { const ms = TARGET - new Date(); return Math.max(0, Math.ceil(ms / 86400000)); }
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove("show"), 1800); }

  function moduleProgress(modId) {
    const items = ITEMS.filter(i => i.module === modId);
    const done = items.filter(i => { const r = store[i.id]; return r && (r.known || (r.stages && Object.keys(r.stages).length)); }).length;
    return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
  }
  function overallProgress() {
    const done = ITEMS.filter(i => { const r = store[i.id]; return r && (r.known || (r.stages && Object.keys(r.stages).length)); }).length;
    return { done, total: ITEMS.length, pct: ITEMS.length ? Math.round((done / ITEMS.length) * 100) : 0 };
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
  function speak(item) {
    if (!item) return;
    if (AUDIO && AUDIO_IDS.has(item.id)) {
      try {
        if (curAudio) { curAudio.pause(); }
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        curAudio = new Audio(AUDIO.base + item.id + ".mp3");
        curAudio.play().catch(() => speakTTS(item)); // autoplay/format fallback
        return;
      } catch (e) { /* fall through */ }
    }
    speakTTS(item);
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
    document.querySelectorAll(".tabs a").forEach(a => a.classList.toggle("is-active", a.dataset.tab === (route || "home")));
    view.scrollTop = 0; window.scrollTo(0, 0);
    if (route === "learn") renderLearn(arg);
    else if (route === "quiz") arg ? renderQuizRun(arg) : renderQuizMenu();
    else if (route === "plan") renderPlan();
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
        <div class="stat rise"><div class="stat__num">${ITEMS.filter(i => i.priority === 1).length}</div><div class="stat__label">Doorway must-knows (P1)</div></div>
        <div class="stat rise"><div class="stat__num">${MODULES.length}</div><div class="stat__label">Modules</div></div>
        <div class="stat rise"><div class="stat__num">${d}</div><div class="stat__label">Days to 15 June</div></div>
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
    let list = ITEMS.slice();
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
      <div class="learnbar">${modChips}</div>
      <div class="learnbar">${priChips}<span class="spacer"></span>
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
    speak(it); // auto-play on show (audio-first)
  }

  /* ====================================================================
     QUIZ
     ==================================================================== */
  const STAGES = [
    { n: 1, key: "recognition", title: "Recognise", desc: "See Russian → choose the meaning.", instr: "What does this mean?" },
    { n: 2, key: "recall", title: "Recall", desc: "See English → choose the Russian.", instr: "Pick the Russian" },
    { n: 3, key: "produce", title: "Produce", desc: "See English → type the Russian (stress optional).", instr: "Type it in Russian" },
    { n: 4, key: "listen", title: "Listen", desc: "Hear it → choose the meaning. No text.", instr: "What did you hear?" },
    { n: 5, key: "roleplay", title: "Role-play", desc: "A table prompt → say it, then self-rate.", instr: "Say it out loud" },
  ];
  function stagePool(stageKey) {
    if (stageKey === "listen") return ITEMS.filter(i => i.syllables >= 1);
    if (stageKey === "roleplay") return ITEMS.filter(i => i.priority <= 2 && (i.ru_plain.includes(" ") || i.tags.includes("toast")));
    return ITEMS;
  }
  function stageProgress(stageKey) {
    const pool = stagePool(stageKey);
    const done = pool.filter(i => store[i.id] && store[i.id].stages && store[i.id].stages[stageKey]).length;
    return { done, total: pool.length, pct: pool.length ? Math.round(done / pool.length * 100) : 0 };
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
      <div class="callout">Each round is 10 questions, drawn first from what you haven't mastered. Aim for one round a day; do Listen + Role-play on weekends.</div>
      <div class="stagegrid">${cards}</div>`;
  }

  let quiz = null;
  function renderQuizRun(stageKey) {
    const stage = STAGES.find(s => s.key === stageKey);
    if (!stage) { location.hash = "#/quiz"; return; }
    if (!quiz || quiz.stageKey !== stageKey) {
      const pool = stagePool(stageKey);
      // prioritise un-mastered, then by priority, then sample 10
      const ranked = pool.slice().sort((a, b) => {
        const am = store[a.id] && store[a.id].stages && store[a.id].stages[stageKey] ? 1 : 0;
        const bm = store[b.id] && store[b.id].stages && store[b.id].stages[stageKey] ? 1 : 0;
        if (am !== bm) return am - bm;
        return a.priority - b.priority;
      });
      const head = ranked.slice(0, 16);
      quiz = { stageKey, stage, q: shuffle(head).slice(0, Math.min(10, head.length)), i: 0, correct: 0, answered: false };
    }
    drawQuestion();
  }
  function drawQuestion() {
    const { stage } = quiz;
    if (quiz.i >= quiz.q.length) return drawSummary();
    const it = quiz.q[quiz.i];
    quiz.answered = false;
    const dots = quiz.q.map((_, k) => `<span class="${k < quiz.i ? "done" : k === quiz.i ? "cur" : ""}"></span>`).join("");
    let promptHtml = "", body = "";

    if (stage.key === "recognition") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-ru">${colorStress(it.ru)}</div>`;
      const opts = shuffle([it].concat(sample(ITEMS, 3, it)));
      body = `<div class="options">${opts.map(o => `<button class="opt" onclick="ZS.answer('${o.id}','${it.id}',this)">${escapeHtml(o.en)}</button>`).join("")}</div>`;
    } else if (stage.key === "recall") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-en">${escapeHtml(it.en)}</div>`;
      const opts = shuffle([it].concat(sample(ITEMS, 3, it)));
      body = `<div class="options">${opts.map(o => `<button class="opt" onclick="ZS.answer('${o.id}','${it.id}',this)">${colorStress(o.ru)}</button>`).join("")}</div>`;
    } else if (stage.key === "produce") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-en">${escapeHtml(it.en)}</div>`;
      body = `<div class="answerbox"><input id="prodIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Печатайте по-русски…" />
        <button class="btn btn--red" onclick="ZS.checkProd('${it.id}')">Check</button></div>
        <div style="margin-top:8px"><button class="btn btn--sm btn--ghost" style="color:var(--ink);border-color:var(--ink)" onclick="ZS.giveUp('${it.id}')">Show answer</button></div>`;
    } else if (stage.key === "listen") {
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-ru" style="font-size:2.6rem">🔊</div>`;
      const opts = shuffle([it].concat(sample(ITEMS, 3, it)));
      body = `<div style="text-align:center;margin-bottom:14px"><button class="iconbtn iconbtn--play" onclick="ZS.sayItem('${it.id}')">▶</button></div>
        <div class="options">${opts.map(o => `<button class="opt" onclick="ZS.answer('${o.id}','${it.id}',this)">${escapeHtml(o.en)}</button>`).join("")}</div>`;
    } else { // roleplay
      promptHtml = `<div class="q-instr">${stage.instr}</div><div class="q-en">${escapeHtml(it.en)}</div>`;
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
    if (stage.key === "produce") setTimeout(() => { const el = $("#prodIn"); if (el) { el.focus(); el.addEventListener("keydown", e => { if (e.key === "Enter") ZS.checkProd(it.id); }); } }, 50);
  }

  function gradeItem(id, ok, stageKey) {
    const r = rec(id); r.seen++; if (ok) { r.correct++; r.stages[stageKey] = (r.stages[stageKey] || 0) + 1; } save();
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
    toggleEn() { learnState.hideEn = !learnState.hideEn; renderLearn(); },
    next() { learnState.idx = (learnState.idx + 1) % learnState.list.length; renderCard(); },
    prev() { learnState.idx = (learnState.idx - 1 + learnState.list.length) % learnState.list.length; renderCard(); },
    say() { speak(learnState.list[learnState.idx]); },
    sayItem(id) { speak(ITEMS.find(i => i.id === id)); },
    known() { const it = learnState.list[learnState.idx]; const r = rec(it.id); r.known = true; r.stages.learned = 1; save(); toast("Marked ✓ — " + it.en); ZS.next(); },
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
      gradeItem(correctId, ok, quiz.stageKey);
      showFeedback(ok, it);
    },
    checkProd(id) {
      if (quiz.answered) return;
      const it = ITEMS.find(i => i.id === id);
      const val = $("#prodIn") ? $("#prodIn").value : "";
      const ok = normalize(val) === normalize(it.ru);
      gradeItem(id, ok, quiz.stageKey);
      showFeedback(ok, it, ok ? "" : `<div class="card__hint">You wrote: <em>${escapeHtml(val || "—")}</em></div>`);
    },
    giveUp(id) { const it = ITEMS.find(i => i.id === id); gradeItem(id, false, quiz.stageKey); showFeedback(false, it); },
    revealRP(id) {
      const it = ITEMS.find(i => i.id === id);
      $("#rpReveal").innerHTML = `<div class="feedback good rise"><div class="fb-ru">${colorStress(it.ru)}</div>
        ${it.hint ? `<div class="card__hint">🔈 ${escapeHtml(it.hint)}</div>` : ""}
        <div style="margin:10px 0"><button class="iconbtn iconbtn--play" onclick="ZS.sayItem('${it.id}')">▶</button></div>
        <div style="font-family:var(--font-display);text-transform:uppercase;font-size:.78rem;letter-spacing:.06em">How did you do, out loud?</div>
        <div class="selfrate">
          <button class="btn btn--sm" onclick="ZS.rateRP('${id}',true)">😊 Nailed it</button>
          <button class="btn btn--sm btn--ghost" style="color:var(--ink);border-color:var(--ink)" onclick="ZS.rateRP('${id}',false)">😬 Needs work</button>
        </div></div>`;
      speak(it);
    },
    rateRP(id, ok) { const it = ITEMS.find(i => i.id === id); gradeItem(id, ok, quiz.stageKey); quiz.answered = true; if (ok) quiz.correct++; ZS.nextQ(); },
    nextQ() { quiz.i++; drawQuestion(); },
    retry() { const k = location.hash.split("/")[2]; quiz = null; renderQuizRun(k); },
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
