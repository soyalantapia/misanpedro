import { Camera, Share2, Globe, MessageCircle } from 'lucide-react'
import { CardImage } from '@/components/CardImage'
import { CATEGORIAS, SERVICIOS, type Categoria, type HorariosSemana, type Servicio } from '@/lib/types'
import { isOpenNow } from '@/lib/format'

export type MicrositeData = {
  nombre: string
  categoria: Categoria
  tagline?: string | null
  descripcion?: string | null
  coverImageUrl?: string | null
  logoUrl?: string | null
  servicios?: Servicio[]
  galeria?: string[]
  productos?: { nombre: string; precio?: string | null; descripcion?: string | null }[]
  redes?: {
    instagram?: string | null
    facebook?: string | null
    web?: string | null
    whatsapp?: string | null
  }
  horariosDetalle?: HorariosSemana
}

/**
 * Vista previa (no interactiva) del micro-sitio del comercio — la "carta de
 * presentación" tal como la ve el vecino. Se usa en el panel del comercio:
 *   - en edición: en vivo desde el draft (el comercio ve cómo va quedando)
 *   - en lectura: desde el merchant guardado
 * Replica el look dark de MerchantDetailPage pero en versión compacta y sin
 * datos en vivo (cupones, mapa) — es una preview, no la ficha real.
 */
export function MicrositePreview({ data }: { data: MicrositeData }) {
  const cat = CATEGORIAS.find((c) => c.id === data.categoria)?.label ?? data.categoria
  const abierto = isOpenNow(data.horariosDetalle)
  const servicios = (data.servicios ?? [])
    .map((id) => SERVICIOS.find((s) => s.id === id))
    .filter((s): s is (typeof SERVICIOS)[number] => Boolean(s))
  const redes: { icon: typeof Camera; label: string }[] = []
  if (data.redes?.whatsapp) redes.push({ icon: MessageCircle, label: 'WhatsApp' })
  if (data.redes?.instagram) redes.push({ icon: Camera, label: 'Instagram' })
  if (data.redes?.facebook) redes.push({ icon: Share2, label: 'Facebook' })
  if (data.redes?.web) redes.push({ icon: Globe, label: 'Web' })

  return (
    <div className="overflow-hidden rounded-3xl bg-fin-bg text-fin-ink ring-1 ring-fin-line shadow-card">
      <div className="relative">
        <CardImage
          categoria={data.categoria}
          coverImageUrl={data.coverImageUrl ?? undefined}
          className="h-28 w-full"
          size="md"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-fin-bg via-fin-bg/20 to-transparent" />
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4">
        {data.logoUrl && (
          <img
            src={data.logoUrl}
            alt=""
            className="-mt-7 h-14 w-14 rounded-2xl object-cover ring-4 ring-fin-bg shadow-fin-card"
          />
        )}
        <div className={data.logoUrl ? 'flex flex-col gap-1' : 'flex flex-col gap-1 pt-3'}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-fin-lime">
              {cat}
            </span>
            {abierto !== null && (
              <span
                className={
                  abierto
                    ? 'inline-flex items-center gap-1 rounded-full bg-fin-up/15 px-2 py-0.5 text-[10px] font-bold text-fin-up'
                    : 'inline-flex items-center gap-1 rounded-full bg-fin-surface2 px-2 py-0.5 text-[10px] font-bold text-fin-soft'
                }
              >
                <span className={`h-1.5 w-1.5 rounded-full ${abierto ? 'bg-fin-up' : 'bg-fin-faint'}`} />
                {abierto ? 'Abierto ahora' : 'Cerrado ahora'}
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold leading-tight text-fin-ink">{data.nombre}</h3>
          {data.tagline && <p className="text-xs font-medium text-fin-soft">{data.tagline}</p>}
        </div>

        {data.descripcion && (
          <p className="line-clamp-3 text-xs leading-relaxed text-fin-soft">{data.descripcion}</p>
        )}

        {servicios.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {servicios.map((s) => (
              <span
                key={s.id}
                className="rounded-full bg-fin-surface2 px-2.5 py-1 text-[10px] font-bold text-fin-ink ring-1 ring-fin-line"
              >
                {s.label}
              </span>
            ))}
          </div>
        )}

        {(data.galeria?.length ?? 0) > 0 && (
          <div className="flex gap-1.5">
            {data.galeria!.slice(0, 4).map((src, i) => (
              <div
                key={i}
                className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-fin-line"
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {(data.productos?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-1">
            {data.productos!.slice(0, 3).map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-semibold text-fin-ink">{p.nombre}</span>
                {p.precio && (
                  <span className="shrink-0 font-bold tabular-nums text-fin-lime">{p.precio}</span>
                )}
              </div>
            ))}
            {data.productos!.length > 3 && (
              <span className="text-[10px] text-fin-faint">+{data.productos!.length - 3} más</span>
            )}
          </div>
        )}

        {redes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {redes.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full bg-fin-surface2 px-2.5 py-1 text-[10px] font-bold text-fin-soft ring-1 ring-fin-line"
              >
                <Icon size={11} className="text-fin-lime" /> {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
