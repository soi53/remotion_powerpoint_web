import { NextResponse } from 'next/server'
import fs from 'fs'
import { AUDIO_STATUS_PATH } from '@/lib/paths'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!fs.existsSync(AUDIO_STATUS_PATH)) {
    return NextResponse.json({})
  }
  try {
    const raw = fs.readFileSync(AUDIO_STATUS_PATH, 'utf-8')
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json({})
  }
}
