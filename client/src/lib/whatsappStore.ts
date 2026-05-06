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

const STORAGE_KEY = 'misanpedro.whatsapp.v1'

type State = { campaigns: WhatsappCampaign[] }

const empty: State = { campaigns: [] }

function load(): State {
  if (typeof window === 'undefined') return empty
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as State
    return { campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [] }
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

function update(updater: (s: State) => State) {
  state = updater(state)
  persist(state)
  notify()
}

export function useWhatsappCampaigns() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    () => state.campaigns,
    () => state.campaigns,
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
    update((s) => ({ campaigns: [campaign, ...s.campaigns] }))
    return campaign
  },
}

export function countCampaignsThisMonth(merchantId: string): number {
  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return state.campaigns.filter(
    (c) => c.merchantId === merchantId && new Date(c.sentAt).getTime() >= startMonth,
  ).length
}
