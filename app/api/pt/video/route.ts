import { NextRequest, NextResponse } from 'next/server'
import type { VideoLocation, VideoQuality } from '@/lib/types'
import fs from 'fs'
import path from 'path'

const MEDIA_DIR = path.join(process.cwd(), 'media')
const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

function resolvePath(file: string): string | null {
  for (const dir of [MEDIA_DIR, UPLOADS_DIR]) {
    const p = path.join(dir, file)
    if (fs.existsSync(p)) return p
  }
  return null
}

// picks the best available URL from a quality map
// falls back gracefully rather than 404ing because the user asked for 1080p and you only have 360p
function resolveLocation(location: VideoLocation, quality: VideoQuality): string {
  if (typeof location === 'string') return location
  const fallback: VideoQuality[] = [quality, '1080p', '720p', '360p', 'auto']
  for (const q of fallback) {
    if (location[q]) return location[q]!
  }
  return Object.values(location)[0] ?? ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const vid = searchParams.get('vid')
  const quality = (searchParams.get('quality') ?? 'auto') as VideoQuality
  if (!vid) return NextResponse.json({ message: 'vid required' }, { status: 404 })

  // browser sends Range header for video seeking — required, not optional
  const range = req.headers.get('range')
  if (!range) return NextResponse.json({ message: 'Range header required' }, { status: 403 })

  const start = Number(range.replace(/\D/g, ''))

  // vid param may be a JSON quality map or a plain string — try parse, fall back to string
  let location: VideoLocation
  try { location = JSON.parse(vid) } catch { location = vid }

  const url = resolveLocation(location, quality)

  // ── External URL: proxy the upstream range request ────────────────────────
  // we don't transcode, we don't cache, we just forward the bytes
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const upstream = await fetch(url, { headers: { Range: `bytes=${start}-` } })
    return new NextResponse(upstream.body, {
      status: 206,
      headers: {
        'Content-Range': upstream.headers.get('Content-Range') ?? `bytes ${start}-`,
        'Accept-Ranges': 'bytes',
        'Content-Type': upstream.headers.get('Content-Type') ?? 'video/mp4',
        'Content-Length': upstream.headers.get('Content-Length') ?? '',
      },
    })
  }

  // ── Local file: read a 1MB chunk and stream it ────────────────────────────
  const videoPath = resolvePath(url)
  if (!videoPath)
    return NextResponse.json({ message: 'Video not found' }, { status: 404 })

  const CHUNK = 10 ** 6 // 1MB — small enough to start fast, large enough to not spam requests
  const videoSize = fs.statSync(videoPath).size
  const end = Math.min(videoSize - 1, start + CHUNK)

  // Node ReadableStream → Web ReadableStream — Next.js App Router speaks Web streams
  const stream = fs.createReadStream(videoPath, { start, end })
  const webStream = new ReadableStream({
    start(controller) {
      stream.on('data', chunk => controller.enqueue(chunk))
      stream.on('end', () => controller.close())
      stream.on('error', err => controller.error(err))
    },
  })

  return new NextResponse(webStream, {
    status: 206,
    headers: {
      'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1),
      'Content-Type': 'video/mp4',
    },
  })
}
