/**
 * Códigos telefónicos de país para el campo WhatsApp del registro.
 * Default = Argentina (AR / +54). Lista amplia (Américas completas + resto
 * del mundo más común). `dial` sin el "+". `flag` emoji bandera.
 */
export type Country = { iso: string; name: string; dial: string; flag: string }

export const DEFAULT_COUNTRY = 'AR'

export const COUNTRY_CODES: Country[] = [
  { iso: 'AR', name: 'Argentina', dial: '54', flag: '🇦🇷' },
  { iso: 'UY', name: 'Uruguay', dial: '598', flag: '🇺🇾' },
  { iso: 'PY', name: 'Paraguay', dial: '595', flag: '🇵🇾' },
  { iso: 'BO', name: 'Bolivia', dial: '591', flag: '🇧🇴' },
  { iso: 'BR', name: 'Brasil', dial: '55', flag: '🇧🇷' },
  { iso: 'CL', name: 'Chile', dial: '56', flag: '🇨🇱' },
  { iso: 'PE', name: 'Perú', dial: '51', flag: '🇵🇪' },
  { iso: 'CO', name: 'Colombia', dial: '57', flag: '🇨🇴' },
  { iso: 'EC', name: 'Ecuador', dial: '593', flag: '🇪🇨' },
  { iso: 'VE', name: 'Venezuela', dial: '58', flag: '🇻🇪' },
  { iso: 'MX', name: 'México', dial: '52', flag: '🇲🇽' },
  { iso: 'CR', name: 'Costa Rica', dial: '506', flag: '🇨🇷' },
  { iso: 'PA', name: 'Panamá', dial: '507', flag: '🇵🇦' },
  { iso: 'GT', name: 'Guatemala', dial: '502', flag: '🇬🇹' },
  { iso: 'HN', name: 'Honduras', dial: '504', flag: '🇭🇳' },
  { iso: 'SV', name: 'El Salvador', dial: '503', flag: '🇸🇻' },
  { iso: 'NI', name: 'Nicaragua', dial: '505', flag: '🇳🇮' },
  { iso: 'DO', name: 'Rep. Dominicana', dial: '1', flag: '🇩🇴' },
  { iso: 'CU', name: 'Cuba', dial: '53', flag: '🇨🇺' },
  { iso: 'PR', name: 'Puerto Rico', dial: '1', flag: '🇵🇷' },
  { iso: 'US', name: 'Estados Unidos', dial: '1', flag: '🇺🇸' },
  { iso: 'CA', name: 'Canadá', dial: '1', flag: '🇨🇦' },
  { iso: 'ES', name: 'España', dial: '34', flag: '🇪🇸' },
  { iso: 'PT', name: 'Portugal', dial: '351', flag: '🇵🇹' },
  { iso: 'IT', name: 'Italia', dial: '39', flag: '🇮🇹' },
  { iso: 'FR', name: 'Francia', dial: '33', flag: '🇫🇷' },
  { iso: 'DE', name: 'Alemania', dial: '49', flag: '🇩🇪' },
  { iso: 'GB', name: 'Reino Unido', dial: '44', flag: '🇬🇧' },
  { iso: 'IE', name: 'Irlanda', dial: '353', flag: '🇮🇪' },
  { iso: 'NL', name: 'Países Bajos', dial: '31', flag: '🇳🇱' },
  { iso: 'BE', name: 'Bélgica', dial: '32', flag: '🇧🇪' },
  { iso: 'CH', name: 'Suiza', dial: '41', flag: '🇨🇭' },
  { iso: 'AT', name: 'Austria', dial: '43', flag: '🇦🇹' },
  { iso: 'SE', name: 'Suecia', dial: '46', flag: '🇸🇪' },
  { iso: 'NO', name: 'Noruega', dial: '47', flag: '🇳🇴' },
  { iso: 'DK', name: 'Dinamarca', dial: '45', flag: '🇩🇰' },
  { iso: 'FI', name: 'Finlandia', dial: '358', flag: '🇫🇮' },
  { iso: 'PL', name: 'Polonia', dial: '48', flag: '🇵🇱' },
  { iso: 'CZ', name: 'Rep. Checa', dial: '420', flag: '🇨🇿' },
  { iso: 'GR', name: 'Grecia', dial: '30', flag: '🇬🇷' },
  { iso: 'RO', name: 'Rumania', dial: '40', flag: '🇷🇴' },
  { iso: 'RU', name: 'Rusia', dial: '7', flag: '🇷🇺' },
  { iso: 'UA', name: 'Ucrania', dial: '380', flag: '🇺🇦' },
  { iso: 'TR', name: 'Turquía', dial: '90', flag: '🇹🇷' },
  { iso: 'IL', name: 'Israel', dial: '972', flag: '🇮🇱' },
  { iso: 'AE', name: 'Emiratos Árabes', dial: '971', flag: '🇦🇪' },
  { iso: 'SA', name: 'Arabia Saudita', dial: '966', flag: '🇸🇦' },
  { iso: 'EG', name: 'Egipto', dial: '20', flag: '🇪🇬' },
  { iso: 'MA', name: 'Marruecos', dial: '212', flag: '🇲🇦' },
  { iso: 'ZA', name: 'Sudáfrica', dial: '27', flag: '🇿🇦' },
  { iso: 'NG', name: 'Nigeria', dial: '234', flag: '🇳🇬' },
  { iso: 'IN', name: 'India', dial: '91', flag: '🇮🇳' },
  { iso: 'PK', name: 'Pakistán', dial: '92', flag: '🇵🇰' },
  { iso: 'CN', name: 'China', dial: '86', flag: '🇨🇳' },
  { iso: 'JP', name: 'Japón', dial: '81', flag: '🇯🇵' },
  { iso: 'KR', name: 'Corea del Sur', dial: '82', flag: '🇰🇷' },
  { iso: 'PH', name: 'Filipinas', dial: '63', flag: '🇵🇭' },
  { iso: 'ID', name: 'Indonesia', dial: '62', flag: '🇮🇩' },
  { iso: 'TH', name: 'Tailandia', dial: '66', flag: '🇹🇭' },
  { iso: 'VN', name: 'Vietnam', dial: '84', flag: '🇻🇳' },
  { iso: 'MY', name: 'Malasia', dial: '60', flag: '🇲🇾' },
  { iso: 'SG', name: 'Singapur', dial: '65', flag: '🇸🇬' },
  { iso: 'AU', name: 'Australia', dial: '61', flag: '🇦🇺' },
  { iso: 'NZ', name: 'Nueva Zelanda', dial: '64', flag: '🇳🇿' },
]

const BY_ISO = new Map(COUNTRY_CODES.map((c) => [c.iso, c]))

export function getCountry(iso: string): Country {
  return BY_ISO.get(iso) ?? BY_ISO.get(DEFAULT_COUNTRY)!
}
