import { useState } from 'react'
import { Sparkles, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useUser, useStore, demoStoreActions } from '@/lib/stores'
import { merchantAuth } from '@/lib/merchantStore'
import { loadDemoData, isDemoLoaded } from '@/lib/demoSeeder'
import { useToast } from './Toast'
import { ConfirmDialog } from './ConfirmDialog'
import { cn } from '@/lib/cn'

const STORAGE_KEY = 'misanpedro.demoBar.collapsed'

export function DemoBar() {
  const user = useUser()
  const { demoUsers, activations } = useStore()
  const toast = useToast()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  })
  const [confirmReset, setConfirmReset] = useState(false)
  const demoLoaded = isDemoLoaded()
  const totalRedemptions = activations.filter((a) => a.status === 'canjeado').length

  function setCol(v: boolean) {
    setCollapsed(v)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
    }
  }

  function handleLoad() {
    const result = loadDemoData(user)
    toast.success(
      'Datos demo cargados',
      `${result.users} vecinos · ${result.redemptions} canjes · ${result.campaigns} campañas`,
    )
  }

  function handleReset() {
    demoStoreActions.resetAll()
    merchantAuth.logout()
    setConfirmReset(false)
    toast.info('Datos limpios', 'Volvió todo al estado inicial.')
  }

  return (
    <>
      <div
        className={cn(
          'fixed left-1/2 top-3 z-50 -translate-x-1/2 transition-all duration-300',
          collapsed ? 'w-auto' : 'w-[calc(100vw-1.5rem)] max-w-md',
        )}
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCol(false)}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-floating backdrop-blur transition-all hover:-translate-y-0.5"
          >
            <Sparkles size={11} className="text-accent-300" /> Demo
            <ChevronDown size={11} />
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-full bg-neutral-900/95 px-3 py-2 text-white shadow-floating backdrop-blur ring-1 ring-white/10">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-accent-300">
              <Sparkles size={11} /> Modo demo
            </span>
            <span className="text-[11px] text-white/60 tabular-nums">
              {demoUsers.length + (user ? 1 : 0)}u · {totalRedemptions}c
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={handleLoad}
                title={demoLoaded ? 'Recargar datos' : 'Cargar datos demo ricos'}
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-2.5 py-1 text-[10px] font-bold transition-all hover:-translate-y-0.5"
              >
                <RefreshCw size={10} /> {demoLoaded ? 'Recargar' : 'Cargar demo'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                title="Reiniciar todo"
                aria-label="Reiniciar"
                className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
              >
                <Trash2 size={12} />
              </button>
              <button
                type="button"
                onClick={() => setCol(true)}
                aria-label="Minimizar"
                className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
              >
                <ChevronUp size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="¿Reiniciar todo?"
        description="Se borran usuarios, canjes, cupones custom y sesión de comercio. La app vuelve al estado inicial sin datos."
        confirmLabel="Sí, reiniciar"
        cancelLabel="Cancelar"
        variant="danger"
        onCancel={() => setConfirmReset(false)}
        onConfirm={handleReset}
      />
    </>
  )
}
