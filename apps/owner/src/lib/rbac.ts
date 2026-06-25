/**
 * RBAC en el front: espeja la matriz del backend (routes/owner.ts). El back es la
 * fuente de verdad (cada endpoint la enforcea); acá solo OCULTAMOS lo que el rol no
 * puede, para no mostrar botones/secciones que devolverían 403.
 *
 * Roles: super | admin | finanzas | soporte | viewer
 */
export type Rol = 'super' | 'admin' | 'finanzas' | 'soporte' | 'viewer'

export const ROLES: { value: Rol; label: string; desc: string }[] = [
  { value: 'super', label: 'Super', desc: 'Control total + gestiona el equipo' },
  { value: 'admin', label: 'Admin', desc: 'Apps, comercios, vecinos y pagos' },
  { value: 'finanzas', label: 'Finanzas', desc: 'Métricas y suscripciones/cobranzas' },
  { value: 'soporte', label: 'Soporte', desc: 'Comercios y vecinos (sin pagos)' },
  { value: 'viewer', label: 'Viewer', desc: 'Solo lectura' },
]

export function rolLabel(rol?: string): string {
  return ROLES.find((r) => r.value === rol)?.label ?? rol ?? '—'
}

type Recurso = 'apps' | 'comercios' | 'vecinos' | 'pagos' | 'estadisticas' | 'auditoria' | 'equipo'
type Accion = 'ver' | 'editar'

// Matriz recurso → { ver: roles[], editar: roles[] }. '*' = todos los roles.
const MATRIX: Record<Recurso, { ver: Rol[] | '*'; editar: Rol[] }> = {
  apps: { ver: '*', editar: ['super', 'admin'] },
  comercios: { ver: '*', editar: ['super', 'admin', 'soporte'] },
  vecinos: { ver: '*', editar: [] },
  pagos: { ver: ['super', 'admin', 'finanzas', 'viewer'], editar: ['super', 'admin', 'finanzas'] },
  estadisticas: { ver: '*', editar: [] },
  auditoria: { ver: ['super', 'admin'], editar: [] },
  equipo: { ver: ['super'], editar: ['super'] },
}

export function can(rol: string | undefined | null, recurso: Recurso, accion: Accion = 'ver'): boolean {
  if (!rol) return false
  const entry = MATRIX[recurso]
  if (!entry) return false
  const allowed = entry[accion]
  if (allowed === '*') return true
  return (allowed as Rol[]).includes(rol as Rol)
}

/** ¿Este rol puede ver MRR/facturación? (soporte no). Para ocultar el bloque en stats. */
export function canSeeMrr(rol?: string | null): boolean {
  return can(rol, 'pagos', 'ver')
}
