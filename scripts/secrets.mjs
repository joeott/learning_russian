#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_SECRET_ID = "/zastolom/dev/api-keys";
let cachedSecret = null;

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

export async function runtimeSecret(name) {
  if (process.env[name]) return process.env[name];
  try {
    const secret = await loadAwsSecretJson();
    return secret && secret[name] ? String(secret[name]) : "";
  } catch (error) {
    return "";
  }
}

export function clearSecretCacheForTests() {
  cachedSecret = null;
}
