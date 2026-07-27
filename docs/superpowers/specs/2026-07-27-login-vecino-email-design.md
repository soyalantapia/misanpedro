# Login del vecino por email, con sesión persistente

**Fecha:** 2026-07-27
**Estado:** aprobado, listo para plan de implementación
**Origen:** hallazgo S1-01 (P0) de la auditoría cazabug — ver `CAZABUG-FINDINGS.md`

---

## 1. El problema

Hoy el vecino entra a la app poniendo **sólo su número de teléfono**. `POST /auth/claim`
(`apps/api/src/routes/user-auth.ts:45`) busca la cuenta por `(appId, telefono)` y, si existe,
**la devuelve logueada** con un token de 10 años. No hay ninguna prueba de que el teléfono sea suyo.

Un teléfono no es un secreto: está en el grupo de WhatsApp del barrio, en un aviso de Marketplace,
y es corto y adivinable. Cualquiera que sepa el número de otro vecino puede, desde su casa y sin
pasar por ningún comercio:

- ver su **DNI, email y fecha de nacimiento** (`GET /auth/me/data-export`)
- ver **dónde compra, cuánto gastó y cuándo** (todo su historial de canjes)
- **cambiarle el nombre** (`/claim` pisa `user.nombre`)
- **borrarle la cuenta** y anonimizar sus canjes (`DELETE /auth/me`)

El diseño original apostaba a que *"la verificación la hace el cajero en persona"*. Eso es cierto
**en el mostrador**, pero `/claim` es un endpoint público de internet: el atacante no pasa por el
mostrador. El cajero nunca se entera.

**Contraste dentro del propio producto:** al comercio y al owner ya se les pide un código de 6
dígitos al email. Al vecino no se le pide nada.

## 2. Lo que NO queremos romper

El alta sin fricción es el corazón del producto: el vecino se registra **en el mostrador, con la
cola atrás**. Cualquier solución que lo obligue a abrir su casilla de mail ahí parado mata la
experiencia. Toda esta propuesta se ordena alrededor de esa restricción.

## 3. Decisiones tomadas

| # | Decisión | Por qué |
|---|---|---|
| 1 | **El alta no pide código.** Nombre + email + WhatsApp y entra al instante. | El agujero está en *recuperar cuentas ajenas*, no en *crear la propia*. Crear una cuenta nueva no ataca a nadie. |
| 2 | **Email y teléfono, los dos obligatorios.** Email = identidad. Teléfono = contacto. | El teléfono es lo que usa el comercio para las campañas de WhatsApp; sacarlo mataría esa propuesta de valor. |
| 3 | **La sesión dura para siempre, pero es cancelable.** | El vecino no vuelve a ver un código nunca más en ese celular. Pero si le roban el celular, la sesión se puede cerrar — hoy es imposible. |
| 4 | **Las 4 cuentas viejas sin email se borran.** | Son datos de prueba ("Vecino Uno", "Ana", "Beto", "Cami"), creadas el mismo minuto, con **cero canjes**. No hay nada real que migrar. |
| 5 | **El mail lleva botón mágico Y código de 6 dígitos.** | Mismo patrón ya probado en el login del owner. En el celular toca el botón; desde otro aparato tipea el código. |
| 6 | **No hay pantalla de "iniciar sesión".** El código aparece solo cuando el email ya existe. | El vecino nunca elige entre "registrarme" y "entrar" — esa bifurcación siempre confunde. |
| 7 | **NO se construye "vincular cuenta por teléfono".** | Sería reabrir exactamente el agujero: poner mi email + el teléfono de otro y quedarme con su cuenta. |

## 4. Los flujos

### 4.1 Vecino nuevo (el 95% de los casos)

```
Mostrador → nombre + email + WhatsApp + T&C → [Activar mi cupón]
                                                    ↓
                                        entra al instante, sin código
```

Idéntico de rápido que hoy. Un campo más en el formulario.

### 4.2 El email ya tiene cuenta (se cambió de celular)

Todo ocurre **en la misma pantalla**, sin mandarlo a ningún lado:

