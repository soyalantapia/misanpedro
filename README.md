# Mi Ciudad (`micuidad.com`)

Plataforma **multi-ciudad / multi-país** de descuentos vecinales, marca blanca
("Mi <Ciudad>"), sobre un solo codebase. Cada ciudad es un *tenant* que vive en
`https://<ciudad>.micuidad.com`. Nació como "Mi San Pedro" y se generalizó.

> **📖 Contexto completo / handoff:** ver **[`work-agent/`](work-agent/)** — estado actual,
> arquitectura, pendientes, runbook de deploy y decisiones. Empezá por
> [`work-agent/README.md`](work-agent/README.md).

## En vivo
- Vecino + comercio: `https://<ciudad>.micuidad.com` (ej. `sanpedro`, `minarino`) · comercio en `/#/admin`
- Owner (super-admin): `https://administracion.micuidad.com`
- API: `https://api-production-43c52.up.railway.app/api/v1`
- `misanpedro.com` → redirige 301 a `sanpedro.micuidad.com`

## Estructura del monorepo
```
misanpedro/
├── apps/
│   ├── api/             Hono + Mongoose (MongoDB). En prod sirve también los fronts.
│   ├── web/             PWA vecino + panel comercio (/#/admin) · Vite + React 19 + Tailwind 4 · HashRouter
│   ├── owner/           Panel super-admin (administracion.micuidad.com) · BrowserRouter
│   ├── landing/         Marketing comercio (single-tenant SP, legacy)
│   └── landing-vecino/  Marketing vecino (single-tenant SP, legacy)
└── packages/shared/     Types + Zod schemas compartidos
```

## Setup local
Requiere **Node ≥22** y **pnpm ≥10**.
```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
pnpm install
cp apps/api/.env.example apps/api/.env     # editar MONGODB_URI, JWT_SECRET, etc.
pnpm dev                                   # web + api (turbo)
```
Probar un tenant en local: `?tenant=narino` en la URL.

## Comandos
```bash
pnpm dev            # web + api en paralelo
pnpm build          # build de todo (turbo)
pnpm typecheck      # tsc en los 6 paquetes
pnpm test           # vitest (api 83 + web 104)
pnpm check:tenant   # guardrail: sin nombre de ciudad hardcodeado en web/owner
```

## Deploy (Railway)
```bash
railway up --detach --environment production --service api
```
El servicio `api` corre el backend y sirve los fronts (host-based). DNS en Cloudflare
(`*.micuidad.com` → Railway). Detalle y trampas en [`work-agent/02-DEPLOY-Y-GOTCHAS.md`](work-agent/02-DEPLOY-Y-GOTCHAS.md).

## Stack
- **API:** Hono · Mongoose · Zod · jsonwebtoken · bcryptjs · otplib · nodemailer (SMTP) · Mercado Pago · web-push
- **web/owner:** Vite 7 · React 19 · Tailwind 4 · React Router 7 · vite-plugin-pwa
- **Infra:** Railway (API + Mongo + fronts) · Cloudflare (DNS/SSL) · Hostinger (legacy redirect + buzón de correo)

## Docs de referencia (raíz)
`AUDITORIA-LANZAMIENTO-MICUIDAD.md` · `ESTRATEGIA-PAGOS.md` · `ESTRATEGIA-MULTICIUDAD.md` ·
`SETUP-MICUIDAD.md` · `SETUP-CLOUDFLARE.md` · `SETUP-OWNER.md`
