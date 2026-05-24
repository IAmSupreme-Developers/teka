'use client'
import { useEffect, useRef, useState } from 'react'
import { useStore, fsWrite, fsRead, fsDelete, fsReadDir } from '@/lib/store'
import { bus } from '@/lib/Eventbus'
import type { Video, Playlist, DownloadEntry } from '@/lib/types'
import BottomBar from '@/components/BottomBar'

export default function VideoPage() {
  const { state, save, hydrated } = useStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cPlaylist = state.runtime.cPlaylist
  const offlineMode = state.preferences.offlinemode

  // resume key is "type-id" — matches the ResumeMap shape
  const resumeKey = cPlaylist ? `${cPlaylist.type}-${cPlaylist.id}` : ''
  const resume = resumeKey
    ? (state.runtime.resume[resumeKey] ?? { currentVid: 0, currentTime: 0 })
    : { currentVid: 0, currentTime: 0 }

  const [videos, setVideos] = useState<Video[]>([])
  const [currentIdx, setCurrentIdx] = useState(resume.currentVid)
  const [sticky, setSticky] = useState(state.preferences.vidsticky)
  const [dwait, setDwait] = useState({ one: false, all: false })
  const [progress, setProgress] = useState<number | undefined>(undefined)
  const stopRef = useRef(false)

  // subscribe to download progress events from anywhere
  useEffect(() => {
    const onProgress = (pct: number) => setProgress(pct)
    const onDone = () => setProgress(undefined)
    bus.subscribe('download:progress', onProgress)
    bus.subscribe('download:done', onDone)
    return () => { bus.unSubscribe('download:progress', onProgress); bus.unSubscribe('download:done', onDone) }
  }, [])

  // load playlist on mount or when playlist changes
  useEffect(() => {
    if (!cPlaylist) return
    if (offlineMode) {
      // serve from local downloads — no network needed
      const saved = state.user.downloads.find(d => d.list.id === cPlaylist.id && d.list.type === cPlaylist.type)
      if (saved) setVideos([...saved.videos].sort((a, b) => a.index - b.index))
    } else {
      fetch('/api/pt/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cPlaylist.id, type: cPlaylist.type }),
      }).then(r => r.json()).then((data: Video[]) => setVideos(data.sort((a, b) => a.index - b.index)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cPlaylist?.id, cPlaylist?.type])

  const currentVideo = videos.find(v => v.index === currentIdx)

  // set video src whenever the current episode changes
  useEffect(() => {
    if (!currentVideo || !videoRef.current) return

    if (typeof currentVideo.location === 'string' && currentVideo.location.startsWith('downloads-')) {
      // offline: read blob from Capacitor Filesystem and create an object URL
      fsRead(currentVideo.location).then(blob => {
        if (!videoRef.current) return
        videoRef.current.src = URL.createObjectURL(blob)
        videoRef.current.load()
      })
    } else {
      // online: pass location to the proxy route — may be a plain string or JSON quality map
      const loc = typeof currentVideo.location === 'string'
        ? currentVideo.location
        : JSON.stringify(currentVideo.location)
      videoRef.current.src = `/api/pt/video?vid=${encodeURIComponent(loc)}&quality=${state.preferences.quality}`
      videoRef.current.load()
      // restore watch position if resuming
      const t = resume.currentTime
      if (t) videoRef.current.addEventListener('loadeddata', () => {
        videoRef.current!.currentTime = t
        videoRef.current!.play()
      }, { once: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo?.id])

  // saves current time + episode index to ResumeMap every 3 seconds while playing
  function saveProgress(time: number, idx: number) {
    const next = JSON.parse(JSON.stringify(state))
    next.runtime.resume[resumeKey] = { currentVid: idx, currentTime: time, lastWatched: new Date().toISOString() }
    save(next)
  }

  function startTimer() {
    timerRef.current = setInterval(() => {
      if (videoRef.current) saveProgress(videoRef.current.currentTime, currentIdx)
    }, 3000)
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function playVid(v: Video) {
    stopTimer()
    setCurrentIdx(v.index)
    saveProgress(0, v.index) // reset time when switching episodes
  }

  // ── Download ───────────────────────────────────────────────────────────────

  async function fetchChunk(location: string, start: number) {
    const res = await fetch('/api/pt/tekasafeblob', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vid: location, start }),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json() as Promise<{ base64: string; type: string; prop: { end: number; vidSize: number; percent: number } }>
  }

  async function downloadOne(vid: Video) {
    if (!cPlaylist) return
    const next = JSON.parse(JSON.stringify(state))

    // find or create the download entry for this playlist
    let pIdx = next.user.downloads.findIndex((d: DownloadEntry) => d.list.id === cPlaylist.id && d.list.type === cPlaylist.type)
    if (pIdx === -1) pIdx = next.user.downloads.push({ list: cPlaylist, videos: [], downloadedAt: new Date().toISOString(), complete: false } as DownloadEntry) - 1
    if (next.user.downloads[pIdx].videos.find((v: Video) => v.id === vid.id)) return // already downloaded, skip

    // resolve the actual URL for the selected quality
    const resolvedLoc = typeof vid.location === 'string'
      ? vid.location
      : (vid.location[state.preferences.quality] ?? Object.values(vid.location)[0] ?? '')
    const filename = `downloads-${vid.name}`

    // ask the server if it has capacity for a base64 download
    // local source + server available = fast RAM-served chunked download
    // external source or server at limit = Capacitor native HTTP download
    const useBase64 = vid.source === 'local' && await fetch('/api/pt/downloadlimit')
      .then(r => r.json()).then(d => d.available).catch(() => false)

    if (useBase64) {
      const stack: string[] = []
      let start = 0
      const pump: () => Promise<void> = async () => {
        if (stopRef.current) throw new Error('stopped')
        const data = await fetchChunk(resolvedLoc, start)
        stack.push(data.base64)
        start = data.prop.end
        bus.dispatch("download:progress", data.prop.percent)           // local state — triggers re-render immediately
        next.runtime.downloading = data.prop.percent
        save(next)
        if (data.prop.percent >= 100) {
          // decode each chunk individually — joining first then atob() on 50MB+ string = stack overflow
          const arrays = stack.map(b64 => {
            const bytes = atob(b64)
            const arr = new Uint8Array(bytes.length)
            for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
            return arr
          })
          const total = arrays.reduce((n, a) => n + a.length, 0)
          const merged = new Uint8Array(total)
          let offset = 0
          for (const a of arrays) { merged.set(a, offset); offset += a.length }
          await fsWrite(filename, new Blob([merged], { type: data.type }))
          const savedVid = { ...vid, location: filename }
          next.user.downloads[pIdx].videos.push(savedVid)
          next.user.downloads[pIdx].downloadedAt = new Date().toISOString()
          next.user.downloads[pIdx].complete =
            next.user.downloads[pIdx].videos.length === (cPlaylist.totalEpisodes ?? videos.length)
          next.runtime.downloading = undefined
          bus.dispatch("download:done")
          // update local videos array so playback uses the downloaded file immediately
          setVideos(vs => vs.map(v => v.id === vid.id ? savedVid : v))
          save(next)
        } else await pump()
      }
      await pump()
    } else {

      // NEEDFIX - this will not work if the url is provided for chunk download (not an http link)
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      await new Promise<void>((resolve, reject) => {
        Filesystem.addListener('progress', (p: { url: string; bytes: number; contentLength: number }) => {
          if (p.url === resolvedLoc) {
            const pct = (p.bytes / p.contentLength) * 100
            bus.dispatch("download:progress", pct)                     // local state
            next.runtime.downloading = pct
            save(next)
          }
        })
        Filesystem.downloadFile({
          url: resolvedLoc,
          path: `delete_not/${filename}`,
          directory: Directory.Data,
          progress: true,
        }).then(() => {
          const savedVid = { ...vid, location: filename }
          next.user.downloads[pIdx].videos.push(savedVid)
          next.user.downloads[pIdx].downloadedAt = new Date().toISOString()
          next.user.downloads[pIdx].complete =
            next.user.downloads[pIdx].videos.length === (cPlaylist.totalEpisodes ?? videos.length)
          next.runtime.downloading = undefined
          bus.dispatch("download:done")
          setVideos(vs => vs.map(v => v.id === vid.id ? savedVid : v))
          save(next)
          resolve()
        }).catch(reject)
      })
    }
  }

  async function downloadAll() {
    if (!videos.length || dwait.all) return
    stopRef.current = false
    setDwait(d => ({ ...d, all: true }))
    // sequential — one at a time to avoid hammering the server
    for (const v of videos) {
      if (stopRef.current) break
      await downloadOne(v).catch(console.error)
    }
    setDwait(d => ({ ...d, all: false }))
  }

  async function downloadCurrent() {
    if (!currentVideo || dwait.one) return
    setDwait(d => ({ ...d, one: true }))
    await downloadOne(currentVideo).catch(console.error)
    setDwait(d => ({ ...d, one: false }))
  }

  async function deleteCurrent() {
    if (!currentVideo || !cPlaylist) return
    // find the file by name in the Filesystem directory, then delete by URI
    const files = await fsReadDir()
    const match = files.files.find(f => f.name === currentVideo.location)
    if (match) await fsDelete(match.uri)
    const next = JSON.parse(JSON.stringify(state))
    const pIdx = next.user.downloads.findIndex((d: DownloadEntry) => d.list.id === cPlaylist.id && d.list.type === cPlaylist.type)
    if (pIdx !== -1) {
      next.user.downloads[pIdx].videos = next.user.downloads[pIdx].videos.filter((v: Video) => v.id !== currentVideo.id)
      if (!next.user.downloads[pIdx].videos.length) next.user.downloads.splice(pIdx, 1) // clean up empty entry
    }
    save(next)
  }

  function toggleSticky() {
    const next = JSON.parse(JSON.stringify(state))
    next.preferences.vidsticky = !sticky
    save(next); setSticky(!sticky)
  }

  function photoUrl(photo?: string) {
    return photo ? `/api/pt/photo?content=${encodeURIComponent(photo)}` : '/placeholder.png'
  }

  if (!hydrated) return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
    </div>
  )

  if (!cPlaylist) return (
    <div className="flex flex-col items-center justify-center h-screen gap-3" style={{ background: 'var(--bg)' }}>
      <p style={{ color: 'var(--text-muted)' }}>No playlist selected</p>
    </div>
  )

  return (
    <div className="flex flex-col md:flex-row min-h-screen pb-16" style={{ background: 'var(--bg)' }}>

      {/* ── Main column ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">

        {/* Video player */}
        <div className={`w-full ${sticky ? 'sticky top-0 z-30' : ''}`} style={{ background: '#000' }}>
          <div className="aspect-video w-full bg-black">
            <video ref={videoRef} controls className="w-full h-full"
              poster={photoUrl(cPlaylist.photo)}
              onPlay={startTimer} onPause={stopTimer}
              onEnded={() => { stopTimer(); saveProgress(0, currentIdx) }} />
          </div>
        </div>

        {/* Title + nav row */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-3"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <label className="flex items-center gap-1.5 cursor-pointer shrink-0" title="Sticky player">
            <input type="checkbox" checked={sticky} onChange={toggleSticky} className="sr-only" />
            <span className="text-lg" style={{ opacity: sticky ? 1 : 0.35 }}>📌</span>
          </label>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--accent)' }}>{cPlaylist.name}</p>
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{currentVideo?.name ?? '—'}</p>
          </div>
          <button onClick={() => { const v = videos.find(v => v.index === currentIdx - 1); if (v) playVid(v) }}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity disabled:opacity-30"
            style={{ background: 'var(--bg-raised)' }}
            disabled={!videos.find(v => v.index === currentIdx - 1)}>
            <svg viewBox="0 0 320 512" fill="currentColor" className="w-3.5 h-3.5" style={{ color: 'var(--text)' }}><path d="M41.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 256 246.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z"/></svg>
          </button>
          <button onClick={() => { const v = videos.find(v => v.index === currentIdx + 1); if (v) playVid(v) }}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity disabled:opacity-30"
            style={{ background: 'var(--bg-raised)' }}
            disabled={!videos.find(v => v.index === currentIdx + 1)}>
            <svg viewBox="0 0 320 512" fill="currentColor" className="w-3.5 h-3.5" style={{ color: 'var(--text)' }}><path d="M278.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L210.7 256 73.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160z"/></svg>
          </button>
        </div>

        {/* Download / delete bar */}
        <div className="px-4 py-3 flex gap-2 items-center flex-wrap">
          {!offlineMode ? (
            <>
              <button onClick={downloadCurrent} disabled={dwait.one || dwait.all}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-40 transition-opacity"
                style={{ background: 'var(--bg-raised)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                <svg viewBox="0 0 512 512" fill="currentColor" className="w-3 h-3"><path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32z"/></svg>
                This episode
              </button>
              <button onClick={downloadAll} disabled={dwait.one || dwait.all}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-40 transition-opacity"
                style={{ background: 'var(--bg-raised)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                <svg viewBox="0 0 512 512" fill="currentColor" className="w-3 h-3"><path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32z"/></svg>
                All episodes
              </button>
            </>
          ) : (
            <button onClick={deleteCurrent}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(229,9,20,0.15)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
              <svg viewBox="0 0 448 512" fill="currentColor" className="w-3 h-3"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>
              Delete episode
            </button>
          )}
          {(dwait.one || dwait.all) && (
            <button onClick={() => { stopRef.current = true; setDwait({ one: false, all: false }) }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(229,9,20,0.15)', color: 'var(--accent)' }}>
              Stop ✋
            </button>
          )}
          {progress !== undefined && (
            <div className="flex-1 flex items-center gap-2 min-w-32">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-raised)' }}>
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
              </div>
              <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{Math.round(progress)}%</span>
            </div>
          )}
        </div>

        {/* Episode strip — mobile */}
        {videos.length > 1 && (
          <div className="md:hidden px-4 pb-2">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Episodes</p>
            <div className="flex overflow-x-auto gap-2 pb-1">
              {videos.map(v => (
                <div key={v.id} onClick={() => playVid(v)}
                  className="flex-shrink-0 w-24 cursor-pointer rounded-lg overflow-hidden transition-all"
                  style={{ border: `2px solid ${v.index === currentIdx ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--bg-card)' }}>
                  <div className="aspect-video overflow-hidden">
                    <img src={photoUrl(cPlaylist.photo)} className="w-full h-full object-cover" alt={v.name}
                      onError={e => { const t = e.target as HTMLImageElement; if (!t.dataset.err) { t.dataset.err='1'; t.src='/placeholder.png' } }} />
                  </div>
                  <p className="text-[10px] p-1 truncate" style={{ color: v.index === currentIdx ? 'var(--accent)' : 'var(--text-muted)' }}>{v.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review form */}
        <div className="px-4 py-6 max-w-lg">
          <p className="text-sm font-bold mb-4" style={{ color: 'var(--text)' }}>Leave a Review</p>
          <input placeholder="Name" className="w-full rounded-xl px-4 py-3 text-sm mb-3 outline-none"
            style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)' }} />
          <input placeholder="Email" className="w-full rounded-xl px-4 py-3 text-sm mb-3 outline-none"
            style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)' }} />
          <textarea rows={3} placeholder="Your thoughts..." className="w-full rounded-xl px-4 py-3 text-sm mb-3 outline-none resize-none"
            style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)' }} />
          <button className="px-5 py-2.5 rounded-full text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Submit</button>
        </div>
      </div>

      {/* ── Episode sidebar — desktop ── */}
      {videos.length > 1 && (
        <div className="hidden md:flex flex-col w-64 shrink-0 overflow-y-auto"
          style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>
          <p className="px-4 pt-4 pb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Episodes</p>
          <div className="flex flex-col gap-1 px-2 pb-4">
            {videos.map(v => (
              <div key={v.id} onClick={() => playVid(v)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                style={{ background: v.index === currentIdx ? 'var(--bg-raised)' : 'transparent' }}>
                <div className="w-16 aspect-video rounded-lg overflow-hidden shrink-0" style={{ background: 'var(--bg-raised)' }}>
                  <img src={photoUrl(cPlaylist.photo)} className="w-full h-full object-cover" alt={v.name}
                    onError={e => { const t = e.target as HTMLImageElement; if (!t.dataset.err) { t.dataset.err='1'; t.src='/placeholder.png' } }} />
                </div>
                <p className="text-xs font-medium leading-snug line-clamp-2"
                  style={{ color: v.index === currentIdx ? 'var(--accent)' : 'var(--text)' }}>{v.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <BottomBar />
    </div>
  )
}
