import { NextResponse } from 'next/server'
import { spawnJob, DuplicateJobError } from '@/lib/process-manager'
import { REMOTION_ROOT } from '@/lib/paths'
import net from 'net'

export const dynamic = 'force-dynamic'

const STUDIO_PORT = 3001

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(800)
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => { socket.destroy(); resolve(false) })
    socket.once('timeout', () => { socket.destroy(); resolve(false) })
    socket.connect(port, '127.0.0.1')
  })
}

export async function POST() {
  // If Studio is already serving on port 3001, return early
  const alreadyUp = await isPortListening(STUDIO_PORT)
  if (alreadyUp) {
    return NextResponse.json({ port: STUDIO_PORT, jobId: null, alreadyRunning: true })
  }

  try {
    const jobId = spawnJob('studio', {
      cmd: 'npm',
      args: ['run', 'dev', '--', '--port', String(STUDIO_PORT)],
      cwd: REMOTION_ROOT,
      shell: true,
    })
    return NextResponse.json({ port: STUDIO_PORT, jobId, alreadyRunning: false })
  } catch (err) {
    if (err instanceof DuplicateJobError) {
      // Process was already spawned (running state) — treat as already running
      return NextResponse.json({ port: STUDIO_PORT, jobId: err.existingJobId, alreadyRunning: true })
    }
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
