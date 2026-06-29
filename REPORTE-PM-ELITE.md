# Auditoría PM de elite — Mi San Pedro

**Fecha:** Junio 2026 · **Rama:** `feat/valor-cupon` · **Método:** auditoría por código (lectura a fondo de las pantallas/flujos a lo largo del trabajo + verificación por git/greps del estado actual). No corrida en vivo; lo no leído a fondo se marca "verificar".

**Estándar:** "un usuario nuevo, en su celular, sin que nadie le explique, ¿lo logra?" + "¿cada dato que pido lo necesito DE VERDAD y AHORA?". Prioridad: métrica norte (el vecino canjea en 7 días) + adquisición/retención de comercios.

---

## 1. Veredicto (sin maquillaje)

El producto está **muy por encima del promedio** para pre-lanzamiento: el asesor de cupones, la billetera de ahorro, el Club, las estadísticas del comercio y el onboarding sin fricción del vecino (recién mergeado) son de buen nivel. Pero **hay tres cosas que, hoy, te están costando plata y usuarios, y ninguna se tocó todavía.** Un producto de elite no se mide por lo que construyó: se mide por la fricción que sacó del camino crítico. Acá el camino crítico (el canje y el alta) todavía tiene barro.

**Lo que SÍ O SÍ hay que cambiar (en orden):**
1. **El canje no puede depender de un monto que el cajero tipea a mano.** Es tu métrica norte, y hoy se traba ahí. (🔴)
2. **El alta del comercio no puede pedir CUIT antes de dar valor.** Es tu adquisición, y le ponés un trámite de AFIP a algo que es gratis. (🔴)
3. **El asesor no puede preguntar el producto estrella DESPUÉS de escribir el cupón.** Publica copy genérico y títulos que mienten el %. (🟠)
4. **La app no puede inventar "Ahorrás $X" cuando no hay precio.** (🟡, en arreglo en `feat/valor-cupon`)
5. **El producto no puede mostrar data mock como si fuera real** si el API se cae. (🟠)

---

## 2. Auditoría de datos (qué pedís de más)

| Campo | Dónde | ¿Por qué? | ¿Necesario AHORA? | Alternativa | VEREDICTO |
|---|---|---|---|---|---|
| Nombre del comercio | `AdminSignupPage` | identificar el local | Sí | — | mantener |
| Categoría | `AdminSignupPage` | rubro para la app | Sí | — | mantener |
| Dirección | `AdminSignupPage` | ubicación | Sí | — | mantener |
| Ubicación en el mapa (pin) | `AdminSignupPage` | geo del local | No (se infiere) | geocodificar de la dirección | **inferir** |
| Teléfono | `AdminSignupPage` | contacto | Sí | — | mantener |
| Email del responsable | `AdminSignupPage` | login OTP | Sí | — | mantener |
| **CUIT** | `AdminSignupPage` (paso fiscal) | facturar (a futuro) | **No** (no se cobra aún) | pedir al activar el cobro | **eliminar/diferir** |
| **Razón social** | `AdminSignupPage` | facturar (a futuro) | **No** | diferir al cobro | **eliminar/diferir** |
| **Condición fiscal** | `AdminSignupPage` | facturar (a futuro) | **No** | diferir al cobro | **eliminar/diferir** |
| **Domicilio fiscal** | `AdminSignupPage` | facturar (a futuro) | **No** | diferir al cobro | **eliminar/diferir** |
| Nombre (vecino) | captura al canjear | identidad mínima | Sí | — | mantener |
| Teléfono (vecino) | captura al canjear | identidad/recupero | Sí | — | mantener |
| **DNI / email / fecha nac. (vecino)** | — | (registro viejo) | — | YA eliminados ✅ | hecho |
| **Monto del ticket** | `AdminConfirmarCanjePage` | calcular ahorro | parcial | pre-cargar de `precioReferencia` | **inferir (no obligatorio)** |

