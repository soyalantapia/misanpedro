import { describe, it, expect } from 'vitest'
import { tenantFrontUrl } from './urls'

describe('tenantFrontUrl', () => {
  it('usa el subdomain sobre el dominio de plataforma', () => {
    expect(tenantFrontUrl({ subdomain: 'sanpedro' })).toBe('https://sanpedro.micuidad.com')
    expect(tenantFrontUrl({ subdomain: 'minarino' })).toBe('https://minarino.micuidad.com')
  })

  it('prioriza el customDomain sobre el subdomain', () => {
    expect(
      tenantFrontUrl({ subdomain: 'ramallo', customDomain: 'ramallodescuentos.com.ar' }),
    ).toBe('https://ramallodescuentos.com.ar')
  })

  it('normaliza el subdomain a minúsculas', () => {
    expect(tenantFrontUrl({ subdomain: 'SanPedro' })).toBe('https://sanpedro.micuidad.com')
  })

  it('cada ciudad resuelve a SU origin (no a uno global compartido)', () => {
    const a = tenantFrontUrl({ subdomain: 'sanpedro' })
    const b = tenantFrontUrl({ subdomain: 'minarino' })
    expect(a).not.toBe(b)
  })

  it('sin subdomain ni customDomain cae a un fallback string no vacío', () => {
    const url = tenantFrontUrl({})
    expect(typeof url).toBe('string')
    expect(url.length).toBeGreaterThan(0)
    // El fallback no debe terminar en barra (lo consumimos concatenando paths).
    expect(url.endsWith('/')).toBe(false)
  })
})
