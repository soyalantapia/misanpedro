import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { SUPPORT_EMAIL } from '@/lib/tenant'

const FECHA_VIGENCIA = '10 de mayo de 2026'

export function TerminosPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-12 sm:px-6 sm:pt-10">
      <Link
        to="/"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft size={16} /> Volver
      </Link>

      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
        Términos y Condiciones
      </h1>
      <p className="text-sm text-neutral-500">Vigencia desde el {FECHA_VIGENCIA}</p>

      <article className="prose-sm flex flex-col gap-4 text-sm leading-relaxed text-neutral-700">
        <Section title="1. Quiénes somos · Responsable">
          <p>
            <strong>Mi San Pedro</strong> es una plataforma de descuentos vecinales que opera
            en San Pedro, Provincia de Buenos Aires, República Argentina. Conecta vecinos con
            comercios adheridos para acceder a descuentos y promociones.
          </p>
          <p>
            <strong>Responsable del servicio y del tratamiento de datos personales</strong> (Ley
            25.326 art. 22):
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
              <strong>Domicilio fiscal:</strong> [PENDIENTE_DOMICILIO_FISCAL] · San Pedro,
              Provincia de Buenos Aires, Argentina
            </li>
            <li>
              <strong>Email de contacto y reclamos:</strong>{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-accent-700">
                {SUPPORT_EMAIL}
              </a>
            </li>
          </ul>
        </Section>

        <Section title="2. Aceptación">
          <p>
            Al crear una cuenta de comercio o de vecino, aceptás estos Términos y Condiciones y la{' '}
            <Link to="/legal/privacidad" className="font-bold text-accent-700">
              Política de Privacidad
            </Link>
            . Si no estás de acuerdo, no uses la plataforma.
          </p>
        </Section>

        <Section title="3. Cuenta de comercio">
          <p>El comercio se compromete a:</p>
          <ul>
            <li>Brindar información veraz sobre su identidad, dirección y datos fiscales.</li>
            <li>Honrar todos los cupones activos publicados en la plataforma.</li>
            <li>
              Pagar la suscripción mensual de <strong>$25.000 ARS finales</strong> (sin
              permanencia, sin cargos adicionales) por adelantado vía Mercado Pago.
            </li>
            <li>
              Mantener actualizada su información (horarios, dirección, datos fiscales para
              facturación).
            </li>
            <li>
              No publicar promociones engañosas o que no se respeten en el local físico.
            </li>
          </ul>
        </Section>

        <Section title="4. Cuenta de vecino">
          <p>El vecino debe:</p>
          <ul>
            <li>Tener al menos 16 años para registrarse.</li>
            <li>Brindar información veraz (DNI, email, WhatsApp).</li>
            <li>Mostrar su QR o código de 6 dígitos en el comercio para canjear el descuento.</li>
            <li>Respetar las condiciones particulares de cada cupón (días, horarios, productos).</li>
          </ul>
        </Section>

        <Section title="5. Plan y pagos">
          <p>
            El plan estándar tiene un costo final de <strong>$25.000 ARS por mes</strong> (sin
            IVA discriminado adicional, sin cargos por permanencia). La suscripción es mensual y
            se renueva automáticamente vía Mercado Pago hasta que el comercio la cancele desde
            su panel.
          </p>
          <p>
            En esta primera etapa, el responsable opera bajo el <strong>Régimen Simplificado para
            Pequeños Contribuyentes (Monotributo)</strong> y emite <strong>factura C</strong> por
            cada período cobrado. La factura se envía al email registrado dentro de las 48hs de
            confirmado el pago. Cuando el servicio escale a Sociedad por Acciones Simplificada
            (S.A.S.) o forma equivalente, pasaremos a emitir factura A o B según la condición
            fiscal del comercio adherido, sin cambios en el precio público.
          </p>
        </Section>

        <Section title="6. Derecho de arrepentimiento">
          <p>
            En cumplimiento de la <strong>Ley 24.240 de Defensa del Consumidor</strong>, el
            comercio tiene <strong>10 días corridos desde el alta</strong> para arrepentirse y
            solicitar el reembolso completo del primer cobro. Después del día 10, las cancelaciones
            terminan al final del período mensual ya pagado, sin reembolso prorrateado.
          </p>
        </Section>

        <Section title="7. Suspensión y cancelación">
          <p>El responsable de Mi San Pedro puede suspender o cancelar la cuenta de un comercio en caso de:</p>
          <ul>
            <li>Falta de pago de la suscripción.</li>
            <li>Cupones no respetados o promociones engañosas.</li>
            <li>Quejas reiteradas de vecinos.</li>
            <li>Violación de leyes argentinas.</li>
          </ul>
          <p>
            En caso de suspensión, los cupones del comercio dejan de aparecer en la app del vecino
            inmediatamente. Las activaciones previas se mantienen vigentes hasta que el vecino las
            canjee o expiren.
          </p>
        </Section>

        <Section title="8. Responsabilidad">
          <p>
            Mi San Pedro es un <strong>intermediario tecnológico</strong>. La relación
            contractual del descuento es entre el comercio y el vecino. El responsable de Mi
            San Pedro no es responsable por la calidad de los productos/servicios ofrecidos
            por los comercios adheridos.
          </p>
        </Section>

        <Section title="9. Datos personales">
          <p>
            El tratamiento de datos personales se rige por la{' '}
            <Link to="/legal/privacidad" className="font-bold text-accent-700">
              Política de Privacidad
            </Link>
            , que es parte integrante de estos Términos.
          </p>
          <p>
            Los datos de los vecinos canjeadores se comparten con el comercio en cuyo local
            canjearon, exclusivamente para gestión de la relación comercial. Los comercios se
            comprometen a no compartirlos con terceros y a respetar la <strong>Ley 25.326 de
            Protección de Datos Personales</strong>.
          </p>
        </Section>

        <Section title="10. Propiedad intelectual">
          <p>
            La plataforma, su código, diseño, marca "Mi San Pedro" y contenidos son propiedad
            del responsable identificado en la sección 1 o sus licenciantes. Queda prohibida la
            reproducción sin autorización expresa.
          </p>
        </Section>

        <Section title="11. Modificaciones">
          <p>
            El responsable puede modificar estos Términos avisando con al menos 30 días de
            anticipación al email registrado. Si no estás de acuerdo, podés cancelar tu cuenta
            sin costo dentro de ese período.
          </p>
        </Section>

        <Section title="12. Jurisdicción">
          <p>
            Cualquier conflicto se resolverá en los Tribunales Ordinarios de San Pedro, Provincia
            de Buenos Aires, renunciando a todo otro fuero.
          </p>
        </Section>

        <Section title="13. Contacto">
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
