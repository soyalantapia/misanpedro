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

// Vecino — bienvenida después de registrarse
export async function sendUserWelcome(to: string, nombre: string, appNombre = 'Mi Ciudad') {
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
          <a href="${env.APP_URL_FRONT}" style="background:#ea580c;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">
            Ver descuentos disponibles →
          </a>
        </p>
      `,
      appNombre,
    ),
    text: `Hola ${nombre}, te diste de alta en ${appNombre}. Activá un cupón y mostralo al cajero. ${env.APP_URL_FRONT}`,
  })
}

// Vecino — código OTP (reemplaza el debugCode en pantalla cuando hay Resend)
export async function sendOtpCode(to: string, code: string, appNombre = 'Mi Ciudad') {
  return sendEmail({
    to,
    fromName: appNombre,
    subject: `Tu código ${appNombre}: ${code}`,
    html: wrap(
      'Tu código de acceso',
      `
        <p style="text-align:center;font-size:36px;font-weight:700;letter-spacing:8px;font-family:monospace;margin:24px 0;color:#ea580c">${code}</p>
        <p>Usalo para entrar a tu cuenta. Vence en 5 minutos.</p>
        <p style="font-size:13px;color:#8b8589">Si no pediste este código, ignorá este email.</p>
      `,
      appNombre,
    ),
    text: `Tu código ${appNombre}: ${code}. Vence en 5 minutos.`,
  })
}

// Comercio — código OTP para entrar al panel (login passwordless)
export async function sendMerchantOtpCode(to: string, code: string, appNombre = 'Mi Ciudad') {
  return sendEmail({
    to,
    fromName: appNombre,
    subject: `Tu código para el panel: ${code}`,
    html: wrap(
      'Acceso al panel del comercio',
      `
        <p style="text-align:center;font-size:36px;font-weight:700;letter-spacing:8px;font-family:monospace;margin:24px 0;color:#ea580c">${code}</p>
        <p>Usalo para entrar al panel de tu comercio en <strong>${escapeHtml(appNombre)}</strong>. Vence en 5 minutos.</p>
        <p style="font-size:13px;color:#8b8589">Si no pediste este código, ignorá este email — nadie entró a tu cuenta.</p>
      `,
      appNombre,
    ),
    text: `Tu código para el panel ${appNombre}: ${code}. Vence en 5 minutos.`,
  })
}

// Vecino — confirmación post-canje
export async function sendUserRedemption(input: {
  to: string
  nombre: string
  comercio: string
  cupon: string
  porcentaje: number
  ahorro: number
  fecha: string
}) {
  return sendEmail({
    to: input.to,
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
          <p style="margin:4px 0 0;font-weight:700;color:#10b981;font-size:20px">$${input.ahorro.toLocaleString('es-AR')}</p>
        </div>
        <p style="font-size:13px;color:#8b8589">Canje registrado: ${escapeHtml(input.fecha)}</p>
      `,
    ),
  })
}

// Comercio — bienvenida después de signup
export async function sendMerchantWelcome(to: string, nombre: string, comercio: string, appNombre = 'Mi Ciudad') {
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
          <a href="${env.APP_URL_FRONT}/#/admin" style="background:#ea580c;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">
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
    subject: `Resetear tu contraseña — ${appNombre}`,
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
          El link vence en 30 minutos. Si no fuiste vos, ignorá este email — tu
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
}) {
  const appNombre = input.appNombre ?? 'Mi Ciudad'
  const moneda = input.moneda ?? 'ARS'
  const locale = input.locale ?? 'es-AR'
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
          La factura C se envía por separado. Si no la recibís en 48h, escribinos a
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
