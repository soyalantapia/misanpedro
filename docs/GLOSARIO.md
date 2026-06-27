# Glosario — Mi Ciudad

Términos del proyecto, para que cualquiera (técnico o no) hable el mismo idioma.

## Producto y actores

- **Mi Ciudad** — la plataforma (`micuidad.com`). Marca blanca: en cada ciudad se llama "Mi \<Ciudad\>"
  (Mi San Pedro, Mi Nariño…).
- **Ciudad / Tenant / App** — una ciudad dentro de la plataforma. Técnicamente es un documento **`App`**.
  Todo lo de una ciudad está aislado del resto. Vive en `https://<ciudad>.micuidad.com`.
- **Vecino** — la persona que usa la app para encontrar y usar descuentos. No paga. Técnicamente un **`User`**.
- **Comercio** — el negocio adherido que ofrece descuentos y paga la suscripción. Técnicamente un **`Merchant`**.
  (Nunca decir "fundador": son "comercios" / "comercio adherido".)
- **Dueño / cajero (del comercio)** — la cuenta con la que el comercio entra a su panel. Técnicamente un
  **`MerchantUser`** (rol `admin` o `cajero`).
- **Owner** — nosotros, los que administramos el SaaS desde `administracion.micuidad.com`. Es **cross-tenant**
  (ve todas las ciudades). Tiene **roles** (super/admin/finanzas/soporte/viewer).

## Descuentos y canje

- **Cupón** — el descuento que publica un comercio (un %, un precio fijo, etc.). Técnicamente un **`Coupon`**.
- **Activación** — cuando un vecino "agarra" un cupón: la app le da un **código de 6 dígitos + QR**.
  Técnicamente una **`Activation`** (estado `activo` hasta que se usa). Un vecino tiene **un solo cupón
  activo a la vez**.
- **Canje** — cuando el comercio **valida** el código y **confirma** la operación en la caja. Es **"el camino
  del dinero"**: el momento más crítico. Técnicamente una **`Redemption`** (no se puede canjear dos veces).
- **Ahorro** — los pesos que el vecino se ahorró en ese canje. En la UI el **verde** está reservado para esto.
- **Stock** — el tope de usos de un cupón (`stockMaximo`). Al llegar al tope, el cupón pasa a **`agotado`**.

## Negocio

- **Suscripción** — el pago mensual del comercio (MercadoPago). Técnicamente una **`Subscription`**.
- **3 meses gratis** — el free trial con el que arranca cada comercio (sin tarjeta, sin permanencia).
- **MRR** — *Monthly Recurring Revenue*: el ingreso recurrente mensual (suma de las suscripciones activas).
  Se saca una **foto diaria** (`MrrSnapshot`) para el dashboard del owner.
- **Referido** — cuando un comercio trae a otro. Da semanas gratis (al que refiere y al referido).
  Técnicamente un **`Referral`**.

## Técnico / infra

- **`appId`** — el identificador de la ciudad. **Todo dato de negocio lo lleva.** Se resuelve del **host**
  (subdominio) o el header `X-Tenant-Slug`, **nunca del token de login**. Es lo que garantiza el aislamiento.
- **Multi-tenant** — un solo sistema sirviendo a muchas ciudades aisladas entre sí.
- **OTP** — *One-Time Password*: el código de un solo uso que se manda por email para entrar (login sin
  contraseña). El "login de un toque" es el mismo código pero embebido en un link del mail.
- **Modo soporte (impersonación)** — un owner entra al panel de un comercio **como si fuera el dueño**, para
  dar soporte. Todo lo que hace queda **auditado** a su nombre y se muestra un **banner violeta** mientras dura.
- **Owner / panel owner** — el super-admin (`administracion.micuidad.com`).
- **PWA** — *Progressive Web App*: la app web que se puede "instalar" en el celular. La del vecino tiene
  un **Service Worker** (cachea; por eso a veces hay que forzar refresh tras un deploy).
- **Railway / Cloudflare / Hostinger** — dónde corre todo: Railway (API + base de datos + fronts),
  Cloudflare (DNS y SSL de `*.micuidad.com`), Hostinger (el redirect viejo + el buzón de correo).
- **Monorepo** — un solo repositorio con todas las apps (api, web, owner, landings, shared).
- **Guardrail (`check:tenant`)** — la verificación que **falla el build** si alguien deja el nombre de una
  ciudad "hardcodeado" (escrito a mano en vez de salir del tenant).
