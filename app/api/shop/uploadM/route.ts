import { NextRequest, NextResponse } from 'next/server'
import { mediaManager } from '@/lib/shopState'
import { Base64Slices } from '@/lib/models'

const pending: Record<string, Base64Slices> = {}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body) return NextResponse.json({ message: 'No content' }, { status: 403 })

  const { name, current, total, string: str } = body

  if (mediaManager.entitiesMap[name]) {
    if (pending[name]) { pending[name].reset({ total: undefined }); delete pending[name] }
    return NextResponse.json({ code: 200, message: 'Image with same name present', medianame: name }, { status: 400 })
  }

  let result
  if (!pending[name]) {
    pending[name] = new Base64Slices({ name, current, total, string: str, mediaM: mediaManager })
    result = pending[name].returnInfo()
  } else {
    result = pending[name].addSlice({ current, total, string: str })
    if (result.next === result.total + 1) { pending[name].reset({ total: undefined }); delete pending[name] }
  }

  return NextResponse.json({ value: result })
}
