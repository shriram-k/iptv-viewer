// Minimal ambient type for the `cloudflare:workers` virtual module (resolved at
// build time by @cloudflare/vite-plugin; aliased to a stub in tests). Kept small
// and self-contained so tsc works without committing the ~550KB `wrangler types`
// output — run `npm run cf-typegen` for the full generated Cloudflare runtime types.
declare module 'cloudflare:workers' {
  export const env: {
    SNAPSHOT_KV?: { get(key: string): Promise<string | null> }
    [key: string]: unknown
  }
}
