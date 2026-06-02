/**
 * Email service — usa Resend (https://resend.com) si RESEND_API_KEY está
 * configurado. Si no, modo no-op: los emails se loguean a consola.
 *
 * Para activar:
 *   - Crear cuenta en resend.com y obtener API key
 *   - Verificar el dominio (DNS records)
 *   - Setear RESEND_API_KEY + EMAIL_FROM en env
 */

import { env } from '@/env'

type EmailPayload = {
  to: string | string[]
  subject: string
  /** Cuerpo HTML del email. */
  html: string
  /** Cuerpo plano de fallback para clientes que no soportan HTML. */
  text?: string
  /** Reply-To override. */
  replyTo?: string
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!env.RESEND_API_KEY) {
    console.log('[email/stub]', payload.subject, '→', payload.to)
    // En dev sin Resend, log links accionables (reset password, etc.)
    // para poder testear los flujos. Match cualquier URL del body text.
    const links = (payload.text ?? '').match(/https?:\/\/\S+/g) ?? []
    if (links.length > 0) {
      links.forEach((l) => console.log('[email/stub]  link:', l))
    }
    return { ok: true, id: 'stub' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.replyTo ?? env.SUPPORT_EMAIL,
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

// ─── Templates ──────────────────────────────────────────────────────────

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-width: 560px; margin: 0 auto; padding: 24px;
  color: #333132; line-height: 1.55;
`

function wrap(title: string, body: string): string {
  return `
    <!doctype html><html><body style="background:#f9f9f9;margin:0;padding:0">
      <div style="${BASE_STYLE}">
        <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
          <h1 style="font-size:22px;color:#695ede;margin:0 0 8px">${title}</h1>
          ${body}
          <hr style="border:none;border-top:1px solid #f6f5f6;margin:24px 0">
          <p style="font-size:12px;color:#8b8589;margin:0">
            Mi San Pedro · descuentos en comercios adheridos<br>
            Soporte: <a href="mailto:${env.SUPPORT_EMAIL}" style="color:#695ede">${env.SUPPORT_EMAIL}</a>
          </p>
        </div>
      </div>
    </body></html>
  `
}

// Vecino — bienvenida después de registrarse
export async function sendUserWelcome(to: string, nombre: string) {
  return sendEmail({
    to,
    subject: '¡Bienvenido a Mi San Pedro!',
    html: wrap(
      `Hola ${escapeHtml(nombre.split(' ')[0])} 👋`,
      `
        <p>Te diste de alta en <strong>Mi San Pedro</strong>, la app de descuentos
        en comercios adheridos de San Pedro.</p>
        <p>Activá un cupón en tu comercio favorito y mostrale al cajero el QR o
        código de 6 dígitos. Listo, ahorraste.</p>
        <p style="margin-top:24px">
          <a href="${env.APP_URL_FRONT}" style="background:#695ede;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">
            Ver descuentos disponibles →
          </a>
        </p>
      `,
    ),
    text: `Hola ${nombre}, te diste de alta en Mi San Pedro. Activá un cupón y mostralo al cajero. ${env.APP_URL_FRONT}`,
  })
}

// Vecino — código OTP (reemplaza el debugCode en pantalla cuando hay Resend)
export async function sendOtpCode(to: string, code: string) {
  return sendEmail({
    to,
    subject: `Tu código Mi San Pedro: ${code}`,
    html: wrap(
      'Tu código de acceso',
      `
        <p style="text-align:center;font-size:36px;font-weight:700;letter-spacing:8px;font-family:monospace;margin:24px 0;color:#695ede">${code}</p>
        <p>Usalo para entrar a tu cuenta. Vence en 5 minutos.</p>
        <p style="font-size:13px;color:#8b8589">Si no pediste este código, ignorá este email.</p>
      `,
    ),
    text: `Tu código Mi San Pedro: ${code}. Vence en 5 minutos.`,
  })
}

// Comercio — código OTP para entrar al panel (login passwordless)
export async function sendMerchantOtpCode(to: string, code: string) {
  return sendEmail({
    to,
    subject: `Tu código para el panel: ${code}`,
    html: wrap(
      'Acceso al panel del comercio',
      `
        <p style="text-align:center;font-size:36px;font-weight:700;letter-spacing:8px;font-family:monospace;margin:24px 0;color:#695ede">${code}</p>
        <p>Usalo para entrar al panel de tu comercio en <strong>Mi San Pedro</strong>. Vence en 5 minutos.</p>
        <p style="font-size:13px;color:#8b8589">Si no pediste este código, ignorá este email — nadie entró a tu cuenta.</p>
      `,
    ),
    text: `Tu código para el panel Mi San Pedro: ${code}. Vence en 5 minutos.`,
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
export async function sendMerchantWelcome(to: string, nombre: string, comercio: string) {
  return sendEmail({
    to,
    subject: `¡${comercio} ya está en Mi San Pedro!`,
    html: wrap(
      `Hola ${escapeHtml(nombre.split(' ')[0])}, bienvenido 🎉`,
      `
        <p>Tu comercio <strong>${escapeHtml(comercio)}</strong> ya está adentro
        de Mi San Pedro.</p>
        <p><strong>Próximos pasos:</strong></p>
        <ol>
          <li>Cargá tu primer descuento en el panel</li>
          <li>Verificá que el horario y la dirección estén OK</li>
          <li>Cuando un vecino canjee, vas a verlo en "Clientes"</li>
        </ol>
        <p style="margin-top:24px">
          <a href="${env.APP_URL_FRONT}/#/admin" style="background:#695ede;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">
            Ir al panel del comercio →
          </a>
        </p>
        <p style="font-size:13px;color:#8b8589;margin-top:24px">
          Soporte por WhatsApp: <a href="https://wa.me/${env.SUPPORT_WHATSAPP.replace(/\D/g, '')}" style="color:#695ede">${env.SUPPORT_WHATSAPP}</a>
        </p>
      `,
    ),
  })
}

// Comercio — link de reseteo de password
export async function sendPasswordResetLink(input: {
  to: string
  nombre: string
  link: string
}) {
  return sendEmail({
    to: input.to,
    subject: 'Resetear tu contraseña — Mi San Pedro',
    html: wrap(
      'Resetear tu contraseña',
      `
        <p>Hola ${escapeHtml(input.nombre.split(' ')[0])}, recibimos una solicitud
        para resetear la contraseña de tu cuenta de comercio.</p>
        <p style="margin-top:24px">
          <a href="${input.link}" style="background:#695ede;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">
            Crear nueva contraseña →
          </a>
        </p>
        <p style="font-size:13px;color:#8b8589;margin-top:16px">
          El link vence en 30 minutos. Si no fuiste vos, ignorá este email — tu
          contraseña actual sigue intacta.
        </p>
      `,
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
}) {
  return sendEmail({
    to: input.to,
    subject: `Recibo de suscripción · ${input.comercio}`,
    html: wrap(
      'Gracias por tu pago',
      `
        <p>Recibimos el pago de la suscripción de <strong>${escapeHtml(input.comercio)}</strong>.</p>
        <div style="background:#f9f9f9;border-radius:12px;padding:16px;margin:16px 0">
          <p style="margin:0;font-size:13px;color:#8b8589">MONTO</p>
          <p style="margin:4px 0 12px;font-weight:700;font-size:22px">$${input.amount.toLocaleString('es-AR')}</p>
          <p style="margin:0;font-size:13px;color:#8b8589">PERÍODO</p>
          <p style="margin:4px 0 12px">${escapeHtml(input.periodFrom)} → ${escapeHtml(input.periodTo)}</p>
          <p style="margin:0;font-size:13px;color:#8b8589">REFERENCIA</p>
          <p style="margin:4px 0 0;font-family:monospace;font-size:12px">${escapeHtml(input.externalReference)}</p>
        </div>
        <p style="font-size:13px;color:#8b8589">
          La factura C se envía por separado. Si no la recibís en 48h, escribinos a
          <a href="mailto:${env.SUPPORT_EMAIL}" style="color:#695ede">${env.SUPPORT_EMAIL}</a>.
        </p>
      `,
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
        <p>Acabás de crear una app nueva en Mi San Pedro:</p>
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
            <td style="padding:6px 0;font-family:monospace;font-size:13px">${escapeHtml(input.subdomain)}.misanpedro.app</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8b8589;font-size:13px">Creada por</td>
            <td style="padding:6px 0;font-size:13px">${escapeHtml(input.ownerNombre)} (${escapeHtml(input.ownerEmail)})</td>
          </tr>
        </table>
        <h3 style="margin:24px 0 8px;font-size:15px">Próximos pasos</h3>
        <ol style="font-size:13px;color:#605a5e;padding-left:20px;line-height:1.7">
          <li>Configurar DNS: A/CNAME para <code>${escapeHtml(input.subdomain)}.misanpedro.app</code> apuntando al deploy.</li>
          <li>(Opcional) Sumar comercios pioneros desde el panel.</li>
          <li>Compartir el subdomain con el operador local.</li>
        </ol>
      `,
    ),
  })
}
