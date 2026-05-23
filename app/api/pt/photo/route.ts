import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const MEDIA_DIR = path.join(process.cwd(), 'media')

const EXT_TYPE: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const content = searchParams.get('content')
  if (!content) return NextResponse.json({ message: 'content required' }, { status: 404 })

  // External URL — proxy
  if (content.startsWith('http://') || content.startsWith('https://')) {
    const upstream = await fetch(content)
    return new NextResponse(upstream.body, {
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg' },
    })
  }

  const filePath = path.join(MEDIA_DIR, content)
  if (!fs.existsSync(filePath))
    return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const contentType = EXT_TYPE[ext] ?? 'application/octet-stream'
  const buffer = fs.readFileSync(filePath)

  return new NextResponse(buffer, { headers: { 'Content-Type': contentType } })
}
