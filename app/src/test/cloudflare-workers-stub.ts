// Test-only stub for the `cloudflare:workers` virtual module (which only exists in
// the workerd/Vite-plugin runtime). Vitest aliases the import here so modules that
// reference `env` (src/data/server.ts) can be imported under jsdom without failing
// to resolve. In tests the fixture path is used anyway (import.meta.env.DEV), so
// this env is never actually read for data.
export const env = {} as Record<string, unknown>
