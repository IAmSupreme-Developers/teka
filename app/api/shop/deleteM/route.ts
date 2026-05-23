import { NextRequest, NextResponse } from 'next/server'
import { mediaManager } from '@/lib/shopState'

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body?.name) return NextResponse.json({ message: 'name required' }, { status: 403 })
  mediaManager.removeEntity(body.name)
  return NextResponse.json({})
}
