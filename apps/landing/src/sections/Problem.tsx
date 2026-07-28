import {
  FileText,
  MegaphoneOff,
  UserX,
} from 'lucide-react'
import { AnimatedSection } from '@/components/AnimatedSection'
import { Stagger } from '@/components/Stagger'

const PAINS = [
  {
    icon: FileText,
    title: 'Volantes que terminan en la basura',
    body: 'Imprimís 500 flyers, repartís 300, te llegan 4 personas. El otro 99% va directo al tacho.',
  },
  {
    icon: MegaphoneOff,
    title: 'Instagram que solo ven el 5%',
    body: 'Subís una promo. El algoritmo decide que tus seguidores no la vean. Pagás publicidad. Te llegan likes pero no clientes.',
  },
  {
    icon: UserX,
    title: 'No sabés quiénes son tus clientes',
    body: 'Atendés a 80 personas por día. Ni un nombre. Ni un cumpleaños. Ni un teléfono. Cada cliente entra y sale anónimo.',
  },
] as const

export function Problem() {
  return (
    <section className="px-6 py-16 sm:py-20">
      <AnimatedSection className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-danger">
          El problema
        </span>
        <h2 className="mt-3 text-balance text-[length:var(--text-h2-soporte)] font-bold leading-[1.15] tracking-tight text-neutral-900">
          Tus clientes vienen,
          <br className="hidden sm:inline" />
          {' '}compran y se olvidan que existís
        </h2>
        <p className="mt-6 text-pretty text-lg leading-relaxed text-neutral-600">
          Carlos vino el martes. Marta el viernes. Vos los atendiste, les sonreíste,
          les diste el ticket. Pero hoy no sabés sus nombres, no tenés su teléfono,
          y la próxima vez que ellos piensen en pizza, en tinte o en una planta,
          no van a pensar en vos.
        </p>
      </AnimatedSection>

      {/* FORMATO EDITORIAL, no tarjetas (/design-review 26/07): SocialProof, Problema,
          Solución y Funciones usaban las CUATRO el mismo layout de grilla + ícono en
          caja de color + título + 2 líneas — el anti-patrón AI más reconocible, cuatro
          veces seguidas. El problema se lee mejor como una lista de dolores separados
          por una regla: es una enumeración, no un catálogo de features. */}
      <Stagger variant="lead" className="mx-auto mt-12 max-w-3xl divide-y divide-neutral-200">
        {PAINS.map((p) => (
          <article
            key={p.title}
            className="flex items-start gap-4 py-6 first:pt-0 last:pb-0"
          >
            <p.icon size={20} className="mt-0.5 shrink-0 text-danger" aria-hidden />
            <div>
              <h3 className="text-[length:var(--text-card)] font-bold leading-snug text-neutral-900">
                {p.title}
              </h3>
              <p className="mt-1.5 text-pretty leading-relaxed text-neutral-600">{p.body}</p>
            </div>
          </article>
        ))}
      </Stagger>
    </section>
  )
}
