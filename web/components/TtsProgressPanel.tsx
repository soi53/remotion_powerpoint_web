'use client'

import { useEffect, useRef, useState } from 'react'

export type SlideStatus = 'idle' | 'generating' | 'saved' | 'failed' | 'skipped'

export interface SlideProgress {
  slideId: string
  status: SlideStatus
}

interface SummaryEvent {
  generated: number
  skipped: number
  failed: number
}

type JobPhase = 'idle' | 'running' | 'done' | 'failed'

interface TtsProgressPanelProps {
  jobId: string | null
  slides: { id: string }[]
  onDone?: (status: 'done' | 'failed') => void
}

export default function TtsProgressPanel({ jobId, slides, onDone }: TtsProgressPanelProps) {
  const [phase, setPhase] = useState<JobPhase>('idle')
  const [slideStatuses, setSlideStatuses] = useState<Record<string, SlideStatus>>({})
  const [currentSlideId, setCurrentSlideId] = useState<string | null>(null)
  const [summary, setSummary] = useState<SummaryEvent | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const esRef = useRef<EventSource | null>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!jobId) return

    setPhase('running')
    setSlideStatuses({})
    setCurrentSlideId(null)
    setSummary(null)
    setLogs([])

    const es = new EventSource(`/api/voiceover/stream?jobId=${jobId}`)
    esRef.current = es

    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as {
        type: string
        slideId?: string | null
        status?: string
        generated?: number
        skipped?: number
        failed?: number
        line?: string
      }

      if (data.line) {
        setLogs(prev => [...prev, data.line!])
      }

      if (data.type === 'progress') {
        if (data.slideId) {
          setCurrentSlideId(data.slideId)
          if (data.status === 'generating') {
            setSlideStatuses(prev => ({ ...prev, [data.slideId!]: 'generating' }))
          } else if (data.status === 'failed') {
            setSlideStatuses(prev => ({ ...prev, [data.slideId!]: 'failed' }))
          } else if (data.status === 'skipped') {
            setSlideStatuses(prev => ({ ...prev, [data.slideId!]: 'skipped' }))
          }
        } else if (data.status === 'saved' && currentSlideId) {
          setSlideStatuses(prev => ({ ...prev, [currentSlideId]: 'saved' }))
        }
      }

      if (data.type === 'summary') {
        setSummary({ generated: data.generated ?? 0, skipped: data.skipped ?? 0, failed: data.failed ?? 0 })
      }
    }

    es.addEventListener('done', (e) => {
      const { status } = JSON.parse((e as MessageEvent).data) as { status: string }
      const finalPhase = status === 'done' ? 'done' : 'failed'
      setPhase(finalPhase)
      es.close()
      esRef.current = null
      onDone?.(finalPhase)
    })

    es.onerror = () => {
      setPhase('failed')
      es.close()
      esRef.current = null
      onDone?.('failed')
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

  // Sync initial slide statuses from audio-status.json is done server-side;
  // here we simply initialize all to 'idle' when slides change.
  useEffect(() => {
    setSlideStatuses({})
    setCurrentSlideId(null)
  }, [slides])

  const completedCount = Object.values(slideStatuses).filter(s => s === 'saved').length
  const totalNarrated = slides.length

  function statusIcon(status: SlideStatus) {
    switch (status) {
      case 'generating': return <span className="text-blue-500 animate-pulse">...</span>
      case 'saved': return <span className="text-green-500">✓</span>
      case 'failed': return <span className="text-red-500">✗</span>
      case 'skipped': return <span className="text-gray-400">–</span>
      default: return <span className="text-gray-300">·</span>
    }
  }

  function statusBg(status: SlideStatus) {
    switch (status) {
      case 'generating': return 'bg-blue-50 border-blue-300'
      case 'saved': return 'bg-green-50 border-green-300'
      case 'failed': return 'bg-red-50 border-red-300'
      case 'skipped': return 'bg-gray-50 border-gray-200'
      default: return 'bg-white border-gray-200'
    }
  }

  if (phase === 'idle' && !jobId) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center gap-3">
        {phase === 'running' && (
          <div className="flex items-center gap-2 text-blue-600 text-sm">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            TTS 생성 중...
          </div>
        )}
        {phase === 'done' && (
          <div className="text-green-600 text-sm font-medium">완료! {completedCount}개 생성됨</div>
        )}
        {phase === 'failed' && (
          <div className="text-red-600 text-sm font-medium">오류 발생</div>
        )}
        {(phase === 'running' || phase === 'done') && (
          <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${totalNarrated ? (completedCount / totalNarrated) * 100 : 0}%` }}
            />
          </div>
        )}
        {summary && (
          <span className="text-xs text-gray-500">
            생성 {summary.generated} | 건너뜀 {summary.skipped} | 실패 {summary.failed}
          </span>
        )}
      </div>

      {/* Slide grid status */}
      <div className="flex flex-wrap gap-1.5">
        {slides.map(slide => {
          const st: SlideStatus = slideStatuses[slide.id] ?? 'idle'
          return (
            <div
              key={slide.id}
              title={`${slide.id}: ${st}`}
              className={`flex items-center gap-1 px-2 py-0.5 border rounded text-xs font-mono ${statusBg(st)}`}
            >
              {statusIcon(st)}
              <span className="text-gray-600">{slide.id.replace('slide-', '')}</span>
            </div>
          )
        })}
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
