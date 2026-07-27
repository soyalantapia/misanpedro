/**
 * Email service — dos transportes:
 *   1. SMTP (nodemailer) — preferido. Activá seteando SMTP_HOST/PORT/USER/PASSWORD
 *      (+ SMTP_SECURE). Ej: buzón soporte@micuidad.com en Hostinger
 *      (smtp.hostinger.com:465). Para deliverability, cargá SPF+DKIM del dominio
 *      en el DNS (Cloudflare, donde vive micuidad.com).
 *   2. Resend (HTTP) — fallback si no hay SMTP pero sí RESEND_API_KEY.
 *
 * Sin ningún transporte: en dev se loguea a consola (stub); en PRODUCCIÓN sendEmail
 * devuelve { ok:false } para que el login OTP surfacee un 503 (nadie queda afuera
 * en silencio). EMAIL_FROM define el remitente; con SMTP debe ser la dirección del
 * buzón autenticado.
 */

import nodemailer, { type Transporter } from 'nodemailer'
import { env, isProd } from '@/env'

type EmailPayload = {
  to: string | string[]
  subject: string
  /** Cuerpo HTML del email. */
  html: string
  /** Cuerpo plano de fallback para clientes que no soportan HTML. */
  text?: string
  /** Reply-To override. */
  replyTo?: string
  /** Nombre visible del remitente (display name). Permite firmar el email con el
   *  nombre de la ciudad (ej. "Mi Nariño") manteniendo la dirección verificada
   *  del dominio. Si no se pasa, se usa env.EMAIL_FROM tal cual. */
  fromName?: string
}

/** Construye el header From: si hay fromName, antepone ese display name a la
 *  dirección base extraída de env.EMAIL_FROM. */
function buildFrom(fromName?: string): string {
  if (!fromName) return env.EMAIL_FROM
  const m = env.EMAIL_FROM.match(/<([^>]+)>/)
  const addr = m ? m[1] : env.EMAIL_FROM.trim()
  return `${fromName} <${addr}>`
}

// Transporte SMTP (nodemailer). Singleton lazy: se crea la primera vez que se
// usa, solo si SMTP_HOST está configurado. secure=true → puerto 465 (TLS
// implícito); secure=false → 587 (STARTTLS).
let _smtp: Transporter | null = null
function getSmtpTransport(): Transporter | null {
  if (!env.SMTP_HOST) return null
  if (!_smtp) {
    _smtp = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    })
  }
  return _smtp
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; id?: string; error?: string }> {
  const from = buildFrom(payload.fromName)
  const replyTo = payload.replyTo ?? env.SUPPORT_EMAIL

  // 1) SMTP (preferido si está configurado, ej. soporte@micuidad.com en Hostinger).
  const smtp = getSmtpTransport()
  if (smtp) {
    try {
      const info = await smtp.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo,
      })
      return { ok: true, id: info.messageId }
    } catch (err: any) {
      console.error('[email/smtp]', err?.message ?? err)
      return { ok: false, error: err?.message }
    }
  }

  // 2) Resend (fallback HTTP si no hay SMTP pero sí API key).
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: Array.isArray(payload.to) ? payload.to : [payload.to],
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          reply_to: replyTo,
        }),
      })
      if (!res.ok) {
        const txt = await res.text()
        console.error('[email/error]', res.status, txt)
        return { ok: false, error: txt }
      }
      const data = (await res.json()) as { id: string }
      return { ok: true, id: data.id }
    } catch (err: any) {
      console.error('[email/exception]', err)
      return { ok: false, error: err?.message }
    }
  }

  // 3) Ningún transporte configurado.
  // En PRODUCCIÓN NO podemos mandar emails. Como el login del comercio es OTP-only,
  // devolver "ok" acá dejaría a todos afuera SIN error visible. Fallamos ruidoso
  // para que la ruta pueda surfacear un 503 real.
  if (isProd) {
    console.error(
      '[email] sin transporte configurado (SMTP_HOST o RESEND_API_KEY) en producción — email NO enviado:',
      payload.subject,
    )
    return { ok: false, error: 'email not configured' }
  }
  // En dev sin transporte: stub + log de links accionables (reset, OTP, etc.).
  console.log('[email/stub]', payload.subject, '→', payload.to)
  const links = (payload.text ?? '').match(/https?:\/\/\S+/g) ?? []
  if (links.length > 0) {
    links.forEach((l) => console.log('[email/stub]  link:', l))
  }
  return { ok: true, id: 'stub' }
}

