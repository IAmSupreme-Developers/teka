import { NextRequest, NextResponse } from 'next/server'
import { downloadTracker } from '@/lib/downloadTracker'
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

// in-memory cache: vid path/url → base64 chunks array
// yes, this lives in RAM. yes, a 1GB video will eat 1.33GB of RAM (base64 overhead).
// it's fast though. embarrassingly fast on local network.
const cache: Record<string, string[]> = {}

// split a string into fixed-size chunks — used to slice the base64 string
function chunkSubstr(str: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < str.length; i += size) chunks.push(str.substr(i, size))
  return chunks
}

// loads the full file into RAM as base64 chunks on first request, serves from cache after
// external URLs are fetched once and cached — subsequent chunk requests are instant
async function getChunks(vid: string): Promise<string[]> {
  if (cache[vid]) return cache[vid] // already in RAM, nothing to do

  let b64: string
  if (vid.startsWith('http://') || vid.startsWith('https://')) {
    // fetch the whole external file — this blocks until complete on first request
    const res = await fetch(vid)
    if (!res.ok) throw new Error(`Failed to fetch ${vid}: ${res.status}`)
    b64 = Buffer.from(await res.arrayBuffer()).toString('base64')
  } else {
    const filePath = resolvePath(vid)
    if (!filePath) throw new Error('File not found')
    b64 = fs.readFileSync(filePath).toString('base64') // sync read — intentional, we want it all at once
  }

  // ~512KB chunks — small enough for fast HTTP responses, large enough to not spam 10k requests
  cache[vid] = chunkSubstr(b64, Math.floor(0.5 * 1024 * 1024))
  return cache[vid]
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body?.vid) return NextResponse.json({ message: 'vid required' }, { status: 400 })
  if (body.start === undefined) return NextResponse.json({ message: 'start required' }, { status: 400 })

  const { vid, start } = body
  const ext = (typeof vid === 'string' ? vid : '').split('.').pop() ?? 'mp4'
  const name = vid.split('/').pop()?.replace(`.${ext}`, '') ?? vid

  // track active downloads — start=0 means a new download is beginning
  if (start === 0) downloadTracker.increment()

  try {
    const chunks = await getChunks(vid)

    // last chunk — decrement the counter so the slot opens up for someone else
    if (start === chunks.length - 1) downloadTracker.decrement()

    return NextResponse.json({
      base64: chunks[start],
      name,
      type: `video/${ext}`,
      isMedia: true,
      prop: {
        end: start + 1,
        vidSize: chunks.length,
        percent: (start / (chunks.length - 1)) * 100, // 0-100 progress
      },
    })
  } catch (e: unknown) {
    downloadTracker.decrement() // don't leave a ghost slot open on error
    return NextResponse.json({ message: (e as Error).message }, { status: 404 })
  }
}
