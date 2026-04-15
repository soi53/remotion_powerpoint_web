'use client'

import { useEffect, useRef, useState } from 'react'

type JobPhase = 'idle' | 'running' | 'done' | 'failed'

interface RenderProgressPanelProps {
  jobId: string | null
  onComplete: () => void
}

export default function RenderProgressPanel({ jobId, onComplete }: RenderProgressPanelProps) {
  const [phase, setPhase] = useState<JobPhase>('idle')
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(0)
  const [percent, setPercent] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const esRef = useRef<EventSource | null>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!jobId) return

    setPhase('running')
    setCurrent(0)
    setTotal(0)
    setPercent(0)
    setLogs([])

    const es = new EventSource(`/api/render/stream?jobId=${jobId}`)
    esRef.current = es

    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as {
        type: string
        current?: number
        total?: number
        percent?: number
        line?: string
      }

      if (data.line) {
        setLogs(prev => [...prev, data.line!])
      }

      if (data.type === 'progress') {
        if (data.current !== undefined) setCurrent(data.current)
        if (data.total !== undefined) setTotal(data.total)
        if (data.percent !== undefined) setPercent(data.percent)
      }
    }

    es.addEventListener('done', (e) => {
      const { status } = JSON.parse((e as MessageEvent).data) as { status: string }
      const finalPhase = status === 'done' ? 'done' : 'failed'
      setPhase(finalPhase)
      es.close()
      esRef.current = null
      if (finalPhase === 'done') {
        onComplete()
      }
    })

    es.onerror = () => {
      setPhase('failed')
      es.close()
      esRef.current = null
    }

    return () => {
      es.close()
      esRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  if (phase === 'idle' && !jobId) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Status header */}
      <div className="flex items-center gap-3">
        {phase === 'running' && (
          <div className="flex items-center gap-2 text-blue-600 text-sm">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            렌더링 중...
          </div>
        )}
        {phase === 'done' && (
          <div className="text-green-600 text-sm font-medium">렌더링 완료!</div>
        )}
        {phase === 'failed' && (
          <div className="text-red-600 text-sm font-medium">렌더링 실패</div>
        )}

        {/* Progress bar */}
        {(phase === 'running' || phase === 'done') && (
          <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        {/* Frame count */}
        {total > 0 && (
          <span className="text-xs text-gray-500 shrink-0">
            {current}/{total} 프레임 ({percent}%)
          </span>
        )}
      </div>

      {/* Log tail */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-xs text-gray-300 leading-5">
          {logs.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  )
}
