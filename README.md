# Mi San Pedro

Programa de descuentos vecinales con app PWA para el vecino y panel para el comercio.
Live: https://soyalantapia.github.io/misanpedro/

## Estructura del monorepo

```
misanpedro/
├── apps/
│   ├── web/          ← Frontend (Vite + React 19 + Tailwind 4)
│   └── api/          ← Backend (Hono + MongoDB + Mongoose)
└── packages/
    └── shared/       ← Types + Zod schemas compartidos
```

## Setup local

Requiere Node ≥22 LTS y pnpm ≥10.

```bash
# Una sola vez
pnpm install

# Configurar variables de entorno del backend
cp apps/api/.env.example apps/api/.env
# Editar apps/api/.env con tus credenciales (MONGODB_URI, JWT_SECRET, etc.)

# Arrancar todo (front + back en paralelo)
pnpm dev

# O por separado
pnpm dev:web    # → http://127.0.0.1:5180
pnpm dev:api    # → http://localhost:3001/api/v1/health
```

## Comandos

```bash
pnpm dev              # arranca web + api en paralelo (turbo)
pnpm build            # build de toda la app
pnpm typecheck        # tsc en todos los workspaces
pnpm lint             # eslint
pnpm deploy:web       # build + deploy a gh-pages
```

## Stack

**Frontend** (`apps/web`)
- Vite 7 · React 19 · TypeScript ~6.0 (strict) · Tailwind 4
- React Router 7 (HashRouter) · TanStack Query (Fase 2+)
- lucide-react · html5-qrcode · qrcode · vite-plugin-pwa
- Light theme · Tipografía Satoshi

**Backend** (`apps/api`)
- Hono · @hono/node-server · TypeScript
- Mongoose (MongoDB Atlas) · Zod (validación compartida)
- jsonwebtoken · bcryptjs (auth comercio)
- Mercado Pago Preapproval API (Fase 5)
- whatsapp-web.js + Puppeteer (Fase 6)

**Hosting**
- Frontend → GitHub Pages (gh-pages branch)
- Backend → Railway (planeado, Fase 1)

## Roadmap (ver plan completo en docs)

- ✅ **MVP frontend-only** — todo funcionando con `localStorage` + datos demo
- 🚧 **Fase 0** — Monorepo + backend boilerplate + conexión MongoDB
- ⏭ Fase 1 — Auth real (vecino con OTP, comercio con email+password)
- ⏭ Fase 2 — App vecino conectada a la API
- ⏭ Fase 3 — Validación + canje real con verificación de firma
- ⏭ Fase 4 — CRUD cupones + edit comercio con persistencia
- ⏭ Fase 5 — Mercado Pago suscripciones (paywall real)
- ⏭ Fase 6 — WhatsApp con whatsapp-web.js (sesiones del comercio)
- ⏭ Fase 7 — Eventos + notifs en vivo via SSE
- ⏭ Fase 8 — QA, hardening, lanzamiento beta

## Demo flow (mientras no hay backend real)

1. Abrí https://soyalantapia.github.io/misanpedro/ → datos demo cargan automáticamente
2. Login admin: `cajero@laesquina.com` / `demo123`
3. En Validar, tipeá `123 456` → confirmar canje → ver impacto en Mis clientes
