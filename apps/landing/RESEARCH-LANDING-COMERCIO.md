# Research — Landing del comercio (Fase 1)
**Fecha:** 2026-06-23 · Proyecto: Mi Ciudad / Mi San Pedro · Landing: `apps/landing` (single-tenant SP, dev :5181)
**Método:** análisis multi-agente — copy actual verbatim + comunicación del proyecto + verdad del producto + ICP/competencia (WebSearch).

---

## 1. ICP — el dueño/a de comercio chico del interior

**Perfil:** dueño de PyME de barrio (gastronómico, kiosco, indumentaria, belleza, panadería). Poco tiempo, desconfía de "apps", **quemado por promesas de marketing**, le importa la **caja de hoy**.

**Su lenguaje VERBATIM (no habla de "CRM" ni "fidelización"):**
- "avecez me desespero porque hay **días que no vendo nada**"
- "martes y miércoles son días bien **flojos**"
- "los lunes no lo abro. ¿qué podría hacer para **atraer clientes** esos días?"
- "llegó mucha competencia y con los **precios extremadamente bajos**"
- "los que me vienen son **pidiendo descuentos**" (miedo a regalar margen)
- "el arriendo es muy costoso y los servicios ni hablar" (costos fijos asfixian)
- sobre marketing: "**ya no hay expectativa de que 'esta vez sí'**" (escepticismo, no enojo)

> **Emoción dominante en días malos: desesperación, no "optimización".** Piensa en **el día que no entra un peso**, no en "engagement".

## 2. Competencia — todos venden "fidelizar", nadie ataca el día flojo

| Análogo | Headline | Qué le falta |
|---|---|---|
| **Loyalz Club** | "Impulsa tu negocio con fidelización" | Genérico de categoría; habla de la herramienta, no del dolor; precio en USD (caro para un kiosco) |
| **Pretii** | "Deja de perder clientes frente a la competencia" | El mejor de los 3 (toca competencia), pero baja a "transacciones rentables" (corporativo) |
| **Tarjeta de sellos / "lo anoto a mano"** | (ninguno) | El **competidor #1 real**: gana en confianza + simplicidad; no trae gente nueva, no mide. Hay que ser *tan fácil como el cuaderno* y encima traer caja. |

**Hueco del mercado:** todos premian al que ya viene (fidelización=vitamin). El dolor #1 es **atraer al que falta en el día flojo** (painkiller). Ángulo libre.

## 3. Estado del copy actual (auditado verbatim)

Orden: Nav → Hero → SocialProof → Problem → Agitate → Solution → Features → HowItWorks → UseCase → Pricing → FAQ → FinalCTA → Footer.

**Lo bueno (conservar):** voz "vos" rioplatense nativa y consistente · el bloque **PAS (Problem→Agitate→Solution) es genuinamente fuerte** (Carlos/Marta, volantes al tacho, algoritmo de IG, Meta te bloquea) · **FAQ desarma las objeciones reales** (internet del local, "¿se quedan con mi %?", permanencia) · **Pricing transparente sin "Contact us"** (precio explícito, 3 meses gratis, sin tarjeta, sin IVA factura C).

**Hero actual:** H1 *"Tus clientes vuelven solos. / Sin imprimir un volante más."* — buen tono pero **clever y ancla en fidelización**, no en el dolor #1.

## 4. Verdad del producto (lo que el comercio REALMENTE recibe)

