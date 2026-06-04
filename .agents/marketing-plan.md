# Plan de Marketing — Mi San Pedro (AARRR, fCMO)

> Generado con la skill `marketing-plan` (Corey Haines) sobre `.agents/product-marketing.md`.
> v1 · 2026-06-04 · Estructura AARRR. Estado: borrador para REVIEW sección por sección.

---

## 1. Executive Summary

**Las 3 grandes apuestas (next 90 días):**
1. **La prueba primero.** Conseguir y mostrar **8-10 comercios reales con descuentos potentes**. Es el cuello de botella: sin esto, cada peso de marketing manda gente a una góndola vacía. Desbloquea TODO el funnel.
2. **Vecino como wedge, WhatsApp + calle como motor.** La demanda no viene del software (está hecho) sino de **encender 1 canal local**: canal de WhatsApp + ALF físico (sellos en los comercios) + respaldo de la Cámara.
3. **El loop de dos lados.** Cada comercio difunde a sus clientes (vecinos); cada vecino que ahorra trae a otro. Activar el **referido comercio→comercio (backend ya hecho)** y "compartí tu ahorro" del vecino.

**Outcome a 12 meses:** ser **la app de ahorro default de San Pedro**, con una base de comercios pagos sólida (break-even ~3, objetivo 10-15) y un playbook listo para **expandir a 1 ciudad vecina** (la plataforma ya es multi-tenant).

**North-star metric:** **canjes de vecinos por semana** (ahorro real entregado). Es lo único que prueba las dos caras a la vez.

---

## 2. Strategic Frame
- **Category claim:** "El club de ahorro de San Pedro" (no "app de cupones genérica"). Imagen digna, no "para pobres".
- **ICP:** vecino del mandado semanal (gama baja, WhatsApp, decide por confianza) + comercio PyME de barrio que quiere que el cliente vuelva.
- **Business-model logic:** vecino gratis (demanda) → densidad de demanda hace que el comercio pague ($50k/mes tras 3 meses gratis). El vecino es producto y motor; el comercio es cliente y canal.
- **Brand voice (no negociable):** rioplatense, cercano, digno; "tu ciudad" no "pueblo"; **nada trucho**; naranja `#ea580c` = acción, verde `#059669` = ahorro. Tagline LOCKED: *"Tu plata rinde más"*.

---

## 3. Current State (scored desde materiales — rúbrica 0-5)
| Área | Score | Nota |
|---|---|---|
| Posicionamiento / narrativa | 4/5 | Cerrado y fuerte |
| Landing / CRO (vecino) | 4/5 | Pulida, responsive, mockup fiel a la app |
| Medición | 3/5 | UTM live; falta dashboard (Plausible/Umami, 5 min) |
| **Oferta / prueba (supply)** | **0/5** | **0 comercios reales cargados — BLOCKER #1** |
| Adquisición / demanda | 1/5 | Sin tráfico; canales sin encender (WhatsApp gated) |
| Activación | 3/5 | "Wow" claro, pero muere si la app está vacía; coherencia landing→app ya resuelta |
| Retención | 3/5 | Billetera de ahorro + niveles ya construidos (motor listo) |
| Referral | 2/5 | Backend comercio→comercio hecho; falta activar/panel |
| Revenue | 2/5 | Modelo definido; **Mercado Pago pendiente** (blocker a 3 meses) |

**Done:** 3 landings + PWA + API + owner; landing vecino lista; narrativa locked; medición UTM.
**In-flight:** deploy de mejoras de landing (mockup+botón+gráfico, pendiente); landing comercio pivoteada.
**Stuck:** comercios reales (supply) · link de canal WhatsApp · dashboard analytics · MP.

---

## 4. Acquisition (extraños → conocen Mi San Pedro)
- **Owned:** landing vecino (live, mide UTM), canal de WhatsApp (activar), la propia app.
- **Físico / ALF (lo nuestro):** **sellos/calcos en los comercios cargados** (doble función: prueba social + canal), "**dos chicas en la peatonal**" (street team con QR), volante-imán.
- **Borrowed:** **Cámara de Comercio / Municipio** (respaldo + difusión), y los **propios comercios** difundiendo a sus clientes (su WhatsApp/cartel).
- **Rented:** IG/FB local — orgánico ya; ads chicos **recién cuando haya prueba real**.
- **Skip ahora:** SEO programático, cold email, directorios, ASO (somos PWA).
- **Skills que ejecutan:** `launch` (ORB), `social`, `marketing-ideas`, `co-marketing` (Cámara), `ad-creative`/`ads` (después). **MCP/tools:** Meta Ads / Google Ads CLIs (cuando haya cuentas).

