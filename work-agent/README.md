# work-agent — Contexto completo de Mi Ciudad (micuidad.com)

Esta carpeta es el **handoff vivo** del proyecto: si abrís un chat nuevo (o entra
otra persona), leyendo esto entendés qué es, cómo está armado, dónde estamos y qué falta.

> **Para la visión completa del proyecto** (negocio, arquitectura a fondo, flujos, seguridad,
> historia, roadmap) → **[`../PROJECT.MD`](../PROJECT.MD)**. Para el onboarding técnico
> (cómo correrlo, stack, env) → **[`../README.md`](../README.md)**. Esta carpeta es el **estado vivo**.

> **Producto en una línea:** plataforma **multi-ciudad / multi-país** de descuentos
> vecinales, marca blanca ("Mi <Ciudad>"), sobre **un solo codebase**. Cada pueblo/ciudad
> es un *tenant* (`App`) que vive en su subdominio `https://<ciudad>.micuidad.com`.
> Nació como "Mi San Pedro" y se generalizó a **Mi Ciudad** (`micuidad.com`).

## Por dónde empezar (orden de lectura)

1. **[00-ESTADO-Y-ARQUITECTURA.md](00-ESTADO-Y-ARQUITECTURA.md)** — qué es, cómo está armado (monorepo, apps, multi-tenancy) e infra (Railway + Cloudflare + Hostinger). **Dónde estamos hoy.**
2. **[01-PENDIENTES.md](01-PENDIENTES.md)** — **lo más importante para continuar:** qué falta, en orden. UI a medio hacer, pasos manuales del usuario y backlog.
3. **[02-DEPLOY-Y-GOTCHAS.md](02-DEPLOY-Y-GOTCHAS.md)** — cómo deployar, qué secretos faltan (sin valores) y las trampas que ya nos mordieron.
4. **[03-DECISIONES.md](03-DECISIONES.md)** — decisiones tomadas y el porqué (no las deshagas sin entenderlas).

## Documentos relacionados (en la raíz del repo)
- `AUDITORIA-LANZAMIENTO-MICUIDAD.md` — auditoría de lanzamiento (29 agentes): bloqueantes/mayores/menores.
- `ESTRATEGIA-PAGOS.md` — modelo de cobros por ciudad (Fase 1 MP global / Fase 2 "Conectar MP/Stripe").
- `ESTRATEGIA-MULTICIUDAD.md`, `SETUP-MICUIDAD.md`, `SETUP-CLOUDFLARE.md`, `SETUP-OWNER.md` — runbooks de infra.

## Coordenadas rápidas
- **Repo:** `github.com/soyalantapia/misanpedro` (rama `main`). Local: `~/dev/misanpedro` (+ symlink en `~/Desktop/Programacion/misanpedro`).
- **Node 22** obligatorio: `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`. pnpm 10.28.2 + turbo.
- **Prod:** API + fronts en **Railway** (proyecto `misanpedro-api`, servicio `api`). DNS en **Cloudflare** (`micuidad.com`).
- **URLs vivas:** `https://sanpedro.micuidad.com` · `https://minarino.micuidad.com` · `https://administracion.micuidad.com` (owner) · API: `https://api-production-43c52.up.railway.app`.
- **Deploy:** `railway up --detach --environment production --service api` (ver doc 02).
