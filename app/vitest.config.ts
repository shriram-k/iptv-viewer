import { defineConfig } from 'vitest/config'

// Unit/component tests run in a plain jsdom environment — NOT through the
// Cloudflare workers runtime (vite.config.ts's cloudflare() plugin is for the
// app build/serve, not for unit tests).
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
