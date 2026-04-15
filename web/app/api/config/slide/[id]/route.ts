import { NextResponse } from 'next/server'
import { patchSlide } from '@/lib/config'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const patch = await req.json()

    const updated = patchSlide(id, patch)
    return NextResponse.json({ ok: true, slide: updated.slides.find(s => s.id === id) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg.includes('not found') || msg.includes('No slide-config') ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
