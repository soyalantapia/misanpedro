import { Heart } from 'lucide-react'
import { SUPPORT_EMAIL } from '@/lib/cn'
import { Logo } from '@/components/Logo'

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white px-5 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:gap-4 sm:text-left">
        <div className="flex items-center gap-2.5">
          <Logo markSize={30} textClass="text-sm" />
          <span className="hidden text-xs text-neutral-500 sm:inline">El club de ahorro de San Pedro</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-neutral-500">
          <span>Gratis para vecinos</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="transition-colors hover:text-neutral-900">
            {SUPPORT_EMAIL}
          </a>
          <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-600">
            <Heart size={12} className="text-accent-600" /> Hecho en San Pedro
          </span>
        </div>
      </div>
    </footer>
  )
}
