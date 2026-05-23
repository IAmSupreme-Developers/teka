import { NextRequest, NextResponse } from 'next/server'
import { searchPlaylists } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('query')
  const step = Number(searchParams.get('step') ?? 0)
  if (!query) return NextResponse.json({ message: 'Enter Search Value' }, { status: 404 })
  return NextResponse.json(searchPlaylists('series', query, step))
}
