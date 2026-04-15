import { NextResponse } from 'next/server'
import { readRemotionEnv } from '@/lib/paths'

export const dynamic = 'force-dynamic'

export interface ElevenLabsVoice {
  voice_id: string
  name: string
  category: string
  labels: Record<string, string>
  preview_url: string | null
}

export async function GET() {
  const env = readRemotionEnv()
  const apiKey = env['ELEVENLABS_API_KEY']
  if (!apiKey) {
    return NextResponse.json({ error: 'ELEVENLABS_API_KEY not set in remotion_powerpoint/.env' }, { status: 500 })
  }

  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `ElevenLabs API error: ${res.status} ${text}` }, { status: res.status })
  }

  const data = await res.json()
  const voices: ElevenLabsVoice[] = (data.voices ?? []).map((v: ElevenLabsVoice) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
    labels: v.labels ?? {},
    preview_url: v.preview_url ?? null,
  }))

  return NextResponse.json({ voices })
}
