import { NextResponse } from 'next/server'
import { readRemotionEnv } from '@/lib/paths'

export async function POST(req: Request) {
  try {
    const { narrations, targetLanguage } = await req.json() as {
      narrations: string[]
      targetLanguage: string
    }

    if (!Array.isArray(narrations) || narrations.length === 0) {
      return NextResponse.json({ error: 'narrations must be a non-empty array' }, { status: 400 })
    }
    if (!targetLanguage) {
      return NextResponse.json({ error: 'targetLanguage is required' }, { status: 400 })
    }

    const env = readRemotionEnv()
    const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    const systemPrompt = `You are a professional translator. Translate each narration to ${targetLanguage}.
Return a JSON array of translated strings in the same order as the input.
Preserve the meaning and tone. Only return the JSON array, no other text.`

    const userContent = JSON.stringify(narrations)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 502 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    let translated: string[]
    try {
      // Strip markdown code fences if GPT wraps the response (e.g. ```json ... ```)
      const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      translated = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Failed to parse GPT response as JSON', raw: content }, { status: 502 })
    }

    if (!Array.isArray(translated) || translated.length !== narrations.length) {
      return NextResponse.json({
        error: 'Translation count mismatch',
        expected: narrations.length,
        got: translated.length,
      }, { status: 502 })
    }

    return NextResponse.json({ narrations: translated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
