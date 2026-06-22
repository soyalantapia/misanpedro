import { describe, it, expect } from 'vitest'
import { collectOffenders } from '../../../../scripts/check-no-hardcoded-tenant.mjs'

// Guardrail: las apps multi-tenant (web + owner) NO deben hardcodear una ciudad.
// El nombre sale del tenant (useTenant/appName). Ver scripts/check-no-hardcoded-tenant.mjs.
describe('guardrail multi-tenant', () => {
  it('web + owner no tienen identidad de ciudad hardcodeada', () => {
    const offenders = collectOffenders()
    const detalle = offenders.map((o) => `${o.file}:${o.line} → ${o.text}`).join('\n')
    expect(offenders, `Hardcodeos encontrados:\n${detalle}`).toHaveLength(0)
  })
})
