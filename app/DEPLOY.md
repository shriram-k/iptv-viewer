# v2 app — deploy runbook (Cloudflare Workers)

The v2 UI app (TanStack Start) reads the channel snapshot the [data pipeline](../pipeline)
publishes to Cloudflare KV. Locally it falls back to a bundled fixture, so `npm run dev`
works with no Cloudflare account.

## Local dev
```
cd app
npm install
npm run dev        # http://localhost:3000 — serves the bundled fixture snapshot
npm run test       # vitest unit/component tests
npm run build      # client + Worker SSR bundles
```

## Server-only KV wiring (✅ done)

The loaders now read KV through **server functions**, so the binding never reaches the
client bundle, even on client-side navigation:

- `src/data/server.ts` holds `createServerFn` wrappers (`fetchHomeData`, `fetchCountryData`,
  `fetchCategoryData`, `fetchChannelData`, `fetchSearchData`, `fetchChannelIndex`). Only this
  file imports `env` from `cloudflare:workers`; the Start Vite plugin strips server-fn bodies
  from the client bundle, so KV / the binding stay server-only (verified: 0 in `dist/client`).
- Route loaders and the sitemap handler call those fns; the client hook `useResolvedChannels`
  (favorites / recently-watched / featured rails) calls `fetchChannelIndex` — a Worker RPC —
  instead of reading the store client-side.
- `getStore(env)` gates on `import.meta.env.DEV`: **dev/test always use the bundled fixture**
  (the Cloudflare Vite plugin provides a real-but-EMPTY Miniflare KV binding in `vite dev`, so
  gating on binding presence would serve empty data). In the built Worker it reads `SNAPSHOT_KV`.
- Types: `cloudflare:workers` has a minimal ambient decl (`src/cloudflare-workers.d.ts`); run
  `npm run cf-typegen` for the full generated Cloudflare runtime types (gitignored).

## Live (✅ deployed)

- **URL:** https://iptv.shriramkraja.com (Cloudflare Worker `iptv-viewer-v2`, custom domain + auto TLS).
- **KV namespace `SNAPSHOT_KV`** = `e0ac905d8fc74bc0a5d0c192786e677d` (in `wrangler.jsonc`).
- **Freshness:** the `v2 data pipeline` (daily) + `v2 EPG refresh` (6-hourly) Actions publish to KV;
  they authenticate via the repo secrets `CF_API_TOKEN` / `CF_ACCOUNT_ID` / `CF_KV_NAMESPACE_ID`.

### How the pipeline persists its diff baseline
The pipeline diffs each new snapshot against the last published one to decide auto-publish vs
anomaly-review. That baseline is kept on a dedicated, **unprotected `pipeline-state` branch** — the
workflow restores `data/` from it before a run and force-pushes the refreshed `data/` back after.
`master` is never written to by the bot, so it stays PR-protected and free of daily machine commits.
`data/` is therefore a machine artifact; don't commit it to `master`.

### Original bring-up steps (for reference / a fresh environment)

1. **Create the KV namespace** and paste its id into `wrangler.jsonc` (`SNAPSHOT_KV`):
   ```
   npx wrangler kv namespace create SNAPSHOT_KV
   ```
2. **Seed it** — set the `CF_*` secrets (or env vars) and run `npm run pipeline` + `npm run epg`.
3. **Deploy:** `npm run deploy` (wrangler). Verify `/country/gb` serves the KV snapshot, not the fixture.
4. **Custom domain:** map the domain to the Worker (Workers → Settings → Domains & Routes).
5. **Cache:** an edge cache TTL (~12–24h) aligned to the pipeline's purge hook lets KV refreshes
   propagate without a redeploy.

## Coexistence
The v1 CRA app at the repo root remains on GitHub Pages; v2 is the live site at
`iptv.shriramkraja.com`.
