# Mi San Pedro

PWA del programa de descuentos vecinales **Mi San Pedro**. Los vecinos descubren descuentos en comercios adheridos, activan un cupón con QR y lo canjean en el local.

## Estructura

- `client/` — Frontend React 19 + Vite 7 + TypeScript + Tailwind 4 + React Router 7 + html5-qrcode (PWA)

Ver `Mi_San_Pedro_MVP_Specs.docx` para la especificación funcional completa (pantallas, modelo de datos, endpoints, flujo de canje end-to-end).

## Stack

- Vite 7 · React 19 · TypeScript ~6.0 (strict)
- Tailwind 4 (`@theme inline`)
- React Router 7 (HashRouter)
- lucide-react · html5-qrcode · vite-plugin-pwa
- Tipografía Satoshi (Fontshare)
- Light theme (`color-scheme: light` forzado)

## Desarrollo

```bash
cd client
npm install
npm run dev          # http://127.0.0.1:5180
```

> Requiere Node ≥22 LTS (no v25+). Si tenés Node 25, usá `nvm use 22` o `PATH="/opt/homebrew/opt/node@22/bin:$PATH"`.

## Estado actual

**Fase 0 — Scaffold**

- AppShell vecino con 3 pestañas (Descuentos / Mis cupones / Canjeados)
- Design system Deenex aplicado (tokens, sombras, tipografía Satoshi)
- HashRouter para deploy estático en GitHub Pages
- Placeholders de las 3 pantallas principales

## Próximas fases

1. **App vecino** — listado de descuentos, detalle, registro al primer canje, cupón activo con QR + código numérico, mis cupones, canjeados
2. **Panel comercio** — login, dashboard, validar cupón (scan QR + código manual), mis cupones, mis clientes con bloqueo
3. **Polish** — PWA install, animaciones, empty states, dialogs, export CSV

## Deploy

GitHub Pages desde rama `gh-pages`:

```bash
cd client && npm run build
# luego copiar client/dist a la rama gh-pages
```

URL pública: https://soyalantapia.github.io/misanpedro/
