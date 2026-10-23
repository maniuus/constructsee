import { useSyncExternalStore } from 'react'

/**
 * Status simpan global untuk status bar: "Menyimpan…", "Tersimpan 14:32", "Siap".
 * Ditulis dari modul mana pun lewat `setSaving` / `setSaved` / `setStatus`.
 */
type State = { text: string; tone: 'idle' | 'busy' | 'ok' }

let state: State = { text: 'Siap', tone: 'idle' }
const subs = new Set<() => void>()
const emit = (): void => {
  subs.forEach((f) => f())
}

const subscribe = (f: () => void): (() => void) => {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

const getSnapshot = (): State => state

const clock = (): string => new Date().toLocaleTimeString('id-ID', { hour12: false })

let watchdog: ReturnType<typeof setTimeout> | null = null

export function setSaving(label = 'Menyimpan…'): void {
  const prev = state
  state = { text: label, tone: 'busy' }
  emit()
  // Jaring pengaman: bila simpan gagal tanpa memanggil setSaved/setStatus,
  // status tidak boleh tertahan di "Menyimpan…" selamanya.
  if (watchdog != null) clearTimeout(watchdog)
  watchdog = setTimeout(() => {
    watchdog = null
    if (state.tone !== 'busy') return
    state = prev
    emit()
  }, 10000)
}

export function setSaved(label = 'Tersimpan'): void {
  if (watchdog != null) {
    clearTimeout(watchdog)
    watchdog = null
  }
  state = { text: `${label} ${clock()}`, tone: 'ok' }
  emit()
}

export function setStatus(text: string, tone: State['tone'] = 'idle'): void {
  if (watchdog != null) {
    clearTimeout(watchdog)
    watchdog = null
  }
  state = { text, tone }
  emit()
}

export function useStatus(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
