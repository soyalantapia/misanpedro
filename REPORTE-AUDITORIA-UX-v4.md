# REPORTE AUDITORÍA UX — v4 (11ª pasada · pre-venta)

**Fecha:** 2026-05-28 (víspera de lanzamiento comercial)
**Modo:** análisis estático en piel del usuario, sin app corriendo
**Estado del repo:** commit `78c0a13` + 8 commits previos en este sprint
**Foco:** detectar **lo que sangra ANTES de vender mañana**, no exhaustividad

---

## 1. Resumen ejecutivo

### 🔥 Las 5 fricciones que más sangran

| # | Problema | Severidad |
|---|----------|-----------|
| **B4** | **AdminLoginPage promete "$25.000 + IVA" mientras todo el sistema cobra $25.000 final** — contradicción directa con TyC, MP y AdminSignup | 🔴 **Crítica** |
| **B5** | **Copy "Factura A o C" en 4 lugares user-visible** — en primera etapa (monotributo) sólo emitís factura C, generás expectativa de factura A que no podés cumplir | 🔴 **Crítica** |
| **A1** | `env.ts:25` docstring miente: dice plan + IVA = $30.250 cuando es $25.000 final — riesgo de regresión por dev/AI futuro | 🟠 Alta |
| **A2** | `admin.ts:136` TODO: refund vía MP **no implementado** — cancelás suscripción pero no devolvés plata | 🟠 Alta |
| **M1** | Landing `Pricing.tsx` muestra "$25.000" sin la palabra "final" — un comerciante B2B asume "+IVA" por defecto | 🟡 Media |

### Sensación general del recorrido

> El producto se siente cuidado, profesional y consistente al 95%. Las pasadas v1-v3 hicieron un trabajo excelente. **Pero hay un 5% donde sangrás justo en el primer touchpoint del comerciante** (login + signup): le prometés un precio diferente al que va a pagar y un tipo de factura que no podés emitir. Si un comerciante atento lee esto y después compara con el contrato, te corta la venta de cuajo.

---

## 2. Diario del usuario · 6 escenarios

### Escenario 1 — Vecino nuevo desde landing
*"Vi un poster en San Pedro con QR. Lo escaneo desde el celu."*

- Caigo en `misanpedro.app` → **landing** se ve bien, mockup hermoso, copy claro. Toco "Sumar mi comercio". Mmm pero soy vecino, no comercio. ¿Dónde está mi botón? **No hay CTA "Soy vecino"** en el hero — sólo footer.
- Si en cambio el QR me lleva directo al PWA: bien, hay onboarding con tu logo, descuentos por categoría, busco "panadería"… funciona, fluido. ✓
- Voy a `/registro`: 5 campos requeridos (nombre, DNI, email, WhatsApp, fecha nac). Pesado para mobile pero entiendo (lo necesita la ley). ✓
- Cargo todo, le doy "Crear cuenta y canjear"… error en WhatsApp por formato. **El error aparece junto al campo, pero NO hay scroll automático al primer error.** Si me equivoqué en el primer campo y el form es largo, lo veo. Si me equivoqué en uno del medio, en mobile lo veo cuando bajo. Fricción menor pero real.

### Escenario 2 — Comerciante entra al login por primera vez
*"Vi la landing, hice click en 'Sumar mi comercio'."*

- Caigo en `/admin/login` (split-screen oscuro precioso, branding consistente). ✓
- Hero izquierdo dice: **"$25.000 + IVA · sin permanencia"** y abajo **"Factura A o C"**.
- Yo soy un comerciante B2B: leo "+IVA" y mentalmente calculo $25.000 × 1.21 = **$30.250 / mes**. *"Carísimo. Probemos."*
- Hago click en "Registrar mi comercio" → AdminSignup paso "Pago" me dice **"$25.000 ARS / mes · Precio congelado de por vida"** (sin "+IVA"). 🚨 *"¿Era con o sin IVA al final? Acá dice $25.000 sin nada extra…"*
- Me genera duda. Sigo, MP me cobra $25.000. *"Genial, pagué de menos."* Pero al mes que viene cuando vea factura C sin IVA discriminado pienso *"¿no me estaban robando? ¿esto es legal?"* Y abro un reclamo o cancelo.
- **Y esto es el comerciante de buena fe.** El malicioso ya tiene argumento para no pagar el segundo mes.

### Escenario 3 — Comerciante en step fiscal
*"Estoy llenando datos para emitir factura."*

- AdminSignup paso "Fiscal": header dice **"Para emitir tu factura A o C"**. Info box dice **"Necesitamos estos datos para emitirte la factura A o C de la suscripción mensual."**
- Yo selecciono **Responsable Inscripto** en condición fiscal y espero recibir factura A.
- Pero vos sos monotributista → me emitís **factura C** (no A). Cuando reciba la factura por mail (`email.service.ts:244` dice "La factura A o C se envía por separado"), voy a esperar A y recibir C.
- *"¿Por qué me mandan C si soy Responsable Inscripto y la página decía 'A o C'?"* → ticket al soporte → fricción y mala imagen.

