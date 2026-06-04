import { Lock } from 'lucide-react'

export function Reaseguro() {
  return (
    <section className="px-5 pb-2 pt-6 sm:px-6">
      <p className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs font-medium text-neutral-500">
        <Lock size={13} className="text-accent-600" />
        Sin compromiso · No te llenamos de spam · Tus datos quedan seguros
      </p>
    </section>
  )
}
