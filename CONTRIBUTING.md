# Contribuir a Mi Ciudad

Guía para trabajar **entre varios** sin pisarnos. Lee primero [`PROJECT.MD`](PROJECT.MD)
(qué es y por qué) y [`README.md`](README.md) (cómo correrlo).

## Antes de empezar
- **Node 22 + pnpm.** `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`.
- **Trabajá en `~/dev/misanpedro`** (no en `~/Desktop`, que es iCloud y rompe el build).
- **Dev usa MongoDB Atlas** (dev), nunca la DB de prod (interna a Railway).
- Probá un tenant con `?tenant=narino` (en local no hay subdominio).

## Flujo de trabajo
1. **Rama:** este repo (`soyalantapia/misanpedro`) permite push a `main`, pero para trabajo
   compartido **trabajá en una rama** (`feat/...`, `fix/...`, `docs/...`) y abrí PR.
2. **Commits:** mensajes claros en español, con scope: `feat(soporte): …`, `fix(canje): …`,
   `test(multi-tenant): …`, `docs: …`, `harden(prelaunch): …`. Explicá el **porqué**, no solo el qué.
3. **Antes de pushear**, el set mínimo verde:
   ```bash
   pnpm typecheck && pnpm turbo run test && pnpm check:tenant
   ```
4. **PR:** describí qué cambia y cómo lo verificaste. CI corre solo (typecheck + check:tenant + tests).
5. **Deploy:** `railway up --detach --environment production --service api` deploya **todo**
   (api + web + owner + landings). Verificá el `uptime` en `/health` y un smoke del flujo tocado.
6. **Actualizá [`work-agent/`](work-agent/)** cuando shippees algo grande — es la fuente de verdad viva.

## Reglas de oro (no negociables)
- **Nada hardcodeado por ciudad.** Todo lo visible sale del tenant (`useTenant()`, `appName()`,
  `cityName()`). El guardrail `check:tenant` falla el build si reaparece un nombre de ciudad.
- **El `appId` sale del host/header, nunca del token.** Toda query de negocio filtra por `appId`.
- **El front NO importa `@misanpedro/shared`.** La lógica chica se **duplica** (con tests espejo).
  Si tocás `calcAhorroCanje` en uno, tocá el otro (`web/lib/cuponValor.ts` ↔ `shared/src/valor.ts`).
- **Verde = ahorro**, no es color de marca. La marca por defecto es naranja `#ea580c` (override por ciudad).
- **Narrativa LOCKED** (ver `PROJECT.MD` §2.2): "tu ciudad" no "pueblo"; nunca "fundador"; usar "comercios".
- **No metas secretos en el repo.** Van en Railway (los carga el dueño).

## Estilo de código
- TypeScript estricto. Validá todo input con **Zod** (en `packages/shared/src/schemas.ts` cuando aplique).
- Backend: handlers chicos, lógica en `services/`. Mutaciones por `:id` chequean ownership (anti-IDOR).
- Las operaciones críticas (canje, OTP, stock) son **atómicas** (`findOneAndUpdate`/`$inc` condicional),
  porque Mongo de prod es standalone (sin transacciones) → no introduzcas patrones read-modify-write.
- Escribí/actualizá **tests** para lo que toques. Las suites de integración usan Mongo en memoria + JWT.

## Tests
```bash
pnpm turbo run test                    # todo (269: api 130 + web 139) — OJO: "pnpm test" a secas NO corre nada
pnpm --filter @misanpedro/api test     # solo API (130)
pnpm --filter @misanpedro/web test     # solo web (139, incluye el guardrail)
```
Suites de referencia para copiar el patrón: `redemptions.integration.test.ts` (camino del dinero),
`tenant-isolation.integration.test.ts` (multi-tenant), `support.integration.test.ts` (modo soporte).

## Cuando algo se rompe
Ver [`docs/RUNBOOK.md`](docs/RUNBOOK.md) (operaciones e incidentes) y
[`work-agent/02-DEPLOY-Y-GOTCHAS.md`](work-agent/02-DEPLOY-Y-GOTCHAS.md) (las trampas conocidas).
