# QA Findings — corrida local (apps/web PWA + owner), API local :3002 / Atlas dev

> Entorno: app corriendo local (preview headless, consola limpia sin extensiones). API local :3002 con mi código pre-prod nuevo. NO se testea contra prod (prod está flapeando + no se ensucia data real).
> Estado: PROCESO ITERATIVO. La condición "cero hallazgos en todo el producto" no se declara terminada en una sola sesión sin verificar todo el mapa; este log es persistente y se sigue.
>
> ⚠️ LIMITACIÓN DEL SANDBOX DE PREVIEW: el navegador headless NO tiene red externa → los recursos de CDNs externos (fuente Satoshi de fontshare.com, tiles de OpenStreetMap/Leaflet) FALLAN en este entorno. Eso NO es bug de la app (en navegador real cargan). El QA funcional (API localhost, lógica, validación, routing, consola de código propio) sí es fiel. El QA visual de fuente/mapa requiere navegador real.

## Mapa de superficies
- **apps/web** (PWA vecino + panel comercio `/#/admin`) — config `misanpedro-dev` — PRIORIDAD (producto vivo).
- **apps/owner** (super-admin) — config `misanpedro-owner`.
- **apps/landing** (marketing comercio, legacy SP) — config `misanpedro-landing`.
- **apps/landing-vecino** (marketing vecino, legacy SP) — config `misanpedro-vecino`.

## Cobertura — Panel comercio (/#/admin)
- [x] Deep-link a ruta protegida sin sesión (`/#/admin/clientes`) → redirige a login ✓ (sin bypass)
- [x] Signup 3 pasos (A.3): validación step 1 vacío ✓, avance Comercio→Contacto→Cuenta ✓, crear + auto-login ✓
- [ ] Login OTP · Validar código (vacío/inválido/válido) · Confirmar canje (montoTicket, stockMaximo) · Descuentos (wizard, editar, pausar, borrar) · Clientes · Microsite/Comercio · Estadísticas · WhatsApp · Recomendá · responsive · a11y teclado

## Hallazgos

| ID | Sev | Tipo | Ubicación | Problema | Esperado | Estado |
|----|-----|------|-----------|----------|----------|--------|
| F-01 | Bajo | funcional | apps/landing-vecino (CTA "Ir a la app") | Link "Ir a la app" hardcodea `https://app.misanpedro.com/#/` (dominio legacy; plataforma actual = micuidad.com). No tenant-aware. | Link relativo/derivado del dominio actual. | Abierto (app legacy, prioridad baja) |
| F-02 | — | consola | apps/web (todas las pantallas) | Warning "Couldn't load preload assets" ×N. **Causa: sandbox sin red externa** (no es código de la app). | — | NO-BUG (artefacto de entorno) |
| F-03 | Bajo | red/robustez | apps/web/index.html:13-14 | Fuente Satoshi se carga de CDN externo `api.fontshare.com` sin fallback self-hosted. En el sandbox falla (ERR_FAILED); en real carga. Mejora latente: self-hostear la fuente para resiliencia + cero dependencia externa. | Fuente self-hosted o degradación elegante. | Abierto (mejora, no rompe en real) |
