'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import type { Playlist } from '@/lib/types'
import BottomBar from '@/components/BottomBar'

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  movies: { label: 'Movie',  color: '#e50914' },
  animes: { label: 'Anime',  color: '#f5a623' },
  series: { label: 'Series', color: '#1db954' },
}

export default function SearchResultsPage() {
  const router = useRouter()
  const { state, save, setPlaylist } = useStore()
  const data: Playlist[] = state.runtime.searchdata
  const offlineMode = state.preferences.offlinemode

  // if we arrived here via a fresh search (not downloads), ensure offlineMode is off
  useEffect(() => {
    if (offlineMode && data.length > 0) {
      // check if the data matches downloads — if not, reset offlineMode
      const isDownloads = state.user.downloads.some(d => data.find(p => p.id === d.list.id && p.type === d.list.type))
      if (!isDownloads) {
        const next = JSON.parse(JSON.stringify(state))
        next.preferences.offlinemode = false
        save(next)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openPlaylist(p: Playlist) {
    if (!offlineMode) {
      const res = await fetch('/api/pt/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: p.id, type: p.type }),
      })
      if (!res.ok) return
    }
    await setPlaylist(p)
    router.push('/video')
  }

  function photoUrl(photo: string) {
    return photo ? `/api/pt/photo?content=${encodeURIComponent(photo)}` : '/placeholder.png'
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>
      <div className="px-4 pt-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            {offlineMode ? 'Downloads' : 'Results'}
          </h2>
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
            {data.length} title{data.length !== 1 ? 's' : ''}
          </span>
        </div>

        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <svg viewBox="0 0 512 512" fill="currentColor" className="w-16 h-16" style={{ color: 'var(--border)' }}>
              <path d="M416 208c0 45.4-14.9 87.3-40 120.9L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.9 376c-33.6 25.1-75.5 40-120.9 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/>
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nothing here yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {data.map(item => (
              <div key={`${item.type}-${item.id}`} onClick={() => openPlaylist(item)}
                className="cursor-pointer card-hover">
                <div className="aspect-[2/3] rounded-xl overflow-hidden relative" style={{ background: 'var(--bg-card)' }}>
                  <img src={photoUrl(item.photo)} alt={item.name}
                    className="w-full h-full object-cover"
                    onError={e => { const t = e.target as HTMLImageElement; if (!t.dataset.err) { t.dataset.err='1'; t.src='/placeholder.png' } }} />
                  {item.type && (
                    <span className="absolute top-1.5 left-1.5 badge text-[9px]"
                      style={{ background: TYPE_BADGE[item.type]?.color ?? '#555', color: '#fff' }}>
                      {TYPE_BADGE[item.type]?.label ?? item.type}
                    </span>
                  )}
                  {offlineMode && (
                    <span className="absolute bottom-1.5 right-1.5">
                      <svg viewBox="0 0 512 512" fill="currentColor" className="w-3.5 h-3.5" style={{ color: '#1db954' }}>
                        <path d="M256 48a208 208 0 1 1 0 416A208 208 0 1 1 256 48zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z"/>
                      </svg>
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1.5 font-medium truncate px-0.5" style={{ color: 'var(--text)' }}>{item.name}</p>
                {item.year && <p className="text-[10px] px-0.5" style={{ color: 'var(--text-muted)' }}>{item.year}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomBar />
    </div>
  )
}
