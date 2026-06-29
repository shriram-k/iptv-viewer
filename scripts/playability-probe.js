#!/usr/bin/env node
/*
 * U1 — Playability probe (throwaway spike).
 *
 * Measures, for the current committed playlist.json, what fraction of streams
 * could plausibly play in a browser via hls.js. Two signals:
 *
 *   1. OFFLINE (always available): http vs https scheme breakdown. http streams
 *      are hard-blocked as mixed content on an https page — a firm lower bound
 *      on "won't play" regardless of anything else.
 *
 *   2. NETWORK SAMPLE (needs outbound network): for a sample of https streams,
 *      fetch the manifest and check (a) it responds 2xx and (b) it carries a
 *      permissive `access-control-allow-origin` header. hls.js fetches the
 *      manifest/segments/keys via XHR/fetch, so a missing/!* ACAO on the
 *      manifest means the browser blocks it even when the stream is live.
 *      This approximates the browser-CORS verdict for the manifest (the
 *      segment/key surfaces still need a real-browser run to confirm).
 *
 * The number is the deliverable; this script is not production code.
 *
 * Usage: node scripts/playability-probe.js [sampleSize]
 */
const fs = require('fs');
const path = require('path');

const SAMPLE = parseInt(process.argv[2] || '300', 10);
const TIMEOUT_MS = 6000;
const CONCURRENCY = 20;

function loadStreams() {
  const p = path.join(__dirname, '..', 'playlist.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  return data.channels.map((c) => c.url).filter(Boolean);
}

function schemeBreakdown(urls) {
  let http = 0, https = 0, other = 0;
  for (const u of urls) {
    if (u.startsWith('https://')) https++;
    else if (u.startsWith('http://')) http++;
    else other++;
  }
  return { total: urls.length, http, https, other };
}

function sample(arr, n) {
  // deterministic stride sample (no Math.random — reproducible)
  if (arr.length <= n) return arr.slice();
  const step = arr.length / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

async function probeOne(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'iptv-probe/1.0' } });
    const acao = res.headers.get('access-control-allow-origin');
    const ok = res.status >= 200 && res.status < 300;
    const corsOk = acao === '*' || (acao && acao.length > 0);
    return { url, status: res.status, ok, acao: acao || null, corsOk: !!corsOk, playable: ok && !!corsOk };
  } catch (e) {
    return { url, status: 0, ok: false, acao: null, corsOk: false, playable: false, error: e.name || String(e) };
  } finally {
    clearTimeout(t);
  }
}

async function runPool(urls) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      results.push(await probeOne(urls[idx]));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

(async () => {
  const urls = loadStreams();
  const scheme = schemeBreakdown(urls);
  console.log('=== Offline scheme breakdown ===');
  console.log(scheme);
  console.log(`http (mixed-content, hard-blocked on https): ${(100 * scheme.http / scheme.total).toFixed(1)}%`);

  const httpsUrls = urls.filter((u) => u.startsWith('https://'));
  const sampleUrls = sample(httpsUrls, SAMPLE);
  console.log(`\n=== Network sample: ${sampleUrls.length} https streams (manifest fetch + CORS header) ===`);

  let net;
  try {
    net = await runPool(sampleUrls);
  } catch (e) {
    console.error('Network probe failed (no outbound network?):', e.message);
    console.error('Offline scheme breakdown above is still valid. Re-run this script where outbound network is available.');
    process.exit(2);
  }

  const reachable = net.filter((r) => r.ok).length;
  const corsOk = net.filter((r) => r.corsOk).length;
  const playable = net.filter((r) => r.playable).length;
  const n = net.length;
  const pct = (x) => `${(100 * x / n).toFixed(1)}%`;

  console.log(`manifest reachable (2xx):        ${reachable}/${n} (${pct(reachable)})`);
  console.log(`CORS-permissive (ACAO present):  ${corsOk}/${n} (${pct(corsOk)})`);
  console.log(`=> browser-playable estimate:    ${playable}/${n} (${pct(playable)})`);

  // Project onto the whole catalog: https-share * sampled-playable-rate
  const httpsShare = scheme.https / scheme.total;
  const playableRate = playable / n;
  console.log(`\n=== Catalog projection ===`);
  console.log(`https share: ${(100 * httpsShare).toFixed(1)}% ; sampled playable rate: ${(100 * playableRate).toFixed(1)}%`);
  console.log(`estimated catalog browser-playable: ${(100 * httpsShare * playableRate).toFixed(1)}%`);
})();
