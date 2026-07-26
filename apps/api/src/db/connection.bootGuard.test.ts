import { describe, it, expect, afterEach } from 'vitest'
import { bootMutationsAllowed } from '@/db/connection'

// [cazabug S14-02 · P1] El .env local apunta al MISMO Atlas que prod (dbName
// 'misanpedro' hardcodeado). Sin este guard, `pnpm dev:api` dropeaba índices de
// PROD y escribía (seed/expiry/snapshot) en el arranque. La propiedad crítica:
// en un entorno que NO es producción y SIN opt-in explícito, las mutaciones de
// arranque están APAGADAS.
describe('bootMutationsAllowed — guard anti-mutación-de-prod', () => {
  afterEach(() => {
    delete process.env.DB_BOOTSTRAP
  })

  it('en env test (no producción) y sin DB_BOOTSTRAP → OFF', () => {
    expect(process.env.NODE_ENV).not.toBe('production')
    expect(bootMutationsAllowed()).toBe(false)
  })

  it('con DB_BOOTSTRAP=true → ON (opt-in para reconciliar una Mongo LOCAL a propósito)', () => {
    process.env.DB_BOOTSTRAP = 'true'
    expect(bootMutationsAllowed()).toBe(true)
  })

  it('DB_BOOTSTRAP con cualquier otro valor → sigue OFF (solo el string "true" habilita)', () => {
    process.env.DB_BOOTSTRAP = '1'
    expect(bootMutationsAllowed()).toBe(false)
  })
})
