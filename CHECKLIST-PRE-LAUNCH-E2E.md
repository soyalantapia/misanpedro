# CHECKLIST PRE-LAUNCH — Flujo crítico E2E + Observabilidad

**Fecha:** 2026-05-28 · **Para:** verificación manual antes de difundir

---

## 1. Estado del cableado (verificado por código ✅)

| Pieza | Estado | Detalle |
|---|---|---|
| Webhook MP firma | ✅ | `verifyMpSignature` rechaza 401 si la firma no valida (`billing.ts:71`) |
| Webhook idempotente | ✅ | La activación usa `updateOne({estado:'pending_payment'},{estado:'activo'})` → si MP reenvía el evento, la 2ª vez no reactiva ni manda recibo duplicado (`billing.ts:98-108`) |
| Anti-bypass de pago | ✅ | `mock-confirm` devuelve 403 si `MP_ACCESS_TOKEN` está seteado → en prod NO se puede activar sin pagar (`billing.ts:256`) |
| Error tracking | ✅ (tras instalar) | `captureException` cableado en onError/bootstrap/uncaught/unhandled; `@sentry/node` ya instalado. **Solo falta setear `SENTRY_DSN`** |
| Health checks | ✅ | `/health` (db+uptime+mem), `/health/live`, `/health/ready` (503 si DB caída) |
| Graceful shutdown | ✅ | drena requests, para jobs, cierra DB, flush Sentry |

### ⚠️ Gaps conocidos (no bloqueantes, con workaround)
- **Refund automático MP** no implementado (A2). El cancel dentro de 10 días promete reembolso pero NO lo dispara en MP → **hacelo manual** desde `panel.mercadopago.com.ar` dentro de 48h.
- **No hay test E2E transaccional automatizado.** Los Playwright specs son smoke de renderizado. Por eso el smoke manual de abajo es importante.

---

## 2. Smoke manual del flujo crítico (correr en SANDBOX de MP antes de difundir)

> Usá credenciales de **prueba** de MercadoPago (no productivas). Tarjetas de test: https://www.mercadopago.com.ar/developers → "Tarjetas de prueba".

### Comercio (el que paga)
- [ ] 1. Registro en `/#/admin/registro` → completá datos + fiscales (CUIT de prueba) → llegá al paso "Pago"
- [ ] 2. Se genera el preapproval → te redirige al `initPoint` de MP
- [ ] 3. Pagás con tarjeta de test → MP redirige de vuelta a `/#/admin/billing/return`
- [ ] 4. **El webhook llega** y el comercio pasa de `pending_payment` → `activo` (verificá en el panel owner o en `/admin/comercio`)
- [ ] 5. Llega el **email de recibo** (Resend)
- [ ] 6. Creás un descuento en `/#/admin/cupones/nuevo` → se publica
- [ ] 7. El banner "pago pendiente" YA NO aparece

### Vecino (el que canjea)
- [ ] 8. En la PWA del vecino, el descuento del comercio aparece en el listado
- [ ] 9. Registro vecino → activás el cupón → ves el QR + código de 6 dígitos
- [ ] 10. (Comercio) en `/#/admin/validar` ingresás el código → "Cupón válido" → confirmás canje con monto
- [ ] 11. (Vecino) la pantalla del cupón activo se actualiza sola → aparece en "Canjeados" con el ahorro

### Recuperación de errores
- [ ] 12. Código inválido en Validar → mensaje claro + "probar otro código"
- [ ] 13. Cancelar suscripción dentro de 10 días → mensaje de reembolso (recordá hacer el refund manual en MP)

---

## 3. Observabilidad — setup para el día 1

### Antes de difundir
- [ ] Setear `SENTRY_DSN` en Railway (crear proyecto en sentry.io → Node). Sin esto, Sentry corre en no-op y NO te enterás de los errores.
- [ ] Verificar que `/api/v1/health` responde `ok:true` y `db:"connected"` en prod
- [ ] Configurar el **uptime monitor** de Railway (o UptimeRobot gratis) apuntando a `/api/v1/health/ready` — te avisa si la API o la DB se caen

### Qué mirar el primer día (manual, 3 veces al día)
- [ ] Sentry → ¿hay excepciones nuevas?
- [ ] Railway logs → buscar `[mp-webhook]` (¿llegan los pagos?), `[error]`, `[email/error]`
- [ ] Owner panel → Dashboard: ¿suben registros/pagos? · Pagos: ¿status `authorized`?
- [ ] MercadoPago dashboard → ¿los preapprovals quedan "autorizados"?

### Señales de alarma
- `db:"disconnected"` en health → revisar Atlas (IP allowlist, límite de conexiones)
- Webhook con "firma inválida" repetido → revisar `MP_WEBHOOK_SECRET`
- Comercio pagó pero sigue `pending_payment` → el webhook no llegó: revisar la URL configurada en MP

---

## 4. Recomendación

El flujo crítico está **bien construido y es idempotente**. Lo único imprescindible antes de difundir:
1. **Correr el smoke manual (sección 2) en sandbox MP** — es el camino que tiene que funcionar sí o sí.
2. **Setear `SENTRY_DSN`** + un uptime monitor — para enterarte si algo falla.

No vale la pena escribir un E2E transaccional automatizado la noche antes (frágil, necesita MP sandbox + backend + DB). El smoke manual cubre el riesgo con mucho menos esfuerzo.
