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
        <Section title="1. Quiénes somos">
          <p>
            <strong>Mi San Pedro</strong> es una plataforma operada con domicilio en San Pedro,
            Provincia de Buenos Aires, República Argentina. Conecta vecinos con comercios adheridos
            de la ciudad para acceder a descuentos y promociones.
          </p>
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
              Pagar la suscripción mensual ($25.000 + IVA, sin permanencia) por adelantado vía
              Mercado Pago.
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
            El plan estándar tiene un costo de <strong>$25.000 ARS netos + IVA 21%</strong> ={' '}
            <strong>$30.250 ARS finales por mes</strong>. La suscripción es mensual y se renueva
            automáticamente vía Mercado Pago hasta que el comercio la cancele desde su panel.
          </p>
          <p>
            Mi San Pedro emite factura A (a Responsables Inscriptos) o C (a Monotributistas /
            Consumidores Finales) por cada período cobrado. La factura se envía al email registrado
            dentro de las 48hs de confirmado el pago.
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
          <p>Mi San Pedro puede suspender o cancelar la cuenta de un comercio en caso de:</p>
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
            Mi San Pedro es un intermediario tecnológico. La relación contractual del descuento es
            entre el comercio y el vecino. Mi San Pedro no es responsable por la calidad de los
            productos/servicios ofrecidos por los comercios.
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
            La plataforma, su código, diseño, marcas y contenidos son propiedad de Mi San Pedro o
            sus licenciantes. Queda prohibida la reproducción sin autorización expresa.
          </p>
        </Section>

        <Section title="11. Modificaciones">
          <p>
            Mi San Pedro puede modificar estos Términos avisando con al menos 30 días de
            anticipación al email registrado. Si no estás de acuerdo, podés cancelar tu cuenta sin
            costo dentro de ese período.
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
