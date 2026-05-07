import { useSyncExternalStore } from 'react'

export type WhatsappCampaign = {
  id: string
  merchantId: string
  templateId: string
  audiencia: string
  rendered: string
  sentAt: string
  sentCount: number
  deliveredCount: number
  readCount: number
}

export type WhatsappConnection = {
  connectedAt: string
}

const STORAGE_KEY = 'misanpedro.whatsapp.v1'

type State = {
  campaigns: WhatsappCampaign[]
  connections: Record<string, WhatsappConnection | undefined>
}

const empty: State = { campaigns: [], connections: {} }

function load(): State {
  if (typeof window === 'undefined') return empty
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<State>
    return {
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
      connections: parsed.connections ?? {},
    }
  } catch {
    return empty
  }
}

function persist(s: State) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

let state: State = load()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function update(updater: (s: State) => State) {
  state = updater(state)
  persist(state)
  notify()
}

export function useWhatsappCampaigns() {
  return useSyncExternalStore(subscribe, () => state.campaigns, () => state.campaigns)
}

export function useWhatsappConnection(merchantId: string): WhatsappConnection | null {
  return useSyncExternalStore(
    subscribe,
    () => state.connections[merchantId] ?? null,
    () => state.connections[merchantId] ?? null,
  )
}

export const whatsappActions = {
  send(input: Omit<WhatsappCampaign, 'id' | 'sentAt' | 'deliveredCount' | 'readCount'>) {
    const sentAt = new Date().toISOString()
    const campaign: WhatsappCampaign = {
      ...input,
      id: `wc-${Math.random().toString(36).slice(2, 10)}`,
      sentAt,
      deliveredCount: Math.floor(input.sentCount * 0.95),
      readCount: Math.floor(input.sentCount * 0.62),
    }
    update((s) => ({ ...s, campaigns: [campaign, ...s.campaigns] }))
    return campaign
  },
  connect(merchantId: string) {
    update((s) => ({
      ...s,
      connections: {
        ...s.connections,
        [merchantId]: { connectedAt: new Date().toISOString() },
      },
    }))
  },
  disconnect(merchantId: string) {
    update((s) => {
      const next = { ...s.connections }
      delete next[merchantId]
      return { ...s, connections: next }
    })
  },
}

export function countCampaignsThisMonth(merchantId: string): number {
  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return state.campaigns.filter(
    (c) => c.merchantId === merchantId && new Date(c.sentAt).getTime() >= startMonth,
  ).length
}
