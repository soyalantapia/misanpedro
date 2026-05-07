import type { User } from '@/lib/types'

const now = new Date()
const monthsAgo = (m: number) => {
  const d = new Date(now)
  d.setMonth(d.getMonth() - m)
  return d.toISOString()
}

export const SEED_DEMO_USERS: User[] = [
  {
    id: 'u-demo-marta',
    nombre: 'Marta Domínguez',
    dni: '14872305',
    email: 'marta.dominguez@example.com',
    whatsapp: '+54 9 3329 555 102',
    fechaNacimiento: '1962-04-12',
    acceptedTcAt: monthsAgo(8),
    createdAt: monthsAgo(8),
  },
  {
    id: 'u-demo-juan',
    nombre: 'Juan Pablo Acosta',
    dni: '38104567',
    email: 'jp.acosta@example.com',
    whatsapp: '+54 9 3329 555 218',
    fechaNacimiento: '1995-09-23',
    acceptedTcAt: monthsAgo(3),
    createdAt: monthsAgo(3),
  },
  {
    id: 'u-demo-sofia',
    nombre: 'Sofía Castelli',
    dni: '41205918',
    email: 'sofi.castelli@example.com',
    whatsapp: '+54 9 3329 555 334',
    fechaNacimiento: '2000-11-07',
    acceptedTcAt: monthsAgo(2),
    createdAt: monthsAgo(2),
  },
  {
    id: 'u-demo-roberto',
    nombre: 'Roberto Suárez',
    dni: '22987104',
    email: 'r.suarez@example.com',
    whatsapp: '+54 9 3329 555 451',
    fechaNacimiento: '1978-02-15',
    acceptedTcAt: monthsAgo(5),
    createdAt: monthsAgo(5),
  },
  {
    id: 'u-demo-laura',
    nombre: 'Laura Beltrán',
    dni: '33421098',
    email: 'laura.beltran@example.com',
    whatsapp: '+54 9 3329 555 562',
    fechaNacimiento: '1988-06-30',
    acceptedTcAt: monthsAgo(1),
    createdAt: monthsAgo(1),
  },
]