// ─── Templates ──────────────────────────────────────────────────────────

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-width: 560px; margin: 0 auto; padding: 24px;
  color: #333132; line-height: 1.55;
`

function wrap(title: string, body: string, appNombre = 'Mi Ciudad'): string {
  return `
    <!doctype html><html><body style="background:#f9f9f9;margin:0;padding:0">
      <div style="${BASE_STYLE}">
        <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
          <h1 style="font-size:22px;color:#ea580c;margin:0 0 8px">${title}</h1>
          ${body}
          <hr style="border:none;border-top:1px solid #f6f5f6;margin:24px 0">
          <p style="font-size:12px;color:#8b8589;margin:0">
            ${escapeHtml(appNombre)} · descuentos en comercios adheridos<br>
            Soporte: <a href="mailto:${env.SUPPORT_EMAIL}" style="color:#ea580c">${env.SUPPORT_EMAIL}</a>
          </p>
        </div>
      </div>
    </body></html>
  `
}

// Vecino — bienvenida después de registrarse. `frontUrl` = URL de la ciudad
// (tenant-aware); si no se pasa, cae al global APP_URL_FRONT.
export async function sendUserWelcome(
  to: string,
  nombre: string,
  appNombre = 'Mi Ciudad',
  frontUrl = env.APP_URL_FRONT,
) {
  return sendEmail({
    to,
    fromName: appNombre,
    subject: `¡Bienvenido a ${appNombre}!`,
    html: wrap(
      `Hola ${escapeHtml(nombre.split(' ')[0])} 👋`,
      `
        <p>Te diste de alta en <strong>${escapeHtml(appNombre)}</strong>, la app de descuentos
        en comercios adheridos.</p>
        <p>Activá un cupón en tu comercio favorito y mostrale al cajero el QR o
        código de 6 dígitos. Listo, ahorraste.</p>
        <p style="margin-top:24px">
          <a href="${frontUrl}" style="background:#ea580c;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">
            Ver descuentos disponibles →
          </a>
        </p>
      `,
      appNombre,
    ),
    text: `Hola ${nombre}, te diste de alta en ${appNombre}. Activá un cupón y mostralo al cajero. ${frontUrl}`,
  })
}

// Vecino — código OTP (reemplaza el debugCode en pantalla cuando hay Resend)
export async function sendOtpCode(
  to: string,
  code: string,
  appNombre = 'Mi Ciudad',
  opts: { brandColor?: string; logoUrl?: string; loginUrl?: string } = {},
) {
  return sendEmail({
    to,
    fromName: appNombre,
    subject: `Tu código ${appNombre}: ${code}`,
    html: renderOtpEmail({
      code,
      brandName: appNombre,
      brandColor: opts.brandColor,
      logoUrl: opts.logoUrl,
      loginUrl: opts.loginUrl,
      to,
      context: 'vecino',
    }),
    text: otpPlainText({ code, brandName: appNombre, loginUrl: opts.loginUrl, to }),
  })
}

/** Código OTP para el PANEL DE GESTIÓN (owner). Auth passwordless del owner. */
export async function sendOwnerOtpCode(to: string, code: string, loginUrl?: string) {
  return sendEmail({
    to,
    fromName: 'Mi Ciudad · Gestión',
    subject: `Tu código de acceso al panel: ${code}`,
    html: renderOtpEmail({
      code,
      brandName: 'Mi Ciudad',
      loginUrl,
      to,
      context: 'gestion',
    }),
    text: otpPlainText({ code, brandName: 'Mi Ciudad', loginUrl, to }),
  })
}

/** Invitación a sumarse al equipo de gestión (multi-admin). El invitado entra
 *  por OTP con su email, no necesita contraseña. */
export async function sendOwnerTeamInvite(input: { to: string; nombre: string; rol: string; loginUrl?: string }) {
  const cta = input.loginUrl
    ? `<p style="text-align:center;margin:24px 0"><a href="${input.loginUrl}" style="background:#ea580c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700">Entrar al panel</a></p>`
    : ''
  return sendEmail({
    to: input.to,
    fromName: 'Mi Ciudad · Gestión',
    subject: 'Te sumaron al equipo de Mi Ciudad',
    html: wrap(
      `Hola ${input.nombre} 👋`,
      `
        <p>Te sumaron al equipo de gestión de <strong>Mi Ciudad</strong> con el rol <strong>${input.rol}</strong>.</p>
        <p>Entrás con tu email <strong>${input.to}</strong> y un código que te llega al mail. No hace falta contraseña.</p>
        ${cta}
        <p style="font-size:13px;color:#8b8589">Si no esperabas esto, ignorá el email.</p>
      `,
      'Mi Ciudad · Gestión',
    ),
    text: `Te sumaron al equipo de gestión de Mi Ciudad con el rol ${input.rol}. Entrá con tu email ${input.to} y el código que te llega al mail.${input.loginUrl ? ' ' + input.loginUrl : ''}`,
  })
}

// Stacks de fuentes seguras para email (sin depender de webfonts externas).
const EMAIL_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const EMAIL_MONO = "ui-monospace,'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace"

/** Solo aceptamos HEX #RRGGBB; si no, caemos al naranja de marca. Evita meter
 *  un color inválido (o inyectado) en los estilos inline del email. */
function safeHex(c?: string): string {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#ea580c'
}

/** Solo http(s) y sin caracteres que rompan el atributo HTML — evita inyección
 *  en el `src` del logo o el `href` del botón. */
function isHttpUrl(u?: string): boolean {
  return !!u && /^https?:\/\/[^\s"'<>]+$/i.test(u)
}

/** Magic-link de "un toque": agrega email+code al loginUrl como query params
 *  para que la pantalla de acceso autocomplete y entre sola. Respeta si el URL
 *  ya trae query y funciona con HashRouter (el `?` cae después de `#/ruta`).
 *  Devuelve undefined si no hay loginUrl válido. */
