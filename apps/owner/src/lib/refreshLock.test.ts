import { describe, it, expect, beforeEach, vi } from 'vitest'
import { _tryRefreshParaTests, _resetRefreshInFlight } from './api'
import { authActions } from './store'

// [cazabug loop2] El panel se deslogueaba solo ~1h después de cada login.
//
// El Dashboard hace Promise.all([metrics(), listApps()]). Al vencer el access,
// las DOS dan 401 y las DOS llaman a refrescar con el MISMO refresh token. La
// primera rota bien; la segunda llega con un token ya revocado, y el backend
// —correctamente— lo interpreta como robo de token y revoca TODA la familia,
// incluido el token nuevo que acababa de emitir. Sesión muerta.
//
// El candado que evita esto existe y está documentado en el cliente de la PWA
// (refreshInFlight en apps/web/src/lib/api.ts), pero nunca se portó acá: hay dos
// clientes HTTP con la misma responsabilidad y sólo uno aprendió la lección.

describe('refresh del panel owner — una sola rotación por vez', () => {
  beforeEach(() => {
    _resetRefreshInFlight()
    localStorage.clear()
    // Sesión viva con el access vencido: el escenario real del bug.
    authActions.signIn({
      access: 'access-viejo',
      refresh: 'refresh-compartido',
      refreshExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
      owner: { id: 'o1', email: 'o@t.com', nombre: 'O', rol: 'super' },
    } as any)
  })

  it('🔴 dos requests en paralelo hacen UNA sola rotación, no dos', async () => {
    let rotaciones = 0
    const fetchFalso = vi.fn(async () => {
      rotaciones++
      // Simulamos la latencia del backend: sin candado, las dos entran acá.
      await new Promise((r) => setTimeout(r, 30))
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            access: `access-${rotaciones}`,
            refresh: `refresh-${rotaciones}`,
            refreshExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
          }),
      } as any
    })
    vi.stubGlobal('fetch', fetchFalso)

    const [a, b] = await Promise.all([_tryRefreshParaTests(), _tryRefreshParaTests()])

    expect(a).toBe(true)
    expect(b).toBe(true)
    // Lo esencial: el backend recibió UN solo refresh. Con dos, el segundo llegaba
    // con el token ya rotado y disparaba la defensa anti-robo.
    expect(rotaciones).toBe(1)
  })

  it('después de terminar, un refresh nuevo vuelve a salir (el candado se suelta)', async () => {
    let rotaciones = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        rotaciones++
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              ok: true,
              access: 'a',
              refresh: 'r',
              refreshExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
            }),
        } as any
      }),
    )
    await _tryRefreshParaTests()
    await _tryRefreshParaTests()
    expect(rotaciones).toBe(2)
  })
})
