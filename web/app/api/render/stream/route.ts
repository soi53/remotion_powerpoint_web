import { subscribeToJob } from '@/lib/process-manager'

export const dynamic = 'force-dynamic'

// Parse a stdout line from Remotion CLI into a structured event.
// Examples:
//   "Rendering composition PresentationPlayer..."  → { type: 'start' }
//   "Rendered 12/120 frames"                       → { type: 'progress', current: 12, total: 120, percent: 10 }
function parseLine(line: string): object {
  // Rendering composition start
  if (line.includes('Rendering composition')) {
    return { type: 'start', line }
  }

  // Frame progress: "Rendered X/Y frames"
  const frameMatch = line.match(/Rendered\s+(\d+)\/(\d+)\s+frames/)
  if (frameMatch) {
    const current = parseInt(frameMatch[1], 10)
    const total = parseInt(frameMatch[2], 10)
    return {
      type: 'progress',
      current,
      total,
      percent: Math.round((current / total) * 100),
      line,
    }
  }

  return { type: 'log', line }
}

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get('jobId')
  if (!jobId) {
    return new Response('missing jobId', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      function enqueue(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      subscribeToJob(
        jobId,
        (line) => enqueue(parseLine(line)),
        (status) => {
          controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ status })}\n\n`))
          controller.close()
        },
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
