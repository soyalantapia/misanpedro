# Revisión PM / UX-UI — Mi San Pedro (pasada 2)

**Fecha:** Junio 2026 · **Rama revisada:** `feat/onboarding-vecino-sin-friccion` · **Método:** revisión por código (lectura de pantallas/flujos + verificación de git contra la pasada anterior). No se corrió en vivo; lo que depende de runtime se marca como "verificar".

**Lente (en orden):** 1) Intuitivo · 2) Funcional · 3) Buen UX/UI. **Enfoque PM:** se prioriza por impacto en la métrica norte (el vecino canjea en 7 días) y en adquisición/retención de comercios.

**Severidad:** 🔴 Crítico · 🟠 Alto · 🟡 Medio · ⚪ Bajo · 🟢 Resuelto desde la pasada anterior.

---

## 0. Qué cambió desde la pasada anterior

- 🟢 **RESUELTO: onboarding del vecino sin fricción.** Commit `4de50ae`: claim por teléfono, sesión permanente, sin OTP, sin "Salir", sin DNI/email/fecha. (Evidencia: `PerfilPage.tsx` ahora dice "nombre y teléfono — nada de DNI" y "vuelve a estado anónimo, sin Salir".) Era uno de los hallazgos altos: ya no.
- 🟢/✏️ **CORRECCIÓN de marca:** la identidad NO es "blanco+verde" como dije en la pasada 1. Es **naranja `--color-brand: #ea580c`** como único knob (escala derivada por color-mix), con **verde `#059669` (`--color-up`) reservado al ahorro/positivo**. Por eso "Ahorrás ~$X" va en verde y los CTA en naranja. Mi finding de "blanco+verde" queda corregido.
- 🆕 **Superficies nuevas que aún NO audité a fondo** (landearon recién): "El Club" (`ClubCard`, con test), **Alertas** (`AlertasPage`, estilo Despegar), nav reordenada (Descuentos al centro), emoji por categoría, mapa lista/fly, kit de marca + isotipo, rework de landing (vecino + comercios), plan de marketing AARRR. Recomiendo una pasada enfocada sobre estas.

---

## 1. Resumen ejecutivo

El producto sigue muy avanzado y ahora **resolvió la fricción de onboarding del vecino** (gran avance: anónimo → teléfono al canjear, sin logout). Lo que queda pegándole a la métrica norte y a la adquisición:

1. 🔴 **El canje todavía se traba detrás del monto manual obligatorio** del cajero — ahora es el hallazgo #1.
2. 🟠 **El alta del comercio sigue exigiendo datos fiscales** (CUIT, razón social) — el fix está prompteado pero no aplicado.
3. 🟠 **El asesor sigue pidiendo el producto estrella DESPUÉS de la jugada** → copy genérico y título que puede contradecir el %.
4. 🟠 **Fallback a datos mock en prod** puede mostrar data fantasma.
5. 🟡 **La card del vecino muestra "Ahorrás ~$X" aunque no haya precio real.**

---

## 2. Hallazgos por área

### VECINO (app)

**🟢 RESUELTO — Onboarding sin fricción.** Ya implementado (claim por teléfono, sesión permanente, sin OTP, sin "Salir", sin DNI/email/fecha). No hace falta más acá; solo QA del flujo real.

**🟡 [CONFUSO] La card muestra "Ahorrás ~$X" aunque no haya precio real.**
`CouponCard.tsx:24-26`: si no hay `precioReferencia`, usa `calcAhorro(porcentaje)` (número estimado/inventado). La card siempre afirma un ahorro en pesos (en verde).
*Recomendación:* mostrar pesos SOLO con `precioReferencia` real; si no, mostrar el "%". Refuerza empujar `precioReferencia` en el alta del cupón.

**⚪ [CONFUSO] Copy stale de expiración.** `MisCuponesPage.tsx:141`: toast "Tenés 30 minutos para usarlo", pero los códigos ya no expiran por tiempo. (Verificar si sigue.) Sacar el "30 minutos".

**🆕 A auditar:** "El Club" (niveles del mes / sorteo) y **Alertas** — landearon recién, no revisados a fondo. Chequear que el Club calcule bien el nivel mensual y que Alertas no sature ni confunda.

### COMERCIO (panel)

