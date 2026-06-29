'use strict';
/**
 * U8 — Cloudflare REST adapters for KV writes + cache purge. Used only by the
 * CLI when creds are present; credentials come exclusively from the environment
 * (CI secrets), never from files (origin analytics R11).
 *
 * Env: CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN, CF_ZONE_ID
 */
const API = 'https://api.cloudflare.com/client/v4';
const TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

/** fetch with a timeout and bounded retry on transient (network / 429 / 5xx) failures. */
async function fetchResilient(url, options, label) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      if (res.ok) return res;
      // Retry transient server/rate-limit responses; fail fast on 4xx (config/auth).
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`${label} failed: HTTP ${res.status}`);
      } else {
        throw Object.assign(new Error(`${label} failed: HTTP ${res.status}`), { fatal: true });
      }
    } catch (err) {
      if (err.fatal) throw err; // non-retryable (4xx) — do not loop
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(500 * 2 ** (attempt - 1));
  }
  throw lastErr;
}

function makeKvClient() {
  const acct = requireEnv('CF_ACCOUNT_ID');
  const ns = requireEnv('CF_KV_NAMESPACE_ID');
  requireEnv('CF_API_TOKEN');
  return {
    async put(key, value) {
      const url = `${API}/accounts/${acct}/storage/kv/namespaces/${ns}/values/${encodeURIComponent(key)}`;
      await fetchResilient(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}` },
        body: value,
      }, `KV put ${key}`);
    },
  };
}

function makePurge() {
  const zone = process.env.CF_ZONE_ID;
  return async () => {
    if (!zone) return; // purge optional; TTL fallback covers staleness
    const url = `${API}/zones/${zone}/purge_cache`;
    await fetchResilient(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${requireEnv('CF_API_TOKEN')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ purge_everything: true }),
    }, 'Cache purge');
  };
}

module.exports = { makeKvClient, makePurge };
