import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AdminWhatsappPage } from '@/pages/admin/AdminWhatsappPage'

/**
 * [cazabug] El pub/sub de WhatsApp (`whatsapp.service.ts`) es en vivo, sin
 * buffer ni replay: si el `EventSource` se reconecta justo cuando se emite un
 * evento (típico en una campaña de ~29 min sobre 4G), ese evento se pierde para
 * siempre y la barra de "Enviando…" queda clavada, porque el ÚNICO camino que
 * antes sacaba a la UI de `sending` era el SSE `campaign.done`.
 *
 * Este test simula justo ese peor caso: el stream de WhatsApp NUNCA vuelve a
 * emitir nada después de arrancar la campaña (ni progreso ni `done`). El
 * respaldo tiene que, tras `TIMEOUT_SIN_NOVEDADES_MS`, refetchear el historial
 * real (`GET /wa/campaigns`) y cerrar la fase con los números que YA confirmó
 * el backend — nunca un conteo inventado.
 *
 * Mockeamos todas las dependencias externas de la page (sesión, tenant, stream
 * SSE, toasts) para poder controlar el escenario; dejamos `apiQueries.ts` REAL
 * (así el mecanismo de refetch/tick de `useAsync` es el de producción) y sólo
 * mockeamos la capa HTTP (`@/lib/api`) que consume.
 *
 * NO usamos `vi.useFakeTimers()`: React 19 + jsdom programan trabajo interno
 * vía el scheduler (no sólo `setTimeout` de nuestro código), y falsear el
 * reloj global deja el mount colgado esperando ese trabajo. En cambio,
 * espiamos `window.setInterval` para capturar el callback del respaldo SIN que
 * el timer real llegue a dispararse solo, y simulamos el paso del tiempo
 * mockeando `Date.now()` — así el resto de la UI (clicks, `findBy*`) sigue
 * andando con timers reales de verdad.
 *
 * Los mocks/spies referenciados DENTRO de los factories de `vi.mock` van en
 * `vi.hoisted()`: los factories corren al resolver el import estático de
 * `AdminWhatsappPage` de arriba, que ocurre ANTES que el resto del código de
 * este archivo — sin `vi.hoisted` esas variables todavía no existirían.
 */
const { toastMock, campaignPost, campaignsGet, statusGet, clientesGet } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  campaignPost: vi.fn(),
  campaignsGet: vi.fn(),
  statusGet: vi.fn(),
  clientesGet: vi.fn(),
}))

vi.mock('@/lib/merchantStore', () => ({
  useMerchantSession: () => ({
    session: { merchantId: 'm1' },
    apiMerchant: { nombre: 'Comercio Test' },
  }),
}))

vi.mock('@/lib/tenant', () => ({
  useTenant: () => ({ config: { nombre: 'Mi Ciudad Test' } }),
}))

vi.mock('@/components/Toast', () => ({
  useToast: () => toastMock,
}))

// El stream SSE nunca emite nada después de montar: exactamente el escenario
// de un EventSource que se reconectó y se perdió los eventos.
vi.mock('@/lib/useWhatsappStream', () => ({
  useWhatsappStream: () => ({
    status: 'ready',
    qr: null,
    lastError: null,
    campaign: null,
    resetCampaign: vi.fn(),
  }),
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      redemptions: { ...actual.api.redemptions, clientes: clientesGet },
      whatsapp: {
        ...actual.api.whatsapp,
        status: statusGet,
        campaign: campaignPost,
        campaigns: campaignsGet,
      },
    },
  }
})

/** Callbacks registrados vía `window.setInterval` durante el test (incluye el
 *  del respaldo Y el del `nowMs` de la page — invocar este último es inocuo). */
let intervalCallbacks: Array<() => void>

beforeEach(() => {
  intervalCallbacks = []
  // No dejamos que el intervalo real llegue a disparar solo (tardaría 60s de
  // verdad): capturamos el callback y lo invocamos nosotros, a mano, cuando
  // queremos simular "pasó un tick".
  vi.spyOn(window, 'setInterval').mockImplementation(((fn: () => void) => {
    intervalCallbacks.push(fn)
    return 0 as unknown as ReturnType<typeof window.setInterval>
  }) as typeof window.setInterval)
  vi.spyOn(window, 'clearInterval').mockImplementation(() => {})

  toastMock.success.mockReset()
  toastMock.error.mockReset()

  statusGet.mockResolvedValue({
    ok: true,
    status: 'ready',
    quota: { used: 0, max: 4, remaining: 4 },
  })
  clientesGet.mockResolvedValue({
    ok: true,
    clientes: [
      { nombre: 'Vecino Uno', whatsapp: '5493291234567', canjes: 1, primerCanjeAt: new Date().toISOString() },
    ],
  })
  campaignPost.mockResolvedValue({
    ok: true,
    campaign: { id: 'c-test-1', total: 1 },
    quota: { used: 1, max: 4, remaining: 3 },
  })
  // 1ª llamada (mount): historial vacío. 2ª llamada (refetch del respaldo, tras
  // el timeout): la campaña YA figura completa en Mongo (WaSend agregado).
  campaignsGet
    .mockResolvedValueOnce({ ok: true, campaigns: [] })
    .mockResolvedValue({
      ok: true,
      campaigns: [
        {
          id: 'c-test-1',
          sentAt: new Date().toISOString(),
          sentCount: 1,
          failedCount: 0,
          text: 'hola {{nombre}}',
        },
      ],
    })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdminWhatsappPage — respaldo cuando el SSE se pierde', () => {
  it('si pasan 2+ minutos sin novedades, cierra la campaña con los números REALES del historial', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AdminWhatsappPage />
      </MemoryRouter>,
    )

    // Espera a que cargue el estado "conectado" (GET /wa/status) y aparezca el
    // composer con el botón de enviar.
    const sendButton = await screen.findByRole('button', { name: /montar campaña ahora/i })
    await user.click(sendButton)

    // Confirmar el diálogo de "¿enviar ahora?"
    const confirmButton = await screen.findByRole('button', { name: /sí, enviar ahora/i })
    await user.click(confirmButton)

    // Arrancó la campaña: la UI muestra "Enviando…". Acá también quedó
    // registrado (vía el spy de arriba) el `setInterval` del respaldo.
    await screen.findByText(/enviando/i)
    expect(campaignPost).toHaveBeenCalledTimes(1)
    expect(intervalCallbacks.length).toBeGreaterThan(0)

    // Nunca llega ni un evento de progreso ni el `campaign.done` (SSE
    // perdido). Simulamos que pasaron 130s SIN que nadie tocara el reloj real:
    // mockeamos `Date.now()` para que el chequeo "hace cuánto no hay novedades"
    // (que compara contra `Date.now()`) vea que se pasó de
    // TIMEOUT_SIN_NOVEDADES_MS (2 min), y disparamos el/los intervalos a mano.
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 130_000)
    intervalCallbacks.forEach((fn) => fn())
    dateNowSpy.mockRestore()

    // El respaldo refetcheó /wa/campaigns, encontró la campaña YA completa
    // (sentCount+failedCount === total) y cerró la fase con esos números
    // reales — nunca inventados.
    await waitFor(() => expect(campaignsGet).toHaveBeenCalledTimes(2))
    await screen.findByText(/campaña enviada/i)
    expect(toastMock.success).toHaveBeenCalledWith(
      'Campaña enviada',
      expect.stringContaining('1 entregados'),
    )
  })
})