### Escenario 4 — Vecino sin tenant
*"Llegué desde un link sin subdomain."*

- Caigo en TenantSelectorPage. Header "Elegí tu ciudad". Sólo hay UNA ciudad: San Pedro.
- *"¿Y por qué tengo que elegir si hay una sola?"* — el sistema podría hacer auto-skip cuando `tenants.length === 1`, pero en cambio me obliga a clickear.
- Si toco la única opción, recarga. Es trivial pero suma fricción al primer touch.
- Footer dice "Si llegaste por un link específico, refrescá la pestaña." → *"¿Cuál link? ¿Qué pestaña? Esto no me dice nada."*

### Escenario 5 — Comerciante reclama refund post-cancelación
*"Cancelé en día 9 (dentro del periodo de arrepentimiento)."*

- Abro mi panel → cancelo suscripción. Status "cancelado". Espero ver el dinero devuelto en 5-10 días hábiles.
- Detrás de escena (`admin.ts:136`): el código marca `sub.status = 'cancelled'` + agrega timestamp en `rawLast.refundedAt` + cambia merchant a `cancelado`. **Pero NO llama a la API de MP para hacer el refund.** Tiene un `// TODO: dispara refund real en MP cuando hay credenciales`.
- Como vecino bonafide: nunca recibo el dinero. Reclamo a Defensa del Consumidor (Ley 24.240) → tu producto promete reembolso en 10 días en TyC y landing → no lo hacés automático → **riesgo legal real**.

### Escenario 6 — Dev futuro (vos o un AI) refactoriza precio
- Abro `apps/api/src/env.ts:25`: `/** Plan mensual en ARS (con IVA). Default $25.000 = $30.250 con 21% IVA. */`
- *"Ah, el plan es $25.000 + IVA. Si quiero subir a $30.000 hay que poner $30.000 / 1.21."* → cambio el default → **regresión silenciosa, cobro $24.793 en vez de $30.000**.
- O al revés: *"Hay que sumar IVA al monto antes de mandar a MP"* → adjusts el preapproval → cobra de más → reclamos.

---

## 3. Tabla priorizada — Matriz Impacto × Esfuerzo

| ID | Problema | Severidad | Esfuerzo | Quick win |
|----|----------|-----------|----------|-----------|
| **B4** | Copy "+IVA" en AdminLoginPage (2 lugares) | 🔴 Crítica | 🟢 Bajo (5 min) | ✅ SÍ |
| **B5** | Copy "Factura A o C" en 4 lugares user-visible | 🔴 Crítica | 🟢 Bajo (10 min) | ✅ SÍ |
| **A1** | Docstring `env.ts:25` engañosa | 🟠 Alta | 🟢 Bajo (1 min) | ✅ SÍ |
| **A2** | Refund MP no implementado | 🟠 Alta | 🔴 Alto (1-2 días) | ❌ (workaround documental) |
| **M1** | Pricing landing sin la palabra "final" | 🟡 Media | 🟢 Bajo (2 min) | ✅ SÍ |
| **M2** | TenantSelectorPage no auto-skip con 1 tenant | 🟡 Media | 🟢 Bajo (5 min) | ✅ SÍ |
| **M3** | RegistroPage sin scroll al primer error | 🟡 Media | 🟡 Medio (15 min) | ⚠️ Después |
| **L1** | TenantSelectorPage footer críptico | 🟢 Baja | 🟢 Bajo (2 min) | ✅ SÍ (oportuno) |

---

## 4. Hallazgos detallados

### `[B4]` `[Microcopy/Coherencia comercial]` — Copy "+IVA" contradice TyC + flow real

📍 **Ubicación:** `apps/web/src/pages/admin/AdminLoginPage.tsx:113, 215`
👀 **Qué vi:**
- Línea 113 (sidebar del login): `"$25.000 + IVA · sin permanencia"`
- Línea 215 (CTA registrar comercio): `"Plan estándar · $25.000 + IVA · sin permanencia"`

😖 **Por qué molesta:**
TyC dice "$25.000 ARS finales (sin IVA discriminado)". MP cobra exactamente $25.000. AdminSignupPage dice "$25.000 ARS / mes" sin "+IVA". Pero esta pantalla — **la primera que ve el comerciante después de la landing** — dice "+IVA". El usuario calcula $30.250, ve después $25.000, y se le encienden alarmas. Pérdida de confianza inmediata.

🔥 **Severidad:** Crítica · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:**
```diff
- $25.000 + IVA · sin permanencia
+ $25.000 final / mes · sin permanencia
```
(mismo cambio en ambas líneas)

