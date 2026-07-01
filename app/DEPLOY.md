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

## Going live (remaining ops — needs a Cloudflare account + a live KV)

1. **Create the KV namespace** and paste its id into `wrangler.jsonc` (`SNAPSHOT_KV`, currently
   `REPLACE_WITH_KV_NAMESPACE_ID`):
   ```
   npx wrangler kv namespace create SNAPSHOT_KV
   ```
2. **Seed it** — the pipeline publishes to KV when its CF secrets are set
   (`pipeline/src/publish-kv.js` + the daily / EPG workflows); point them at the same namespace id.
3. **Deploy:** `npm run deploy` (wrangler). Then verify a real page (e.g. `/country/gb`) serves
   the KV snapshot, not the fixture — the one check that needs the live namespace.
4. **Custom domain:** map `iptv.shriramkraja.com` to the Worker (Workers → Triggers → Custom
   Domains). Hard-capped free tier; no surprise bill.
5. **Cache:** add an edge cache TTL (~12–24h) aligned to the pipeline's purge hook so KV
   refreshes propagate without a redeploy.

## Coexistence
The v1 CRA app at the repo root stays on GitHub Pages until this v2 app is verified live;
the DNS cutover is the last step.
