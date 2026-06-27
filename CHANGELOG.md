# Changelog — Mi Ciudad

Registro de qué se shippeó y cuándo. No usamos versionado semántico (deploy continuo a prod);
agrupamos por **tanda**. Lo más nuevo arriba. Detalle vivo en [`work-agent/01-PENDIENTES.md`](work-agent/01-PENDIENTES.md).

---

## 2026-06-27 — Modo soporte + documentación
- **Modo soporte (impersonación owner→comercio)** — cualquier owner entra al panel de cualquier
  comercio como el propietario, para soporte técnico, con auditoría de cada mutación y banner
  siempre visible. Código de un solo uso para el handoff cross-host; sesión revocable.
  (`a9a68fb`, `5fb94f6`, `d56a2ec`.)
  - Bug-hunts: 2 bugs reales fixeados (un owner deshabilitado podía generar sesiones; el banner
    no se veía en la página de confirmar canje). Auditoría-en-mutación verificada e2e en prod.
- **Documentación centralizada** — `PROJECT.MD` (biblia del proyecto), `README.md` reescrito,
  `CONTRIBUTING.md`, `docs/RUNBOOK.md`, este changelog; work-agent actualizado.

## 2026-06-26 — Semana de lanzamiento
- **Emails OTP rediseñados** (`b7f81fb`) — template único lindo/branded, logo + código copiable +
  **login de un toque** (magic-link). Para los 3 logins (vecino/comercio/owner).
- **Onboarding del comercio** (`42472ca`, `1353188`) — en el login, email sin comercio → redirige
  al alta con el flujo precargado. Draft scopeado por email. Bug-hunt: 18→2 bugs fixeados.
- **Camino del dinero (canje) auditado** (`664e2f1`, `4aa9606`, `cc47fb7`) — 13 tests de integración;
  fix de consistencia del ahorro `precio_fijo` (preview del cajero == backend); cierre compensado.
- **Aislamiento multi-tenant verificado** (`51e4402`) — 5 tests de integración + auditoría de
  207 queries → 0 leaks.
- **Hardening pre-launch** (`5c9cee2`) — 5 fixes del barrido final (regex escape, OTP atómico,
  validación franja desde<hasta, tope 5MB en imágenes, claim atómico de referido). 0 blockers.

## 2026-06-25 — Owner expandido (Fases 1-4)
- Auth OTP passwordless · **multi-admin con RBAC** (super/admin/finanzas/soporte/viewer) + sección
  Equipo · **auditoría completa** (`OwnerAuditLog` + `GET /owner/audit`) · **estadísticas en vivo**
  + snapshot diario de MRR. (`df9f302`, `c53cbf5`, `23a7696`, `d928b2e`, `a6d373f`.)

## 2026-06-23 — Tanda pre-producción
- Web Push scoped por `appId` (cierra agujero cross-tenant) · URLs por-tenant (`lib/urls.ts`) ·
  `stockMaximo` con claim atómico · owner backend (rate-limit, audit, suspender/reactivar) +
  front (wizard con legales, MRR multi-moneda, paginación) · alta del comercio en 3 pasos ·
  CI (`.github/workflows/ci.yml`). (`db06da9`, `4f011ad`, `c37d68d`.)

## Antes
- **Pivot multi-ciudad** — de "Mi San Pedro" (una ciudad) a "Mi Ciudad" (`micuidad.com`): 1 codebase,
  datos por `appId`, marca blanca, panel owner.
- **Cutover a Railway** — API + Mongo + fronts migrados a Railway; `micuidad.com` dejó Hostinger
  (que quedó solo para el redirect 301 de `misanpedro.com` y el buzón de correo).
- **Origen** — "Mi San Pedro", una sola ciudad.
