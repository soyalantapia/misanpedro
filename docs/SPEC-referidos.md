# Spec — Programa de Referidos de Comercios (panel administrador)

**Estado:** Draft para revisión · **Fecha:** 2026-05-30 · **Repo:** misanpedro · **Slug:** soyalantapia-misanpedro

## Contexto

Mi San Pedro capta comercios con "3 meses gratis sin tarjeta" (pivot actual: el comercio nace `activo`, sin Mercado Pago; `Merchant.freeTrialUntil` marca el fin del gratis pero hoy no corta nada). Para crecer la base de comercios con costo de adquisición ~0, queremos un **loop de referidos comercio→comercio**: cada comercio comparte un link; cuando el comercio referido **se registra y publica su primer cupón activo**, el que refirió gana **1 semana gratis extra** (se le corre la fecha de cobro).

**Decisión de modelo de cobro (locked):** el período gratis pasa a ser un **corte real** — cuando se active el cobro (Mercado Pago, fase aparte), se cobra al vencer `freeTrialUntil`. El referido **estira esa fecha**. Por eso el premio tiene valor económico real y hay que blindarlo contra abuso.

## Estado actual (verificado en código)

| Pieza | Archivo | Hoy |
|---|---|---|
| Modelo comercio | `apps/api/src/models/Merchant.ts` | Tiene `appId`, `slug`, `estado`, `cuit`, `telefono`, `freeTrialUntil`. **No** tiene campos de referido. |
| Alta comercio | `apps/api/src/routes/merchant-auth.ts` (`POST /signup`) | Crea `Merchant` (`estado:'activo'`, `freeTrialUntil = now+90d`) + `MerchantUser`. No lee ningún `ref`. |
| Crear cupón | `apps/api/src/routes/coupons.ts` (`POST /`) | Crea `Coupon`; ya dispara `sendCouponPush` (Web Push a vecinos). **Punto de enganche del trigger.** |
| Push | `apps/api/src/services/push.service.ts` | Infra de Web Push ya existe (reusar para avisar al referidor). |
| Panel comercio | `apps/web/src/pages/admin/*` + `layouts/MerchantShell.tsx` | Rutas admin bajo `MerchantShell`. Sumar `/admin/referidos`. |
| Panel owner | `apps/web/src/pages/owner/*` + `apps/api/src/routes/owner.ts` | Super-admin del operador. Sumar dashboard de referidos. |
| Multi-tenant | `middleware/tenant.ts` | Todo scoped por `appId` + header `X-Tenant-Slug`. Referidos: **misma ciudad**. |

## Cambio propuesto

### 1. Data model

**`Merchant.ts` — campos nuevos:**
```ts
referralCode:        { type: String, index: true },   // único por appId; se genera al signup (o lazy)
referredByCode:      { type: String },                // crudo, para auditoría
referredByMerchantId:{ type: Types.ObjectId, ref: 'Merchant' }, // referidor resuelto (mismo appId, no self)
referralWeeksEarned: { type: Number, default: 0 },     // semanas acreditadas (para el tope de 8)
firstCouponAt:       { type: Date },                    // 1er cupón activo (hace idempotente el trigger)
```
Índice nuevo: `{ appId: 1, referralCode: 1 }` unique sparse.

**`Referral.ts` — colección nueva (audit + dedupe + idempotencia + dashboard owner):**
```ts
appId:               ObjectId (ref App, index)
referrerMerchantId:  ObjectId (ref Merchant, index)
referredMerchantId:  ObjectId (ref Merchant, index)
referredByCode:      String
status:              'pending' | 'confirmed' | 'rejected'
rejectedReason?:     'self' | 'duplicate_contact' | 'cap_reached' | null
weeksGranted:        Number (0 ó 1)
createdAt / confirmedAt
```
Índice unique `{ appId: 1, referredMerchantId: 1 }` → **un referido cuenta una sola vez** (idempotencia natural).

### 2. Flujo (diagrama)

