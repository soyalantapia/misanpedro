# Setup del Panel Owner en producción

El **Panel Owner** (super-admin de la plataforma) está desplegado en:
**https://misanpedro.com/owner/** → apunta al API de prod (Railway), detrás de login + 2FA.

Desde ahí controlás TODA la plataforma: crear/editar ciudades (slug, nombre, país → moneda+locale,
color), ver comercios/usuarios/suscripciones y métricas cross-ciudad.

---

## 1. Crear tu cuenta owner (one-time)
La DB de prod es interna de Railway (no se puede crear el owner desde local), así que se crea con un
**bootstrap por env-var que corre al arrancar el API** (apps/api/src/db/connection.ts → `bootstrapOwner`).

En Railway → proyecto `misanpedro-api` → env `production` → service `api` → **Variables**, agregá:

| Variable | Valor |
|---|---|
| `OWNER_BOOTSTRAP_EMAIL` | tu-email@dominio.com |
| `OWNER_BOOTSTRAP_PASSWORD` | una contraseña fuerte (≥8 chars) — **la elegís vos** |
| `OWNER_BOOTSTRAP_NOMBRE` | Tu Nombre (opcional) |
| `OWNER_2FA_REQUIRED` | `true` (recomendado: el panel es público, exigí 2FA) |

Guardar dispara un redeploy. En los logs del API vas a ver:
`[bootstrap-owner] ✅ Owner creado: tu-email…`
(Es **idempotente**: si el owner ya existe, no hace nada.)

## 2. Entrar
1. Andá a **https://misanpedro.com/owner/**.
2. Login con tu email + la contraseña que pusiste.
3. El primer login te muestra el **QR de 2FA** → escanealo con Google Authenticator / Authy / 1Password.
4. Ingresá el código de 6 dígitos → adentro.

## 3. 🔒 Seguridad (importante)
- Una vez que entraste, **borrá `OWNER_BOOTSTRAP_PASSWORD`** de Railway (ya no hace falta).
- El panel queda público en `/owner/` detrás de login + 2FA + rate-limit. Si querés más cierre:
  moverlo a un subdominio (`admin.misanpedro.com`) o IP allowlist (.htaccess) — avisame.

---

## Crear ciudades

**Opción A — desde el panel** (recomendado): Owner → "Ciudades" → "Nueva ciudad" → elegís el país
(auto-completa moneda + locale), nombre, slug, color → crear. La ciudad nace vacía y aislada.

**Opción B — por consola** (lote), corriendo DENTRO de Railway o contra la DB que corresponda:
```
SLUG=narino NOMBRE="Mi Nariño" CIUDAD="Pasto" PAIS="Colombia" MONEDA="COP" LOCALE="es-CO" \
  node --import tsx --env-file=.env scripts/crear-ciudad.ts
```
(`UPDATE=true` para actualizar una existente. PRIMARY_COLOR/ACCENT_COLOR para el color, LAT/LNG para el geoCenter.)

## Servir una ciudad (URL)
Hoy, sin el dominio de plataforma, una ciudad se prueba con `?tenant=<slug>` (ej.
`https://app.misanpedro.com/?tenant=narino`). Cuando compres el **dominio de plataforma** (ver
ESTRATEGIA-MULTICIUDAD.md), cada ciudad vive en `<slug>.<dominio>` (subdominio → resuelve el slug solo).

## Redeploy del panel Owner (si cambia el código)
```
SSH_KEY=~/.ssh/misanpedro_hostinger pnpm deploy:hostinger
```
(Buildea y sube los 4 frontends; el owner va a `public_html/owner/`.)
