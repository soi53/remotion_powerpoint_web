import { NextRequest, NextResponse } from 'next/server'
import { readConfig, writeConfig } from '@/lib/config'

/**
 * POST /api/upload-script
 * Accepts a .txt file with narration sections tagged as [1], [2], etc.
 * Parses each section and updates the corresponding slide's narration field.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided (field: "file")' }, { status: 400 })
  }

  const text = await file.text()
  const narrations = parseScriptFile(text)

  if (narrations.length === 0) {
    return NextResponse.json(
      { error: 'No sections found. Use [1], [2], ... tags to mark each slide narration.' },
      { status: 400 }
    )
  }

  const config = readConfig()
  if (!config) {
    return NextResponse.json(
      { error: 'No slide-config.json found. Upload a PPTX first.' },
      { status: 404 }
    )
  }

  const slideCount = config.slides.length
  const warnings: string[] = []

  if (narrations.length !== slideCount) {
    warnings.push(
      `스크립트 섹션 수(${narrations.length})와 슬라이드 수(${slideCount})가 다릅니다. ` +
      `앞부터 ${Math.min(narrations.length, slideCount)}개 슬라이드에 적용됩니다.`
    )
  }

  const applyCount = Math.min(narrations.length, slideCount)
  for (let i = 0; i < applyCount; i++) {
    config.slides[i].narration = narrations[i]
  }

  writeConfig(config)

  return NextResponse.json({
    applied: applyCount,
    slideCount,
    sectionCount: narrations.length,
    warnings: warnings.length > 0 ? warnings : undefined,
  })
}

/**
 * Parse a script file using [N] section tags.
 * Each tag marks the start of a new section.
 * Returns an array of narration strings (index 0 = slide 1).
 */
function parseScriptFile(text: string): string[] {
  // Split on [N] tags - support [1], [2], [10], etc.
  const tagRegex = /\[(\d+)\]/g
  const parts: { index: number; start: number }[] = []

  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(text)) !== null) {
    parts.push({ index: parseInt(match[1], 10), start: match.index + match[0].length })
  }

  if (parts.length === 0) return []

  // Sort by the [N] number (not by position) to handle out-of-order files
  parts.sort((a, b) => a.index - b.index)

  const narrations: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const start = parts[i].start
    // Find end: position of the NEXT tag in the original text
    // Re-scan to get the next tag's position after this one
    const nextTagMatch = findNextTag(text, start)
    const end = nextTagMatch !== null ? nextTagMatch : text.length
    const content = text.slice(start, end).trim()
    narrations[parts[i].index - 1] = content
  }

  // Fill any gaps with empty string (sparse array → dense)
  const maxIndex = Math.max(...parts.map(p => p.index))
  const result: string[] = []
  for (let i = 1; i <= maxIndex; i++) {
    result.push(narrations[i - 1] ?? '')
  }

  return result
}

function findNextTag(text: string, fromPos: number): number | null {
  const tagRegex = /\[\d+\]/g
  tagRegex.lastIndex = fromPos
  const match = tagRegex.exec(text)
  return match ? match.index : null
}
