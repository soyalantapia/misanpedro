/**
 * ¿Qué se le muestra al vecino por una activación de su billetera?
 *
 * El catálogo que consultan las pantallas (`useApiCoupons`) trae SOLO los cupones
 * activos y vigentes. Si el comercio borra o pausa el cupón, la activación del
 * vecino deja de resolver contra ese catálogo, y las pantallas asumían que eso no
 * podía pasar:
 *
 *  · MisCuponesPage devolvía `<div className="animate-pulse">` — un esqueleto gris
 *    latiendo para siempre, como si estuviera cargando algo que nunca iba a llegar.
 *  · CuponActivoPage devolvía `<Navigate to="/" replace />` — al tocar su propio
 *    cupón el vecino salía disparado al inicio, sin ningún mensaje, y como el botón
 *    de cancelar está más abajo en esa misma pantalla, tampoco podía sacárselo.
 *
 * El dato para resolverlo ya viaja: la activación trae el snapshot del cupón y del
 * comercio (`couponTitulo`, `merchantNombre`…). CanjeadosPage ya lo usaba como
 * fallback (`c?.titulo ?? r.couponTitulo`); estas dos pantallas quedaron sin él.
 * Esta función centraliza esa decisión para que no se vuelva a olvidar en la
 * próxima pantalla que liste activaciones. [cazabug loop2]
 */

export type DatosCupon = { titulo: string; porcentaje: number; merchantId: string } | undefined
export type DatosComercio = { nombre: string; categoria?: string } | undefined

export type ActivacionConSnapshot = {
  couponTitulo?: string
  couponPorcentaje?: number
  merchantNombre?: string
  merchantCategoria?: string
}

export type VistaActivacion =
  /** Todavía no sabemos: el catálogo está en vuelo. Acá SÍ corresponde un esqueleto. */
  | { tipo: 'cargando' }
  /** Ni catálogo ni snapshot. Activaciones viejas, de antes de que el snapshot se
   *  escribiera al activar. No hay nada honesto que mostrar más que el código. */
  | { tipo: 'sin-datos' }
  | {
      tipo: 'lista'
      titulo: string
      porcentaje: number
      merchantNombre: string
      /** Slug del comercio, si el catálogo lo resolvió (para linkear al comercio). */
      merchantSlug?: string
      /** ¿El cupón sigue existiendo y ofertándose? Si es false, ofrecer
       *  "reactivar" es mentirle: el backend responde "cupón no disponible". */
      cuponVigente: boolean
    }

export function verActivacion(input: {
  cupon: DatosCupon
  comercio: DatosComercio
  activacion: ActivacionConSnapshot
  catalogoCargando: boolean
}): VistaActivacion {
  const { cupon, comercio, activacion, catalogoCargando } = input

  // El catálogo resolvió: es la fuente viva, gana sobre el snapshot (el comercio
  // pudo haber editado el título o el porcentaje después de la activación).
  if (cupon && comercio) {
    return {
      tipo: 'lista',
      titulo: cupon.titulo,
      porcentaje: cupon.porcentaje,
      merchantNombre: comercio.nombre,
      merchantSlug: cupon.merchantId,
      cuponVigente: true,
    }
  }

  // Sin catálogo todavía y sin snapshot: no sabemos si falta el dato o si el cupón
  // desapareció. Esperar es lo correcto.
  if (catalogoCargando && !activacion.couponTitulo) return { tipo: 'cargando' }

  if (activacion.couponTitulo && activacion.merchantNombre) {
    return {
      tipo: 'lista',
      titulo: activacion.couponTitulo,
      porcentaje: activacion.couponPorcentaje ?? 0,
      merchantNombre: activacion.merchantNombre,
      merchantSlug: undefined,
      cuponVigente: false,
    }
  }

  if (catalogoCargando) return { tipo: 'cargando' }
  return { tipo: 'sin-datos' }
}
