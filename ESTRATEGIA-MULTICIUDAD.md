# Estrategia multi-ciudad — "Mi[Ciudad]" sobre una sola plataforma

**Objetivo:** darle la tecnología a cada pueblo/ciudad como su propia marca — Mi San Pedro,
Mi Nariño, Mi San Martín, etc. — sobre **una sola base de código multi-tenant**. Cada ciudad
tiene sus **propios comercios, cupones, usuarios, canjes** (datos 100% aislados); comparten el
software, el deploy y la administración (owner).

> **Decisión de URL (junio 2026):** dominio de plataforma NEUTRO a comprar (ej. `miciudad.app`),
> con **un subdominio por ciudad** (`sanpedro.miciudad.app`, `narino.miciudad.app`…). A futuro,
> cada ciudad puede tener su **dominio propio** vía el campo `customDomain` (ya existe en el modelo).
> **Pendiente: comprar el dominio.** El resto de esta estrategia queda lista para ejecutar.

---

## 1. Veredicto — la tecnología YA es multi-ciudad
El motor multi-tenant **ya está construido**. No hay que rehacer el core: hay que "encender"
ciudades + conectar el dominio de plataforma. San Pedro es la ciudad piloto (en vivo en
misanpedro.com).

## 2. Cómo funciona la tenancy (estado actual, revisado)
- **Aislamiento de datos:** cada registro lleva `appId` (ref a la App/ciudad). Está en TODOS los
  modelos de datos: `Coupon, Merchant, User, MerchantUser, Activation, Redemption, Referral,
  CustomerNote, WaSend, Subscription, PushSubscription, Otp`. → **cupones, locales y usuarios son
  por-ciudad, nunca cruzados.** Sin `appId` (correcto): `Owner` (super-admin de plataforma),
  `RefreshToken`/`PasswordReset` (tokens; referencian a un user que sí es por-ciudad).
- **Modelo `App` = la ciudad** (apps/api/src/models/App.ts): `slug`, `nombre` ("Mi Nariño"),
  `ciudad/provincia/pais`, `subdomain`, `customDomain`, `brand` (logo/colores/copy), `operator`
  (quién opera esa ciudad), `plan`, `status` (pending/active/suspended), **`geoCenter` (lat/lng)**,
  `settings` (flags: catálogo público, WhatsApp, onboarding).
- **Crear una ciudad:** endpoint `POST /owner/apps` (apps/api/src/routes/owner.ts) — ya existe,
  con auth de owner. También `GET /owner/apps` (KPIs por ciudad) y `GET /owner/metrics` (SaaS global).
  La app `apps/owner` es el panel de plataforma.
- **Resolución del tenant (API)** (middleware/tenant.ts): orden = header `X-Tenant-Slug` →
  subdominio (sufijo whitelisted) → `customDomain` (lookup DB) → `?tenant=`. Subdominios
  reservados (no son ciudades): `www, api, admin, owner, app, comercios`.
- **Frontend:** resuelve el slug (subdomain o default) → `GET /tenant/:slug/config` → aplica el
  **nombre** de la ciudad. El color hoy NO se aplica por-tenant (todas naranja — ver §4).

## 3. Qué es por-ciudad vs de-plataforma
| Por ciudad (aislado, `appId`) | De plataforma (compartido) |
|---|---|
| Comercios, cupones, usuarios/vecinos | Código / deploy (1 build sirve a todas) |
| Canjes, activaciones, referidos, alertas | Owner (super-admin) + métricas cross-tenant |
| Suscripciones, notas de cliente, campañas WA | El registro `App` de cada ciudad |
| `geoCenter`, branding y operador propios | El dominio de plataforma + DNS wildcard |

## 4. Gaps a resolver (preparación)

### Código — domain-independent (se puede hacer YA, antes del dominio)
- [x] **Default de marca violeta → naranja** en el modelo `App.brand` (`#695ede`→`#ea580c`). *(hecho)*
- [ ] **Generalizar la resolución de tenant** para el dominio de plataforma: hoy el frontend
      defaultea a `'sanpedro'` y el sufijo de subdominio está hardcodeado a `.misanpedro.app`
      (web `tenant.ts` y api `middleware/tenant.ts`). → hacerlo **configurable por env**
      (`VITE_PLATFORM_DOMAIN` / `PLATFORM_HOST_SUFFIX`) para que cada subdominio resuelva su slug
      sin default a San Pedro. *(se hace cuando se sepa el dominio)*
- [ ] **Landing del vecino tenant-aware:** hoy el copy es de San Pedro ("El club de ahorro de San
      Pedro"). → leer `nombre`/`ciudad` del config del tenant (o landing mínima por-ciudad).
- [ ] **(Opcional) Color por-ciudad:** cablear `--color-brand` desde `brand.primaryColor` del
      tenant (hoy se setea `--tenant-primary` pero la app usa `--color-brand` del build). Si todas
      las ciudades comparten el naranja de plataforma, NO hace falta.

### Ops — cuando esté el dominio
- [ ] Comprar el dominio de plataforma (ej. `miciudad.app`).
- [ ] **Wildcard DNS** `*.<dominio>` → el host donde se sirve la app.
- [ ] **SSL wildcard** (`*.<dominio>`).
- [ ] (Opcional por ciudad) dominio propio + su DNS/SSL → setear `customDomain` en la App.

## 5. Playbook — "encender una ciudad" (cuando esté el dominio)
1. **Datos de la ciudad:** `slug` (ej. `narino`), `nombre` ("Mi Nariño"), `ciudad`, `provincia`,
   `geoCenter` (lat/lng del centro — se geocodifica), `operator` (nombre/email/whatsapp).
2. **Crear la App:** `POST /owner/apps` (o el panel owner, o un script en lote).
3. **DNS:** `<slug>.<dominio>` ya resuelve por el wildcard → sirve la misma app, que detecta el
   slug del subdominio y carga su config.
4. **Listo:** la ciudad arranca **vacía** (0 comercios / 0 cupones / 0 usuarios — aislada por
   `appId`). Se onboardean los comercios (alta sin fricción) y los vecinos (claim por teléfono),
   todo por-ciudad.
5. **(Opcional)** dominio propio: comprar + setear `customDomain`.

## 6. Marca
- Identidad unificada de plataforma: **"Mi[Ciudad]"** en **naranja** (`--color-brand #ea580c`),
  isotipo sello (%). Da coherencia y reduce trabajo por ciudad.
- Color/logo por-ciudad: posible a futuro (campos `brand` en el modelo); no necesario al arrancar.

## 7. San Pedro (piloto)
- Sigue en vivo en `misanpedro.com` / `app.misanpedro.com`. Cuando esté el dominio de plataforma,
  San Pedro puede: (a) quedarse en su dominio propio (modelo `customDomain` = `misanpedro.com`), o
  (b) migrar a `sanpedro.<dominio>`. Recomendado: **(a)** — ya tiene tracción y marca propia.

## 8. Qué necesito de vos para ejecutar
1. **El dominio de plataforma** comprado (+ acceso al DNS).
2. **La lista de ciudades a encender** con: slug, nombre, ciudad/provincia (las coordenadas las
   geocodifico yo).
3. Confirmar si todas comparten el **naranja** de plataforma (recomendado) o cada una quiere su color.

> Apenas tengas el dominio: yo hago la generalización de resolución + la landing tenant-aware + el
> script de creación en lote, y encendemos todas las ciudades de la lista el mismo día.
