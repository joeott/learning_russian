#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_SECRET_ID = "/zastolom/dev/api-keys";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let cachedSecret = null;
let cachedDotenv = null;

export function secretId() {
  return process.env.ZASTOLOM_API_KEYS_SECRET_ID || DEFAULT_SECRET_ID;
}

export async function loadAwsSecretJson() {
  if (cachedSecret) return cachedSecret;
  const id = secretId();
  const { stdout } = await execFileAsync(
    "aws",
    [
      "secretsmanager",
      "get-secret-value",
      "--secret-id",
      id,
      "--query",
      "SecretString",
      "--output",
      "text",
    ],
    {
      env: process.env,
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    }
  );
  const raw = stdout.trim();
  cachedSecret = raw ? JSON.parse(raw) : {};
  return cachedSecret;
}

function parseDotenv(raw) {
  const parsed = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) parsed[key] = value;
  }
  return parsed;
}

function dotenvPaths() {
  return [
    path.join(ROOT, ".env"),
    path.join(os.homedir(), "Projects", "ott_law_redesign", ".env"),
    path.join(os.homedir(), "Projects", ".env"),
  ];
}

export function loadDotenvSecrets() {
  if (cachedDotenv) return cachedDotenv;
  cachedDotenv = {};
  for (const file of dotenvPaths()) {
    try {
      if (fs.existsSync(file)) {
        Object.assign(cachedDotenv, parseDotenv(fs.readFileSync(file, "utf8")));
      }
    } catch (_error) {
      // Ignore unreadable local dotenv files; AWS Secrets Manager remains the fallback.
    }
  }
  return cachedDotenv;
}

export async function runtimeSecret(name) {
  if (process.env[name]) return process.env[name];
  const dotenv = loadDotenvSecrets();
  if (dotenv[name]) return dotenv[name];
  try {
    const secret = await loadAwsSecretJson();
    return secret && secret[name] ? String(secret[name]) : "";
  } catch (error) {
    return "";
  }
}

export function clearSecretCacheForTests() {
  cachedSecret = null;
  cachedDotenv = null;
}
