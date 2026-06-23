import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config — smoke tests E2E.
 *
 * Cubre flujos básicos contra el dev server. Para tests E2E completos
 * con API+DB, usar mongodb-memory-server o testcontainers (TODO en O2-extended).
 *
 * Correr local: `pnpm --filter @misanpedro/web e2e`
 * Correr con UI: `pnpm --filter @misanpedro/web e2e:ui`
 *
 * Por ahora NO está en CI (requiere browsers preinstalados ~200MB que
 * inflan el tiempo de ejecución). Para meterlo en CI, agregar el job
 * `e2e` en ci.yml con `npx playwright install --with-deps chromium`.
 */
// Parametrizable por tenant: definí E2E_BASE_URL para apuntar a otra ciudad.
// Sin la env var, mantiene el comportamiento actual (San Pedro / dev server).
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5180/misanpedro/'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],

  // Levanta el dev server automáticamente antes de los tests.
  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
