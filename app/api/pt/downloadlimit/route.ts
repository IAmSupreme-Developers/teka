import { NextResponse } from 'next/server'
import { downloadTracker, BASE64_DOWNLOAD_LIMIT } from '@/lib/downloadTracker'

export async function GET() {
  return NextResponse.json({
    active: downloadTracker.active,
    limit: BASE64_DOWNLOAD_LIMIT,
    available: downloadTracker.available(),
  })
}
