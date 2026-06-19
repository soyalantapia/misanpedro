import { Schema, model, type InferSchemaType } from 'mongoose'

/**
 * App = tenant raíz. Cada ciudad/pueblo es una App separada.
 *
 * Ej:
 *   { slug: 'sanpedro', nombre: 'Mi San Pedro', subdomain: 'sanpedro' }
 *   { slug: 'ramallo',  nombre: 'Mi Ramallo',  subdomain: 'ramallo' }
 *
 * El slug es la clave de tenancy: aparece en TODOS los modelos como `appId`
 * (ref a App) y se usa para filtrar queries por tenant.
 *
 * En el frontend, el subdomain identifica al tenant:
 *   sanpedro.misanpedro.app → slug 'sanpedro'
 *   ramallo.misanpedro.app  → slug 'ramallo'
 */
const appSchema = new Schema(
  {
    /** Identificador URL-safe único. Se usa en subdominio y en API headers. */
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      match: /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/,
    },

    /** Nombre comercial visible: "Mi San Pedro", "Mi Ramallo", etc. */
    nombre: { type: String, required: true },

    /** Ciudad + Provincia + País para mostrar / SEO. */
    ciudad: { type: String, required: true },
    provincia: { type: String, default: 'Buenos Aires' },
    pais: { type: String, default: 'Argentina' },

    /**
     * Localización del tenant (ciudades multi-país).
     * moneda = código ISO-4217 (ARS, COP, CLP, MXN, UYU, PEN, USD).
     * locale = BCP-47 para Intl (es-AR, es-CO, es-CL, es-MX, es-UY, es-PE).
     * Hoy "idioma" = locale: maneja formato de moneda/números/fechas.
     * (La traducción de UI a otros idiomas es un proyecto aparte.)
     */
    moneda: { type: String, default: 'ARS', match: /^[A-Z]{3}$/ },
    locale: { type: String, default: 'es-AR', match: /^[a-z]{2,3}(-[A-Z]{2,4})?$/ },

    /** Subdominio dentro de misanpedro.app. Default = slug. */
    subdomain: { type: String, required: true, unique: true, index: true },

    /** Custom domain opcional (ej: ramallodescuentos.com.ar si lo compra). */
    customDomain: { type: String, index: true, sparse: true, unique: true },

    /** Branding tenant-specific (logo, colores, hero copy override). */
    brand: {
      logoUrl: { type: String },
      // colores en HEX (#RRGGBB)
      // Marca de plataforma: naranja (no el violeta viejo). Cada ciudad puede overridear.
      primaryColor: { type: String, default: '#ea580c' },
      accentColor: { type: String, default: '#c2410c' },
      heroEyebrow: { type: String }, // override del eyebrow del Hero ("Para comercios de SP")
      heroHeadline: { type: String }, // override del H1 (opcional)
    },

    /** Estado operacional: pending = creada pero no activa; active = live; suspended = pausada. */
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'archived'],
      default: 'pending',
      index: true,
    },

    /** Plan/tarifa del tenant — para futuras tarifas SaaS escalonadas. */
    plan: {
      type: String,
      enum: ['founder', 'standard', 'enterprise'],
      default: 'founder',
    },

    /** Datos comerciales del operador local (vos, o un partner regional). */
    operator: {
      nombre: { type: String },
      email: { type: String },
      whatsapp: { type: String },
    },

    /** Métricas cacheadas (actualizadas por job background, evita aggregations en cada dashboard load). */
    cachedStats: {
      lastUpdatedAt: { type: Date },
      totalMerchants: { type: Number, default: 0 },
      activeMerchants: { type: Number, default: 0 },
      totalUsers: { type: Number, default: 0 },
      activeCoupons: { type: Number, default: 0 },
      redemptionsLast30Days: { type: Number, default: 0 },
    },

    /**
     * Centro geográfico del tenant — coordenadas usadas como placeholder
     * para nuevos comercios hasta que actualicen su dirección real.
     * { lat: -33.68, lng: -59.67 } es el centro de San Pedro, BA.
     */
    geoCenter: {
      lat: { type: Number, default: -33.6797 },
      lng: { type: Number, default: -59.6669 },
    },

    /** Configuración del tenant (features flags futuras). */
    settings: {
      // Si true, los vecinos pueden ver descuentos sin login.
      publicCatalog: { type: Boolean, default: true },
      // Si true, el comercio puede mandar campañas de WhatsApp.
      whatsappEnabled: { type: Boolean, default: true },
      // Si true, mostramos onboarding wizard al primer login del comercio.
      showOnboarding: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
)

export type AppDoc = InferSchemaType<typeof appSchema> & { _id: string }
export const App = model('App', appSchema)
