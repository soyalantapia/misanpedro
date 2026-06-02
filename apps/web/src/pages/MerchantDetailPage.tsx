import { lazy, Suspense } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  MapPin,
  Phone,
  Clock,
  ExternalLink,
  Navigation,
  Camera,
  Share2,
  Globe,
  MessageCircle,
} from 'lucide-react'
import { CardImage } from '@/components/CardImage'
import { CouponCard } from '@/components/CouponCard'
import { useCouponsByMerchant } from '@/lib/couponsStore'
import { useMerchant } from '@/lib/merchantsStore'
import { CATEGORIAS, SERVICIOS, type Categoria, type Coupon, type Merchant } from '@/lib/types'
import { formatHorariosSemana, isOpenNow } from '@/lib/format'
import { useApiMerchant } from '@/lib/apiQueries'

const MiniMap = lazy(() => import('@/components/MiniMap'))

/** Instagram: aceptamos handle o URL y construimos un href SEGURO nosotros
 *  (el valor es texto libre del comercio, nunca lo metemos crudo en href). */
function instagramHref(v?: string | null): string | null {
  if (!v) return null
  const handle = v
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[^A-Za-z0-9._].*$/, '')
  return handle ? `https://instagram.com/${handle}` : null
}

/** WhatsApp: dejamos solo dígitos y armamos el link de wa.me. */
function whatsappHref(v?: string | null): string | null {
  if (!v) return null
  const digits = v.replace(/\D/g, '')
  return digits.length >= 8 ? `https://wa.me/${digits}` : null
}

