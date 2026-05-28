import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Palette, MapPin, Globe } from 'lucide-react'
import { owner } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { cn } from '@/lib/cn'

type Step = 1 | 2 | 3

export function NewAppPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState({
    nombre: '',
    ciudad: '',
    provincia: 'Buenos Aires',
    slug: '',
    subdomain: '',
    primaryColor: '#695ede',
    accentColor: '#4239a3',
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value }
      // Auto-rellenar slug y subdomain desde nombre/ciudad si todavía están vacíos
      if (key === 'nombre' && !f.slug) {
        next.slug = slugify(String(value))
        if (!f.subdomain) next.subdomain = next.slug
      }
      if (key === 'ciudad' && !f.nombre) {
        // Si todavía no hay nombre, sugerimos "Mi <ciudad>"
        const v = String(value).trim()
        if (v) {
          next.nombre = `Mi ${v}`
          next.slug = next.slug || slugify(v)
          next.subdomain = next.subdomain || next.slug
        }
      }
      if (key === 'slug' && !f.subdomain) {
        next.subdomain = String(value)
      }
      return next
    })
  }

  function validateStep(n: Step): string | null {
    if (n === 1) {
      if (!form.nombre.trim()) return 'El nombre es requerido'
      if (!form.ciudad.trim()) return 'La ciudad es requerida'
    }
    if (n === 2) {
      if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(form.slug)) {
        return 'Slug inválido (a-z, 0-9, -)'
      }
      if (!form.subdomain.trim()) return 'Subdomain requerido'
    }
    return null
  }

  function next() {
    const err = validateStep(step)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setStep((s) => (s + 1) as Step)
  }

  async function submit() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await owner.createApp({
        slug: form.slug,
        nombre: form.nombre,
        ciudad: form.ciudad,
        provincia: form.provincia,
        subdomain: form.subdomain,
        primaryColor: form.primaryColor,
        accentColor: form.accentColor,
      })
      if (res.ok && res.app) {
        navigate(`/apps/${res.app._id ?? res.app.id}`)
      } else {
        setError('No pudimos crear la app')
        setSubmitting(false)
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error creando la app')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Onboarding"
        title="Nueva app"
        subtitle="Creá una nueva ciudad en 3 pasos"
        actions={
          <Link
            to="/apps"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
          >
            <ArrowLeft size={12} /> Volver
          </Link>
        }
      />

      <Stepper step={step} />

      <div className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200 sm:p-8">
        {step === 1 && (
          <StepLocation form={form} update={update} />
        )}
        {step === 2 && <StepDomain form={form} update={update} />}
        {step === 3 && <StepBrand form={form} update={update} />}

        {error && (
          <div className="mt-4 rounded-xl bg-danger-bg px-3 py-2 text-xs font-semibold text-danger">
            {error}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-neutral-100 pt-6">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
            disabled={step === 1 || submitting}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
          >
            <ArrowLeft size={12} />
            Anterior
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-5 py-2.5 text-xs font-bold text-white shadow shadow-accent-500/30 transition-all hover:-translate-y-0.5"
            >
              Continuar
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-success to-success px-5 py-2.5 text-xs font-bold text-white shadow shadow-success/30 transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Check size={12} />
              {submitting ? 'Creando…' : 'Crear app'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: 'Ubicación', icon: MapPin },
    { n: 2, label: 'Dominio', icon: Globe },
    { n: 3, label: 'Branding', icon: Palette },
  ] as const
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => {
        const active = step === s.n
        const done = step > s.n
        return (
          <li key={s.n} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors',
                done
                  ? 'bg-success text-white'
                  : active
                    ? 'bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow shadow-accent-500/30'
                    : 'bg-neutral-100 text-neutral-400',
              )}
            >
              {done ? <Check size={12} /> : <s.icon size={12} />}
            </span>
            <span
              className={cn(
                'hidden text-xs font-semibold sm:inline',
                active || done ? 'text-neutral-900' : 'text-neutral-400',
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  'mx-2 h-px flex-1 transition-colors',
                  done ? 'bg-success' : 'bg-neutral-200',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function StepLocation({
  form,
  update,
}: {
  form: any
  update: (k: any, v: any) => void
}) {
  return (
    <div className="grid gap-5">
      <h2 className="text-lg font-bold text-neutral-900">¿Cómo se llama y dónde vive?</h2>
      <TextField
        label="Nombre comercial"
        hint="Lo que ven los vecinos: 'Mi San Pedro', 'Mi Ramallo', etc."
        value={form.nombre}
        onChange={(v) => update('nombre', v)}
        placeholder="Mi Ramallo"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Ciudad"
          value={form.ciudad}
          onChange={(v) => update('ciudad', v)}
          placeholder="Ramallo"
        />
        <TextField
          label="Provincia"
          value={form.provincia}
          onChange={(v) => update('provincia', v)}
          placeholder="Buenos Aires"
        />
      </div>
    </div>
  )
}

function StepDomain({
  form,
  update,
}: {
  form: any
  update: (k: any, v: any) => void
}) {
  return (
    <div className="grid gap-5">
      <h2 className="text-lg font-bold text-neutral-900">¿Qué subdomain va a usar?</h2>
      <TextField
        label="Slug (clave única)"
        hint="Usado en URLs e identificación. Solo a-z, 0-9 y guiones."
        value={form.slug}
        onChange={(v) => update('slug', slugify(v))}
        placeholder="ramallo"
      />
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Subdomain</p>
        <div className="mt-1.5 flex items-stretch rounded-xl bg-neutral-50 ring-1 ring-neutral-200 focus-within:ring-2 focus-within:ring-accent-500">
          <input
            type="text"
            value={form.subdomain}
            onChange={(e) => update('subdomain', slugify(e.target.value))}
            placeholder="ramallo"
            className="flex-1 bg-transparent py-3 pl-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
          <span className="flex items-center pr-4 text-sm text-neutral-500">
            .misanpedro.app
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-500">
          La PWA del vecino va a vivir en <strong>{form.subdomain || 'subdomain'}.misanpedro.app</strong>
        </p>
      </div>
    </div>
  )
}

function StepBrand({
  form,
  update,
}: {
  form: any
  update: (k: any, v: any) => void
}) {
  return (
    <div className="grid gap-5">
      <h2 className="text-lg font-bold text-neutral-900">¿Qué look tiene?</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <ColorField label="Color primario" value={form.primaryColor} onChange={(v) => update('primaryColor', v)} />
        <ColorField label="Color accent" value={form.accentColor} onChange={(v) => update('accentColor', v)} />
      </div>

      <div className="rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Preview</p>
        <div className="mt-3 flex items-center gap-3">
          <span
            className="grid h-12 w-12 place-items-center rounded-xl text-white shadow"
            style={{
              background: `linear-gradient(135deg, ${form.primaryColor}, ${form.accentColor})`,
            }}
          >
            <span className="text-sm font-black">{(form.ciudad?.[0] ?? 'C').toUpperCase()}</span>
          </span>
          <div>
            <p className="font-bold text-neutral-900">{form.nombre || 'Tu app'}</p>
            <p className="text-xs text-neutral-500">{form.ciudad || 'Tu ciudad'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-accent-50 p-4 text-xs leading-relaxed text-accent-900 ring-1 ring-accent-100">
        Después podés ajustar logo, hero copy y horarios desde el detalle de la app.
      </div>
    </div>
  )
}

function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
      />
      {hint && <span className="text-[11px] text-neutral-500">{hint}</span>}
    </label>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{label}</span>
      <div className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2 ring-1 ring-neutral-200 focus-within:ring-2 focus-within:ring-accent-500">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm uppercase tracking-wider text-neutral-900 focus:outline-none"
        />
      </div>
    </label>
  )
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}
