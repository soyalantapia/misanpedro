import { describe, it, expect } from 'vitest'
import { verActivacion } from './activacionVista'

// [cazabug loop2] El cupón borrado/pausado dejaba al vecino con una tarjeta muda.
//
// MisCuponesPage: `if (!c || !m) return <div className="animate-pulse">` — un
// esqueleto gris latiendo para siempre. CuponActivoPage: `<Navigate to="/" />` —
// lo expulsaba al inicio sin decirle nada, y el botón de cancelar vive DEBAJO de
// ese guard, así que tampoco podía deshacerse del código.

const cupon = { titulo: '20% en pizzas', porcentaje: 20, merchantId: 'pizzeria' }
const comercio = { nombre: 'Pizzería Don Luis', categoria: 'gastronomia' }
const conSnapshot = {
  couponTitulo: '20% en pizzas',
  couponPorcentaje: 20,
  merchantNombre: 'Pizzería Don Luis',
  merchantCategoria: 'gastronomia',
}

describe('verActivacion', () => {
  it('con el cupón en catálogo muestra el dato vivo y permite reactivar', () => {
    const v = verActivacion({ cupon, comercio, activacion: conSnapshot, catalogoCargando: false })
    expect(v).toMatchObject({ tipo: 'lista', titulo: '20% en pizzas', cuponVigente: true })
  })

  it('el catálogo gana sobre el snapshot: el comercio pudo editar el cupón después', () => {
    const v = verActivacion({
      cupon: { ...cupon, titulo: '30% en pizzas', porcentaje: 30 },
      comercio,
      activacion: conSnapshot,
      catalogoCargando: false,
    })
    expect(v).toMatchObject({ titulo: '30% en pizzas', porcentaje: 30 })
  })

  it('🔴 cupón borrado: muestra la tarjeta con el snapshot, no un esqueleto', () => {
    const v = verActivacion({
      cupon: undefined,
      comercio: undefined,
      activacion: conSnapshot,
      catalogoCargando: false,
    })
    expect(v).toMatchObject({
      tipo: 'lista',
      titulo: '20% en pizzas',
      merchantNombre: 'Pizzería Don Luis',
    })
  })

  it('🔴 con el cupón borrado NO promete reactivar (el backend lo rechaza)', () => {
    const v = verActivacion({
      cupon: undefined,
      comercio: undefined,
      activacion: conSnapshot,
      catalogoCargando: false,
    })
    expect(v.tipo === 'lista' && v.cuponVigente).toBe(false)
  })

  it('el esqueleto queda SOLO para la espera real del catálogo', () => {
    const v = verActivacion({
      cupon: undefined,
      comercio: undefined,
      activacion: {},
      catalogoCargando: true,
    })
    expect(v.tipo).toBe('cargando')
  })

  it('con snapshot no espera al catálogo: ya puede pintar la tarjeta', () => {
    const v = verActivacion({
      cupon: undefined,
      comercio: undefined,
      activacion: conSnapshot,
      catalogoCargando: true,
    })
    expect(v.tipo).toBe('lista')
  })

  it('activación vieja sin snapshot y catálogo ya resuelto: lo dice, no finge cargar', () => {
    const v = verActivacion({
      cupon: undefined,
      comercio: undefined,
      activacion: {},
      catalogoCargando: false,
    })
    expect(v.tipo).toBe('sin-datos')
  })

  it('snapshot a medias (cupón sí, comercio no) no arma una tarjeta sin nombre', () => {
    const v = verActivacion({
      cupon: undefined,
      comercio: undefined,
      activacion: { couponTitulo: '20% en pizzas', couponPorcentaje: 20 },
      catalogoCargando: false,
    })
    expect(v.tipo).toBe('sin-datos')
  })
})