export function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const localMerchant = useMerchant(id)
  const localCoupons = useCouponsByMerchant(id ?? '')
  const apiRes = useApiMerchant(id)
  const apiMerchant = apiRes.data?.merchant ?? null
  const apiCoupons = apiRes.data?.coupons ?? null

  const merchant: Merchant | undefined = apiMerchant
    ? {
        id: apiMerchant.slug,
        nombre: apiMerchant.nombre,
        categoria: apiMerchant.categoria as Categoria,
        direccion: apiMerchant.direccion,
        lat: apiMerchant.lat ?? 0,
        lng: apiMerchant.lng ?? 0,
        telefono: apiMerchant.telefono,
        horarios: apiMerchant.horarios,
        horariosDetalle: apiMerchant.horariosDetalle,
        cover: apiMerchant.cover,
        coverImageUrl: apiMerchant.coverImageUrl,
        logoUrl: apiMerchant.logoUrl,
        mapsUrl: apiMerchant.mapsUrl,
        logoSeed: apiMerchant.logoSeed,
        destacado: apiMerchant.destacado,
        tagline: apiMerchant.tagline,
        descripcion: apiMerchant.descripcion,
        servicios: apiMerchant.servicios as Merchant['servicios'],
        galeria: apiMerchant.galeria,
        productos: apiMerchant.productos,
        redes: apiMerchant.redes ?? undefined,
      }
    : localMerchant

  const coupons: Coupon[] = apiCoupons
    ? apiCoupons.map((c: any) => ({
        id: c.id,
        merchantId: apiMerchant?.slug ?? id ?? '',
        titulo: c.titulo,
        descripcion: c.descripcion,
        condiciones: c.condiciones ?? '',
        porcentaje: c.porcentaje,
        vigenciaHasta: c.vigenciaHasta,
        imagenSeed: 'custom',
        estado: c.estado as Coupon['estado'],
        diasAplica: c.diasAplica,
      }))
    : localCoupons.filter((c) => c.estado === 'activo')

  if (!merchant && !apiRes.loading) return <Navigate to="/" replace />
  if (!merchant) return null

  const cat = CATEGORIAS.find((c) => c.id === merchant.categoria)?.label ?? merchant.categoria
  const mapsUrl =
    merchant.mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${merchant.nombre}, ${merchant.direccion}`)}`
  const horariosDisplay = formatHorariosSemana(merchant.horariosDetalle) || merchant.horarios
  const abierto = isOpenNow(merchant.horariosDetalle)
  const servicios = (merchant.servicios ?? [])
    .map((id) => SERVICIOS.find((s) => s.id === id))
    .filter((s): s is (typeof SERVICIOS)[number] => Boolean(s))
  const galeria = merchant.galeria ?? []
  const productos = merchant.productos ?? []
  const wa = whatsappHref(merchant.redes?.whatsapp)
  const ig = instagramHref(merchant.redes?.instagram)
  const fb = merchant.redes?.facebook || null
  const web = merchant.redes?.web || null
  const hasCoords = Boolean(merchant.lat && merchant.lng)

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-2xl flex-col">
      <div className="relative">
        <CardImage
          categoria={merchant.categoria}
          coverImageUrl={merchant.coverImageUrl}
          className="h-44 w-full sm:h-56"
          size="lg"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-fin-bg via-fin-bg/20 to-transparent" />
        <Link
          to="/"
          aria-label="Volver"
          className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-fin-bg/80 text-fin-ink shadow-fin-card backdrop-blur transition-all hover:-translate-y-0.5"
        >
          <ChevronLeft size={20} />
        </Link>
      </div>

      <div className="flex flex-col gap-6 px-4 pb-12 sm:px-6">
        <header className={`flex flex-col gap-2 ${merchant.logoUrl ? '-mt-10' : 'pt-4'}`}>
          {merchant.logoUrl && (
            <img
              src={merchant.logoUrl}
              alt={`Logo de ${merchant.nombre}`}
              className="h-20 w-20 rounded-2xl object-cover ring-4 ring-fin-bg shadow-fin-card"
            />
          )}
          <div className="mt-1 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-fin-lime">{cat}</p>
              {abierto !== null && (
                <span
                  className={
                    abierto
                      ? 'inline-flex items-center gap-1 rounded-full bg-fin-up/15 px-2 py-0.5 text-[11px] font-bold text-fin-up'
                      : 'inline-flex items-center gap-1 rounded-full bg-fin-surface2 px-2 py-0.5 text-[11px] font-bold text-fin-soft'
                  }
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${abierto ? 'bg-fin-up' : 'bg-fin-faint'}`}
                  />
                  {abierto ? 'Abierto ahora' : 'Cerrado ahora'}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-fin-ink sm:text-4xl">
              {merchant.nombre}
            </h1>
            {merchant.tagline && (
              <p className="text-sm font-medium text-fin-soft">{merchant.tagline}</p>
            )}
          </div>
        </header>

        {(wa || merchant.telefono || hasCoords) && (
          <div className="flex flex-wrap gap-2">
            {wa && (
              <QuickAction href={wa} icon={MessageCircle} label="WhatsApp" primary />
            )}
            {merchant.telefono && (
              <QuickAction
                href={`tel:${merchant.telefono.replace(/\s/g, '')}`}
                icon={Phone}
                label="Llamar"
              />
            )}
            <QuickAction href={mapsUrl} icon={Navigation} label="Cómo llegar" external />
          </div>
        )}

        {merchant.descripcion && (
          <Section title="Sobre el comercio">
            <p className="whitespace-pre-line text-sm leading-relaxed text-fin-soft">
              {merchant.descripcion}
            </p>
          </Section>
        )}

        {servicios.length > 0 && (
          <Section title="Servicios">
            <div className="flex flex-wrap gap-2">
              {servicios.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full bg-fin-surface2 px-3 py-1.5 text-xs font-bold text-fin-ink ring-1 ring-fin-line"
                >
                  {s.label}
                </span>
              ))}
            </div>
          </Section>
        )}

        {productos.length > 0 && (
          <Section title="Productos destacados">
            <div className="flex flex-col gap-2">
              {productos.map((p, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-fin-surface p-3.5 ring-1 ring-fin-line"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-fin-ink">{p.nombre}</p>
                    {p.descripcion && (
                      <p className="mt-0.5 text-xs leading-snug text-fin-soft">{p.descripcion}</p>
                    )}
                  </div>
                  {p.precio && (
                    <span className="shrink-0 rounded-full bg-fin-surface2 px-2.5 py-1 text-xs font-bold text-fin-lime tabular-nums ring-1 ring-fin-line">
                      {p.precio}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {galeria.length > 0 && (
          <Section title="Fotos">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {galeria.map((src, i) => (
                <div
                  key={i}
                  className="aspect-square overflow-hidden rounded-2xl ring-1 ring-fin-line"
                >
                  <img
                    src={src}
                    alt={`Foto de ${merchant.nombre}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Descuentos disponibles">
          {coupons.length === 0 ? (
            <p className="rounded-2xl bg-fin-surface2 p-5 text-center text-sm text-fin-soft">
              Este comercio no tiene descuentos activos en este momento.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {coupons.map((c, i) => (
                <CouponCard key={c.id} coupon={c} merchant={merchant} index={i} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Dónde y cuándo">
          <div className="flex flex-col gap-3 rounded-2xl bg-fin-surface p-4 ring-1 ring-fin-line shadow-fin-card text-sm text-fin-soft">
            <Row icon={MapPin}>{merchant.direccion}</Row>
            {horariosDisplay && <Row icon={Clock}>{horariosDisplay}</Row>}
          </div>
          {hasCoords && (
            <div className="mt-3">
              <Suspense
                fallback={
                  <div className="h-[200px] animate-pulse rounded-2xl bg-fin-surface2 ring-1 ring-fin-line" />
                }
              >
                <MiniMap lat={merchant.lat} lng={merchant.lng} />
              </Suspense>
            </div>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-fin-lime hover:text-fin-lime2"
          >
            Abrir en Google Maps <ExternalLink size={12} />
          </a>
        </Section>

        {(merchant.telefono || wa || ig || fb || web) && (
          <Section title="Contacto y redes">
            <div className="flex flex-col gap-2">
              {merchant.telefono && (
                <LinkRow
                  icon={Phone}
                  href={`tel:${merchant.telefono.replace(/\s/g, '')}`}
                  label={merchant.telefono}
                />
              )}
              {wa && <LinkRow icon={MessageCircle} href={wa} label="Escribir por WhatsApp" external />}
              {ig && <LinkRow icon={Camera} href={ig} label="Instagram" external />}
              {fb && <LinkRow icon={Share2} href={fb} label="Facebook" external />}
              {web && <LinkRow icon={Globe} href={web} label="Sitio web" external />}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-fin-faint">
        {title}
      </h2>
      {children}
    </section>
  )
}

function QuickAction({
  href,
  icon: Icon,
  label,
  primary,
  external,
}: {
  href: string
  icon: typeof Phone
  label: string
  primary?: boolean
  external?: boolean
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      className={
        primary
          ? 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-fin-lime px-4 py-3 text-sm font-bold text-fin-bg shadow-fin-glow transition-all hover:-translate-y-0.5'
          : 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-fin-surface2 px-4 py-3 text-sm font-bold text-fin-ink ring-1 ring-fin-line transition-all hover:-translate-y-0.5'
      }
    >
      <Icon size={16} /> {label}
    </a>
  )
}

function LinkRow({
  icon: Icon,
  href,
  label,
  external,
}: {
  icon: typeof Phone
  href: string
  label: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      className="flex items-center gap-2.5 rounded-2xl bg-fin-surface p-3 text-sm font-medium text-fin-ink ring-1 ring-fin-line transition-colors hover:text-fin-lime"
    >
      <Icon size={15} className="shrink-0 text-fin-lime" />
      <span className="truncate">{label}</span>
      {external && <ExternalLink size={12} className="ml-auto shrink-0 text-fin-faint" />}
    </a>
  )
}

function Row({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="mt-0.5 shrink-0 text-fin-faint" />
      <span>{children}</span>
    </div>
  )
}
