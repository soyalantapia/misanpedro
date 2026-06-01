import { Hono } from 'hono'

export const templatesRoutes = new Hono()

/**
 * "Recetas" de cupones por rubro — el comercio arranca de una JUGADA completa,
 * no de un formulario en blanco. Cada receta trae objetivo + tipo de oferta +
 * descuento (sin miedo a lo grande) + cuándo aplica + producto gancho, listas
 * para que el asesor las precargue.
 *
 * Static (no DB) por simplicidad. Campos extra son backward-compatible: el form
 * clásico solo lee titulo/descripcion/condiciones/porcentaje/diasAplica.
 */
type CouponTemplate = {
  titulo: string
  descripcion: string
  condiciones?: string
  porcentaje: number
  diasAplica?: string
  // ─── Jugada del asesor (todo opcional) ───
  objetivo?: 'traer_nuevos' | 'llenar_flojos' | 'vaciar_stock' | 'fidelizar'
  tipoOferta?: 'porcentaje' | 'dos_por_uno' | 'precio_fijo' | 'happy_hour'
  exclusiva?: boolean
  dias?: string[]
  franjaDesde?: string
  franjaHasta?: string
  productoGancho?: string
}

const TEMPLATES: Record<string, CouponTemplate[]> = {
  gastronomia: [
    {
      titulo: '50% en pizzas los martes',
      descripcion:
        'Mitad de precio en todas las pizzas los martes a la noche, la más floja de la semana. Llenás el salón sin resignar el finde. Pediles que muestren la app al sentarse.',
      condiciones: 'Solo martes a la noche. No acumulable con otras promos.',
      porcentaje: 50,
      tipoOferta: 'porcentaje',
      objetivo: 'llenar_flojos',
      exclusiva: true,
      dias: ['mar'],
      franjaDesde: '20:00',
      franjaHasta: '23:30',
      diasAplica: 'Martes · 20 a 23:30 hs',
      productoGancho: 'pizza',
    },
    {
      titulo: '30% en el menú del mediodía',
      descripcion:
        'Menú ejecutivo y platos a la carta con 30% de lunes a viernes al mediodía. Para ganarle a la oficina de al lado y llenar las mesas del almuerzo.',
      condiciones: 'Lun a Vie · 12 a 15 hs. No incluye bebidas alcohólicas.',
      porcentaje: 30,
      tipoOferta: 'porcentaje',
      objetivo: 'llenar_flojos',
      exclusiva: true,
      dias: ['lun', 'mar', 'mie', 'jue', 'vie'],
      franjaDesde: '12:00',
      franjaHasta: '15:00',
      diasAplica: 'Lun a Vie · 12 a 15 hs',
      productoGancho: 'menú del día',
    },
  ],
  cafeteria: [
    {
      titulo: '50% en el café de 15 a 18',
      descripcion:
        'Café a mitad de precio en la franja muerta de la tarde. El vecino baja la app, viene con alguien y te llena las mesas entre el almuerzo y el after.',
      condiciones: 'Solo de 15 a 18 hs. En barra y salón.',
      porcentaje: 50,
      tipoOferta: 'porcentaje',
      objetivo: 'llenar_flojos',
      exclusiva: true,
      dias: ['lun', 'mar', 'mie', 'jue', 'vie'],
      franjaDesde: '15:00',
      franjaHasta: '18:00',
      diasAplica: 'Lun a Vie · 15 a 18 hs',
      productoGancho: 'café',
    },
    {
      titulo: '40% en medialunas después de las 18',
      descripcion:
        'Lo que queda de la tarde, fuera con 40%. En vez de tirarlo, lo vendés y el vecino vuelve por la promo de cierre.',
      condiciones: 'Desde las 18 hs y hasta agotar. Solo mostrador.',
      porcentaje: 40,
      tipoOferta: 'porcentaje',
      objetivo: 'vaciar_stock',
      exclusiva: true,
      dias: ['lun', 'mar', 'mie', 'jue', 'vie', 'sab'],
      franjaDesde: '18:00',
      franjaHasta: '20:00',
      diasAplica: 'Todos los días · desde 18 hs',
      productoGancho: 'medialunas',
    },
  ],
  panaderia: [
    {
      titulo: '40% en la última hornada',
      descripcion:
        'Pan y facturas de la última hornada con 40% antes de cerrar. No tirás nada y le das al vecino un motivo para pasar a la tarde, todos los días.',
      condiciones: 'Desde las 19 hs y hasta agotar. Solo lo de la última hornada.',
      porcentaje: 40,
      tipoOferta: 'porcentaje',
      objetivo: 'vaciar_stock',
      exclusiva: true,
      dias: ['lun', 'mar', 'mie', 'jue', 'vie', 'sab'],
      franjaDesde: '19:00',
      franjaHasta: '21:00',
      diasAplica: 'Todos los días · desde 19 hs',
      productoGancho: 'pan y facturas',
    },
    {
      titulo: 'Martes de factura: 25% la docena',
      descripcion:
        'La docena de factura con 25% todos los martes. La costumbre que hace que el vecino elija tu panadería y no la de la otra cuadra.',
      condiciones: 'Solo martes. Docena surtida.',
      porcentaje: 25,
      tipoOferta: 'porcentaje',
      objetivo: 'fidelizar',
      exclusiva: true,
      dias: ['mar'],
      diasAplica: 'Martes · todo el día',
      productoGancho: 'docena de facturas',
    },
  ],
  supermercado: [
    {
      titulo: 'Martes de mandado: 15% en todo',
      descripcion:
        'El mandado del martes con 15% en todo el local. La jugada de costumbre semanal: el vecino arma su rutina alrededor de tu descuento.',
      condiciones: 'Solo martes. No acumulable con otras promos. Excluye recargas y cigarrillos.',
      porcentaje: 15,
      tipoOferta: 'porcentaje',
      objetivo: 'fidelizar',
      exclusiva: true,
      dias: ['mar'],
      diasAplica: 'Martes · todo el día',
      productoGancho: 'el mandado',
    },
    {
      titulo: '25% en frutas y verduras los lunes',
      descripcion:
        'Arrancá la semana moviendo la verdulería con 25% los lunes. Producto que rota rápido y te trae al vecino antes de la compra grande.',
      condiciones: 'Solo lunes. Hasta agotar stock del día.',
      porcentaje: 25,
      tipoOferta: 'porcentaje',
      objetivo: 'llenar_flojos',
      exclusiva: true,
      dias: ['lun'],
      diasAplica: 'Lunes · todo el día',
      productoGancho: 'frutas y verduras',
    },
  ],
  kiosco: [
    {
      titulo: '50% en gaseosas el finde',
      descripcion:
        'Gaseosas a mitad de precio, sábados y domingos. La promo que hace que el vecino cruce a tu kiosco y no al de enfrente.',
      condiciones: 'Sáb y Dom. Línea seleccionada. Hasta agotar stock.',
      porcentaje: 50,
      tipoOferta: 'porcentaje',
      objetivo: 'traer_nuevos',
      exclusiva: true,
      dias: ['sab', 'dom'],
      diasAplica: 'Sábados y domingos',
      productoGancho: 'gaseosas',
    },
    {
      titulo: '20% en golosinas a la salida del cole',
      descripcion:
        'Golosinas con 20% de 16 a 18, la hora pico de los chicos. Convertís el movimiento de la tarde en clientes que vuelven.',
      condiciones: 'Lun a Vie · 16 a 18 hs.',
      porcentaje: 20,
      tipoOferta: 'porcentaje',
      objetivo: 'llenar_flojos',
      exclusiva: true,
      dias: ['lun', 'mar', 'mie', 'jue', 'vie'],
      franjaDesde: '16:00',
      franjaHasta: '18:00',
      diasAplica: 'Lun a Vie · 16 a 18 hs',
      productoGancho: 'golosinas',
    },
  ],
  farmacia: [
    {
      titulo: '20% en perfumería los lunes',
      descripcion:
        'Perfumería y cuidado personal con 20% los lunes. Movés la góndola que más margen deja en el día más flojo, sin tocar medicamentos.',
      condiciones: 'Solo lunes. No incluye medicamentos recetados ni de venta libre.',
      porcentaje: 20,
      tipoOferta: 'porcentaje',
      objetivo: 'llenar_flojos',
      exclusiva: true,
      dias: ['lun'],
      diasAplica: 'Lunes · todo el día',
      productoGancho: 'perfumería',
    },
    {
      titulo: '25% en dermocosmética con la app',
      descripcion:
        'Línea de dermocosmética con 25% mostrando la app. Exclusivo de Mi San Pedro: le das al vecino la razón para bajar la app y volver.',
      condiciones: 'Solo presentando la app. No incluye medicamentos.',
      porcentaje: 25,
      tipoOferta: 'porcentaje',
      objetivo: 'fidelizar',
      exclusiva: true,
      diasAplica: 'Todos los días',
      productoGancho: 'dermocosmética',
    },
  ],
  belleza: [
    {
      titulo: '30% en color los martes y miércoles',
      descripcion:
        'Coloración con 30% los días flojos de la semana. Llenás la agenda de martes y miércoles, que normalmente quedan vacíos.',
      condiciones: 'Solo con turno previo, martes y miércoles. No incluye corte.',
      porcentaje: 30,
      tipoOferta: 'porcentaje',
      objetivo: 'llenar_flojos',
      exclusiva: true,
      dias: ['mar', 'mie'],
      diasAplica: 'Mar y Mié · con turno',
      productoGancho: 'coloración',
    },
    {
      titulo: '40% en tu primer tratamiento facial',
      descripcion:
        'Primer facial con 40% para clientas nuevas. Descuento agresivo de entrada: si el trabajo es bueno, vuelven a precio lleno.',
      condiciones: 'Solo clientas nuevas, con turno. Una vez por persona.',
      porcentaje: 40,
      tipoOferta: 'porcentaje',
      objetivo: 'traer_nuevos',
      exclusiva: true,
      diasAplica: 'Mar a Sáb · con turno',
      productoGancho: 'tratamiento facial',
    },
  ],
  indumentaria: [
    {
      titulo: 'Liquidá temporada: 40% en lo marcado',
      descripcion:
        'Selección de temporada pasada con 40%. Hacés caja con lo que no rota y liberás espacio para lo nuevo. Marcá las prendas con el sticker.',
      condiciones: 'Hasta agotar stock. Solo prendas marcadas. No acumulable.',
      porcentaje: 40,
      tipoOferta: 'porcentaje',
      objetivo: 'vaciar_stock',
      exclusiva: true,
      diasAplica: 'Lun a Sáb · horario comercial',
      productoGancho: 'temporada pasada',
    },
  ],
  hogar: [
    {
      titulo: '30% en deco de lunes a jueves',
      descripcion:
        'Cortinas, almohadones y deco con 30% los días de semana. Movés el local en los días que nadie entra, sin resignar el finde.',
      condiciones: 'Lun a Jue. Hasta agotar stock. No acumulable con liquidaciones.',
      porcentaje: 30,
      tipoOferta: 'porcentaje',
      objetivo: 'llenar_flojos',
      exclusiva: true,
      dias: ['lun', 'mar', 'mie', 'jue'],
      diasAplica: 'Lun a Jue · horario comercial',
      productoGancho: 'deco y textil',
    },
  ],
  salud: [
    {
      titulo: '20% en cuidado personal',
      descripcion:
        'Cremas, jabones, shampoos y cuidado diario con 20%. La línea que el vecino repone seguido: lo enganchás para que vuelva.',
      condiciones: 'No incluye medicamentos recetados.',
      porcentaje: 20,
      tipoOferta: 'porcentaje',
      objetivo: 'fidelizar',
      exclusiva: true,
      diasAplica: 'Lun a Vie · hasta 20 hs',
      productoGancho: 'cuidado personal',
    },
  ],
  servicios: [
    {
      titulo: '30% OFF en tu primera vez',
      descripcion:
        'Primera consulta o servicio con 30% para clientes nuevos. Descuento de entrada fuerte: el objetivo es que prueben y se queden.',
      condiciones: 'Solo nuevos clientes, con turno. Una vez por persona.',
      porcentaje: 30,
      tipoOferta: 'porcentaje',
      objetivo: 'traer_nuevos',
      exclusiva: true,
      diasAplica: 'Lun a Vie · con turno',
      productoGancho: 'primera consulta',
    },
  ],
  inmobiliaria: [
    {
      titulo: '15% OFF en honorarios de alquiler',
      descripcion:
        'Honorarios de gestión de alquiler con 15% para nuevos inquilinos que llegan por la app.',
      condiciones: 'Contratos nuevos firmados durante la vigencia del cupón.',
      porcentaje: 15,
      tipoOferta: 'porcentaje',
      objetivo: 'traer_nuevos',
      exclusiva: true,
      productoGancho: 'gestión de alquiler',
    },
  ],
}

templatesRoutes.get('/coupons/:categoria', (c) => {
  const cat = c.req.param('categoria')
  const templates = TEMPLATES[cat] ?? []
  return c.json({ ok: true, templates })
})
