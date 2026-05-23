'use client'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import type { VideoQuality } from '@/lib/types'
import BottomBar from '@/components/BottomBar'

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="relative w-12 h-6 rounded-full transition-colors duration-200"
      style={{ background: on ? 'var(--accent)' : 'var(--bg-raised)', border: '1px solid var(--border)' }}>
      <span className="absolute top-[2px] w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
        style={{ left: on ? 'calc(100% - 22px)' : '2px' }} />
    </button>
  )
}

function Row({ label, sub, right }: { label: string; sub?: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4" style={{ borderBottom: '1px solid var(--border)' }}>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
      {right}
    </div>
  )
}

const QUALITIES: VideoQuality[] = ['auto', '360p', '720p', '1080p']

export default function SettingsPage() {
  const router = useRouter()
  const { state, save } = useStore()
  const prefs = state.preferences
  const downloads = state.user.downloads

  function toggle(key: keyof typeof prefs) {
    const next = JSON.parse(JSON.stringify(state))
    next.preferences[key] = !next.preferences[key]
    save(next)
  }

  function setQuality(q: VideoQuality) {
    const next = JSON.parse(JSON.stringify(state))
    next.preferences.quality = q
    save(next)
  }

  function openDownloads() {
    const next = JSON.parse(JSON.stringify(state))
    next.runtime.searchdata = downloads.map(d => d.list)
    next.preferences.offlinemode = true
    save(next)
    router.push('/search')
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>
      {/* header */}
      <div className="px-5 pt-14 pb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Settings</h1>
      </div>

      <div className="px-5 space-y-8">

        {/* Downloads section */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Downloads</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <button onClick={openDownloads} className="w-full flex items-center justify-between px-4 py-4 transition-opacity active:opacity-70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                  <svg viewBox="0 0 512 512" fill="white" className="w-4 h-4"><path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64z"/></svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>My Downloads</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{downloads.length} playlist{downloads.length !== 1 ? 's' : ''} saved</p>
                </div>
              </div>
              <svg viewBox="0 0 320 512" fill="currentColor" className="w-3 h-3" style={{ color: 'var(--text-muted)' }}><path d="M278.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L210.7 256 73.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160z"/></svg>
            </button>
          </div>
        </section>

        {/* Playback section */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Playback</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="px-4">
              <Row label="Autoplay" sub="Automatically play next episode" right={<Toggle on={prefs.autoplay} onChange={() => toggle('autoplay')} />} />
              <Row label="Sticky Player" sub="Pin video to top while scrolling" right={<Toggle on={prefs.vidsticky} onChange={() => toggle('vidsticky')} />} />
              <Row label="Offline Mode" sub="Play from downloaded files only" right={<Toggle on={prefs.offlinemode} onChange={() => toggle('offlinemode')} />} />
            </div>
          </div>
        </section>

        {/* Quality section */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Stream Quality</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex p-2 gap-2">
              {QUALITIES.map(q => (
                <button key={q} onClick={() => setQuality(q)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: prefs.quality === q ? 'var(--accent)' : 'var(--bg-raised)',
                    color: prefs.quality === q ? '#fff' : 'var(--text-muted)',
                  }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Appearance section */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Appearance</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="px-4">
              <Row label="Language" sub={prefs.eng ? 'English' : 'Français'} right={
                <button onClick={() => toggle('eng')} className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: 'var(--bg-raised)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                  {prefs.eng ? 'EN' : 'FR'}
                </button>
              } />
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
