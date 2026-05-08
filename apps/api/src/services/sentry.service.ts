/**
 * Sentry init opcional. Si SENTRY_DSN está vacío, los wrappers son no-ops.
 *
 * Para activar:
 *   pnpm --filter @misanpedro/api add @sentry/node
 *
 * En este punto el SDK no está instalado por defecto para no inflar el
 * bundle. El loader es dinámico — si falla el import, queda en modo no-op.
 */

import { env, isProd } from '@/env'

type SentryLike = {
  init: (opts: { dsn: string; environment: string; tracesSampleRate: number }) => void
  captureException: (err: unknown, hint?: any) => void
  captureMessage: (msg: string, level?: any) => void
  flush: (timeoutMs?: number) => Promise<boolean>
}

let sentry: SentryLike | null = null
let initialized = false

export async function initSentry(): Promise<void> {
  if (initialized) return
  initialized = true
  if (!env.SENTRY_DSN) {
    console.log('[sentry] SENTRY_DSN vacío; modo no-op')
    return
  }
  try {
    const moduleName = '@sentry/node'
    const mod: any = await import(/* @vite-ignore */ moduleName)
    sentry = mod
    sentry?.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: isProd ? 0.1 : 1.0,
    })
    console.log('[sentry] inicializado')
  } catch (err) {
    console.warn('[sentry] @sentry/node no instalado; modo no-op')
    sentry = null
  }
}

export function captureException(err: unknown, context?: Record<string, any>): void {
  if (!sentry) return
  try {
    sentry.captureException(err, context ? { extra: context } : undefined)
  } catch {
    /* noop */
  }
}

export function captureMessage(msg: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!sentry) return
  try {
    sentry.captureMessage(msg, level)
  } catch {
    /* noop */
  }
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!sentry) return
  try {
    await sentry.flush(timeoutMs)
  } catch {
    /* noop */
  }
}