## 5. Activation (conocen → primera experiencia de valor)
- **El "wow":** entrar (sin registro) y **ver descuentos reales cerca + primer canje fácil** → la billetera suma "Ahorrado en San Pedro".
- **Blocker:** app vacía sin comercios → resolver supply. **Coherencia landing→app** ya arreglada (el dato del canje está aclarado en el paso 2 + FAQ).
- **Skills:** `signup`, `cro`, `copywriting`, `popups` (captura de WhatsApp). **Métrica:** % visita-landing → entra-app → primer canje.

## 6. Retention (convertido → vuelve y profundiza)
- **Motor ya construido:** **billetera de ahorro con niveles** (Recién empezás → Bronce → Plata → Oro → Leyenda del barrio) = gamificación de la recurrencia.
- **Razón para volver:** **descuentos nuevos cada semana** → empujar por WhatsApp/push "lo nuevo de esta semana, cerca tuyo".
- **Skills:** `sms` (WhatsApp), `emails`, `churn-prevention` (más adelante), `community-marketing`.

## 7. Referral (retenido → trae más)
- **Comercio→comercio:** backend hecho (**+1 semana gratis por referido, tope 8**) → activar el panel del comercio + el copy del owner.
- **Vecino→vecino:** "**compartí tu ahorro**" / "invitá a un vecino" (mecánica simple, sin fricción).
- **Skills:** `referrals`. **Métrica:** % de altas que vienen de un referido.

## 8. Revenue
- **Comercio paga $50k/mes** tras 3 meses gratis (primeros 20). **MP pendiente** = no se captura ni el primer peso → resolver antes del mes 4.
- **Guion de conversión gratis→pago:** definir **qué métrica le mostramos al comercio en el mes 3** para que pague (clientes traídos, canjes, repetición). Ese es el momento de la verdad del negocio.
- **Skills:** `pricing`, `paywalls` (lado comercio), `sales-enablement`.

---

## 9. Roadmap 90 días (AARRR-tagged · owner)
- **Sem 1-2 — UNBLOCK:** cargar **8-10 comercios reales** [Supply · founder] · pegar analytics [Medición · Claude] · **deploy landing** (mockup+botón+gráfico) [Activación · Claude] · cerrar 1 cara/Cámara [Acquisition · founder].
- **Sem 3-4 — FOUNDATION:** poblar landing con **prueba real** (logos/nombres + contador) [Activación · Claude] · activar **WhatsApp** [Acquisition/Retention] · producir **sellos** [Acquisition] · **soft-launch** círculo cercano [Acquisition].
- **Sem 5-8 — VELOCITY:** **street team** peatonal [Acquisition] · IG/FB local [Acquisition] · leer funnel + iterar copy con `cro`/`ab-testing` [Activación] · empujar "nuevos esta semana" [Retention].
- **Sem 9-12 — COMPOUND:** activar **referido comercio→comercio** [Referral] · primeros datos de conversión gratis→pago [Revenue] · preparar **Mercado Pago** [Revenue] · evaluar 2ª ciudad [Growth].

## 10. 12-month outlook
Q1 lanzar + prueba + demanda local · Q2 retención (billetera/semana) + primeros pagos · Q3 referral loop + optimización + ads pagos con prueba · Q4 playbook + 2ª ciudad (multi-tenant).

## 11. Marketing Ops Stack (skills + tools por etapa)
- **Acquisition:** `launch`, `social`, `ads`, `ad-creative`, `co-marketing`, `marketing-ideas` · Meta/Google Ads MCP.
- **Activation:** `cro`, `signup`, `copywriting`, `popups` · analytics (GA4/Plausible).
- **Retention:** `sms`, `emails`, `community-marketing`, `churn-prevention` · WhatsApp.
- **Referral:** `referrals` · dub (links).
- **Revenue:** `pricing`, `paywalls`, `sales-enablement` · Mercado Pago.
- **Cross-cutting:** `product-marketing` (este doc), `customer-research`, `copy-editing`, `marketing-psychology`.

## 12. Tactical idea bank
Pendiente: cruzar con `marketing-ideas` (139 tácticas) y taggear Now / Q2 / Q3+ / Skip para Mi San Pedro. (Correr `marketing-ideas` aparte.)

## 13. Measurement & open decisions
- **North-star:** canjes/semana. **Leading:** visitas landing→app (UTM), comercios cargados, % canje, comercios pagos.
- **Decisiones que bloquean:** (a) ¿quién consigue los comercios y para cuándo? (b) ¿una cara/Cámara visible? (c) ¿cuándo se prende MP? (d) link del canal de WhatsApp.
