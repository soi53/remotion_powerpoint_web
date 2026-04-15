import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { PUBLIC_DIR } from '@/lib/paths'

const CONTENT_TYPES: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3':  'audio/mpeg',
  '.mp4':  'video/mp4',
  '.json': 'application/json',
  '.webp': 'image/webp',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params

  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: 'No path provided' }, { status: 400 })
  }

  for (const seg of segments) {
    if (seg === '..' || seg === '.' || seg.includes('\\') || seg.includes('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
  }

  const filePath = path.join(PUBLIC_DIR, ...segments)
  const resolved = path.resolve(filePath)
  const resolvedPublic = path.resolve(PUBLIC_DIR)

  if (!resolved.startsWith(resolvedPublic + path.sep) && resolved !== resolvedPublic) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const ext = path.extname(resolved).toLowerCase()
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

  const nodeStream = fs.createReadStream(resolved)

  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer | string) => {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
        controller.enqueue(new Uint8Array(buf))
      })
      nodeStream.on('end', () => controller.close())
      nodeStream.on('error', (err) => controller.error(err))
    },
    cancel() {
      nodeStream.destroy()
    },
  })

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600, immutable',
      'Access-Control-Allow-Origin': 'http://localhost:3001',
    },
  })
}
