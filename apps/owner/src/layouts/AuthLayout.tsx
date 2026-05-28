import type { ReactNode } from 'react'

/** Layout para pantallas no autenticadas (login, setup 2FA). */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-accent-50 via-white to-accent-100">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[600px] w-[1200px] -translate-x-1/2 rounded-full bg-gradient-to-br from-accent-300/30 to-accent-500/10 blur-3xl" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-12">
        <a href="/" className="mb-8 flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-lg">
            <span className="text-sm font-black">M</span>
          </span>
          <span className="text-xl">Mi San Pedro</span>
          <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
            Owner
          </span>
        </a>
        {children}
      </div>
    </div>
  )
}
