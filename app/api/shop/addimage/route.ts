import { NextRequest, NextResponse } from 'next/server'
import { productManager } from '@/lib/shopState'

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body) return NextResponse.json({ message: 'No content' }, { status: 403 })

  const prod = productManager.getEntityById(Number(body.id))
  if (!prod) return NextResponse.json({ message: 'Product not found' }, { status: 404 })

  prod.addImage(body.media)
  return NextResponse.json({})
}
