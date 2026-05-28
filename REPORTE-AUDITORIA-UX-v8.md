# REPORTE AUDITORÍA UX — v8 (15ª pasada · 100% LANDING)

**Fecha:** 2026-05-28
**Foco exclusivo:** la LANDING comercial (lo primero que ve un comerciante antes de pagar)
**Modo:** análisis estático en piel de un comerciante escéptico, sin app corriendo
**Alcance:** `apps/landing/src/**` (Nav, Hero, SocialProof, Problem, Agitate, Solution, Features, HowItWorks, UseCase, Pricing, FAQ, FinalCTA, Footer)
**Regla respetada:** solo detecto y reporto — **no toqué código**

---

## 1. Resumen ejecutivo

### 🔥 Los 2 hallazgos que SANGRAN antes de vender

| # | Problema | Severidad |
|---|----------|-----------|
| **LA2** | La landing/login venden **"WhatsApp Business integrado de verdad · vía API oficial de Meta"** pero la implementación real es **whatsapp-web.js** (no-oficial, vía QR) y el propio panel admite *"el envío está simulado"* y *"cuando se integre la API oficial"*. Claim falso + feature no entregada + riesgo de **ban del número del comercio** | 🔴 **Crítica** |
| **LA1** | **Social proof fabricado**: SocialProof lista 6 "pioneros adheridos" inventados y UseCase tiene un testimonio entrecomillado de "Mariela Suárez / Heladería La Frutilla" con métricas (48 canjes, etc.). El día del lanzamiento **no hay clientes reales** → publicidad engañosa (Ley 24.240) | 🟠 Alta |

### Sensación general

> **La landing es hermosa, persuasiva y está técnicamente impecable** — estructura PAS (Problem→Agitate→Solution), Hero con mockup, Features, HowItWorks, Pricing claro, FAQ honesta, FinalCTA con urgencia, Nav y Footer pulidos, responsive con hamburger menu. Como pieza de conversión, es de nivel profesional. **Pero tiene dos problemas de *veracidad*, no de diseño:** vende una integración de WhatsApp que no está entregada como se promete (LA2) y muestra clientes/testimonios que todavía no existen (LA1). Ninguno es un bug de código — son decisiones de negocio que tenés que tomar antes de mandar tráfico real, porque te exponen legalmente (Defensa del Consumidor) y operativamente (un comercio que paga por WhatsApp y se encuentra con "simulado" pide reembolso).

---

## 2. Diario del comerciante escéptico

### Llego desde un anuncio
- Hero: "Tus clientes vuelven solos. Sin imprimir un volante más." Mockup lindo, "10 días para arrepentirte", "precio congelado". Me engancha. ✓
- SocialProof: "Programa fundador · Primeros 20 comercios" con 6 logos: La Frutilla, La Esquina, Carmen Vintage, Vivero Pampero, Almendra Belleza, Estación 25. *"Ah, ya tienen comercios adheridos, no soy el primer conejillo."* — **(LA1)** salvo que… si lanzaron hoy, ¿cómo tienen 6 fundadores? Si soy un comerciante de San Pedro y conozco a "La Esquina", les pregunto y me dicen "nosotros no estamos en eso" → se me cae la confianza de golpe.
- UseCase: "Un día en La Frutilla" — testimonio de Mariela Suárez con comillas, foto, 48 canjes. Muy convincente… hasta que leo la letra gris chiquita: *"Comercio piloto · datos reemplazables"* **(LA1)**. O sea, es inventado. La mayoría no lee esa línea y lo toma como real.
- Features: "WhatsApp Business integrado · Sin Meta bloqueándote". FAQ: "WhatsApp Business integrado de verdad… ves quién leyó y quién respondió". Login del comercio: "vía API oficial de Meta". *"Genial, justo lo que necesito."* **(LA2)** — pero cuando entre al panel y arme una campaña, la propia pantalla me va a decir *"Demo: el envío está simulado"*. Pagué $25.000 por algo que no funciona como me prometieron.

---

## 3. Hallazgos detallados

### `[LA2]` `[Veracidad/Legal/Operacional]` — WhatsApp: claim "API oficial de Meta" vs realidad

📍 **Dónde se vende como presente:**
- `Features.tsx:29-30` — "WhatsApp Business integrado" · "Sin Meta bloqueándote"
- `FAQ.tsx:27` — "WhatsApp Business integrado de verdad… ves quién leyó y quién respondió"
- `AdminLoginPage.tsx:99` — "vía API oficial de Meta"
- `AdminLoginPage.tsx:226` — "API oficial de WhatsApp Business"

📍 **Lo que dice la implementación real:**
- `apps/api/src/services/whatsapp.service.ts:2` — "integración real vía **whatsapp-web.js** (Puppeteer)" + `package.json` → `whatsapp-web.js ^1.34.7`
- `AdminWhatsappPage.tsx:673-674` — *"Demo: el envío está **simulado**. En producción cada mensaje pasa por la API oficial…"*
- `AdminWhatsappPage.tsx:801` — *"Disponible **cuando se integre** la WhatsApp Business API oficial"*
- `AdminWhatsappPage.tsx:275` — *"sin WhatsApp Business API oficial"*

