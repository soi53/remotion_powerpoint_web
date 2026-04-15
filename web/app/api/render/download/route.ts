import { NextResponse } from 'next/server'
import fs from 'fs'
import { OUTPUT_VIDEO_PATH } from '@/lib/paths'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!fs.existsSync(OUTPUT_VIDEO_PATH)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  try {
    const stat = fs.statSync(OUTPUT_VIDEO_PATH)
    const fileBuffer = fs.readFileSync(OUTPUT_VIDEO_PATH)

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="presentation.mp4"',
        'Content-Length': String(stat.size),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