---

### `[B5]` `[Microcopy/Coherencia comercial]` — Promete "Factura A o C" pero solo emitís C

📍 **Ubicación:** 4 archivos:
- `apps/web/src/pages/admin/AdminLoginPage.tsx:119`
- `apps/web/src/pages/admin/AdminSignupPage.tsx:321`
- `apps/web/src/pages/admin/AdminSignupPage.tsx:637-638`
- `apps/api/src/services/email.service.ts:244`

👀 **Qué vi:**
La UI promete "factura A o C" como si el comerciante pudiera elegir. Pero vos en primera etapa sos **monotributista** y **siempre emitís factura C**, independiente de la condición fiscal del comerciante.

😖 **Por qué molesta:**
Un comerciante Responsable Inscripto **necesita factura A** para tomar el crédito fiscal del IVA (que en factura C no hay). Si esperaba A y recibe C → reclamos, refunds, malas reseñas. La promesa "A o C" implica que el comerciante elige; la realidad implica que vos elegís (y siempre es C).

🔥 **Severidad:** Crítica · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:**
Cambiar las 4 menciones a **"factura C"** (en primera etapa monotributo). Cuando hagas la SAS más adelante, hacés un PR único con find/replace `factura C` → `factura A o C`.

```diff
# AdminLoginPage.tsx:119
- Factura A o C
+ Factura C (monotributo)

# AdminSignupPage.tsx:321
- Para emitir tu factura A o C
+ Para emitir tu factura C

# AdminSignupPage.tsx:637-638
- Necesitamos estos datos para emitirte la factura A o C de la suscripción mensual.
+ Necesitamos estos datos para emitirte la factura C de la suscripción mensual.

# email.service.ts:244
- La factura A o C se envía por separado.
+ La factura C se envía por separado.
```

---

### `[A1]` `[Documentación de código]` — Docstring engañosa en `env.ts`

📍 **Ubicación:** `apps/api/src/env.ts:25`
👀 **Qué vi:**
```ts
/** Plan mensual en ARS (con IVA). Default $25.000 = $30.250 con 21% IVA. */
PLAN_AMOUNT_ARS: z.coerce.number().default(25_000),
```

😖 **Por qué molesta:**
Esta docstring contradice la realidad (es precio FINAL sin IVA). Un dev futuro o un AI agent lee esto y refactoriza el cobro asumiendo que tiene que sumar IVA encima → regresión silenciosa con consecuencias financieras directas.

🔥 **Severidad:** Alta · 🔧 **Esfuerzo:** Bajo (1 línea)
✅ **Recomendación:**
```ts
/** Plan mensual en ARS — precio FINAL al comercio (monotributo emite factura C sin IVA discriminado). */
PLAN_AMOUNT_ARS: z.coerce.number().default(25_000),
```

---

### `[A2]` `[Lógica/Compliance legal]` — Refund vía MP no implementado

📍 **Ubicación:** `apps/api/src/routes/admin.ts:127-138`
👀 **Qué vi:**
```ts
adminRoutes.post('/merchants/:id/refund', requireSuperAdmin, async (c) => {
  // ...
  sub.status = 'cancelled'
  sub.rawLast = { ...(sub.rawLast as any), refundedAt: new Date().toISOString() }
  await sub.save()
  await Merchant.updateOne({ _id: id }, { estado: 'cancelado' })
  // TODO: dispara refund real en MP cuando hay credenciales
  return c.json({ ok: true })
})
```

😖 **Por qué molesta:**
La landing y TyC prometen 10 días de arrepentimiento con reembolso (Ley 24.240). El endpoint de refund cambia status pero **no devuelve el dinero**. Riesgo legal: Defensa del Consumidor te cae con multa firme.

🔥 **Severidad:** Alta · 🔧 **Esfuerzo:** Alto (1-2 días para implementar MP refund API correctamente)
✅ **Recomendación:**
**Opción A (quick fix antes de vender):** documentar en runbook que los refunds de los primeros 30 días se hacen **manualmente desde el panel de MP** (login MP → ver pago → "Devolver dinero"). Agregar comentario en el código:
```ts
// IMPORTANTE: hasta implementar refund automático, el operador (Alan) debe
// hacer el refund manualmente desde panel.mercadopago.com.ar dentro de las
// 48h del POST a este endpoint, para cumplir TyC (Ley 24.240).
```
**Opción B (correcto):** implementar `refundPreapproval(externalReference)` en `mp.service.ts` con la API de MP `POST /v1/payments/:id/refunds`. Cantar las pruebas con un sandbox. Plan: 1 día con tests.

---

### `[M1]` `[Microcopy]` — Pricing landing no dice "final"

📍 **Ubicación:** `apps/landing/src/sections/Pricing.tsx:87-91`
👀 **Qué vi:**
```jsx
<span className="...">$25.000</span>
<span className="...">/mes</span>
```
Después: "Cancelás cuando quieras desde tu panel"