```
Comercio A (referidor)
   └─ /admin/referidos  → ve su link:  {APP_URL_FRONT}/#/admin/registro?ref=<referralCode>
        └─ comparte por WhatsApp ─────────────────────────────┐
                                                              ▼
Comercio B (referido) abre el link → AdminSignupPage lee ?ref=<code>
   └─ POST /merchant/auth/signup { ..., ref:<code> }
        ├─ resolver code → referrer (mismo appId)
        ├─ DEDUPE: si email/CUIT/tel de B == los de A  → Referral(status:'rejected', reason:'self')
        │          (no se crea crédito)
        └─ si válido → Merchant B {referredByCode, referredByMerchantId}
                       + Referral(status:'pending')
                              │
Comercio B publica 1er cupón activo → POST /coupons (create)
   └─ si B.firstCouponAt vacío:
        ├─ set B.firstCouponAt = now
        └─ si existe Referral(B, status:'pending'):
              ├─ CAP: A.referralWeeksEarned < 8 ?
              │     sí → A.freeTrialUntil += 7d ; A.referralWeeksEarned += 1 ; weeksGranted=1
              │     no → weeksGranted=0 ; rejectedReason='cap_reached' (igual status:'confirmed')
              ├─ Referral.status='confirmed', confirmedAt=now
              └─ avisar a A: in-app (badge en /admin/referidos) + Web Push  ✅ "Ganaste 1 semana gratis"
```

Todo el crédito ocurre **una vez** (gateado por `firstCouponAt` vacío + `Referral` pending + índice unique). Idempotente ante reintentos.

### 3. API

| Método + ruta | Auth | Qué hace |
|---|---|---|
| `POST /merchant/auth/signup` (extender) | público+tenant | Acepta `ref?` en el body; resuelve referidor; aplica dedupe; crea `Referral(pending)`. |
| `POST /coupons` (extender) | merchant | Al detectar 1er cupón activo, confirma el `Referral` pendiente y acredita la semana al referidor (con tope). |
| `GET /referrals/me` | merchant | `{ code, link, pendientes, confirmados, weeksEarned, cap:8, freeTrialUntil }`. Genera `referralCode` lazy si falta. |
| `GET /owner/referrals` | super-admin | Por ciudad: confirmados, pendientes, total semanas regaladas, top referidores. |

`shared/schemas.ts`: `merchantSignupSchema` suma `ref: z.string().optional()`.

### 4. Frontend — panel comercio (lo que pediste)

- **Ruta `/admin/referidos`** (en `App.tsx` dentro de `MerchantShell`) + ítem en el nav del panel ("Recomendá y ganá").
- **`AdminReferidosPage`** (MVP esencial, con el nuevo design system `fin-*`):
  - Hero: "Recomendá un comercio y ganá 1 semana gratis por cada uno".
  - Card del link: `referralCode` + botón **Compartir por WhatsApp** (copy listo) + copiar al portapapeles.
  - Card de progreso: **Pendientes / Confirmados / Semanas ganadas (x/8) / Tu nueva fecha de cobro**.
  - "Cómo funciona" (3 pasos) + nota de términos (1 semana por referido que se registra y publica su 1er cupón; tope 8).
- **`AdminSignupPage`**: leer `?ref=` (HashRouter → `useSearchParams`), pasar `ref` al signup, y mostrar banner "Te invitó un comercio 👋".
- **Aviso de acreditación:** Web Push (reusar push.service) + badge/contador en `/admin/referidos`.

### 5. Frontend — panel owner

- Vista "Referidos": tabla por ciudad (confirmados, pendientes, semanas regaladas), top referidores, costo estimado (semanas × valor del plan).

## Anti-abuso (locked: dedupe + tope)

