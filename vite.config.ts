/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Production-only Content Security Policy: no third-party scripts, styles or frames, and requests
 * only over HTTPS (GREEN-API) or to a local proxy. The dev server needs inline scripts for HMR,
 * so the policy is not applied there.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  'connect-src https: http://localhost:* http://127.0.0.1:*',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const contentSecurityPolicy = (): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
      injectTo: 'head-prepend',
    },
  ],
})

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app from /<repo>/, so the base is configurable at build time.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), contentSecurityPolicy()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
})