```
[Activar mi cupón]
        ↓
"Ya tenés cuenta con ese mail. Te mandamos un código a maria@gmail.com"
Código: [ _ _ _ _ _ _ ]  →  [Entrar y recuperar mis canjes]
        ↓
entra con TODO su historial
```

El mail también trae un botón "Entrar" que, tocado desde el celular, lo mete sin tipear nada.

### 4.3 Desde Perfil: "Entrar desde mi cuenta"

Para el que ya sabe que tiene cuenta y no quiere pasar por el alta. Pide el email, manda el código,
mismo desenlace que 4.2.

### 4.4 Cerrar sesión

En Perfil: lista de sesiones abiertas (dispositivo + última actividad) y un botón
**"Cerrar sesión en todos lados"** que las revoca todas — incluida la del celular perdido.

## 5. Cambios técnicos

### 5.1 Modelo de datos (`apps/api/src/models/User.ts`)

| Campo | Antes | Después |
|---|---|---|
| `email` | opcional, sin índice | **required**, único por ciudad |
| `telefono` | required, **único por ciudad (identidad)** | required, **índice NO único** (contacto) |

Índices:
- **Crear:** `{ appId: 1, email: 1 }` único.
- **Dropear:** `{ appId: 1, telefono: 1 }` único → reemplazar por no-único (se sigue usando para
  buscar destinatarios de campañas).
- Lo hace `User.syncIndexes()`, que ya corre al boot y está gateado por `bootMutationsAllowed()`
  (`apps/api/src/db/connection.ts`), o sea: sólo en producción o con `DB_BOOTSTRAP=true`.

**Verificado contra la base real (solo lectura, 2026-07-27):** 24 vecinos, 20 con email,
**0 emails duplicados dentro de una misma ciudad** → el índice único construye limpio.

### 5.2 Infraestructura que YA existe y se reusa

No hay que inventar casi nada:

- `Otp` ya soporta `purpose: 'user'` con `appId` (`apps/api/src/models/Otp.ts`).
- `sendOtpCode()` ya existe en `apps/api/src/services/email.service.ts:191`.
- `RefreshToken` ya soporta `subjectType: 'user'`.
- El front ya tiene reservado el slot `msp.tok.user.refresh` (`apps/web/src/lib/api.ts:15`).
- El patrón OTP completo (TTL 5 min, 5 intentos, consumo atómico anti-replay, rate limits) está
  resuelto en `merchant-auth.ts` — se copia.

### 5.3 Endpoints (`apps/api/src/routes/user-auth.ts`)

| Endpoint | Comportamiento |
|---|---|
| `POST /auth/claim` *(cambia)* | Recibe nombre + email + telefono + acceptedTc. **Email nuevo** → crea el vecino y devuelve `{created:true, accessToken, refreshToken}` (201). **Email existente** → **NO loguea**: genera el OTP, lo manda por mail y devuelve `{created:false, needsCode:true}` (200). |
| `POST /auth/request-otp` *(nuevo)* | Email → manda el código. Es el "Entrar desde mi cuenta" de Perfil. |
| `POST /auth/verify-otp` *(nuevo)* | Email + código → valida y emite `accessToken` + `refreshToken`. |
| `POST /auth/refresh` *(nuevo)* | Refresh → nuevo access. No rota (mismo criterio que el comercio: la rotación puede desloguear por una respuesta perdida). |
| `POST /auth/logout` *(nuevo)* | Revoca ese refresh. |
| `POST /auth/logout-all` *(nuevo)* | Revoca todos los del vecino. |
| `GET /auth/sessions` *(nuevo)* | Lista de sesiones para la pantalla de Perfil. |

### 5.4 Tokens

| | Antes | Después |
|---|---|---|
| access | **10 años**, irrevocable | 1h, se renueva solo |
| refresh | no existía | no vence (`neverExpires: true`), **revocable** |

El vecino no nota el cambio: el access se renueva solo con el refresh. Lo que se gana es poder
cortar el acceso.

### 5.5 Rate limits

