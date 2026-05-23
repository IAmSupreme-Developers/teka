'use client'
import { useStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Playlist } from '@/lib/types'
import Pagination from '@/components/Pagination'
import BottomBar from '@/components/BottomBar'

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  movies:  { label: 'Movie',  color: '#e50914' },
  animes:  { label: 'Anime',  color: '#f5a623' },
  series:  { label: 'Series', color: '#1db954' },
}

export default function HomePage() {
  const { state, setPlaylist } = useStore()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const data: Playlist[] = state.runtime.searchdata

  async function openPlaylist(p: Playlist) {
    await setPlaylist(p)
    router.push('/video')
  }

  function photoUrl(photo: string) {
      return photo ? `/api/pt/photo?content=${encodeURIComponent(photo)}` : '/placeholder.png'
    }

  const featured = data[0]

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>

      {/* hero — first result as featured banner */}
      {featured ? (
        <div className="relative w-full aspect-[16/9] max-h-72 overflow-hidden cursor-pointer"
          onClick={() => openPlaylist(featured)}>
          <img src={photoUrl(featured.photo)} alt={featured.name}
            className="w-full h-full object-cover"
            onError={e => { const t = e.target as HTMLImageElement; if (!t.dataset.err) { t.dataset.err='1'; t.src='/placeholder.png' } }} />
          {/* gradient overlay */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--bg) 0%, transparent 60%)' }} />
          <div className="absolute bottom-0 left-0 px-5 pb-5">
            {featured.type && (
              <span className="badge mb-2" style={{ background: TYPE_BADGE[featured.type]?.color ?? '#555', color: '#fff' }}>
                {TYPE_BADGE[featured.type]?.label ?? featured.type}
              </span>
            )}
            <h2 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text)' }}>{featured.name}</h2>
            {featured.year && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{featured.year}</p>}
            <button className="mt-3 px-5 py-2 rounded-full text-sm font-semibold text-white flex items-center gap-2"
              style={{ background: 'var(--accent)' }}>
              <svg viewBox="0 0 384 512" fill="currentColor" className="w-3 h-3"><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>
              Play Now
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full aspect-[16/9] max-h-72 skeleton" />
      )}

      {/* content grid */}
      <div className="px-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
            {data.length > 0 ? 'Results' : 'Recently Added'}
          </h3>
          {data.length > 0 && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
              {data.length} titles
            </span>
          )}
        </div>

        {data.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {data.map(item => (
              <div key={`${item.type}-${item.id}`} onClick={() => openPlaylist(item)}
                className="cursor-pointer card-hover">
                <div className="aspect-[2/3] rounded-xl overflow-hidden relative"
                  style={{ background: 'var(--bg-card)' }}>
                  <img src={photoUrl(item.photo)} alt={item.name}
                    className="w-full h-full object-cover"
                    onError={e => { const t = e.target as HTMLImageElement; if (!t.dataset.err) { t.dataset.err='1'; t.src='/placeholder.png' } }} />
                  {item.type && (
                    <span className="absolute top-1.5 left-1.5 badge text-[9px]"
                      style={{ background: TYPE_BADGE[item.type]?.color ?? '#555', color: '#fff' }}>
                      {TYPE_BADGE[item.type]?.label ?? item.type}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1.5 font-medium truncate px-0.5" style={{ color: 'var(--text)' }}>{item.name}</p>
                {item.year && <p className="text-[10px] px-0.5" style={{ color: 'var(--text-muted)' }}>{item.year}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {Array(12).fill(null).map((_, i) => (
              <div key={i}>
                <div className="aspect-[2/3] rounded-xl skeleton" />
                <div className="h-3 rounded skeleton mt-2 w-3/4" />
              </div>
            ))}
          </div>
        )}

        {data.length > 0 && (
          <div className="mt-8">
            <Pagination min={1} max={99} current={page} sDigit={2} onClick={setPage} />
          </div>
        )}
      </div>

      <BottomBar />
    </div>
  )
}
