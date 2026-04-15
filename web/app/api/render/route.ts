import { NextResponse } from 'next/server'
import { spawnJob, DuplicateJobError, getJobByType } from '@/lib/process-manager'
import { REMOTION_ROOT, OUTPUT_VIDEO_PATH } from '@/lib/paths'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const jobId = spawnJob('render', {
      cmd: 'npx',
      args: ['remotion', 'render', 'PresentationPlayer', OUTPUT_VIDEO_PATH, '--concurrency=4'],
      cwd: REMOTION_ROOT,
      shell: true,
    })
    return NextResponse.json({ jobId })
  } catch (err) {
    if (err instanceof DuplicateJobError) {
      return NextResponse.json({ error: 'already_running', jobId: err.existingJobId }, { status: 409 })
    }
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  const job = getJobByType('render')
  if (!job) {
    return NextResponse.json({ job: null })
  }
  return NextResponse.json({ job })
}