😖 **Por qué sangra:**
1. **Claim falso:** se vende "API oficial de Meta" cuando NO está integrada (el código lo admite en 3 lugares).
2. **Feature no entregada:** el comercio paga $25.000/mes en parte por WhatsApp masivo, y se encuentra con "simulado" o con whatsapp-web.js.
3. **Riesgo de ban:** whatsapp-web.js automatiza WhatsApp Web (vía QR) — viola los ToS de WhatsApp. El número del comercio puede ser **suspendido por Meta**. Irónicamente, Features dice "Sin Meta bloqueándote", que es exactamente el riesgo que introduce whatsapp-web.js.
4. **Legal:** publicidad engañosa (Ley 24.240).

🔥 **Severidad:** Crítica · 🔧 **Esfuerzo:** Bajo (copy) — pero requiere **decisión de negocio**
✅ **Recomendación (elegí una):**
- **(a) Honesto / recomendado:** marcar WhatsApp como **"Próximamente"** o **"en beta"** en landing/Features/login hasta tener la API oficial real. Quitar "API oficial de Meta" de los claims presentes. No cobrar por una feature aún no entregada.
- **(b) Si vas a operar con whatsapp-web.js:** NO decir "API oficial de Meta" (es falso) y entender que asumís el riesgo de ban del número. No recomendado.
- **(c) Si la API oficial ya está lista:** alinear `whatsapp.service.ts` con eso y quitar los comentarios de "simulado". (No parece ser el caso según el código.)

---

### `[LA1]` `[Veracidad/Legal]` — Social proof fabricado

📍 **Ubicación:**
- `SocialProof.tsx:4-11` — `PIONEROS`: 6 comercios nombrados, presentados como "Programa fundador · Primeros 20 comercios" (implica adheridos).
- `UseCase.tsx:31-58` — testimonio entrecomillado de "Mariela Suárez, dueña de Heladería La Frutilla" + métricas (48 canjes, 12 volvieron). Disclaimer sutil en gris: "Comercio piloto · datos reemplazables".

😖 **Por qué sangra:**
- El día del lanzamiento no puede haber 6 fundadores ni un caso real con métricas. Son placeholders presentados como reales.
- Si alguno de esos nombres corresponde a un comercio real de San Pedro que NO se adhirió, usás su nombre sin permiso (riesgo legal adicional).
- Un comerciante local va a reconocer los nombres y detectar que no es cierto → se rompe la confianza, que es lo único que tenés el día 1.
- El testimonio con comillas atribuido a una persona nombrada es lo más riesgoso (testimonio fabricado).

🔥 **Severidad:** Alta · 🔧 **Esfuerzo:** Bajo
✅ **Recomendación:**
- Reemplazar el social proof por algo honesto para etapa fundador: en vez de "6 comercios adheridos", usar **"Estás entre los primeros 20 comercios de San Pedro"** sin nombres falsos.
- UseCase: o conseguís UN piloto real que te deje usar su testimonio (ideal), o lo convertís en un ejemplo **claramente hipotético** ("Así funcionaría para una heladería de San Pedro:") sin nombre propio ni comillas de persona real.
- Cuando tengas clientes reales (con permiso), volvés a poner social proof verdadero — que convierte mucho más.

---

### `[LA3]` `[Marca]` — "misanpedro" en minúscula
📍 `Solution.tsx:14` — "misanpedro es el contacto directo con tu cliente"
✅ Cambiar a "Mi San Pedro" por coherencia de marca. 🟢 Baja.

---

## 4. Recomendaciones

### Antes de mandar tráfico real (decisiones de negocio)
- **LA2** — definir la estrategia de WhatsApp y alinear los claims con la realidad. Es el más urgente: te expone legal y operativamente, y es lo que más fricción genera post-venta.
- **LA1** — sacar el social proof fabricado; reemplazar por copy honesto de etapa fundador.

### Quick win de copy
- **LA3** — "misanpedro" → "Mi San Pedro" en Solution.

### Lo que está EXCELENTE y no hay que tocar
- ✅ Estructura PAS completa (Problem → Agitate → Solution)
- ✅ Hero con mockup compuesto + reassurance (10 días arrepentimiento)
- ✅ Features, HowItWorks (3 pasos claros), Solution (flow visual)
- ✅ Pricing (ya con "Precio FINAL — sin IVA" del fix v4)
- ✅ FAQ honesta (vecino gratis, sin permanencia, no se quedan con % del ticket)
- ✅ FinalCTA con urgencia legítima, Nav sticky con hamburger + Escape, Footer con legal
- ✅ Responsive, animaciones, performance (scroll throttle con rAF)

---

**Veredicto:**
Como diseño y copy de conversión, la landing es de primer nivel. Pero **LA2 (WhatsApp) y LA1 (social proof) son problemas de veracidad que conviene resolver antes de vender** — no por estética, sino porque te exponen a reclamos de Defensa del Consumidor y a romper la confianza de un pueblo donde todos se conocen. Son decisiones tuyas (no fixes que deba aplicar solo): decime cómo querés encararlos.
