# 03 · Decisiones tomadas (y por qué)

No deshagas esto sin entender el motivo. Son decisiones del usuario o aprendizajes con costo.

1. **Un solo codebase multi-tenant** (no un repo por ciudad). Cada ciudad = `App`/tenant. Razón:
   escalar a muchos pueblos sin duplicar. → todo lo que se muestre debe salir del tenant, nunca hardcodeado.

2. **Todo en Railway** ("todo donde está misanpedro"). El servicio `api` sirve API + fronts.
   Se migró desde Hostinger a pedido del usuario. `micuidad.com` ya no usa Hostinger.

3. **Cloudflare con wildcard DNS-only → Railway** (no Worker). El Worker viejo (Cloudflare→Hostinger)
   se eliminó tras el cutover. Wildcard `*` CNAME → Railway, SSL wildcard de Railway vía `_acme-challenge`.

4. **San Pedro centralizado en la plataforma.** `misanpedro.com` redirige 301 a
   `sanpedro.micuidad.com`. Se decidió NO mantener San Pedro en su sitio legacy aparte.

5. **Email por SMTP, no Resend.** El usuario no tiene Resend. `email.service.ts` usa nodemailer
   (SMTP preferido → Resend fallback → stub/503). Buzón `soporte@micuidad.com` en Hostinger.

6. **Owner sin 2FA + email/password** (`OWNER_2FA_REQUIRED=false`), por decisión del usuario.
   (La password es débil → pendiente rotar; está en el backlog, no es un olvido.)

7. **Marca = naranja `#ea580c`** por defecto; cada ciudad puede overridear su `brand.primaryColor`.
   El verde está RESERVADO para semántica de "ahorro" (no como color de marca).

8. **`nombre` vs `localidad`:** son dos campos. `nombre`="Mi Nariño" (marca/logo), `ciudad`/localidad
   ="Nariño" (lo que ven los vecinos). La localidad se autocompleta de lo que va después de "Mi" en
   el alta, pero es editable. El usuario quería un campo claro para controlarlo.

9. **Login del comercio: claro/premium SIN mockup.** El usuario rechazó el mockup en el login (se
   eligió "Opción A"). El mockup del vecino (`VecinoAppMockup`) queda SOLO en el banner del registro.

10. **Pagos: una cuenta por ciudad, posiblemente otro proveedor por país.** Fase 1 = MP global (= la de
    SP). Fase 2 (cuando cobre la 2da ciudad) = "Conectar MercadoPago/Stripe" tipo OAuth, tokens en
    `App.payment` encriptados. No se construye antes. Ver `ESTRATEGIA-PAGOS.md`.

11. **Legales por país** (`App.legal` + `lib/legal.ts` `legalFor(pais)`): AR cita Ley 25.326/24.240,
    CO cita Ley 1581/1480/SIC, etc. Sin placeholders ni CUIT hardcodeado en el JS shipeado.

12. **Guardrail anti-hardcodeo** (`scripts/check-no-hardcoded-tenant.mjs`): corre en build/tests; el
    nombre de ciudad SIEMPRE sale del tenant. Es la red de seguridad para que el bug de "Mi San Pedro
    en otra ciudad" no vuelva.

13. **Prod Mongo interno → seeds por env/owner.** No se expone la DB; los cambios de datos de prod van
    por el panel owner o `SEED_CITY_JSON`.

14. **2FA del owner: queda OFF + se agregó rate-limit** (tanda 2026-06-23, decisión del usuario).
    El panel super-admin sigue con email+password (`OWNER_2FA_REQUIRED=false`), pero ahora
    `/owner/auth/login` tiene rate-limit (10/min por IP) para frenar fuerza bruta. El flujo 2FA
    sigue cableado (front+back) para activarlo cuando se quiera (flip de env).

15. **URL por-tenant centralizada en `lib/urls.ts` (`tenantFrontUrl`).** Toda URL externa
    (back_url MP, CTAs de email) sale del subdomain del tenant, no de `APP_URL_FRONT` global.
    Regla: no volver a usar `APP_URL_FRONT` para links por-ciudad.

16. **`stockMaximo` con claim atómico.** El canje reclama stock con `$inc` condicional
    (`stockUsado < stockMaximo`) ANTES de confirmar, marca `agotado` al tope y compensa en
    doble-tap. No reintroducir el `coupon.stockUsado++` no-atómico.

17. **Refactors diferidos pre-prod (no bloquean):** promoción de schemas owner/billing a
    `packages/shared`, `tsconfig.base` extendido por las apps, y manifest PWA por-tenant
    (debe hacerse server-side por host, NO con blob runtime — rompería instalabilidad).
    Documentados en `01-PENDIENTES.md`.