- `claim`: 30/h (ya existe).
- `request-otp`: 5/h por email+IP.
- `verify-otp`: 10/min.

### 5.6 Front (`apps/web`)

- **`RegistroPage.tsx`**: campo email; maneja `needsCode` mostrando el input del código en la
  misma pantalla; actualizar el copy (hoy dice *"Sin contraseñas ni códigos: tu teléfono es tu cuenta"*).
- **`PerfilPage.tsx`**: "Entrar desde mi cuenta", lista de sesiones y "Cerrar sesión en todos lados".
- **`lib/api.ts`**: guardar el refresh del vecino y auto-renovar el access ante un 401 (el mecanismo
  ya existe para `merchant`, se extiende a `user`).
- Manejo del botón mágico: leer `?email=&code=` y limpiar la URL al entrar, para que el código no
  quede en el historial del navegador (igual que hace hoy el login del owner).

## 6. Migración

1. **Borrar** las 4 cuentas de prueba sin email (cero canjes, sin impacto real).
2. **Deploy**: `syncIndexes()` dropea el único de teléfono y crea el único de email.
3. Las 20 cuentas con email entran con su mail, **historial intacto**, sin hacer nada.

## 7. Errores y casos borde

| Caso | Qué pasa |
|---|---|
| Código vencido / ya usado / 5 intentos fallidos | Error claro + opción de pedir uno nuevo. |
| Dos altas simultáneas con el mismo email | El índice único rechaza la segunda; se reintenta leyendo la ganadora (mismo patrón que hoy con teléfono). |
| Email de otra ciudad | Todo va scopeado por `appId`: el mismo email puede ser vecino en dos ciudades sin colisionar. |
| El navegador borra el almacenamiento | La sesión se pierde y hay que pedir el código de nuevo. Es inevitable (pasa hoy también). |
| El vecino se equivocó al tipear el mail | Ver riesgo #1. |
| **Celular con el bundle viejo cacheado** (service worker de la PWA) manda el alta sin email | El backend responde 400 con un mensaje claro (*"Actualizá la app"*) en vez de un error críptico. No se acepta el alta sin email: aceptarla dejaría cuentas sin identidad válida. Con 24 vecinos el impacto es despreciable, pero el mensaje tiene que ser entendible. |

## 8. Testing

Cada test tiene que **fallar antes** del cambio y pasar después.

1. **El del agujero:** sabiendo el email de otro vecino **no se puede** entrar a su cuenta (hoy, con
   el teléfono, sí se puede). Es el test que justifica todo el trabajo.
2. Vecino nuevo entra **sin código** (no rompimos el mostrador).
3. Email existente → **no loguea**, pide código; con el código correcto entra y **conserva su historial**.
4. Código vencido / reusado / de otra ciudad → rechazado.
5. `logout-all` deja afuera **de verdad** al otro dispositivo (el refresh viejo ya no sirve).
6. El teléfono deja de ser único: dos vecinos pueden compartirlo sin romper el alta.

## 9. Riesgos aceptados

1. **El vecino que se equivoca al tipear el mail o no se acuerda cuál puso** va a tener problemas
   para recuperar su cuenta. Con 20 cuentas reales el costo es mínimo hoy, y por eso este es el
   momento de hacer el cambio — pero es el precio de cerrar el agujero. Mitigación futura posible:
   que el cajero pueda ayudar desde el panel del comercio.
2. **Enumeración de emails:** responder "ya tenés cuenta" revela que ese email está registrado. El
   producto ya acepta este trade-off en el login del comercio (devuelve `registered: true/false`).
   Saber que un mail está en Mi San Pedro es información de bajo valor.
3. **El botón mágico pone el código en la URL.** Se mitiga con un solo uso, TTL de 5 minutos y
   limpieza de la barra de direcciones al entrar.

## 10. Fuera de alcance (YAGNI)

- Verificar el email en el alta (decisión 1: se entra sin verificar).
- Cambiar de email desde la app.
- Recuperación asistida por el comercio (posible mitigación futura del riesgo #1).
- Login por WhatsApp/SMS.
