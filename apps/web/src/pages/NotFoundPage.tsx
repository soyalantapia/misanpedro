import { Link, useLocation } from 'react-router-dom'
import { Home, Compass, Store } from 'lucide-react'

export function NotFoundPage() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <div className="grid min-h-[100svh] place-items-center bg-fin-bg px-4 py-10">
      <div className="animate-fade-up flex w-full max-w-md flex-col items-center gap-5 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-fin-lime text-fin-bg shadow-fin-glow">
          <Compass size={28} />
        </div>
        <div>
          <p className="font-mono text-sm font-bold tracking-widest text-fin-lime">404</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-fin-ink sm:text-4xl">
            Esta ruta no existe
          </h1>
          <p className="mt-2 text-sm text-fin-soft">
            Tal vez el cupón expiró o la URL está mal escrita. Volvé al{' '}
            {isAdmin ? 'panel del comercio' : 'inicio de la app'}.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <Link
            to={isAdmin ? '/admin' : '/'}
            className="inline-flex items-center gap-1.5 rounded-full bg-fin-lime px-5 py-2.5 text-sm font-bold text-fin-bg shadow-fin-glow transition-all hover:-translate-y-0.5"
          >
            {isAdmin ? <Store size={14} /> : <Home size={14} />}
            {isAdmin ? 'Volver al panel' : 'Volver al inicio'}
          </Link>
          {!isAdmin && (
            <Link
              to="/admin/login"
              className="text-xs font-semibold text-fin-soft hover:text-fin-ink"
            >
              ¿Sos comerciante? Ingresar al panel
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
