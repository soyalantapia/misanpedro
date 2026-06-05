# Marca — Mi San Pedro

Isotipo de **cupón** + wordmark **MiSanPedro** (siempre junto, "Mi" en naranja).

## Archivos
- `isotipo-sello.svg` — isotipo redondo (sello). Para avatar de redes, stickers, sello en la puerta, watermark.
- `isotipo-cupon.svg` — isotipo cuadrado (cupón). Para app icon.
- `../apps/landing-vecino/public/favicon.svg` — favicon (cupón cuadrado).
- Componente React: `apps/landing-vecino/src/components/Logo.tsx` (lockup temable, sigue `--color-brand`).

## Color
- Marca: **#ea580c** (degradé `#fb8a3c → #ea580c`).
- Ahorro / "Ahorrás": **#059669** (verde).
- En la app/landing el sello deriva del knob `--color-brand` (vía `accent-400/600`).

## Wordmark
- **MiSanPedro** — todo junto (camelCase). "Mi" en naranja, "SanPedro" en oscuro (`#17161f`) o blanco sobre fondo oscuro.
- Tipografía recomendada: Manrope 800 (o Sora 700). En la app usa la system font por performance.
- Para entregables de imprenta/redes, **vectorizar el texto** (outlines) antes de exportar.

## Exploraciones
`logo-explore.html`, `logo-explore-2.html`, `logo-misanpedro.html`, `logo-contexto.html`, `logo-contexto-2.html`
(servir con `python3 -m http.server` desde esta carpeta).
