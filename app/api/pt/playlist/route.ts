import { NextRequest, NextResponse } from 'next/server'
import { getPlaylistVideos } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body?.query || !body?.type)
    return NextResponse.json({ message: 'Enter Search Value' }, { status: 404 })

  const videos = getPlaylistVideos(body.type, Number(body.query))
  return NextResponse.json(videos)
}
