import { NextRequest, NextResponse } from 'next/server'
import { searchPlaylists } from '@/lib/db'

function searchHandler(type: string) {
  return async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query')
    const step = Number(searchParams.get('step') ?? 0)

    if (!query)
      return NextResponse.json({ message: 'Enter Search Value' }, { status: 404 })

    const results = searchPlaylists(type, query, step)
    return NextResponse.json(results)
  }
}

export const GET = searchHandler('movies')
