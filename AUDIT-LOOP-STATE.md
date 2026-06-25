# AUDIT-LOOP-STATE

ronda_actual: 1
estado: EN_PROGRESO
fixes_en_esta_ronda: 1
rondas_limpias_consecutivas: 0

> ⚠️ Hubo 1 fix en la ronda 1 (pantalla blanca, app-wide) → la ronda NO puede cerrar el loop;
> tras completar el resto del inventario hay que hacer una ronda nueva desde cero.

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

## B. Panel del comercio (web :5180, /#/admin/..., sesión comercio)
- [ ] AdminLoginPage
- [ ] AdminSignupPage
- [ ] AdminDashboardPage (/admin)
- [ ] AdminCuponesPage
- [ ] AdminCuponEditPage (nuevo + editar)
- [ ] AdminValidarPage
- [ ] AdminConfirmarCanjePage (/admin/canje/:id)
- [ ] AdminClientesPage
- [ ] AdminClienteDetailPage
- [ ] AdminEstadisticasPage
- [ ] AdminReferidosPage
- [ ] AdminWhatsappPage
- [ ] AdminComercioPage

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
