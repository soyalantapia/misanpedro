import { AnimatedSection } from '@/components/AnimatedSection'

/**
 * Tickets de un día cualquiera. Los números son de ILUSTRACIÓN y describen la
 * situación SIN la plataforma (el problema que ya cuenta el H2), no un resultado
 * de usarla: no hay ninguna promesa acá. Por eso el pie aclara "así es hoy".
 */
const TICKETS = [
  { hora: '09:40', monto: '$4.200' },
  { hora: '12:15', monto: '$8.900' },
  { hora: '17:30', monto: '$3.100' },
  { hora: '20:05', monto: '$6.400' },
]

export function Agitate() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-accent-50 via-white to-accent-100 px-6 py-14 sm:py-16">
      <div className="pointer-events-none absolute -top-32 left-1/3 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-accent-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-[400px] w-[700px] rounded-full bg-accent-100 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_minmax(0,380px)] lg:gap-14">
        <AnimatedSection className="text-center lg:text-left">
          <h2 className="text-balance text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-neutral-900">
            Hoy atendiste 80 personas. ¿Cuántas vuelven{' '}
            <span className="bg-gradient-to-br from-accent-500 to-accent-700 bg-clip-text text-transparent">
              mañana
            </span>
            ?
          </h2>
          <p className="mt-6 text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg">
            Vos no sabés. Y por eso ellas tampoco vuelven. El olvido es mutuo, y cada
            cliente que se olvida es plata que se va.
          </p>
        </AnimatedSection>

        <AnimatedSection variant="media" delay={120}>
          <TicketsAnonimos />
        </AnimatedSection>
      </div>
    </section>
  )
}

/**
 * El costado del banner: la caja de un día, con la plata que entró y sin una sola
 * persona identificada. Es una ILUSTRACIÓN del problema, no una pantalla del
 * producto (por eso no lleva chrome de navegador, a diferencia del mockup del Hero).
 */
function TicketsAnonimos() {
  return (
    <figure className="relative mx-auto w-full max-w-sm lg:max-w-none">
      <div className="pointer-events-none absolute inset-x-8 -bottom-5 h-10 rounded-full bg-neutral-900/15 blur-2xl" />

      <div className="relative rounded-2xl bg-white p-5 shadow-xl ring-1 ring-neutral-900/10 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
          Los que pasaron hoy por tu caja
        </p>

        <ul className="mt-4 space-y-2">
          {TICKETS.map((t) => (
            <li
              key={t.hora}
              className="flex items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2.5 ring-1 ring-neutral-200"
            >
              <span
                aria-hidden
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-500"
              >
                ?
              </span>
              <span className="sr-only">Cliente sin nombre</span>
              {/* La barra gris ocupa el lugar donde iría el nombre: el vacío ES el mensaje. */}
              <span aria-hidden className="h-2.5 flex-1 rounded-full bg-neutral-200" />
              <span className="text-[11px] tabular-nums text-neutral-500">{t.hora}</span>
              <span className="text-xs font-bold tabular-nums text-neutral-700">{t.monto}</span>
            </li>
          ))}
          <li className="pt-1 text-center text-[11px] font-semibold text-neutral-400">
            y 76 más
          </li>
        </ul>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-200 pt-4">
          <div>
            <p className="text-2xl font-bold tabular-nums text-neutral-900">80</p>
            <p className="text-[11px] leading-snug text-neutral-500">personas atendidas</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-danger">0</p>
            <p className="text-[11px] leading-snug text-neutral-500">
              que podés invitar a volver
            </p>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 text-center text-[11px] text-neutral-500 lg:text-left">
        Así es un día hoy, sin ninguna herramienta.
      </figcaption>
    </figure>
  )
}