**🔴 [BUG] El canje cuelga del monto manual obligatorio. (ahora el #1)**
`AdminConfirmarCanjePage.tsx`: "El monto del ticket es obligatorio" / "Falta el monto" — el cajero no puede confirmar sin tipearlo. Fricción en el momento de la verdad + dato frágil.
*Recomendación:* pre-cargar el monto desde `precioReferencia`; nunca bloquear el canje por ese campo.

**🟠 [BUG] El asesor pregunta el gancho después de la jugada.**
`AdminCuponEditPage.tsx:437`: `PASOS = ['objetivo','jugada','gancho',...]`. La jugada/título usan el producto estrella pero se pide después → copy genérico ("tu producto estrella") y título que hornea el % (puede contradecir el % real si el costo lo capa).
*Recomendación:* reordenar a objetivo → gancho → jugada → …; no meter el número en el string del título.

**🟠 [BUG/CONFUSO] El alta del comercio sigue exigiendo lo fiscal.**
`AdminSignupPage.tsx`: todavía tiene pasos `'fiscal'|'pago'` y campos CUIT/razón social/condición/domicilio + `validateCuit`. Muro contradictorio en plena adquisición, para algo que hoy no se cobra. (Fix ya prompteado, no aplicado.)
*Recomendación:* sacar lo fiscal del alta; diferirlo al cobro; empujar el perfil (fotos/horarios) en su lugar.

**🟡 [CONFUSO] Glosario "cupón" vs "descuento"** entre el editor y el listado (verificar si sigue). Unificar en "descuento" del lado comercio.

**🟡 [POLISH] Tipos de oferta a medio exponer** (`tipoOferta` en datos pero UI fuerza %). (Decisión ya tomada: sumar happy hour + precio fijo.)

### OWNER

**🟡 [BUG] Falta la vista de Referidos + promesa rota** (el referido nuevo no recibe los "15 días extra" del banner; solo acredita al referidor). Verificar si sigue.

### LANDING

**🟡 A re-auditar:** la landing tuvo un rework reciente (commits `c4e79fb`, `b429f02`). Re-chequear coherencia del pivot ("MercadoPago integrado" mientras MP está bypasseado) y la narrativa.

### TRANSVERSAL

**✏️ CORRECCIÓN:** marca = **naranja `#ea580c`** (single knob), verde `#059669` reservado al ahorro. (No "blanco+verde".)

**🟠 [BUG-RIESGO] Fallback a datos mock/locales en prod.** `apiResult ?? localResult` + `getMerchant` mock en varias pantallas. En prod, si el API hipa, puede mostrar data demo/vieja como real y enmascarar una caída.
*Recomendación:* que el fallback muestre "sin conexión" en vez de mock.

**⚪ [POLISH] Dos vocabularios de tokens:** vecino `fin-*` (alias), comercio `brand/ink/surface`. Ambos derivan del mismo knob, pero conviene una sola fuente.

---

## 3. Lo que está bien (no romper)

- **Onboarding del vecino sin fricción** (recién resuelto) — protegerlo en el QA.
- **El asesor de cupones**: motor de plata + medidor de fuerza + jugadas por rubro.
- **Billetera de ahorro + Canjeados + El Club**: refuerzan ahorro y pertenencia.
- **Dashboard del comercio**: muestra su retorno (ingresos, clientes nuevos).
- **Límite de uso por persona**: "Ya lo usaste" + cuándo vuelve, bien integrado.
- **Single-knob de marca** (`--color-brand` re-tematiza todo) — buena base de diseño.
- **Estados de carga/vacío/error** presentes y cuidados; mobile-first.

---

## 4. Priorización

### Quick wins (alto impacto, bajo esfuerzo)
| # | Acción | Impacto |
|---|---|---|
| 1 | Pre-cargar el monto del canje desde `precioReferencia` | Métrica norte |
| 2 | Reordenar el asesor (gancho antes de jugada) + sacar el % del título | Calidad de cupones |
| 3 | Sacar lo fiscal del alta del comercio (fix ya prompteado) | Adquisición |
| 4 | Card: pesos solo con precio real | Confianza |
| 5 | Glosario "descuento" + sacar copy stale ("30 min") | Confusión |

### Cambios de fondo
| # | Acción | Impacto |
|---|---|---|
| A | Endurecer el fallback mock (no data fantasma en prod) | Confiabilidad |
| B | Vista de Referidos en owner + bonus al referido | Crecimiento |
| C | Pasada UX enfocada sobre lo nuevo (Club, Alertas, landing rework) | Calidad |
| D | Exponer tipos de oferta (happy hour + precio fijo) | Poder del comercio |

---

## 5. Top 10 acciones (estado actual)

1. 🔴 Pre-cargar el monto del canje desde el precio de referencia.
2. 🟠 Reordenar el asesor (gancho antes de jugada) y desligar el título del %.
3. 🟠 Sacar lo fiscal del alta del comercio (fix ya prompteado).
4. 🟠 Endurecer el fallback a datos mock en producción.
5. 🟡 Card del vecino: pesos solo con precio real.
6. 🟡 Unificar glosario y sacar copy stale.
7. 🟡 Vista de Referidos en owner + corregir la promesa al referido.
8. 🆕 Pasada UX enfocada sobre El Club, Alertas y la landing reworkeada.
9. 🟡 Exponer tipos de oferta (happy hour + precio fijo).
10. ⚪ Unificar tokens (vecino → semánticos).

> ✅ Resuelto desde la pasada 1: onboarding del vecino sin fricción.
