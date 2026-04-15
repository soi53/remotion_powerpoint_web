import { NextResponse } from 'next/server'
import { getJobByType } from '@/lib/process-manager'
import net from 'net'

export const dynamic = 'force-dynamic'

const STUDIO_PORT = 3001

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const timeout = 800
    socket.setTimeout(timeout)
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => { socket.destroy(); resolve(false) })
    socket.once('timeout', () => { socket.destroy(); resolve(false) })
    socket.connect(port, '127.0.0.1')
  })
}

export async function GET() {
  const job = getJobByType('studio')
  const portOpen = await isPortListening(STUDIO_PORT)

  return NextResponse.json({
    port: STUDIO_PORT,
    running: portOpen,
    jobId: job?.id ?? null,
    status: job?.status ?? null,
  })
}
