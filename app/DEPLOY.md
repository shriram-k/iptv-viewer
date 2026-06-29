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

## Going live (remaining integration step)

1. **Create the KV namespace** and put its id in `wrangler.jsonc` (`SNAPSHOT_KV` binding):
   ```
   npx wrangler kv namespace create SNAPSHOT_KV
   ```
2. **Seed it** — the pipeline already publishes to KV when its CF secrets are set
   (`pipeline/src/publish-kv.js`); point the pipeline at the same namespace id.
3. **Wire the loaders to the real binding (server-only).** ⚠️ Not yet done — this is the
   one piece that needs a live KV to verify, so it's intentionally deferred:
   - TanStack loaders run on **both** server and client; KV is server-only. Wrap the
     `src/data` getters in `createServerFn` (or convert the route loaders to server-only)
     so KV reads always execute on the Worker, even on client-side navigation.
   - Access the binding via the Cloudflare env in that server boundary and pass it to
     `getStore(env)` (already supported in `src/data/store.ts`).
   - Until this is wired, prod would serve the dev fixture — so do this before the DNS cutover.
4. **Deploy:** `npm run deploy` (wrangler).
5. **Custom domain:** map `iptv.shriramkraja.com` to the Worker in the Cloudflare dashboard
   (Workers → Triggers → Custom Domains). Hard-capped free tier; no surprise bill.
6. **Cache:** add an edge cache TTL (~12–24h) aligned to the pipeline's purge hook so KV
   refreshes propagate without a redeploy.

## Coexistence
The v1 CRA app at the repo root stays on GitHub Pages until this v2 app is verified live;
the DNS cutover is the last step.
