(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ZASTOLOM_METRICS = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const DEFAULT_RATING = 1500;
  const MIN_RATING = 700;
  const MAX_RATING = 2400;
  const TARGET_LOW = 0.58;
  const TARGET_HIGH = 0.78;
  const STRUCTURE_PREFIX = "structure:";
  const STAGE_PREFIX = "stage:";
  const MISSION_PREFIX = "mission:";
  const TARGET_MID = (TARGET_LOW + TARGET_HIGH) / 2;

  const CEFR_BANDS = [
    { level: "Pre-A1", min: MIN_RATING, max: 1375, actfl: "Novice Low", descriptor: "memorized words and rehearsed chunks" },
    { level: "A1", min: 1375, max: 1550, actfl: "Novice Mid", descriptor: "familiar phrases in predictable exchanges" },
    { level: "A1+", min: 1550, max: 1650, actfl: "Novice High", descriptor: "short answers with repair support" },
    { level: "A2", min: 1650, max: 1775, actfl: "Intermediate Low", descriptor: "simple exchanges on familiar topics" },
    { level: "A2+", min: 1775, max: 1900, actfl: "Intermediate Mid", descriptor: "connected routine conversation" },
    { level: "B1", min: 1900, max: 2050, actfl: "Intermediate High", descriptor: "handles complications in familiar situations" },
    { level: "B1+", min: 2050, max: 2200, actfl: "Advanced Low", descriptor: "sustained narration and explanation" },
    { level: "B2", min: 2200, max: MAX_RATING + 1, actfl: "Advanced Mid", descriptor: "extended interaction with control" },
  ];

  const STAGE_WEIGHT = {
    recognition: 0.75,
    recall: 0.9,
    conjugate: 1.1,
    cloze: 1.05,
    dictation: 1.15,
    stress: 0.85,
    pronounce: 1.1,
    backtranslate: 1.2,
    contrast: 1,
    produce: 1.25,
    listen: 1,
    roleplay: 1.35,
  };

  const STAGE_BASE_DIFFICULTY = {
    recognition: -120,
    recall: -40,
    conjugate: 80,
    cloze: 55,
    dictation: 105,
    stress: 10,
    pronounce: 90,
    backtranslate: 130,
    contrast: 40,
    produce: 150,
    listen: 20,
    roleplay: 180,
  };

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function stageWeight(stageKey) {
    return STAGE_WEIGHT[stageKey] || 1;
  }

  function baseDifficulty(stageKey, priority) {
    const priorityOffset = priority === 1 ? -55 : priority === 2 ? 0 : 55;
    return DEFAULT_RATING + (STAGE_BASE_DIFFICULTY[stageKey] || 0) + priorityOffset;
  }

  function expectedSuccess(ability, difficulty) {
    return 1 / (1 + Math.pow(10, ((difficulty || DEFAULT_RATING) - (ability || DEFAULT_RATING)) / 400));
  }

  function outcomeScore(ok, assisted, latencyMs, targetMs) {
    if (!ok) return 0;
    const slow = latencyMs && targetMs && latencyMs > targetMs;
    if (assisted) return slow ? 0.55 : 0.65;
    return slow ? 0.85 : 1;
  }

  function kFactor(attempts, confidence) {
    if ((attempts || 0) < 10) return 40;
    if ((confidence || 0) >= 0.8) return 16;
    return 24;
  }

  function updateRating(rating, expected, outcome, k, weight) {
    return clamp((rating || DEFAULT_RATING) + (k || 24) * (weight || 1) * (outcome - expected), MIN_RATING, MAX_RATING);
  }

  function updateDifficulty(difficulty, expected, outcome, k, weight) {
    return clamp((difficulty || DEFAULT_RATING) - (k || 16) * 0.55 * (weight || 1) * (outcome - expected), MIN_RATING, MAX_RATING);
  }

  function confidence(attempts) {
    return clamp((attempts || 0) / 30, 0, 1);
  }

  function proficiencyBand(rating) {
    const value = clamp(Number(rating) || DEFAULT_RATING, MIN_RATING, MAX_RATING);
    return CEFR_BANDS.find(row => value >= row.min && value < row.max) || CEFR_BANDS[1];
  }

  function evidenceLevel(attempts) {
    const n = attempts || 0;
    if (n >= 30) return "high";
    if (n >= 12) return "medium";
    if (n >= 4) return "low";
    return "thin";
  }

  function calibration(row) {
    const attempts = Number(row && row.attempts || 0);
    const difficulty = Number(row && row.difficulty || row && row.rating || DEFAULT_RATING);
    const band = proficiencyBand(difficulty);
    return {
      cefr: band.level,
      actfl: band.actfl,
      descriptor: band.descriptor,
      evidence: evidenceLevel(attempts),
      confidence: confidence(attempts),
    };
  }

  function challengeScore(expected) {
    const value = Number(expected);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return clamp(1 - Math.abs(value - TARGET_MID) / TARGET_MID, 0, 1);
  }

  function recommendationSortKey(row) {
    const expected = Number(row && row.expected_success || row && row.last_expected_success || 0);
    const bucketId = bucket(expected);
    const bucketRank = { rescue: 0, "n+1": 1, consolidate: 2, too_easy: 3 }[bucketId] ?? 4;
    const lapses = Number(row && row.lapses || 0);
    const attempts = Number(row && row.attempts || 0);
    const difficulty = Number(row && row.difficulty || DEFAULT_RATING);
    return [bucketRank, -lapses, -challengeScore(expected), attempts, -difficulty];
  }

  function targetLatency(stageKey) {
    if (stageKey === "recognition" || stageKey === "recall" || stageKey === "listen") return 6500;
    if (stageKey === "produce" || stageKey === "backtranslate" || stageKey === "roleplay") return 18000;
    return 12000;
  }

  function bucket(expected) {
    if (expected < 0.55) return "rescue";
    if (expected >= TARGET_LOW && expected <= TARGET_HIGH) return "n+1";
    if (expected < 0.9) return "consolidate";
    return "too_easy";
  }

  function bucketLabel(id) {
    return {
      rescue: "Rescue",
      "n+1": "n+1",
      consolidate: "Consolidate",
      too_easy: "Easy review",
    }[id] || "Unrated";
  }

  function eventSkillKeys(meta, stageKey) {
    const keys = new Set([STAGE_PREFIX + stageKey]);
    (meta.structures || []).forEach(s => keys.add(STRUCTURE_PREFIX + s));
    if (meta.priority === 1 || meta.priority === 2) keys.add(MISSION_PREFIX + "core");
    if (stageKey === "listen" || stageKey === "dictation") keys.add(MISSION_PREFIX + "listening");
    if (stageKey === "produce" || stageKey === "backtranslate" || stageKey === "roleplay") keys.add(MISSION_PREFIX + "production");
    return Array.from(keys);
  }

  function emptyRatings() {
    return { version: 1, skills: {}, items: {}, updated_at: "" };
  }

  function applyAttempt(ratings, attempt) {
    const next = ratings || emptyRatings();
    next.skills = next.skills || {};
    next.items = next.items || {};
    const meta = attempt.meta || {};
    const stageKey = attempt.stage_key || "recognition";
    const itemKey = `${attempt.item_id || ""}:${stageKey}`;
    const item = next.items[itemKey] || {
      item_id: attempt.item_id || "",
      stage_key: stageKey,
      difficulty: baseDifficulty(stageKey, meta.priority),
      attempts: 0,
      lapses: 0,
      last_expected_success: 0,
      updated_at: "",
    };
    const skillKeys = eventSkillKeys(meta, stageKey);
    const aggregateAbility = skillKeys.reduce((sum, key) => {
      const row = next.skills[key] || { rating: DEFAULT_RATING };
      return sum + (row.rating || DEFAULT_RATING);
    }, 0) / Math.max(1, skillKeys.length);
    const expected = expectedSuccess(aggregateAbility, item.difficulty);
    const outcome = outcomeScore(!!attempt.ok, !!attempt.assisted, attempt.latency_ms || 0, targetLatency(stageKey));
    const weight = stageWeight(stageKey);
    const itemK = kFactor(item.attempts, confidence(item.attempts));

    item.attempts += 1;
    if (!attempt.ok) item.lapses += 1;
    item.last_expected_success = expected;
    item.difficulty = updateDifficulty(item.difficulty, expected, outcome, itemK, weight);
    item.updated_at = attempt.at || new Date().toISOString();
    next.items[itemKey] = item;

    skillKeys.forEach(key => {
      const skill = next.skills[key] || {
        skill_key: key,
        rating: DEFAULT_RATING,
        attempts: 0,
        correct: 0,
        assisted_correct: 0,
        last_attempt_at: "",
        confidence: 0,
      };
      const k = kFactor(skill.attempts, skill.confidence);
      skill.rating = updateRating(skill.rating, expected, outcome, k, weight);
      skill.attempts += 1;
      if (attempt.ok) skill.correct += 1;
      if (attempt.ok && attempt.assisted) skill.assisted_correct += 1;
      skill.last_attempt_at = attempt.at || new Date().toISOString();
      skill.confidence = confidence(skill.attempts);
      next.skills[key] = skill;
    });

    next.updated_at = attempt.at || new Date().toISOString();
    return { ratings: next, expected, outcome, bucket: bucket(expected), skill_keys: skillKeys, item };
  }

  function metricSnapshot(ratings) {
    ratings = ratings || emptyRatings();
    const skills = ratings.skills || {};
    const get = key => skills[key] || { rating: DEFAULT_RATING, attempts: 0, confidence: 0 };
    const grammarRows = Object.keys(skills)
      .filter(k => k.indexOf(STRUCTURE_PREFIX + "grammar:") === 0 || k.indexOf(STRUCTURE_PREFIX + "verb:") === 0 || k.indexOf(STRUCTURE_PREFIX + "case") === 0)
      .map(k => skills[k]);
    const avg = rows => rows.length ? rows.reduce((n, row) => {
      const rating = Number(row.rating);
      return n + (Number.isFinite(rating) ? rating : DEFAULT_RATING);
    }, 0) / rows.length : DEFAULT_RATING;
    const avgConfidence = rows => rows.length ? rows.reduce((n, row) => {
      const value = Number(row.confidence);
      return n + (Number.isFinite(value) ? value : 0);
    }, 0) / rows.length : 0;
    const missionRows = [get(MISSION_PREFIX + "core"), get(MISSION_PREFIX + "listening"), get(MISSION_PREFIX + "production")];
    const missionRating = avg(missionRows);
    const grammarRating = avg(grammarRows);
    const bottlenecks = Object.values(skills)
      .filter(row => (row.attempts || 0) >= 2)
      .sort((a, b) => (a.rating || DEFAULT_RATING) - (b.rating || DEFAULT_RATING))
      .slice(0, 5);
    return {
      missionAbility: Math.round(missionRating),
      missionCefr: proficiencyBand(missionRating).level,
      missionActfl: proficiencyBand(missionRating).actfl,
      grammarControl: Math.round(grammarRating),
      grammarCefr: proficiencyBand(grammarRating).level,
      grammarActfl: proficiencyBand(grammarRating).actfl,
      listeningDiscrimination: Math.round(get(MISSION_PREFIX + "listening").rating || DEFAULT_RATING),
      productionControl: Math.round(get(MISSION_PREFIX + "production").rating || DEFAULT_RATING),
      confidence: Math.round(avgConfidence(missionRows) * 100),
      bottlenecks,
    };
  }

  return {
    DEFAULT_RATING,
    TARGET_LOW,
    TARGET_HIGH,
    STRUCTURE_PREFIX,
    STAGE_PREFIX,
    MISSION_PREFIX,
    CEFR_BANDS,
    baseDifficulty,
    bucket,
    bucketLabel,
    calibration,
    challengeScore,
    confidence,
    emptyRatings,
    evidenceLevel,
    eventSkillKeys,
    expectedSuccess,
    metricSnapshot,
    outcomeScore,
    proficiencyBand,
    recommendationSortKey,
    stageWeight,
    targetLatency,
    updateDifficulty,
    updateRating,
    applyAttempt,
  };
});