**Qué sacaría / diferiría YA:**
- **Todo el paso fiscal del alta** (CUIT, razón social, condición, domicilio) → al momento del cobro.
- **El pin obligatorio en el mapa** → geocodificar de la dirección, ajustar opcional.
- **El monto del ticket como obligatorio** en el canje → pre-cargado, el cajero solo confirma.

> Regla que estás violando: pedís datos burocráticos (fiscales) **antes** de que el comercio sienta valor. Eso es lo primero que un PM de elite borra.

---

## 3. Mapa de fricción (contá los pasos)

**Canje del vecino — HOY ~10 pasos → POSIBLE ~4** (el más importante, tu métrica norte):
1. Abrir la app · 2. Encontrar el cupón · 3. "Canjear" (activa) · 4. Mostrar QR/código · 5. Cajero abre Validar · 6. Elegir modo · 7. Tipear 6 dígitos / escanear · 8. "Confirmar canje" (navega) · 9. **Tipear el monto (obligatorio)** · 10. Confirmar.
**Evitables:** 6, 8, 9 (el monto), y parte del 7. Con un canje "un toque" (validar+confirmar en una pantalla, monto pre-cargado) bajás a ~4.

**Alta del comercio — HOY ~4 pasos + muro → POSIBLE ~2:**
Datos → **Fiscal (muro de CUIT)** → "Pago" (sin pago) → Listo.
**Evitables:** el paso fiscal entero y el copy del pivot ("Pago", "factura C mensual"). Queda Datos → Listo.

**Crear cupón (el asesor) — 6 pasos, razonable, pero con un bug de orden:**
objetivo → **jugada → gancho** (orden invertido) → plata → cuándo → publicar. No hay modo rápido (cada cupón son 6 pasos). El orden invertido hace que el copy salga genérico.

---

## 4. Incongruencias

- **🟠 [INCONGRUENCIA] El asesor pide el gancho después de la jugada.** `AdminCuponEditPage.tsx:437` (`PASOS = ['objetivo','jugada','gancho',...]`). El título/descr se arman con "tu producto estrella" y no se actualizan al tipear el gancho. *Fix:* gancho antes de jugada.
- **🟠 [INCONGRUENCIA] El título hornea el %.** Las jugadas escriben "50% en X" en el título; si el costo capa el descuento, el título dice 50% y el cupón es 30%. *Fix:* no meter el número en el string.
- **🟡 [INCONGRUENCIA] Glosario.** El editor dice "cupón" (h1 "Armemos un cupón fuerte", "Publicar cupón") y el listado dice "Descuentos del comercio". *Fix:* unificar en "descuento" del lado comercio.
- **🟡 [INCONGRUENCIA] Promesa rota al referido.** El banner del alta promete "15 días gratis extra" al referido, pero el backend solo acredita al referidor. (Verificar si sigue.) *Fix:* implementar el bonus o corregir el copy.
- **⚪ [INCONGRUENCIA] Copy stale.** `MisCuponesPage.tsx:141`: "Tenés 30 minutos para usarlo", pero los códigos ya no expiran por tiempo. *Fix:* sacar el "30 min".
- **⚪ [INCONGRUENCIA] Dos vocabularios de tokens.** Vecino usa `fin-*` (alias), comercio usa `brand/ink/surface`; ambos del mismo knob (`--color-brand #ea580c`, `--color-up #059669` para el ahorro). *Fix:* unificar el vecino en los semánticos.

---

## 5. Hallazgos por área

### Vecino
- **🔴 [PROBLEMA] La app inventa el ahorro en pesos.** `CouponCard.tsx:21-23`: sin `precioReferencia`, usa `calcAhorro(porcentaje)` → "Ahorrás ~$X" falso. *(En arreglo en `feat/valor-cupon`.)* *Fix:* pesos solo con precio real; si no, el "%".
- **⚠️ [VERIFICAR] "Armá tu plan".** El commit `facb632` lo describe como "= buscador" — confirmar que sigue siendo el planner por presupuesto (ocasión→plan que entra) y no se redujo a un search.
- **✅ Onboarding sin fricción:** mergeado (claim por teléfono, sesión permanente, sin OTP, sin "Salir", sin DNI). Solo QA.

