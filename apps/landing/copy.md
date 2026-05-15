# Landing copy — misanpedro (comercios.misanpedro.app)

**Framework:** PAS · **Tono:** Rioplatense (vos), concreto, sin jerga SaaS · **CTA primario:** "Empezar gratis 14 días" (repetido 4×)

Convenciones de notación:
- `[PIONERO_N]` = placeholder de comercio real (reemplazar antes del deploy)
- `[FOTO_N]` = placeholder de foto/avatar
- `[WA_SOPORTE]` = número de WhatsApp de soporte (reemplazar)

---

## 0. Nav sticky

```
[logo: misanpedro]                                       Funciones · Precios · FAQ    [Empezar gratis]
```

- Logo a la izquierda (texto + ícono)
- 3 anchor links al centro (escritorio) / hamburger (mobile)
- CTA "Empezar gratis" a la derecha — siempre visible al hacer scroll

---

## 1. Hero

**Eyebrow tag:**
> 🛒 Para comercios de San Pedro

**H1 (la promesa):**
> # Tus clientes vuelven solos.
> # Sin imprimir un volante más.

**Subhead:**
> Subí tus descuentos en 5 minutos, validalos con un código de 6 dígitos desde el celular, y enterate de cada cliente que vuelve. Sin contratos. Sin letra chica. Hecho en San Pedro.

**CTAs:**
- Primario: **`Empezar gratis 14 días →`**
- Secundario: `Hablar por WhatsApp` (link a `wa.me/[WA_SOPORTE]`)

**Trust strip (debajo de los CTAs, gris, chico):**
> Sin tarjeta · Cancelás cuando quieras · Soporte por WhatsApp

**Hero visual:**
- Mockup compuesto: celular mostrando el panel del comercio (cupón canjeado de "Mario Pizza") + fragmento del CRM detrás (cliente "Carolina Pérez · 3 visitas · cumple 12 abril")
- Imagen estática (no carousel), AVIF + WebP fallback, preload
- Alt: "Panel de comercio misanpedro mostrando un cupón canjeado y los datos del cliente"

---

## 2. Social proof / "Hecho en San Pedro"

**Eyebrow (centrado, chico, uppercase):**
> Hecho en San Pedro · Para comercios de San Pedro

**H3 + sub:**
> Beta abierta — primeros 20 comercios pioneros
> Precio fundador $25.000/mes congelado por 12 meses

**Banda de logos (placeholder hasta tener pioneros):**
```
[PIONERO_1]   [PIONERO_2]   [PIONERO_3]   [PIONERO_4]   [PIONERO_5]
```
(Si todavía no hay 5 pioneros, mostrar 3 + texto "+ 12 comercios sumándose esta semana" o algo verdadero. **No inventar números**.)

---

## 3. Problem (P de PAS)

**H2:**
> ## Tus clientes vienen, compran y se olvidan que existís

**Bajada (1 párrafo):**
> Carlos vino el martes. Marta el viernes. Vos los atendiste, les sonreíste, les diste el ticket. Pero hoy no sabés sus nombres, no tenés su teléfono, y la próxima vez que ellos piensen en pizza, en tinte o en una planta, no van a pensar en vos.

**3 cards de dolores específicos (grid):**

### Card 1
**Ícono:** 📄 (volante doblado)
**Título:** Volantes que terminan en la basura
**Body:** Imprimís 500 flyers, repartís 300, te llegan 4 personas. El otro 99% va directo al tacho.

### Card 2
**Ícono:** 📱 (Instagram)
**Título:** Instagram que sólo ven el 5%
**Body:** Subís una promo. El algoritmo decide que tus seguidores no la vean. Pagás publicidad. Te llegan likes pero no clientes.

### Card 3
**Ícono:** 🚫 (WhatsApp bloqueado)
**Título:** WhatsApp masivo que Meta te bloquea
**Body:** Mandás un mensaje a 50 contactos. Meta detecta spam. Te suspenden la cuenta. Perdés el contacto con todos.

---

## 4. Agitate (A de PAS) — bloque oscuro

**Fondo:** neutral-900 (oscuro), texto blanco

**Una sola frase grande, centrada:**

> # Cada cliente que entra a tu local
> # es una relación que se evapora
> # apenas cruza la puerta de salida.

**Bajada (1 línea, gris claro):**
> Y vos seguís bajando la persiana sin saber si Carlos vuelve mañana o no.

---

## 5. Solution (S de PAS)

**Eyebrow:**
> La solución

**H2:**
> ## misanpedro es el contacto directo con tu cliente