function buildOtpMagicLink(
  loginUrl: string | undefined,
  to: string | undefined,
  code: string,
): string | undefined {
  if (!isHttpUrl(loginUrl)) return undefined
  const sep = loginUrl!.includes('?') ? '&' : '?'
  const parts: string[] = []
  if (to) parts.push(`email=${encodeURIComponent(to)}`)
  parts.push(`code=${encodeURIComponent(code)}`)
  return `${loginUrl}${sep}${parts.join('&')}`
}

type OtpContext = 'comercio' | 'gestion' | 'vecino'

/**
 * Template ÚNICO de código OTP — lindo, branded y email-client-safe (tablas,
 * estilos inline, fuentes de sistema). Lo usan los tres logins (vecino, comercio,
 * owner). Trae: logo real de la marca (o monograma si no hay imagen), explicación
 * clara, el código grande y fácil de copiar, y un botón de "un toque" que entra
 * directo con el código ya cargado (magic-link).
 */
export function renderOtpEmail(input: {
  code: string
  brandName: string
  brandColor?: string
  logoUrl?: string
  loginUrl?: string
  to?: string
  context?: OtpContext
}): string {
  const accent = safeHex(input.brandColor)
  const brand = escapeHtml(input.brandName)
  const code = escapeHtml(input.code)
  const support = escapeHtml(env.SUPPORT_EMAIL)
  const ctx: OtpContext = input.context ?? 'vecino'
  const copy = {
    comercio: {
      eyebrow: 'Acceso al panel',
      lead: `Usá este código para entrar al panel de tu comercio en <b style="color:#15161a;font-weight:600">${brand}</b>.`,
      cta: 'Entrar al panel',
      tagline: 'descuentos en comercios adheridos',
    },
    gestion: {
      eyebrow: 'Panel de gestión',
      lead: `Usá este código para entrar al panel de gestión de <b style="color:#15161a;font-weight:600">${brand}</b>.`,
      cta: 'Entrar al panel de gestión',
      tagline: 'panel de administración de la plataforma',
    },
    vecino: {
      eyebrow: 'Tu acceso',
      lead: `Usá este código para entrar a tu cuenta de <b style="color:#15161a;font-weight:600">${brand}</b> y seguir ahorrando.`,
      cta: `Entrar a ${brand}`,
      tagline: 'descuentos en comercios adheridos',
    },
  }[ctx]

  const magic = buildOtpMagicLink(input.loginUrl, input.to, input.code)
  const ctaUrl = magic ?? (isHttpUrl(input.loginUrl) ? input.loginUrl : undefined)

  // Logo: imagen real si hay logoUrl http(s) válido; si no, monograma + wordmark
  // de la marca (siempre renderiza, no depende de que el cliente cargue imágenes).
  const initial = escapeHtml(
    (input.brandName.replace(/^mi\s+/i, '').trim().charAt(0) || 'M').toUpperCase(),
  )
  const logoBlock = isHttpUrl(input.logoUrl)
    ? `<img src="${escapeHtml(input.logoUrl!)}" alt="${brand}" height="40" style="display:block;height:40px;max-height:40px;width:auto;border:0;outline:none;text-decoration:none">`
    : `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle">
            <div style="width:42px;height:42px;border-radius:12px;background:${accent};color:#ffffff;font:700 19px/42px ${EMAIL_FONT};text-align:center">${initial}</div>
          </td>
          <td style="vertical-align:middle;padding-left:12px;font:700 17px ${EMAIL_FONT};color:#15161a">${brand}</td>
        </tr></table>`

  // Botón de "un toque". Patrón bulletproof: tabla + bgcolor + anchor en bloque.
  const ctaBlock = ctaUrl
    ? `
      <tr><td style="padding:20px 40px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="border-bottom:1px solid #eef0f2;font-size:0;line-height:0">&nbsp;</td>
          <td style="padding:0 12px;font:600 11px ${EMAIL_FONT};color:#b4b8be;letter-spacing:.08em;white-space:nowrap">O ENTRÁ SIN COPIAR NADA</td>
          <td style="border-bottom:1px solid #eef0f2;font-size:0;line-height:0">&nbsp;</td>
        </tr></table>
      </td></tr>
      <tr><td align="center" style="padding:18px 40px 0">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
          <td align="center" bgcolor="${accent}" style="border-radius:12px">
            <a href="${escapeHtml(ctaUrl)}" style="display:block;padding:15px 22px;font:600 16px ${EMAIL_FONT};color:#ffffff;text-decoration:none;border-radius:12px">${escapeHtml(copy.cta)} →</a>
          </td>
        </tr></table>
        ${magic ? `<p style="margin:10px 0 0;font:400 12px/1.5 ${EMAIL_FONT};color:#a2a6ad">Un toque y entrás directo: el código ya va cargado.</p>` : ''}
      </td></tr>`
    : ''

  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>Tu código de acceso · ${brand}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f5f7">Tu código ${code} para entrar a ${brand}. Vence en 5 minutos.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7">
  <tr><td align="center" style="padding:36px 12px">
    <table role="presentation" width="468" cellpadding="0" cellspacing="0" style="width:468px;max-width:100%;background:#ffffff;border:1px solid #ebecf0;border-radius:20px;overflow:hidden">
      <tr><td style="height:4px;background:${accent};font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td style="padding:32px 40px 0">
        ${logoBlock}
      </td></tr>
      <tr><td style="padding:26px 40px 0">
        <div style="font:600 12px ${EMAIL_FONT};letter-spacing:.09em;text-transform:uppercase;color:${accent}">${escapeHtml(copy.eyebrow)}</div>
        <h1 style="margin:6px 0 8px;font:700 25px ${EMAIL_FONT};color:#15161a">Tu código de acceso</h1>
        <p style="margin:0;font:400 15px/1.6 ${EMAIL_FONT};color:#5b5f67">${copy.lead}</p>
      </td></tr>
      <tr><td style="padding:22px 40px 0">
        <div style="background:#f7f8fa;border:1px solid #e9ebef;border-radius:14px;padding:20px 16px;text-align:center">
          <div style="font:600 11px ${EMAIL_FONT};letter-spacing:.08em;text-transform:uppercase;color:#9aa0a8;margin-bottom:10px">Tu código</div>
          <div style="font:700 40px/1 ${EMAIL_MONO};letter-spacing:10px;color:${accent};padding-left:10px">${code}</div>
        </div>
        <p style="margin:10px 0 0;text-align:center;font:400 13px/1.5 ${EMAIL_FONT};color:#8b8f98">Copialo y pegalo en la pantalla de acceso · <b style="color:#6b7079;font-weight:600">vence en 5 minutos</b></p>
      </td></tr>${ctaBlock}
      <tr><td style="padding:24px 40px 0">
        <p style="margin:0;font:400 13px/1.6 ${EMAIL_FONT};color:#8b8f98">¿No pediste este código? Ignorá este email. Tu cuenta sigue segura y nadie entró.</p>
      </td></tr>
      <tr><td style="padding:22px 40px 32px">
        <div style="border-top:1px solid #eef0f2;height:1px;line-height:1px;font-size:1px">&nbsp;</div>
        <p style="margin:16px 0 0;font:400 12px/1.7 ${EMAIL_FONT};color:#a2a6ad">${brand} · ${copy.tagline}<br>¿Ayuda? <a href="mailto:${support}" style="color:${accent};text-decoration:none">${support}</a></p>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;font:400 11px ${EMAIL_FONT};color:#b4b8be">Enviado por ${brand}. No respondas a este correo.</p>
  </td></tr>
</table>
</body></html>`
}

/** Cuerpo de texto plano de fallback para el OTP (clientes sin HTML). */
function otpPlainText(input: {
  code: string
  brandName: string
  loginUrl?: string
  to?: string
}): string {
  const magic = buildOtpMagicLink(input.loginUrl, input.to, input.code)
  const lines = [
    `Tu código para entrar a ${input.brandName}: ${input.code}`,
    'Vence en 5 minutos.',
  ]
  if (magic) lines.push('', `O entrá directo (un toque): ${magic}`)
  lines.push('', 'Si no pediste este código, ignorá este email.')
  return lines.join('\n')
}

// Comercio — código OTP para entrar al panel (login passwordless)
export async function sendMerchantOtpCode(
  to: string,
  code: string,
  appNombre = 'Mi Ciudad',
  brandColor?: string,
  loginUrl?: string,
  logoUrl?: string,
) {
  return sendEmail({
    to,
    fromName: appNombre,
    subject: `Tu código para el panel: ${code}`,
    html: renderOtpEmail({
      code,
      brandName: appNombre,
      brandColor,
      logoUrl,
      loginUrl,
      to,
      context: 'comercio',
    }),
    text: otpPlainText({ code, brandName: appNombre, loginUrl, to }),
  })
}

// Vecino — confirmación post-canje (tenant-aware: moneda/locale/nombre de ciudad)
export async function sendUserRedemption(input: {
  to: string
  nombre: string
  comercio: string
  cupon: string
  porcentaje: number
  ahorro: number
  fecha: string
  appNombre?: string
  moneda?: string
  locale?: string
}) {
  const appNombre = input.appNombre ?? 'Mi Ciudad'
  const moneda = input.moneda ?? 'ARS'
  const locale = input.locale ?? 'es-AR'
  const ahorroFormatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(input.ahorro)
  return sendEmail({
    to: input.to,
    fromName: appNombre,
    subject: `Canjeaste tu cupón en ${input.comercio} ✅`,
    html: wrap(
      `¡Genial, ${escapeHtml(input.nombre.split(' ')[0])}!`,
      `
        <p>Acabás de usar tu cupón de <strong>${escapeHtml(input.comercio)}</strong>.</p>
        <div style="background:#f9f9f9;border-radius:12px;padding:16px;margin:16px 0">
          <p style="margin:0;font-size:13px;color:#8b8589">CUPÓN</p>
          <p style="margin:4px 0 12px;font-weight:600">${escapeHtml(input.cupon)}</p>
          <p style="margin:0;font-size:13px;color:#8b8589">DESCUENTO</p>
          <p style="margin:4px 0 12px;font-weight:600">${input.porcentaje}% OFF</p>
          <p style="margin:0;font-size:13px;color:#8b8589">AHORRASTE</p>
          <p style="margin:4px 0 0;font-weight:700;color:#10b981;font-size:20px">${escapeHtml(ahorroFormatted)}</p>
        </div>
        <p style="font-size:13px;color:#8b8589">Canje registrado: ${escapeHtml(input.fecha)}</p>
      `,
      appNombre,
    ),
  })
}

// Comercio — bienvenida después de signup
export async function sendMerchantWelcome(
  to: string,
  nombre: string,
  comercio: string,
  appNombre = 'Mi Ciudad',
  frontUrl = env.APP_URL_FRONT,
) {
  return sendEmail({
    to,
    fromName: appNombre,
    subject: `¡${comercio} ya está en ${appNombre}!`,
    html: wrap(
      `Hola ${escapeHtml(nombre.split(' ')[0])}, bienvenido 🎉`,
      `
        <p>Tu comercio <strong>${escapeHtml(comercio)}</strong> ya está adentro
        de <strong>${escapeHtml(appNombre)}</strong>.</p>
        <p><strong>Próximos pasos:</strong></p>
        <ol>
          <li>Cargá tu primer descuento en el panel</li>
          <li>Verificá que el horario y la dirección estén OK</li>
          <li>Cuando un vecino canjee, vas a verlo en "Clientes"</li>
        </ol>
        <p style="margin-top:24px">
          <a href="${frontUrl}/#/admin" style="background:#ea580c;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">
            Ir al panel del comercio →
          </a>
        </p>
        <p style="font-size:13px;color:#8b8589;margin-top:24px">
          Soporte por WhatsApp: <a href="https://wa.me/${env.SUPPORT_WHATSAPP.replace(/\D/g, '')}" style="color:#ea580c">${env.SUPPORT_WHATSAPP}</a>
        </p>
      `,
      appNombre,
    ),
  })
}

// Comercio — link de reseteo de password
export async function sendPasswordResetLink(input: {
  to: string
  nombre: string
  link: string
  appNombre?: string
}) {
  const appNombre = input.appNombre ?? 'Mi Ciudad'
  return sendEmail({
    to: input.to,
    fromName: appNombre,
    subject: `Resetear tu contraseña · ${appNombre}`,
    html: wrap(
      'Resetear tu contraseña',
      `
        <p>Hola ${escapeHtml(input.nombre.split(' ')[0])}, recibimos una solicitud
        para resetear la contraseña de tu cuenta de comercio.</p>
        <p style="margin-top:24px">
          <a href="${input.link}" style="background:#ea580c;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">
            Crear nueva contraseña →
          </a>
        </p>
        <p style="font-size:13px;color:#8b8589;margin-top:16px">
          El link vence en 30 minutos. Si no fuiste vos, ignorá este email: tu
          contraseña actual sigue intacta.
        </p>
      `,
      appNombre,
    ),
    text: `Para resetear tu contraseña: ${input.link} (vence en 30 min)`,
  })
}

// Comercio — recibo de pago de suscripción
export async function sendSubscriptionReceipt(input: {
  to: string
  comercio: string
  amount: number
  periodFrom: string
  periodTo: string
  externalReference: string
  appNombre?: string
  moneda?: string
  locale?: string
  pais?: string
}) {
  const appNombre = input.appNombre ?? 'Mi Ciudad'
  const moneda = input.moneda ?? 'ARS'
  const locale = input.locale ?? 'es-AR'
  // "Factura C" es un comprobante del monotributo argentino; solo aplica a AR.
  const esArgentina = /argentina|^ar$/i.test((input.pais ?? '').trim())
  const comprobanteLinea = esArgentina
    ? 'La factura C se envía por separado.'
    : 'El comprobante fiscal se envía por separado.'
  const amountFormatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(input.amount)
  return sendEmail({
    to: input.to,
    fromName: appNombre,
    subject: `Recibo de suscripción · ${input.comercio}`,
    html: wrap(
      'Gracias por tu pago',
      `
        <p>Recibimos el pago de la suscripción de <strong>${escapeHtml(input.comercio)}</strong>.</p>
        <div style="background:#f9f9f9;border-radius:12px;padding:16px;margin:16px 0">
          <p style="margin:0;font-size:13px;color:#8b8589">MONTO</p>
          <p style="margin:4px 0 12px;font-weight:700;font-size:22px">${escapeHtml(amountFormatted)}</p>
          <p style="margin:0;font-size:13px;color:#8b8589">PERÍODO</p>
          <p style="margin:4px 0 12px">${escapeHtml(input.periodFrom)} → ${escapeHtml(input.periodTo)}</p>
          <p style="margin:0;font-size:13px;color:#8b8589">REFERENCIA</p>
          <p style="margin:4px 0 0;font-family:monospace;font-size:12px">${escapeHtml(input.externalReference)}</p>
        </div>
        <p style="font-size:13px;color:#8b8589">
          ${comprobanteLinea} Si no lo recibís en 48h, escribinos a
          <a href="mailto:${env.SUPPORT_EMAIL}" style="color:#ea580c">${env.SUPPORT_EMAIL}</a>.
        </p>
      `,
      appNombre,
    ),
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ──────────────────────────────────────────────────────────────
// Owner notifications
// ──────────────────────────────────────────────────────────────

/**
 * Notifica al owner (vos) que se creó una nueva app/tenant.
 * Se manda al SUPPORT_EMAIL configurado en env.
 */
export async function sendOwnerNewAppNotice(input: {
  appNombre: string
  appSlug: string
  ciudad: string
  subdomain: string
  ownerEmail: string
  ownerNombre: string
}) {
  return sendEmail({
    to: env.SUPPORT_EMAIL,
    subject: `Nueva app creada: ${input.appNombre} (${input.appSlug})`,
    html: wrap(
      `Nueva app: ${escapeHtml(input.appNombre)}`,
      `
        <p>Acabás de crear una app nueva en Mi Ciudad:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr>
            <td style="padding:6px 0;color:#8b8589;font-size:13px">Slug</td>
            <td style="padding:6px 0;font-family:monospace;font-size:13px">${escapeHtml(input.appSlug)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8b8589;font-size:13px">Ciudad</td>
            <td style="padding:6px 0;font-size:13px">${escapeHtml(input.ciudad)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8b8589;font-size:13px">Subdomain</td>
            <td style="padding:6px 0;font-family:monospace;font-size:13px">${escapeHtml(input.subdomain)}.micuidad.com</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8b8589;font-size:13px">Creada por</td>
            <td style="padding:6px 0;font-size:13px">${escapeHtml(input.ownerNombre)} (${escapeHtml(input.ownerEmail)})</td>
          </tr>
        </table>
        <h3 style="margin:24px 0 8px;font-size:15px">Próximos pasos</h3>
        <ol style="font-size:13px;color:#605a5e;padding-left:20px;line-height:1.7">
          <li>DNS: el comodín <code>*.micuidad.com</code> ya cubre todos los slugs; no hace falta entrada individual para <code>${escapeHtml(input.subdomain)}.micuidad.com</code>.</li>
          <li>(Opcional) Sumar comercios pioneros desde el panel.</li>
          <li>Compartir el subdomain con el operador local.</li>
        </ol>
      `,
    ),
  })
}
