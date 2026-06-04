import { Heart } from 'lucide-react'
import { SUPPORT_EMAIL } from '@/lib/cn'

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white px-5 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:gap-4 sm:text-left">
        <div className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 text-white">
            <span className="text-sm font-black">M</span>
          </span>
          <span className="text-sm text-neutral-900">Mi San Pedro</span>
          <span className="ml-2 hidden text-xs text-neutral-500 sm:inline">El club de ahorro de San Pedro</span>
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