**Bajada (2 párrafos en lenguaje natural):**
> Publicás un descuento desde tu celular. Carolina, una vecina de San Pedro, lo activa desde la app del barrio y le aparece un código de 6 dígitos. Cuando llega a tu local, tu cajero ingresa el código y listo: descuento aplicado, canje registrado, datos de Carolina guardados.
>
> A partir de ese momento sabés que Carolina existe, dónde vive, cuándo cumple años, qué descuento prefiere, cuántas veces te visitó. Le podés mandar un WhatsApp el día de su cumpleaños o cuando tengas una promo que sabés que le va a interesar. **Sin spam. Sin algoritmo. Directo.**

**CTA inline:**
> **`Empezar gratis 14 días →`**

**Visual (a la derecha del texto en desktop, abajo en mobile):**
- Diagrama de 3 paneles mostrando el flujo:
  1. Comercio publica cupón (mockup celular del admin)
  2. Vecino activa (mockup celular de la PWA)
  3. Cajero valida (mockup del panel de validación)

---

## 6. Features

**Eyebrow:**
> Todo lo que necesitás

**H2:**
> ## Cero código. Cero hardware extra. Sólo tu celular.

**Grid de 6 features (íconos Lucide):**

| Ícono | Título | Body (1 línea) |
|---|---|---|
| `Ticket` | Cupones en 5 minutos | Subí descuento, vigencia y condiciones. Listo para canjear. |
| `Hash` | Código de 6 dígitos | Tu cajero valida desde el celular. Sin escáner, sin hardware. |
| `Users` | CRM automático | Cada canje guarda nombre, DNI, cumpleaños y frecuencia del cliente. |
| `MessageCircle` | WhatsApp Business integrado | Mandá campañas desde la plataforma. Sin Meta bloqueándote. |
| `Smartphone` | Panel desde el celular | No necesitás computadora. Todo desde tu teléfono. |
| `CreditCard` | MercadoPago integrado | Cobramos la mensualidad por MP. Sin tarjeta en formularios. |

---

## 7. How it works

**Fondo:** neutral-900 (oscuro), texto blanco
**H2:**
> ## En 10 minutos tenés tu primer canje

**3 pasos numerados (01 · 02 · 03):**

### 01 · Te registrás y publicás tu cupón
Completá los datos del comercio, subí tu logo y publicá el primer descuento. Aparece en la app del vecino al instante.

### 02 · El vecino activa el cupón
Carolina ve tu descuento en la app, lo activa con un toque. Le aparece un código de 6 dígitos válido por 30 minutos.

### 03 · Tu cajero valida y vos ves quién canjeó
Carolina llega al local, el cajero ingresa el código en su celular, descuento aplicado. Vos ves a Carolina en tu panel: nombre, edad, cumpleaños, qué canjeó.

**Visual:** screenshots reales de la PWA en cada paso (cupón → activación → validación)

---

## 8. Caso de uso (placeholder hasta tener testimonios reales)

**Eyebrow:**
> Caso de uso

**H2:**
> ## Un día en [PIONERO_1]

**Layout:** card grande con foto del comercio + foto del dueño/a + bloque de texto

**Foto:** [FOTO_PIONERO_1] (frente del local o dueño)

**Quote/narrativa (estilo storytelling, 1 párrafo + bullets de resultados):**

> _"Empezamos un martes a las 10 de la mañana. Subí el primer cupón —25% en pizzas hasta el viernes— y a las 11 ya tenía 3 canjes. Para el viernes 48. Pero lo que más me sorprendió no fue eso: fue que la semana siguiente volvieron 12 de esas 48 personas. Sin que les manden nada."_
>
> **[NOMBRE_PIONERO_1]** — Dueño/a de [PIONERO_1]
>
> - **48 canjes** en la primera semana
> - **12 clientes que volvieron** sin remarketing
> - **0 volantes impresos** desde que arrancamos

**Nota interna (no aparece en el sitio):** Si todavía no hay pioneros, reemplazar este bloque por un "Día en La Frutillería" estilo demo plausible, con foto de stock honestamente etiquetada o esconder la sección con un comentario claro hasta tener datos reales.

---

## 9. Pricing

**Eyebrow:**
> Precios

**H2:**
> ## Un solo plan. Sin sorpresas.

**Subhead:**
> Plan único mensual. Cobramos por MercadoPago. Cancelás cuando quieras desde tu panel.

**Card de pricing (1 sola, centrada):**

```
┌─────────────────────────────────────────────┐
│                                             │
│  PLAN COMERCIO                              │
│  Para PyMEs adheridas al programa           │
│                                             │
│  PRECIO FUNDADOR                            │
│  ~~$45.000~~                                │
│  $25.000 /mes                               │
│  Congelado por 12 meses                     │
│                                             │
│  ✓ Cupones ilimitados                       │
│  ✓ CRM completo (DNI, cumple, frecuencia)   │
│  ✓ WhatsApp Business integrado              │
│  ✓ Panel desde el celular                   │
│  ✓ Validación con código de 6 dígitos       │
│  ✓ MercadoPago integrado                    │
│  ✓ Reportes en tiempo real                  │
│  ✓ Soporte por WhatsApp                     │
│                                             │
│  [Empezar gratis 14 días →]                 │
│                                             │
│  14 días gratis · Sin tarjeta · Cancelás    │
│  cuando quieras                             │
│                                             │
└─────────────────────────────────────────────┘
```

