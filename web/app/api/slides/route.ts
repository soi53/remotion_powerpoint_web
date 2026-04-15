import { NextResponse } from 'next/server'
import fs from 'fs'
import { SLIDES_DIR, hasCurrentProject } from '@/lib/paths'

export interface SlideUrl {
  id: string
  url: string
}

/**
 * GET /api/slides
 * Returns a list of slide PNG URLs served via /api/static/current/slides/
 */
export async function GET() {
  if (!hasCurrentProject()) {
    return NextResponse.json({ error: 'No project loaded. Upload a PPTX first.' }, { status: 404 })
  }

  if (!fs.existsSync(SLIDES_DIR)) {
    return NextResponse.json({ slides: [] })
  }

  const files = fs
    .readdirSync(SLIDES_DIR)
    .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort((a, b) => {
      // Natural sort: slide1.png, slide2.png, ..., slide10.png
      const numA = extractNumber(a)
      const numB = extractNumber(b)
      if (numA !== null && numB !== null) return numA - numB
      return a.localeCompare(b)
    })

  const slides: SlideUrl[] = files.map(filename => ({
    id: filename.replace(/\.[^.]+$/, ''), // strip extension
    url: `/api/static/current/slides/${filename}`,
  }))

  return NextResponse.json({ slides })
}

function extractNumber(filename: string): number | null {
  const match = filename.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}
