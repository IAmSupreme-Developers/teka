'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'

interface Props { onClose: () => void }

const CATEGORIES = [
  { value: 'movies', label: '🎬 Movies' },
  { value: 'animes', label: '⛩️ Anime' },
  { value: 'series', label: '📺 TV Series' },
]

export default function SearchOverlay({ onClose }: Props) {
  const router = useRouter()
  const { state, save, setSearchData } = useStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function search() {
    const q = query.trim(), c = category.trim()
    if (!q) { setError('What are you looking for?'); return }
    if (!c) { setError('Pick a category first'); return }
    setError(''); setLoading(true)

    try {
      const res = await fetch(`/api/pt/${c}?query=${encodeURIComponent(q)}&step=0`)
      const data = await res.json()
      if (!res.ok || !data.length) { setError('Nothing found. Try a different title.'); return }
      const next = JSON.parse(JSON.stringify(state))
      next.preferences.offlinemode = false
      save(next)
      setSearchData(data, c)
      onClose()
      router.push('/search')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(10,10,14,0.97)', backdropFilter: 'blur(24px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div className="flex items-center gap-3 px-4 pt-14 pb-4">
        <button onClick={onClose} className="p-2 rounded-full" style={{ color: 'var(--text-muted)' }}>
          <svg viewBox="0 0 320 512" fill="currentColor" className="w-4 h-4"><path d="M41.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 256 246.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z"/></svg>
        </button>
        <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
          <svg viewBox="0 0 512 512" fill="currentColor" className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }}><path d="M416 208c0 45.4-14.9 87.3-40 120.9L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.9 376c-33.6 25.1-75.5 40-120.9 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>
          <input ref={inputRef} autoFocus type="text" value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search titles, genres..."
            className="flex-1 bg-transparent outline-none text-base"
            style={{ color: 'var(--text)' }} />
          {query && <button onClick={() => setQuery('')} style={{ color: 'var(--text-muted)' }}>✕</button>}
        </div>
      </div>

      <div className="px-4 pb-4 flex gap-2">
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setCategory(c.value)}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{
              background: category === c.value ? 'var(--accent)' : 'var(--bg-raised)',
              color: category === c.value ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${category === c.value ? 'var(--accent)' : 'var(--border)'}`,
            }}>
            {c.label}
          </button>
        ))}
      </div>

      {error && <p className="px-4 text-sm" style={{ color: 'var(--accent)' }}>{error}</p>}

      <div className="px-4 pt-2">
        <button onClick={search} disabled={loading}
          className="w-full py-4 rounded-2xl font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: 'var(--accent)' }}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
    </div>
  )
}
