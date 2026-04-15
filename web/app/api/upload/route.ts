import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { CURRENT_DIR, PPTX_TO_SLIDES_SCRIPT, REMOTION_ROOT, hasCurrentProject } from '@/lib/paths'
import { spawnJob, DuplicateJobError } from '@/lib/process-manager'

const UPLOAD_PPTX_PATH = path.join(CURRENT_DIR, 'upload.pptx')

export async function POST(req: NextRequest) {
  // Check if project already exists (for overwrite warning)
  const overwrite = req.headers.get('x-overwrite-confirm') === 'true'
  if (hasCurrentProject() && !overwrite) {
    return NextResponse.json(
      { error: 'PROJECT_EXISTS', message: '현재 작업 중인 프로젝트가 있습니다. 계속하면 덮어써집니다.' },
      { status: 409 }
    )
  }

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

  if (!file.name.toLowerCase().endsWith('.pptx')) {
    return NextResponse.json({ error: 'Only .pptx files are supported' }, { status: 400 })
  }

  // Write uploaded file to disk
  fs.mkdirSync(CURRENT_DIR, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(UPLOAD_PPTX_PATH, buffer)

  // Spawn pptx-to-slides.mjs
  let jobId: string
  try {
    jobId = spawnJob('upload', {
      cmd: 'node',
      args: [PPTX_TO_SLIDES_SCRIPT, UPLOAD_PPTX_PATH],
      cwd: REMOTION_ROOT,
    })
  } catch (err) {
    if (err instanceof DuplicateJobError) {
      return NextResponse.json(
        { error: 'DUPLICATE_JOB', jobId: err.existingJobId },
        { status: 409 }
      )
    }
    throw err
  }

  return NextResponse.json({ jobId })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  // SSE stream for upload progress
  const { subscribeToJob } = await import('@/lib/process-manager')

  const stream = new ReadableStream({
    start(controller) {
      const enc = (data: object) =>
        new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)

      subscribeToJob(
        jobId,
        (line) => {
          controller.enqueue(enc({ type: 'log', line }))
        },
        (status) => {
          controller.enqueue(enc({ type: 'done', status }))
          controller.close()
        }
      )
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
