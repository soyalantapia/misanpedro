import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { SUPPORT_EMAIL } from '@/lib/tenant'

const FECHA_VIGENCIA = '10 de mayo de 2026'

export function PrivacidadPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-12 sm:px-6 sm:pt-10">
      <Link
        to="/"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft size={16} /> Volver
      </Link>

      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
        Política de Privacidad
      </h1>
      <p className="text-sm text-neutral-500">Vigencia desde el {FECHA_VIGENCIA}</p>

      <article className="prose-sm flex flex-col gap-4 text-sm leading-relaxed text-neutral-700">
        <Section title="1. Responsable del tratamiento">
          <p>
            <strong>Responsable de la base de datos personales</strong> conforme a la{' '}
            <strong>Ley 25.326</strong> de Protección de Datos Personales (art. 22) y su decreto
            reglamentario:
          </p>
          <ul>
            <li>
              <strong>Nombre / Razón social:</strong> Alan Naim Tapia
            </li>
            <li>
              <strong>CUIT:</strong> 20-43316638-9
            </li>
            <li>
              <strong>Condición fiscal:</strong> Monotributista (Régimen Simplificado AFIP)
            </li>
            <li>
              <strong>Domicilio:</strong> [PENDIENTE_DOMICILIO_FISCAL] · San Pedro, Provincia de
              Buenos Aires, Argentina
            </li>
            <li>
              <strong>Email para ejercicio de derechos:</strong>{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-accent-700">
                {SUPPORT_EMAIL}
              </a>
            </li>
            <li>
              <strong>Marca comercial:</strong> Mi San Pedro
            </li>
          </ul>
          <p className="text-xs text-neutral-500">
            La base de datos será registrada ante la Agencia de Acceso a la Información Pública
            (AAIP) cuando corresponda según los umbrales reglamentarios.
          </p>
        </Section>

        <Section title="2. Datos que recolectamos">
          <p>
            <strong>De vecinos:</strong> nombre, DNI, email, número de WhatsApp, fecha de
            nacimiento, dispositivos usados, IP, historial de cupones activados y canjeados.
          </p>
          <p>
            <strong>De comercios:</strong> razón social, CUIT, condición fiscal, domicilio fiscal,
            email del responsable, datos del local (dirección, teléfono, horarios).
          </p>
        </Section>

        <Section title="3. Para qué los usamos">
          <ul>
            <li>Operar la plataforma (que vos veas tus cupones, que el comercio valide).</li>
            <li>Generar estadísticas para el comercio (canjes, ahorro, clientes únicos).</li>
            <li>Enviarte emails transaccionales (bienvenida, OTP, confirmación de canje).</li>
            <li>Contactarte ante incidencias o preguntas.</li>
            <li>Cumplir con obligaciones legales y fiscales.</li>
          </ul>
          <p>
            <strong>No usamos tus datos para publicidad de terceros.</strong> No vendemos ni
            cedemos tu información a empresas no relacionadas.
          </p>
        </Section>

        <Section title="4. Quién accede a tus datos (vecinos)">
          <p>
            Cuando canjeás un cupón en un comercio, ese comercio accede a:{' '}
            <strong>tu nombre, DNI, email, WhatsApp, fecha del canje y monto del ticket</strong>.
            Es necesario para que pueda emitir el descuento y registrar la transacción.
          </p>
          <p>
            <strong>El comercio no accede</strong> a tu actividad en otros comercios. Cada comercio
            sólo ve los canjes que ocurrieron en su local.
          </p>
        </Section>

        <Section title="5. Tus derechos (Ley 25.326)">
          <p>Tenés derecho a:</p>
          <ul>
            <li>
              <strong>Acceso:</strong> ver qué datos tuyos tenemos. Podés exportarlos desde tu
              perfil.
            </li>
            <li>
              <strong>Rectificación:</strong> corregir datos incorrectos.
            </li>
            <li>
              <strong>Supresión:</strong> pedir que borremos tus datos. Algunos quedan anonimizados
              en registros de transacciones por obligación contable.
            </li>
            <li>
              <strong>Oposición:</strong> oponerte a usos específicos.
            </li>
          </ul>
          <p>
            Para ejercer tus derechos:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-accent-700">
              {SUPPORT_EMAIL}
            </a>
            . También podés borrar tu cuenta directamente desde el perfil del vecino.
          </p>
          <p className="text-xs text-neutral-500">
            La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, Órgano de Control de la Ley 25.326,
            tiene la atribución de atender denuncias y reclamos por incumplimiento.
          </p>
        </Section>

        <Section title="6. Seguridad">
          <p>
            Las contraseñas se almacenan hasheadas con bcrypt (no las podemos leer). Los tokens de
            sesión están firmados criptográficamente. Las comunicaciones van por HTTPS. La base de
            datos está alojada en MongoDB Atlas con cifrado en reposo.
          </p>
        </Section>

        <Section title="7. Cookies y almacenamiento local">
          <p>
            Usamos <strong>localStorage</strong> del navegador para mantener tu sesión iniciada y
            recordar tus preferencias (vista por descuento o por local). No usamos cookies de
            terceros para tracking publicitario.
          </p>
        </Section>

        <Section title="8. Retención">
          <ul>
            <li>Datos de cuenta activa: mientras la cuenta exista.</li>
            <li>Después de borrar la cuenta: anonimización inmediata.</li>
            <li>
              Registros transaccionales (canjes, facturas): 10 años, conforme obligaciones
              fiscales argentinas.
            </li>
          </ul>
        </Section>

        <Section title="9. Menores">
          <p>
            La plataforma está dirigida a personas mayores de 16 años. No recolectamos
            intencionalmente datos de menores de esa edad. Si detectamos una cuenta de un menor,
            la eliminamos.
          </p>
        </Section>

        <Section title="10. Cambios">
          <p>
            Si modificamos esta política, te avisamos por email con al menos 30 días de
            anticipación. Si no estás de acuerdo, podés cancelar tu cuenta sin costo.
          </p>
        </Section>

        <Section title="11. Contacto">
          <p>
            Soporte:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-accent-700">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </Section>
      </article>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold text-neutral-900">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}