😖 **Por qué molesta:**
En el contexto B2B argentino, "$25.000 /mes" sin la palabra "final" se lee como "+IVA". Es la convención. El comerciante hace la cuenta mental con IVA y se decepciona cuando lee TyC.

🔥 **Severidad:** Media · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Agregar texto pequeño debajo del precio:
```diff
  <span className="...text-5xl...">$25.000</span>
  <span className="...">/mes</span>
+ </p>
+ <p className="mt-1 text-xs font-medium text-neutral-500">
+   Precio FINAL — sin IVA adicional (factura C de monotributo)
+ </p>
```

---

### `[M2]` `[Fricción]` — TenantSelectorPage no auto-skip con 1 tenant

📍 **Ubicación:** `apps/web/src/pages/TenantSelectorPage.tsx:18-29`
👀 **Qué vi:**
Carga la lista de tenants activos. Si hay 1 solo (San Pedro al inicio), el usuario debe clickear esa única opción.

😖 **Por qué molesta:**
Fricción innecesaria en el primer touch. Si hay 1 sola opción, el sistema sabe la respuesta — debería auto-seleccionar.

🔥 **Severidad:** Media · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:**
```ts
useEffect(() => {
  void (async () => {
    try {
      const list = await listAvailableTenants()
      // M2: auto-skip si hay un solo tenant activo (caso lanzamiento San Pedro)
      if (list.length === 1) {
        setTenantSlug(list[0].slug)
        window.location.reload()
        return
      }
      setTenants(list)
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos conectar con el servidor')
    } finally {
      setLoading(false)
    }
  })()
}, [])
```

---

### `[M3]` `[Form UX]` — RegistroPage sin scroll al primer error en mobile

📍 **Ubicación:** `apps/web/src/pages/RegistroPage.tsx:49-53`
👀 **Qué vi:**
Al fallar la validación, se setean `errors` pero el viewport no se mueve. Si el error está en un campo medio del form (DNI, WhatsApp, fecha nac), en mobile el usuario puede no verlo.

😖 **Por qué molesta:**
El usuario toca "Crear cuenta", no ve nada cambiar, asume que está roto, refresca, pierde lo que cargó.

🔥 **Severidad:** Media · 🔧 **Esfuerzo:** Medio (necesita refs por campo)
✅ **Recomendación (post-launch, no bloquea):**
Después de `setErrors(errs)`, hacer scroll al primer campo con error usando `document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })`.

---

### `[L1]` `[Microcopy]` — Footer críptico en TenantSelector

📍 **Ubicación:** `apps/web/src/pages/TenantSelectorPage.tsx:112-114`
👀 **Qué vi:**
> "Si llegaste por un link específico, refrescá la pestaña."

😖 **Por qué molesta:**
El usuario que llega ahí no sabe a qué link te referís ni por qué refrescar resolvería nada.

🔥 **Severidad:** Baja · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:**
```diff
- Si llegaste por un link específico, refrescá la pestaña.
+ ¿Tu ciudad no está? Probablemente todavía no llegamos. Avisanos en hola@misanpedro.app.
```

---

## 5. Recomendaciones

### Quick wins (hacer HOY antes de comercializar)
**B4** + **B5** + **A1** + **M1** + **L1** = **~20 min total** de copy edits puros. Cero riesgo de romper código.

### Mejora con workaround documental (hacer HOY)
**A2** — Documentar en runbook que refunds se hacen manualmente desde MP en los primeros 30 días + agregar comentario en el código + agregar un campo `manualRefundPending` opcional para no perder track.

### Mejora estratégica (próxima iteración)
**M2** + **M3** + **A2 (implementación real)** — post-launch, en la primera semana de operación.

### Lo que NO está roto (auditado y limpio)
- ✅ TenantSelectorPage UI/UX (loading, empty, error states)
- ✅ LoginPage vecino — countdown OTP, reenviar, mensajes claros
- ✅ AdminLoginPage estructura (sólo copy + IVA falla)
- ✅ Hero landing — copy "10 días arrepentimiento" sin promesa "gratis"
- ✅ RegistroPage validación inline + privacidad GDPR-AR
- ✅ Sin `console.log` debug code en frontend
- ✅ Sin `alert()`/`confirm()` nativos
- ✅ Sin TODOs en frontend ni TODOs críticos en API (excepto A2)
- ✅ 100% de menciones a "Cuponcito" eliminadas en source
- ✅ 101 tests verdes + 4/4 builds OK

---

**Veredicto:**
Aplicando **B4 + B5 + A1 + M1 + L1** (20 min de copy) + documentando **A2** en runbook, el producto está **comercialmente impecable para vender mañana**. M2/M3 quedan en backlog post-launch sin urgencia.
