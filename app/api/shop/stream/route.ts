import { NextRequest, NextResponse } from 'next/server'
import { mediaManager } from '@/lib/shopState'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const media = searchParams.get('media')
  if (!media) return NextResponse.json({ message: 'media required' }, { status: 400 })

  const nodeStream = mediaManager.stream(media)
  if (!nodeStream) return NextResponse.json({ message: 'Media not found' }, { status: 404 })

  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', chunk => controller.enqueue(chunk))
      nodeStream.on('end', () => controller.close())
      nodeStream.on('error', err => controller.error(err))
    },
  })

  return new NextResponse(webStream, {
    headers: { 'Content-Type': 'application/octet-stream' },
  })
}