**Diferenciadores reales y verificados (poner al frente):**
1. **Asesor de cupones con motor de plata** (el #1): wizard de 6 pasos que cruza objetivo×rubro y propone una jugada concreta, con **cuenta de margen en vivo** y **candado anti-bajo-costo** (el slider de descuento se topea según tu costo). Resuelve el "no sé armar una promo que me convenga". *Es la mejor demo en vivo.*
2. **Riesgo cero REAL:** nace `estado:'activo'`, visible al instante, 3 meses gratis sin tarjeta, `freeTrialUntil` no corta nada, fiscal/pago diferidos. El producto respalda la promesa.
3. **Los clientes son tuyos:** base privada por comercio (nombre/DNI/cumple/frecuencia) exportable a CSV; "la base general nunca se entrega". + no se queda un % del ticket (anti-Groupon).

**NO prometer todavía (humo):**
- ⚠️ **WhatsApp "automático/integrado":** es WhatsApp Web por QR — exige el celu del comercio + pestaña abierta durante el envío, tope 4/mes, lento por anti-ban, **no mide leídos**. Véndelo "mandá promos a tu base con un toque", con la condición visible.
- ⚠️ **"Estadísticas completas desde el día 1":** las ventas son **estimado** (dependen de que el cajero cargue el monto) y todo necesita volumen. Honesto: "a medida que canjeás, se va llenando".

## 5. 🔴 Contradicciones / bugs que hay que resolver ANTES de reescribir

1. **PRECIO: $50.000 (landing) vs $25.000 (panel del comercio + certificación).** El comercio podría ver $50k en la landing y $25k en su panel. **Decisión de negocio del usuario.**
2. **WhatsApp:** Pricing lo lista "integrado" pero Features/FAQ dicen "pronto". Sobrepromesa en la sección de precio. → "WhatsApp (próximamente)".
3. **MercadoPago "integrado"** mientras está bypasseado en el alta (deuda del pivot 3-meses-gratis).
4. **Color violeta `#695ede`** en la landing/alta — PROHIBIDO (marca = naranja `#EA580C`). "Es lo primero que ve el comercio."
5. **Dominios/email viejos:** `hola@misanpedro.app`, `misanpedro.app` en `cn.ts`, robots/sitemap/OG apuntan a gh-pages y a la sección equivocada → SEO indexa URLs muertas + el comercio escribe a una casilla inexistente.
6. **Naming triple:** "Mi San Pedro" (landing) / "Cuponcito" (repo/cert) / "Mi Ciudad" (rebrand). T&C dicen una cosa, el producto otra.
7. **Sin prueba social real** (decisión deliberada de no inventarla): SocialProof y UseCase tan hedgeados que restan. Hueco #1 de credibilidad.

## 6. Recomendación estratégica (Fase 2 — promesa / prueba / oferta)

**LA PROMESA (pivot):** de *"tus clientes vuelven solos"* (fidelización, sin prueba) → **"llená los días flojos sin regalar tu margen"** (el dolor #1 del ICP, painkiller, alineado con el Asesor real).

> **Hero propuesto:**
> - Eyebrow: `Para comercios de San Pedro`
> - **H1: "Esos días que no vendés nada… empezá a llenarlos."**
> - Sub: *Ponés tu descuento, solo el día que querés, y los vecinos cerca se enteran. Sin regalar tu margen. Sin contratos. Sin app que aprender.*

**LA PRUEBA:** riesgo-cero real (3 meses gratis sin tarjeta, activo al instante) + el Asesor como demo + "no nos quedamos con tu %" + (pendiente fuerte) **1 piloto real con nombre/rubro**. Mientras no exista, señales de confianza local (hecho por vecinos, Cámara/Municipio si aplica).

**LA OFERTA:** la actual está bien (gratis 3 meses sin tarjeta → plan único mensual, cancelás solo). Sólo **desaturar** (hoy aparece ~5×) y concentrar los números en Pricing.

**Framework:** PAS (ya funciona) + Hormozi en el hero (maximizar resultado/llenar-el-día, minimizar tiempo/esfuerzo/"sin app que aprender").

### Los 6 movimientos de mayor impacto
1. Pivotear el Hero al dolor "día flojo" (+ headline del FinalCTA que recapitule beneficio, no solo urgencia).
2. Subir el combo **CRM ("tus clientes son tuyos") + 0% de comisión** del fondo (hoy enterrados) a Solution/Hero.
3. Conseguir/mostrar **1 prueba social humana real**.
4. Unificar CTA a **"Empezá gratis"** en toda la página (hoy: Empezar / Empezá gratis / Quiero conectar...).
5. Arreglar las contradicciones de precio + WhatsApp + violeta + dominios viejos.
6. Reencuadrar UseCase como **demo de producto** ("así se vería tu primer descuento") en vez de caso que se auto-disculpa.