1. **Auto-referido:** rechazar si email/CUIT/teléfono del referido coincide con el del referidor.
2. **Duplicado:** índice unique `{appId, referredMerchantId}` → un referido nunca cuenta dos veces. Además rechazar si el contacto (email/CUIT/tel) del referido ya pertenece a otro comercio del tenant.
3. **Tope:** `referralWeeksEarned ≤ 8`. Pasado el tope, el referido se confirma pero `weeksGranted=0`.
4. El crédito se aplica **al confirmar** (1er cupón), no al registrarse → evita altas vacías.

## Acceptance criteria

1. `GET /referrals/me` devuelve un `referralCode` estable y el link armado, para un comercio sin código previo (lazy-gen).
2. Alta con `?ref=<code>` válido de otra cuenta del mismo tenant → crea `Referral(pending)` con `referrerMerchantId` correcto.
3. Alta con `?ref=` propio (mismo email/CUIT/tel) → `Referral(rejected, reason:'self')`, **sin** crédito.
4. Referido publica su 1er cupón activo → `Referral`→`confirmed`, referidor `freeTrialUntil` +7d exactos y `referralWeeksEarned` +1, **una sola vez** (republicar/editar no vuelve a acreditar).
5. Referidor con 8 semanas ya ganadas → nuevo referido confirma con `weeksGranted=0` (no supera el tope).
6. `/admin/referidos` muestra link, contadores y la nueva fecha de cobro; el botón WhatsApp abre `wa.me` con el link.
7. Owner ve el agregado por ciudad.
8. Todo scoped por `appId` (un referido de otra ciudad no acredita).

## Plan de testing

| Capa | Qué | Aprox |
|---|---|---|
| Unit | resolver code, dedupe (self/dup), cap, +7d | +6 |
| Integration | signup?ref → pending → 1er cupón → confirmed (+ idempotencia) | +4 |
| E2E (Playwright) | comercio A copia link → B se registra → B crea cupón → A ve +1 semana | +1 |

## Rollback

Feature-flag por tenant (`App.settings.referralsEnabled`, default off) → apagar sin deploy. Revertir = flag off; los campos/colección quedan inertes. La extensión de `freeTrialUntil` es aditiva (no destructiva).

## Effort (estimado)

Backend modelos+migración 3h · signup/coupons hooks 3h · endpoints me/owner 3h · UI `/admin/referidos` 4h · signup `?ref` + banner 1.5h · owner UI 2.5h · tests 4h · **≈21h**.

## Archivos

| Archivo | Cambio |
|---|---|
| `apps/api/src/models/Merchant.ts` | + campos referido |
| `apps/api/src/models/Referral.ts` | **nuevo** |
| `apps/api/src/models/index.ts` | export Referral |
| `apps/api/src/routes/merchant-auth.ts` | signup resuelve `ref` + dedupe + Referral(pending) |
| `apps/api/src/routes/coupons.ts` | confirmar referral en 1er cupón |
| `apps/api/src/routes/referrals.ts` | **nuevo** (`GET /me`) |
| `apps/api/src/routes/owner.ts` | + `GET /owner/referrals` |
| `apps/api/src/index.ts` | montar `/referrals` |
| `apps/api/src/services/push.service.ts` | + `sendReferralConfirmedPush` |
| `packages/shared/src/schemas.ts` | `merchantSignupSchema` + `ref?` |
| `apps/web/src/pages/admin/AdminReferidosPage.tsx` | **nuevo** |
| `apps/web/src/pages/admin/AdminSignupPage.tsx` | leer `?ref` + banner |
| `apps/web/src/App.tsx` + `layouts/MerchantShell.tsx` | ruta + nav |
| `apps/web/src/lib/api.ts` | cliente `referrals.me()` |
| `apps/web/src/pages/owner/*` + `owner/lib/api.ts` | vista referidos |

## Fuera de alcance (fase 2)

- Lista detallada de referidos / leaderboard en el panel comercio (MVP es "esencial").
- Cobro real con Mercado Pago (es prerequisito conceptual pero feature aparte).
- Referidos cross-ciudad. Recompensas al referido (solo gana el referidor por ahora).