**Bajada (chica, debajo de la card):**
> Después del trial, $25.000/mes. **Si te sumás durante la beta, ese precio queda congelado durante 12 meses** aunque después suba para nuevos comercios.

---

## 10. FAQ

**H2:**
> ## Preguntas frecuentes

**6 Q&A en accordion (cerrados por default, primero abierto):**

### ¿Qué necesito para empezar?
Sólo un celular con WhatsApp y MercadoPago. No necesitás computadora, scanner ni hardware extra. Te registrás, completás los datos del comercio, subís tu primer cupón y listo.

### ¿El vecino paga algo por usar la app?
No, para el vecino es 100% gratis. La app del vecino es gratuita y siempre lo va a ser. Nosotros cobramos sólo a los comercios adheridos.

### ¿Y si en mi local no anda bien internet?
Tu cajero valida con un código de 6 dígitos desde su propio celular. No necesitamos WiFi del local. Sólo hace falta señal del cajero (datos móviles funcionan).

### ¿Puedo cancelar cuando quiera?
Sí. No hay contrato anual, no hay permanencia, no hay penalidad. Cancelás desde tu panel y la cuenta queda pausada el mes siguiente. Si volvés, conservás tu historial.

### ¿Cómo cobro al cliente? ¿Ustedes se quedan con algo?
Vos cobrás directo al cliente en tu caja, en efectivo, débito, crédito o como quieras. Nosotros **no nos quedamos con ningún porcentaje del ticket**. Sólo cobramos la mensualidad fija.

### ¿Funciona con WhatsApp de verdad o es un link?
WhatsApp Business **integrado de verdad**: usás tu propio número, mandás mensajes desde la plataforma, ves quién leyó y quién respondió. No es un "compartir por WhatsApp" — es una herramienta de campaña real.

---

## 11. Final CTA — banda con gradient

**Fondo:** gradient accent (verde/amber a más oscuro)
**Texto:** blanco, centrado

**H2 grande:**
> # Tu primer canje en menos de 10 minutos.

**Subhead:**
> Precio fundador para los primeros 20 comercios. 14 días gratis. Sin tarjeta.

**CTA:**
> **`Empezar gratis 14 días →`**

**Mini-trust debajo:**
> O escribinos por WhatsApp si querés ver una demo de 15 min antes →

---

## 12. Footer

**3 columnas:**

### Col 1 — Logo + tagline
```
[logo]
misanpedro

Programa de descuentos
para comercios de San Pedro.

Hecho en San Pedro,
Buenos Aires.
```

### Col 2 — Producto
- Funciones
- Precios
- FAQ
- Para vecinos → `app.misanpedro.app`

### Col 3 — Soporte + Legal
- WhatsApp: [WA_SOPORTE]
- Email: hola@misanpedro.app
- Términos
- Privacidad

**Bottom bar:**
> © 2026 misanpedro · Todos los derechos reservados

---

## Metadata SEO

**Title (≤60 chars):**
> misanpedro · Cupones y CRM para comercios de San Pedro

**Description (≤155 chars):**
> Convertí clientes en habitués. Cupones, CRM y WhatsApp Business para tu PyME. Hecho en San Pedro. Desde $25.000/mes. 14 días gratis.

**OG image (1200×630):**
- Fondo claro
- Logo + tagline grande
- Mockup del panel comercio
- "Empezar gratis 14 días"

---

## Wording de CTAs (consistencia)

| Lugar | Texto exacto |
|---|---|
| Nav | `Empezar gratis` |
| Hero primario | `Empezar gratis 14 días →` |
| Hero secundario | `Hablar por WhatsApp` |
| Inline en Solution | `Empezar gratis 14 días →` |
| Card de Pricing | `Empezar gratis 14 días →` |
| Final CTA | `Empezar gratis 14 días →` |

**Regla:** mismo wording, mismo color (negro/accent), misma forma (pill). Sin variaciones.

---

## Lo que falta para shippear

- [ ] Datos reales de 3-5 comercios pioneros (nombre, logo, foto del dueño, 1 testimonio breve)
- [ ] Foto/mockup del hero (puedo armarla a partir de screenshots de la PWA actual)
- [ ] Número de WhatsApp de soporte
- [ ] Email de contacto
- [ ] Confirmación: ¿`comercios.misanpedro.app` o vamos directo a `misanpedro.app`?
