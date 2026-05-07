import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser, useActivations } from '@/lib/stores'
import { useCoupons } from '@/lib/couponsStore'
import { useToast } from './Toast'
import { formatMoney } from '@/lib/format'

/**
 * Watcher invisible que detecta cuando el comercio confirma un canje del
 * vecino actual (vía storage event o markRedeemed) y dispara un toast con
 * acción "Ver canjeados". Live update entre tabs.
 */
export function RedemptionWatcher() {
  const user = useUser()
  const activations = useActivations()
  const coupons = useCoupons()
  const toast = useToast()
  const navigate = useNavigate()

  // Set de IDs ya notificados para no duplicar toasts
  const seenRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!user) return

    // Primera carga: registramos los canjes existentes sin notificar
    if (!initializedRef.current) {
      activations.forEach((a) => {
        if (a.userId === user.id && a.status === 'canjeado') {
          seenRef.current.add(a.id)
        }
      })
      initializedRef.current = true
      return
    }

    // Buscar canjes nuevos del current user
    const newRedemptions = activations.filter(
      (a) =>
        a.userId === user.id && a.status === 'canjeado' && !seenRef.current.has(a.id),
    )
    newRedemptions.forEach((a) => {
      seenRef.current.add(a.id)
      const c = coupons.find((c) => c.id === a.couponId)
      const ahorro = a.ahorroEstimado ?? 0
      toast.success(
        '¡Tu canje quedó registrado!',
        c ? `${c.titulo} · Ahorraste ${formatMoney(ahorro)}` : `Ahorraste ${formatMoney(ahorro)}`,
      )
      // Sin auto-redirect — el user decide
      void navigate
    })
  }, [activations, user, coupons, toast, navigate])

  return null
}
