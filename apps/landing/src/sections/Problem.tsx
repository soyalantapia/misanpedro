import { FileText, MegaphoneOff, Ban } from 'lucide-react'

const PAINS = [
  {
    icon: FileText,
    title: 'Volantes que terminan en la basura',
    body: 'Imprimís 500 flyers, repartís 300, te llegan 4 personas. El otro 99% va directo al tacho.',
  },
  {
    icon: MegaphoneOff,
    title: 'Instagram que sólo ven el 5%',
    body: 'Subís una promo. El algoritmo decide que tus seguidores no la vean. Pagás publicidad. Te llegan likes pero no clientes.',
  },
  {
    icon: Ban,
    title: 'WhatsApp masivo que Meta te bloquea',
    body: 'Mandás un mensaje a 50 contactos. Meta detecta spam. Te suspenden la cuenta. Perdés el contacto con todos.',
  },
] as const

export function Problem() {
  return (
    <section className="px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-danger">El problema</span>
        <h2 className="mt-3 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl">
          Tus clientes vienen,
          <br />
          compran y se olvidan que existís
        </h2>
        <p className="mt-6 text-pretty text-lg leading-relaxed text-neutral-600">
          Carlos vino el martes. Marta el viernes. Vos los atendiste, les sonreíste, les
          diste el ticket. Pero hoy no sabés sus nombres, no tenés su teléfono, y la
          próxima vez que ellos piensen en pizza, en tinte o en una planta, no van a
          pensar en vos.
        </p>
      </div>

      <div className="mx-auto mt-16 grid max-w-5xl gap-5 sm:grid-cols-3">
        {PAINS.map((p) => (
          <div
            key={p.title}
            className="group rounded-2xl bg-white p-6 ring-1 ring-neutral-200 transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            <span className="inline-grid h-10 w-10 place-items-center rounded-xl bg-danger-bg text-danger transition-transform group-hover:scale-110">
              <p.icon size={18} />
            </span>
            <h3 className="mt-5 font-bold text-neutral-900">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
