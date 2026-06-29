# Revisión PM / UX-UI — Mi San Pedro (pasada 3)

**Fecha:** Junio 2026 · **Rama:** `feat/valor-cupon` · **Método:** revisión por código (git + greps de verificación + lectura de pantallas a lo largo del trabajo). No se corrió en vivo; lo que depende de runtime o de contenido no leído a fondo se marca como "verificar".

**Lente (en orden):** Intuitivo · Funcional · UX/UI. **Foco PM:** métrica norte (el vecino canjea en 7 días) + adquisición/retención de comercios.

**Severidad:** 🔴 Crítico · 🟠 Alto · 🟡 Medio · ⚪ Bajo.

---

## 1. Resumen ejecutivo

Avance fuerte desde la pasada 2: el **onboarding sin fricción del vecino se mergeó** (PR #2), y landearon **Estadísticas del comercio**, **El Club**, **Alertas** y **Referidos (panel comercio)**. El **sistema de valor del cupón** está en obra ahora mismo (rama `feat/valor-cupon`), todavía a mitad. Pero **los tres hallazgos de mayor impacto siguen sin tocarse**: el monto del canje, el orden del asesor, y el muro fiscal del alta. Esos tres son los que hay que priorizar.

Top hallazgos vigentes:
1. 🔴 El canje sigue trabándose con el **monto manual obligatorio** del cajero.
2. 🟠 El **asesor sigue pidiendo el gancho después de la jugada** (copy genérico + título que puede contradecir el %).
3. 🟠 El **alta del comercio sigue con el muro fiscal** (CUIT/razón social).
4. 🟡 La card del vecino **todavía inventa "Ahorrás ~$X"** (en arreglo en `feat/valor-cupon`).
5. 🟡 **Owner sin vista de Referidos** + posible promesa rota al referido.

---

## 2. Estado de lo que venimos construyendo

| Feature | Estado | Evidencia |
|---|---|---|
| Onboarding sin fricción (vecino) | ✅ Hecho (mergeado) | PR #2 `aa074ad`; `PerfilPage.tsx` sin "Salir" ni DNI |
| Planificador "Armá tu plan" | ⚠️ Verificar | Commit `facb632` dice "'Armá tu plan' = buscador" — confirmar que sigue siendo el planner de ocasión→presupuesto→planes y no se redujo a un buscador genérico |
| El Club (niveles/sorteo en Perfil) | ✅ Hecho | `components/features/ClubCard.tsx` (+ test) |
| Sistema de valor del cupón (tipos/alcance/aprox/toggle) | ⚠️ En obra | Rama `feat/valor-cupon`; el modelo aún solo tiene `precioReferencia` + `tipoOferta` (falta `alcance`, `precioFijo`, `mostrarAhorroVecino`) |
| Display de valor (no inventar "$X") | ❌ Vivo | `CouponCard.tsx:21-23`: `calcAhorro(porcentaje)` inventa pesos sin precio real |
| Límite de uso por persona | ✅ Hecho | `usoVentana` en `Coupon.ts`; `CouponCard` con `usoEstado`/"Ya lo usaste" |
| Alertas (página nueva) | ✅ Hecho | `pages/AlertasPage.tsx` (verificar que no sature) |
| Asesor de cupones | ⚠️ A medias | Funciona, pero `PASOS` con gancho DESPUÉS de la jugada (`AdminCuponEditPage.tsx:437`) |
| Canje en la caja (monto) | ❌ Vivo | `AdminConfirmarCanjePage.tsx`: "Falta el monto" (obligatorio y manual) |
| Alta del comercio (fiscal) | ❌ Vivo | `AdminSignupPage.tsx`: pasos `'fiscal'`/`validateCuit` (10 referencias) |
| Estadísticas del comercio | ✅ Hecho | `pages/admin/AdminEstadisticasPage.tsx` (verificar contenido: retorno plata+gente, cuándo, qué cupón) |
| Referidos (panel comercio) | ✅ Hecho | `pages/admin/AdminReferidosPage.tsx` |
| Referidos (owner) | ❌ Falta | sin referencias a referral en `apps/owner/src` |
| Landing rework + marca naranja | ✅ Hecho | commits `c4e79fb`, `7737610`; verificar deuda del pivot ("MercadoPago integrado") |

---

## 3. Hallazgos por área

### VECINO

**🟡 [BUG] La card todavía inventa el ahorro en pesos.** `CouponCard.tsx:21-23`: si no hay `precioReferencia`, usa `calcAhorro(porcentaje)` → "Ahorrás ~$X" inventado. *En arreglo en `feat/valor-cupon`*; hasta que merge, todo cupón sin precio muestra un número falso. *Recomendación:* terminar el sistema de valor (pesos solo con precio real; % cuando no).

**⚠️ [VERIFICAR] "Armá tu plan" pudo haberse vuelto un buscador.** Commit `facb632` lo describe como "= buscador". Si dejó de ser el planner de ocasión→presupuesto→planes, es un downgrade del héroe del vecino. *Recomendación:* confirmar que sigue armando planes por presupuesto, no solo buscando.

**⚠️ [VERIFICAR] Alertas** (`AlertasPage.tsx`, estilo Despegar): revisar que no sature ni confunda, y que el badge/feed sea claro.

**✅ Onboarding sin fricción:** mergeado. Solo QA del flujo real (claim por teléfono, sesión permanente).

### COMERCIO

**🔴 [BUG] El canje cuelga del monto manual obligatorio.** `AdminConfirmarCanjePage.tsx` ("Falta el monto"). El cajero no puede confirmar sin tipear el monto → fricción en el momento de la verdad + dato frágil. *Recomendación:* pre-cargar desde `precioReferencia`; nunca bloquear el canje por ese campo. **(Sigue siendo el #1.)**

**🟠 [BUG] El asesor pregunta el gancho después de la jugada.** `AdminCuponEditPage.tsx:437` (`PASOS`). Copy genérico ("tu producto estrella") + título que hornea el % (puede contradecir el real). *Recomendación:* reordenar (gancho antes de jugada); no meter el número en el título.

**🟠 [BUG/CONFUSO] El alta sigue con el muro fiscal.** `AdminSignupPage.tsx` con pasos `'fiscal'`/`validateCuit`. Muro contradictorio en plena adquisición, para algo que hoy no se cobra. *Recomendación:* sacar lo fiscal del alta; llevar a armar el perfil (fotos/horarios).

**⚠️ [VERIFICAR] Estadísticas** (`AdminEstadisticasPage.tsx`): confirmar que abre con el retorno en plata + gente, y que cada bloque tiene su acción (es un asesor, no un tablero).

### OWNER

**🟡 [BUG] Falta la vista de Referidos en owner** (sin referencias a referral en `apps/owner/src`) + verificar la promesa de "15 días extra" al referido.

### LANDING

**🟡 [VERIFICAR] Coherencia del pivot** tras el rework: "MercadoPago integrado" mientras MP está bypasseado.

### TRANSVERSAL

**🟠 [BUG-RIESGO] Fallback a datos mock/locales en prod** (`apiResult ?? localResult` + `getMerchant` mock). Riesgo de mostrar data fantasma o enmascarar una caída.

**⚪ [POLISH] Dos vocabularios de tokens** (vecino `fin-*` alias vs comercio `brand/ink/surface`); ambos del mismo knob (`--color-brand #ea580c`, `--color-up #059669` para el ahorro).

**⚪ [VERIFICAR] Glosario** ("descuento" comercio vs "cupón" vecino) y narrativa ("tu ciudad/San Pedro", nunca "pueblo"/"fundador").

---

## 4. Lo que está bien (no romper)

- Onboarding del vecino sin fricción (mergeado).
- El asesor de cupones (motor de plata, medidor de fuerza, jugadas por rubro).
- Billetera de ahorro + Canjeados + El Club.
- Estadísticas del comercio + Referidos (panel) + Alertas, todos construidos.
- Límite de uso por persona, bien integrado.
- Single-knob de marca (`--color-brand` re-tematiza todo).
- Estados de carga/vacío/error presentes; mobile-first.

---

## 5. Priorización

### Quick wins (alto impacto, bajo esfuerzo)
| # | Acción | Impacto |
|---|---|---|
| 1 | Pre-cargar el monto del canje desde `precioReferencia` | Métrica norte |
| 2 | Reordenar el asesor (gancho antes de jugada) + sacar el % del título | Calidad de cupones |
| 3 | Sacar lo fiscal del alta (fix ya prompteado) | Adquisición |
| 4 | Terminar el sistema de valor (no inventar "$X") | Confianza |
| 5 | Verificar "Armá tu plan" (que siga siendo el planner) | Héroe del vecino |

### Cambios de fondo
| # | Acción | Impacto |
|---|---|---|
| A | Endurecer el fallback mock (no data fantasma en prod) | Confiabilidad |
| B | Vista de Referidos en owner + bonus al referido | Crecimiento |
| C | QA a fondo de lo nuevo (Estadísticas, Club, Alertas, landing) | Calidad |

---

## 6. Top 10 acciones (por impacto)

1. 🔴 Pre-cargar el monto del canje desde el precio de referencia.
2. 🟠 Reordenar el asesor (gancho antes de jugada) y desligar el título del %.
3. 🟠 Sacar lo fiscal del alta del comercio.
4. 🟡 Terminar el sistema de valor del cupón (pesos solo con precio real).
5. ⚠️ Verificar que "Armá tu plan" siga siendo el planner por presupuesto.
6. 🟠 Endurecer el fallback a datos mock en producción.
7. 🟡 Vista de Referidos en owner + corregir la promesa al referido.
8. ⚠️ QA de Estadísticas, El Club y Alertas (recién landeados).
9. 🟡 Verificar coherencia del pivot en la landing.
10. ⚪ Unificar glosario y tokens.

> ✅ Resuelto desde pasadas anteriores: onboarding del vecino sin fricción (mergeado).
> 🛠️ En obra ahora: sistema de valor del cupón (`feat/valor-cupon`).
