import { NextResponse } from 'next/server'
import { spawnJob, DuplicateJobError } from '@/lib/process-manager'
import { GENERATE_VOICEOVER_SCRIPT, REMOTION_ROOT, readRemotionEnv } from '@/lib/paths'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: { voiceId?: string; force?: boolean; retryFailed?: boolean } = {}
  try {
    body = await req.json()
  } catch { /* no body */ }

  const env = readRemotionEnv()
  if (!env['ELEVENLABS_API_KEY']) {
    return NextResponse.json({ error: 'ELEVENLABS_API_KEY not set in remotion_powerpoint/.env' }, { status: 500 })
  }

  const args: string[] = []
  if (body.force) args.push('--force')
  if (body.retryFailed) args.push('--retry-failed')
  if (body.voiceId) args.push('--voice-id', body.voiceId)

  try {
    const jobId = spawnJob('voiceover', {
      cmd: 'node',
      args: [GENERATE_VOICEOVER_SCRIPT, ...args],
      cwd: REMOTION_ROOT,
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
