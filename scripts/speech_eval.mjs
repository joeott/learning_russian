#!/usr/bin/env node
const ACUTE = "\u0301";

export function normalizeSpeech(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(new RegExp(ACUTE, "g"), "")
    .toLowerCase()
    .replace(/[ё]/g, "е")
    .replace(/[«»"“”]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s-]+/gu, " ")
    .replace(/\b(э|эм|ну|а)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let prevDiag = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prevDiag + cost);
      prevDiag = temp;
    }
  }
  return dp[b.length];
}

function tokenDiff(targetTokens, transcriptTokens) {
  const used = new Set();
  const rows = targetTokens.map((target) => {
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

export function compareSpeech({ transcript, target, confidence = 0.85 } = {}) {
  const normalizedTranscript = normalizeSpeech(transcript);
  const normalizedTarget = normalizeSpeech(target);
  const distance = levenshtein(normalizedTranscript, normalizedTarget);
  const maxLen = Math.max(normalizedTranscript.length, normalizedTarget.length, 1);
  const charSimilarity = Math.max(0, 1 - distance / maxLen);
  const targetTokens = normalizedTarget.split(/\s+/).filter(Boolean);
  const transcriptTokens = normalizedTranscript.split(/\s+/).filter(Boolean);
  const diffTokens = tokenDiff(targetTokens, transcriptTokens);
  const matched = diffTokens.filter((row) => row.target && row.heard && row.distance <= Math.max(1, Math.ceil(row.target.length * 0.34))).length;
  const tokenSimilarity = targetTokens.length ? matched / targetTokens.length : 0;
  const textSimilarity = Math.round(((charSimilarity * 0.55) + (tokenSimilarity * 0.45)) * 1000) / 1000;
  let verdict = "repair";
  if (normalizedTranscript && normalizedTranscript === normalizedTarget) verdict = "correct";
  else if (textSimilarity >= 0.72) verdict = "close";
  const suggestedErrorType = verdict === "repair" ? "forgot_phrase" : verdict === "close" ? "stress" : "";
  return {
    transcript: String(transcript || ""),
    normalized_transcript: normalizedTranscript,
    target_normalized: normalizedTarget,
    text_similarity: textSimilarity,
    sample_match_score: textSimilarity,
    verdict,
    suggested_error_type: suggestedErrorType,
    diff_tokens: diffTokens,
    confidence,
  };
}
