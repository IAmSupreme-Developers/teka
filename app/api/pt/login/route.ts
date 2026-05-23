import { NextRequest, NextResponse } from 'next/server'
import { authenticate } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body?.username || !body?.password)
    return NextResponse.json({ message: 'Credentials required' }, { status: 400 })

  const user = authenticate(body.username, body.password)
  if (!user)
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 })

  return NextResponse.json(user)
}
