import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit/component tests run in a plain jsdom environment — NOT through the
// Cloudflare workers runtime (vite.config.ts's cloudflare() plugin is for the
// app build/serve, not for unit tests).
export default defineConfig({
  resolve: {
    alias: {
      // The `cloudflare:workers` virtual module only exists in workerd; stub it so
      // modules that import `env` (src/data/server.ts) load under jsdom.
      'cloudflare:workers': fileURLToPath(new URL('./src/test/cloudflare-workers-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
