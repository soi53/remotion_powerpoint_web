import { subscribeToJob } from '@/lib/process-manager'

export const dynamic = 'force-dynamic'

// Parse a stdout line from generate-presentation-voiceover.mjs into a structured event.
// Examples:
//   "🎙️  [slide-01] 생성 중..."       → { type: 'progress', slideId: 'slide-01', status: 'generating' }
//   "   ✅ 저장: public/current/..."    → { type: 'progress', slideId: null, status: 'saved' }
//   "   ❌ 실패 [slide-02]: ..."        → { type: 'progress', slideId: 'slide-02', status: 'failed' }
//   "⏭️  [slide-03] 건너뜀 ..."        → { type: 'progress', slideId: 'slide-03', status: 'skipped' }
//   "생성: 3장 | 건너뜀: 0장 | 실패: 0장"  → { type: 'summary', ... }
function parseLine(line: string): object {
  // Generating
  const genMatch = line.match(/\[(.+?)\]\s*생성\s*중/)
  if (genMatch) {
    return { type: 'progress', slideId: genMatch[1], status: 'generating', line }
  }
  // Saved (✅)
  if (line.includes('✅') && line.includes('저장')) {
    return { type: 'progress', slideId: null, status: 'saved', line }
  }
  // Failed (❌)
  const failMatch = line.match(/❌\s*실패\s*\[(.+?)\]/)
  if (failMatch) {
    return { type: 'progress', slideId: failMatch[1], status: 'failed', line }
  }
  // Skipped (⏭️)
  const skipMatch = line.match(/\[(.+?)\]\s*건너뜀/)
  if (skipMatch) {
    return { type: 'progress', slideId: skipMatch[1], status: 'skipped', line }
  }
  // Summary line
  const summaryMatch = line.match(/생성:\s*(\d+)장.*건너뜀:\s*(\d+)장.*실패:\s*(\d+)장/)
  if (summaryMatch) {
    return {
      type: 'summary',
      generated: parseInt(summaryMatch[1], 10),
      skipped: parseInt(summaryMatch[2], 10),
      failed: parseInt(summaryMatch[3], 10),
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
