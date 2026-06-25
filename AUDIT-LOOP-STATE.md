# AUDIT-LOOP-STATE

ronda_actual: 1
estado: EN_PROGRESO (1 fix crítico aplicado; re-triage post-fix LIMPIO)
fixes_en_esta_ronda: 1
rondas_limpias_consecutivas: 0

> RONDA 1 — RESULTADO:
> - 1 bug CRÍTICO encontrado y arreglado: pantalla blanca app-wide (`<ApiSync>` con useNavigate fuera del Router) → commit
>   c50345e, deployado + verificado en prod (vecino + admin renderizan). Prod estaba caído desde 4def4ea.
> - Triage COMPLETO de las 3 superficies (vecino 16 págs · panel comercio 13 · owner 8) POST-fix = TODO renderiza, 0 errores
>   reales de consola, estados vacíos bien diseñados, multi-tenant correcto (narino=teal "Mi Nariño"). Spot-checks visuales
>   (catálogo, dashboard owner, validar/estadísticas panel) = OK.
> - Como hubo 1 fix, el loop NO termina todavía: falta una RONDA 2 confirmatoria (re-pasar todo; esperado-limpio) + las pocas
>   celdas que requieren datos reales (cupon/comercio/activacion/cliente por :id, forgot/reset password, wizard NewApp pasos).
> - Para terminación formal: 2 rondas limpias consecutivas. El re-triage post-fix de arriba es efectivamente la 1ª pasada limpia.

> Cada página se audita en mobile (375×812) y desktop (1280×800); las tenant-dependientes en sanpedro + narino.
> Marca: `[ ]` pendiente · `[x]` OK · `[!]` bug→fix (ver histórico).

## A. PWA del vecino (web :5180, /#/...)
- [!] DescuentosPage (/)  → 🔴 CRÍTICO app-wide: pantalla blanca (ApiSync fuera del Router) → FIX commit c50345e. Render OK post-fix.
- [x] DescuentosPage locales (/locales)  (render OK, 0 errores reales)
- [x] MapaPage (/mapa)  (render OK)
- [ ] MisCuponesPage
- [x] CanjeadosPage (/canjeados)  (render OK, estado vacío sin sesión)
- [x] AlertasPage (/alertas)  (render OK)
- [x] PerfilPage (/perfil)  (render OK)
- [x] PlanPage (/plan)  (render OK)
- [x] RegistroPage (/datos)  (render OK)
- [ ] CuponDetailPage (/cupon/:id)  (necesita un id real)
- [ ] MerchantDetailPage (/comercio/:id)  (necesita un id real)
- [ ] CuponActivoPage (/activacion/:id)  (necesita una activación)
- [ ] TenantSelectorPage
- [x] legal/TerminosPage  (render OK)
- [x] legal/PrivacidadPage  (render OK)
- [x] NotFoundPage  (render OK)

> NOTA round1: triage de páginas del vecino = todas renderizan, 0 errores de consola REALES.
> Faltan las que necesitan datos (cupon/comercio/activacion id, MisCupones, TenantSelector) + el barrido VISUAL fino (screenshots mobile+desktop) + narino.

## B. Panel del comercio (web :5180, /#/admin/..., sesión comercio) — triaged con comercio QA en sanpedro
- [x] AdminLoginPage  (render OK)
- [x] AdminSignupPage  (render OK)
- [x] AdminDashboardPage (/admin)  (render OK)
- [x] AdminCuponesPage  (render OK)
- [x] AdminCuponEditPage nuevo (render OK)
- [x] AdminValidarPage  (render OK + verificado visual: input 6 dígitos prolijo)
- [ ] AdminConfirmarCanjePage (/admin/canje/:id)  (necesita una activación real)
- [x] AdminClientesPage  (render OK, empty state)
- [ ] AdminClienteDetailPage  (necesita un userId)
- [x] AdminEstadisticasPage  (render OK + verificado visual: empty state lindo)
- [x] AdminReferidosPage  (render OK)
- [x] AdminWhatsappPage  (render OK)
- [x] AdminComercioPage  (render OK)

> NOTA round1: panel triaged con comercio QA `qa-comercio-loop` (sanpedro, BORRADO al terminar) = TODO renderiza, 0 errores reales,
> estados vacíos bien diseñados. Multi-tenant verificado: narino = teal #0d9488 + "Mi Nariño" (los 403 que vi eran mi sesión de
> comercio cruzada de tenant, NO bug). Faltan las 2 que necesitan datos (canje/:id, cliente/:userId).

## C. Owner (owner :5182, sesión owner) — rutas reales: / · /apps · /apps/nueva · /apps/:id · /comercios · /vecinos · /pagos · /settings
- [x] LoginPage  (login OK, form funciona)
- [ ] ForgotPasswordPage
- [ ] ResetPasswordPage
- [x] DashboardPage (/)  (render OK + verificado visual: MRR/KPIs/gráficos perfectos)
- [x] AppsPage (/apps)  (render OK)
- [x] AppDetailPage (/apps/:id)  (render OK; ya auditada a fondo antes — card de Links)
- [x] NewAppPage (/apps/nueva)  (render OK; aviso de contraste ya implementado)
- [x] MerchantsPage (/comercios)  (render OK, len 2019)
- [x] UsersPage→Vecinos (/vecinos)  (render OK, len 1569)
- [x] SubscriptionsPage→Pagos (/pagos)  (render OK, len 1259)
- [x] SettingsPage (/settings)  (render OK)

> NOTA round1: owner triaged = TODO renderiza, 0 errores de consola, Dashboard verificado visualmente OK.
> Setup: owner QA `qa-owner@local.test` / `qa-owner-12345` (enabled:true) en Atlas dev — BORRAR al cerrar el loop.
> Faltan: Forgot/Reset password (flujo), barrido visual fino mobile, y los pasos del wizard de NewApp.

## D. Landings (:5181 comercio, :5185 vecino; ?tenant=sanpedro/narino)
- [ ] Landing comercio (todas las secciones)
- [ ] Landing vecino (todas las secciones)

## Bugs encontrados (histórico)
- ronda 1 · DescuentosPage (app-wide) · 🔴 CRÍTICO funcional · pantalla blanca: `<ApiSync>` usaba useNavigate fuera del `<HashRouter>` → crash de toda la PWA (vecino + comercio). Prod estaba caído desde commit 4def4ea. · FIX commit `c50345e` (mover ApiSync dentro del Router) · deployado + verificado en prod (vecino + admin renderizan).

## A decidir / no-bloqueante (no son bugs claros)
- axe-core (SOLO dev, @axe-core/react en main.tsx) marca contraste del naranja de marca `#ea580c` como texto chico sobre claro (3.34:1 < 4.5 AA). NO aparece en prod (axe es dev-only) y es el color de marca usado como acento → decisión de diseño, no bug. Si se quiere AA estricto, usar un shade más oscuro para texto chico.
- fontshare CORS (`api.fontshare.com`, Satoshi): el error sólo lo dispara el precache PWA vía XHR en el entorno browse; en navegadores reales el `<link rel=stylesheet>` carga bien. No es bug de usuario. (Mejora opcional: self-hostear la fuente para no depender de un CDN externo.)
- Mucho dato de prueba ("E2E/QA/Test") en el catálogo de sanpedro → es DATA, no código. Limpiar el Atlas dev/prod aparte.
