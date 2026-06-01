#!/usr/bin/env node
import { runtimeSecret } from "./secrets.mjs";

const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";

export async function transcribeRussianAudio({ audio_base64, mime_type, filename, prompt }) {
  const apiKey = await runtimeSecret("OPENAI_API_KEY");
  if (!apiKey) {
    return { provider: "unavailable", transcript: "", confidence: 0, error: "OPENAI_API_KEY is not configured" };
  }
  if (!audio_base64) {
    return { provider: "unavailable", transcript: "", confidence: 0, error: "audio_base64 is required" };
  }
  const model = process.env.SPEECH_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
  const audio = Buffer.from(audio_base64, "base64");
  const form = new FormData();
  form.append("model", model);
  form.append("language", "ru");
  form.append("response_format", "json");
  if (prompt) form.append("prompt", prompt);
  form.append(
    "file",
    new Blob([audio], { type: mime_type || "audio/webm" }),
    filename || "zastolom-recording.webm"
  );
  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error && payload.error.message ? payload.error.message : `OpenAI transcription failed (${response.status})`;
    return { provider: "unavailable", transcript: "", confidence: 0, error: message };
  }
  return {
    provider: "openai",
    transcript: payload.text || "",
    confidence: typeof payload.confidence === "number" ? payload.confidence : 0.85,
    model,
  };
}