### Comercio
- **🔴 [FRICCIÓN/PROBLEMA] El canje se traba con el monto manual obligatorio.** `AdminConfirmarCanjePage.tsx` ("Falta el monto"). *Fix:* pre-cargar de `precioReferencia`; nunca bloquear el canje.
- **🟠 [DATO-DE-MÁS] El alta exige lo fiscal.** `AdminSignupPage.tsx` (pasos `'fiscal'`/`validateCuit`). *Fix:* sacar lo fiscal; llevar a armar el perfil (fotos/horarios).
- **🟠 [PROBLEMA] El asesor: gancho después de la jugada + título/%.** (ver Incongruencias).
- **⚠️ [VERIFICAR] Estadísticas** (`AdminEstadisticasPage.tsx`): que abra con el retorno en plata + gente y que cada bloque tenga su acción.

### Owner
- **🟡 [PROBLEMA] Falta la vista de Referidos** en `apps/owner`.

### Landing
- **🟡 [INCONGRUENCIA] Deuda del pivot:** "MercadoPago integrado" / "plan mensual" mientras MP está bypasseado. Verificar tras el rework.

### Transversal
- **🟠 [PROBLEMA] Fallback a datos mock en prod.** Patrón `apiResult ?? localResult` + `getMerchant` mock en varias pantallas. *Fix:* mostrar "sin conexión" en vez de data fantasma.

---

## 6. Lo que está bien (no romper)
- Onboarding del vecino sin fricción (mergeado).
- El asesor de cupones: motor de plata (con tope por costo), medidor de fuerza, jugadas por rubro.
- Billetera de ahorro + Canjeados + El Club.
- Estadísticas del comercio + Referidos (panel) + Alertas, construidos.
- Límite de uso por persona, bien integrado ("Ya lo usaste").
- Single-knob de marca (`--color-brand` re-tematiza todo).
- Estados de carga/vacío/error presentes; mobile-first.

---

## 7. Priorización

### Quick wins (alto impacto, bajo esfuerzo)
| Acción | Qué cambia para el usuario |
|---|---|
| Pre-cargar el monto del canje | El cajero confirma de un toque; el canje no se traba |
| Sacar lo fiscal del alta | El comercio se suma sin trámite de AFIP |
| Reordenar el asesor (gancho antes) | El cupón sale con el producto y el % correctos |
| Terminar el sistema de valor (no inventar $X) | El vecino confía: ve pesos reales o el % |
| Sacar copy stale ("30 min") + glosario | Menos contradicciones, más confianza |

### Cambios de fondo
| Acción | Qué cambia |
|---|---|
| Canje "un toque" (validar+confirmar en una pantalla) | El momento de la verdad pasa de ~10 a ~4 pasos |
| Endurecer el fallback mock | Nunca data fantasma en prod |
| Vista de Referidos en owner + bonus al referido | Cierra el loop de crecimiento |

---

## 8. La visión de elite (el norte)

- **El canje ideal:** el vecino muestra una cosa, el cajero toca **un botón**, listo. El ahorro se calcula solo (del precio de referencia), no se tipea. ~4 segundos, sin fila trabada.
- **El alta ideal:** el comercio se suma en **2 minutos sin un solo dato fiscal**, y sale guiado a armar su ficha (fotos, horarios) y su primer cupón. El trámite de facturación llega recién cuando se cobra.
- **El cupón ideal:** el comercio elige un objetivo, el asesor le propone una jugada **con su producto y su precio reales**, le muestra la cuenta para animarse al descuento grande, y el vecino lo ve con el valor **honesto** (pesos cuando hay precio, % cuando no).

> En una línea: ya construiste un gran producto; lo que falta para que sea de elite es **sacar el barro del camino crítico** — el monto del canje y el muro fiscal del alta. Esos dos, primero.

---

*Nota de método: este reporte se generó por revisión de código acumulada en la sesión (verificada por git/greps del estado actual). Un pase multi-agente automatizado se intentó pero el servidor rate-limiteó; las evidencias archivo:línea son de lecturas reales del repo.*
