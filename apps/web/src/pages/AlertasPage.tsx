import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { AlertsContent } from '@/components/AlertsBell'
import { markAllSeen } from '@/lib/alerts'

export function AlertasPage() {
  const navigate = useNavigate()

  // Ver la página = ver las alertas → marcamos como vistas.
  useEffect(() => {
    const t = setTimeout(markAllSeen, 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="animate-fade-up mx-auto w-full max-w-2xl px-4 py-6 pb-32 sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-fin-lime/15 text-fin-lime">
          <Bell size={20} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fin-ink">Alertas</h1>
          <p className="text-sm text-fin-soft">Cupones nuevos y tus notificaciones.</p>
        </div>
      </header>

      <AlertsContent onOpenCoupon={(id) => navigate(`/cupon/${id}`)} />
    </div>
  )
}
