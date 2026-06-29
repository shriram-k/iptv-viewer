'use strict';
/**
 * U8 — Cloudflare REST adapters for KV writes + cache purge. Used only by the
 * CLI when creds are present; credentials come exclusively from the environment
 * (CI secrets), never from files (origin analytics R11).
 *
 * Env: CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN, CF_ZONE_ID
 */
const API = 'https://api.cloudflare.com/client/v4';

function authHeaders() {
  return { Authorization: `Bearer ${process.env.CF_API_TOKEN}` };
}

function makeKvClient() {
  const acct = process.env.CF_ACCOUNT_ID;
  const ns = process.env.CF_KV_NAMESPACE_ID;
  return {
    async put(key, value) {
      const url = `${API}/accounts/${acct}/storage/kv/namespaces/${ns}/values/${encodeURIComponent(key)}`;
      const res = await fetch(url, { method: 'PUT', headers: authHeaders(), body: value });
      if (!res.ok) throw new Error(`KV put ${key} failed: HTTP ${res.status}`);
    },
  };
}

function makePurge() {
  const zone = process.env.CF_ZONE_ID;
  return async () => {
    if (!zone) return; // purge optional; TTL fallback covers staleness
    const url = `${API}/zones/${zone}/purge_cache`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ purge_everything: true }),
    });
    if (!res.ok) throw new Error(`Cache purge failed: HTTP ${res.status}`);
  };
}

module.exports = { makeKvClient, makePurge };
