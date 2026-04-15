import { NextResponse } from 'next/server'
import { readConfig, writeConfig } from '@/lib/config'
import { hasCurrentProject } from '@/lib/paths'

export async function GET() {
  if (!hasCurrentProject()) {
    return NextResponse.json({ error: 'NO_PROJECT' }, { status: 404 })
  }

  const config = readConfig()
  if (!config) {
    return NextResponse.json({ error: 'NO_PROJECT' }, { status: 404 })
  }

  return NextResponse.json(config)
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()

    if (!body?.slides || !Array.isArray(body.slides)) {
      return NextResponse.json({ error: 'Invalid config: missing slides array' }, { status: 400 })
    }

    writeConfig(body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
