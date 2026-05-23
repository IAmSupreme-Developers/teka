import { NextRequest, NextResponse } from 'next/server'
import { productManager } from '@/lib/shopState'

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body) return NextResponse.json({ message: 'No content' }, { status: 403 })

  const { id, method, argument } = body
  const prod = productManager.getEntityById(Number(id)) as Record<string, unknown> | undefined
  if (!prod || typeof prod[method] !== 'function')
    return NextResponse.json({ result: false, message: `no product or method: ${method}` })

  const result = (prod[method] as (arg: unknown) => unknown)(argument)
  return NextResponse.json(result)
}
