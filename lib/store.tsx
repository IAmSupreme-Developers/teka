'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { TEKA, Playlist } from './types'

const DEFAULT: TEKA = {
  runtime: { searchdata: [], resume: {} },
  user: { id: 0, name: '', username: '', email: '', dob: '', tel: 0, downloads: [], reviews: [] },
  preferences: { vidsticky: true, lighttheme: true, eng: true, offlinemode: false, autoplay: true, quality: 'auto' },
}

// JSON.parse(JSON.stringify()) — the poor man's deep clone
// structuredClone() exists but this works everywhere including older Capacitor webviews
function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)) }

// ── Capacitor Preferences ─────────────────────────────────────────────────────
// replaces localStorage — uses native secure storage on device, IndexedDB on web
// dynamic import so it doesn't blow up during SSR
async function prefsGet(key: string): Promise<string | null> {
  const { Preferences } = await import('@capacitor/preferences')
  const { value } = await Preferences.get({ key })
  return value
}
async function prefsSet(key: string, value: string) {
  const { Preferences } = await import('@capacitor/preferences')
  await Preferences.set({ key, value })
}

// ── Capacitor Filesystem ──────────────────────────────────────────────────────
// used exclusively for downloaded video blobs — NOT for the TEKA state
// on web: IndexedDB (no 5MB cap like localStorage), on native: actual filesystem

export async function fsWrite(filename: string, data: Blob) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  // Filesystem.writeFile needs a base64 string for binary — Blob → DataURL → strip header → base64
  const base64 = await new Promise<string>((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => res((reader.result as string).split(',')[1])
    reader.onerror = rej
    reader.readAsDataURL(data)
  })
  return Filesystem.writeFile({ path: `delete_not/${filename}`, data: base64, directory: Directory.Data })
}

export async function fsRead(filename: string): Promise<Blob> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  // no Encoding param = returns raw base64 string (correct for binary)
  // passing Encoding.UTF8 here would corrupt video data — don't do it
  const result = await Filesystem.readFile({ path: `delete_not/${filename}`, directory: Directory.Data })
  const b64 = result.data as string
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: 'video/mp4' })
}

export async function fsDelete(uri: string) {
  const { Filesystem } = await import('@capacitor/filesystem')
  return Filesystem.deleteFile({ path: uri })
}

export async function fsReadDir() {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  return Filesystem.readdir({ path: 'delete_not/', directory: Directory.Data })
}

// ── Store ─────────────────────────────────────────────────────────────────────
// global React context — the entire app state lives here
// persisted to Capacitor Preferences on every save() call
interface Store {
  state: TEKA
  hydrated: boolean
  save: (next: TEKA) => void
  setPlaylist: (p: Playlist) => Promise<void>
  setSearchData: (data: Playlist[], category: string) => void
  isOnline: boolean
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TEKA>(DEFAULT)
  const [hydrated, setHydrated] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // hydrate from persisted state on mount — async because Capacitor Preferences is async
    prefsGet('PreLoaded').then(saved => {
      if (saved) setState(JSON.parse(saved))
      setHydrated(true)
    })
    fetch('/api/pt/checkonline').then(() => setIsOnline(true)).catch(() => setIsOnline(false))
  }, [])

  // always clone before mutating — never pass the same reference back in
  const save = (next: TEKA) => {
    setState(next)
    prefsSet('PreLoaded', JSON.stringify(next))
  }

  const setPlaylist = async (p: Playlist) => {
    const next = clone(state)
    next.runtime.cPlaylist = p
    setState(next)                                    // sync — immediate React state update
    prefsSet('PreLoaded', JSON.stringify(next))       // async background persist
  }

  const setSearchData = (data: Playlist[], category: string) => {
    const next = clone(state)
    // stamp the category onto each result — server doesn't include it in the response
    next.runtime.searchdata = data.map(p => ({ ...p, type: category }))
    save(next)
  }

  return <Ctx.Provider value={{ state, hydrated, save, setPlaylist, setSearchData, isOnline }}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be inside StoreProvider')
  return ctx
}
