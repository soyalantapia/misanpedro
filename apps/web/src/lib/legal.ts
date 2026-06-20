/**
 * Marco legal por país para las páginas de Términos y Privacidad.
 *
 * La plataforma es multi-país: una ciudad argentina se rige por la Ley 25.326
 * (datos) y la Ley 24.240 (consumidor); una colombiana por la Ley 1581 de 2012
 * (Habeas Data) y la Ley 1480 (Estatuto del Consumidor). Mostrarle a un usuario
 * colombiano leyes argentinas sería incorrecto y engañoso, así que derivamos el
 * marco del `pais` del tenant. País desconocido → texto neutro.
 */

export type LegalFramework = {
  /** País normalizado para comparaciones (lowercase, sin acentos). */
  paisKey: string
  /** ¿Aplica el régimen fiscal argentino (factura C / monotributo)? */
  esArgentina: boolean
  /** Ley de protección de datos personales aplicable. */
  dataLaw: string
  /** Autoridad de control de datos personales. */
  dataAuthority: string
  /** Ley de defensa del consumidor aplicable. */
  consumerLaw: string
  /** Etiqueta por defecto del identificador fiscal (CUIT/NIT/…). */
  taxIdLabel: string
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

const ARGENTINA: LegalFramework = {
  paisKey: 'argentina',
  esArgentina: true,
  dataLaw: 'Ley 25.326 de Protección de Datos Personales',
  dataAuthority: 'Agencia de Acceso a la Información Pública (AAIP)',
  consumerLaw: 'Ley 24.240 de Defensa del Consumidor',
  taxIdLabel: 'CUIT',
}

const COLOMBIA: LegalFramework = {
  paisKey: 'colombia',
  esArgentina: false,
  dataLaw: 'Ley 1581 de 2012 (Protección de Datos Personales / Habeas Data)',
  dataAuthority: 'Superintendencia de Industria y Comercio (SIC)',
  consumerLaw: 'Ley 1480 de 2011 (Estatuto del Consumidor)',
  taxIdLabel: 'NIT',
}

const GENERICO: LegalFramework = {
  paisKey: 'generico',
  esArgentina: false,
  dataLaw: 'la normativa de protección de datos personales aplicable',
  dataAuthority: 'la autoridad de control competente en materia de datos personales',
  consumerLaw: 'la normativa de defensa del consumidor aplicable',
  taxIdLabel: 'ID fiscal',
}

/** Devuelve el marco legal correspondiente al país del tenant. */
export function legalFor(pais?: string | null): LegalFramework {
  const key = normalize(pais ?? '')
  if (key === 'argentina' || key === 'ar') return ARGENTINA
  if (key === 'colombia' || key === 'co') return COLOMBIA
  return GENERICO
}
