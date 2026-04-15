import { NextResponse } from 'next/server'
import fs from 'fs'
import { CURRENT_DIR, RENDER_OUT_DIR } from '@/lib/paths'

export async function POST() {
  try {
    if (fs.existsSync(CURRENT_DIR)) {
      fs.rmSync(CURRENT_DIR, { recursive: true, force: true })
    }
    if (fs.existsSync(RENDER_OUT_DIR)) {
      fs.rmSync(RENDER_OUT_DIR, { recursive: true, force: true })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
