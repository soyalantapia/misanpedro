import { Hono } from 'hono'

export const templatesRoutes = new Hono()

/**
 * Templates de cupones por categoría — el comercio puede usarlos como punto
 * de partida en lugar de empezar de cero. Static (no DB) por simplicidad.
 */
const TEMPLATES: Record<string, Array<{ titulo: string; descripcion: string; condiciones?: string; porcentaje: number; diasAplica?: string }>> = {
  gastronomia: [
    {
      titulo: '20% OFF en almuerzo de día de semana',
      descripcion:
        'Menú ejecutivo o platos a la carta con 20% de descuento de lunes a viernes al mediodía. Perfecto para oficinistas y vecinos del barrio.',
      condiciones: 'Lun a Vie · 12 a 15 hs. No incluye bebidas alcohólicas.',
      porcentaje: 20,
      diasAplica: 'Lun a Vie · 12 a 15 hs',
    },
    {
      titulo: '15% en cafés de barra y desayunos',
      descripcion:
        'Café especialidad, lágrima, capuccino y combinados de desayuno. Aplica en barra, antes del mediodía.',
      condiciones: 'Antes de las 12 hs. No incluye bebidas frías.',
      porcentaje: 15,
      diasAplica: 'Mar a Dom · 8 a 12 hs',
    },
    {
      titulo: '25% en pastas caseras los miércoles',
      descripcion:
        'Pastas caseras con salsa a elección. Sorrentinos, raviolones, tallarines, ñoquis. Por persona.',
      condiciones: 'Solo miércoles. No acumulable con otras promos.',
      porcentaje: 25,
      diasAplica: 'Miércoles · todo el día',
    },
  ],
  belleza: [
    {
      titulo: '20% en corte + brushing',
      descripcion:
        'Corte y peinado con producto de styling incluido. Para todo tipo de cabello. Reservar con turno.',
      condiciones: 'Solo con turno previo. No incluye coloración.',
      porcentaje: 20,
      diasAplica: 'Mar a Sáb · con turno',
    },
    {
      titulo: '30% en tratamiento facial premium',
      descripcion:
        'Limpieza profunda, hidratación y masaje facial relajante. 60 minutos. Productos hipoalergénicos.',
      condiciones: 'Solo con turno previo. Válido para clientes nuevos del mes.',
      porcentaje: 30,
      diasAplica: 'Mar a Sáb · con turno',
    },
  ],
  indumentaria: [
    {
      titulo: '25% en colección de temporada',
      descripcion:
        'Selección curada de prendas marcadas con sticker MSP. Camperas, sweaters, pantalones y accesorios.',
      condiciones: 'Hasta agotar stock. Sólo prendas marcadas.',
      porcentaje: 25,
      diasAplica: 'Lun a Sáb · horario comercial',
    },
  ],
  salud: [
    {
      titulo: '10% en cuidado personal',
      descripcion:
        'Línea de cremas, jabones, shampoos, desodorantes y productos de cuidado diario.',
      condiciones: 'No incluye medicamentos recetados.',
      porcentaje: 10,
      diasAplica: 'Lun a Vie · hasta 20 hs',
    },
  ],
  servicios: [
    {
      titulo: '15% en servicio de turno',
      descripcion:
        'Cualquier servicio reservado con turno: revisión, mantenimiento, control general. Asesoramiento incluido.',
      condiciones: 'Sólo turnos lunes a jueves. Excluye repuestos importados.',
      porcentaje: 15,
      diasAplica: 'Lun a Jue · con turno',
    },
  ],
  hogar: [
    {
      titulo: '20% en deco y textil',
      descripcion:
        'Cortinas, almohadones, alfombras y accesorios de decoración. Selección curada de productos nacionales.',
      condiciones: 'Hasta agotar stock. No acumulable con liquidaciones.',
      porcentaje: 20,
      diasAplica: 'Lun a Sáb · horario comercial',
    },
  ],
}

templatesRoutes.get('/coupons/:categoria', (c) => {
  const cat = c.req.param('categoria')
  const templates = TEMPLATES[cat] ?? []
  return c.json({ ok: true, templates })
})
