'use client'

import { useState, useEffect, useRef } from 'react'

type StudioPhase = 'idle' | 'starting' | 'ready' | 'failed'

interface RemotionPreviewProps {
  /** Auto-start Studio on mount (default: false) */
  autoStart?: boolean
}

const STUDIO_PORT = 3001
const POLL_INTERVAL_MS = 2000
const MAX_WAIT_MS = 60_000

export default function RemotionPreview({ autoStart = false }: RemotionPreviewProps) {
  const [phase, setPhase] = useState<StudioPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef<number>(0)

  // On mount: check if Studio is already running
  useEffect(() => {
    fetch('/api/studio/status')
      .then(r => r.json())
      .then(data => {
        if (data.running) {
          setPhase('ready')
        } else if (autoStart) {
          startStudio()
        }
      })
      .catch(() => { if (autoStart) startStudio() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll until Studio responds on :3001
  function startPolling() {
    startedAtRef.current = Date.now()
    pollRef.current = setInterval(async () => {
      const elapsed = Date.now() - startedAtRef.current
      if (elapsed > MAX_WAIT_MS) {
        clearInterval(pollRef.current!)
        setPhase('failed')
        setError(`${MAX_WAIT_MS / 1000}초 내 Remotion Studio가 응답하지 않습니다.`)
        return
      }
      try {
        const res = await fetch(`http://localhost:${STUDIO_PORT}`, { mode: 'no-cors' })
        // no-cors: opaque response means it's up
        void res
        clearInterval(pollRef.current!)
        setPhase('ready')
        setIframeKey(k => k + 1)
      } catch {
        // still starting — keep polling
      }
    }, POLL_INTERVAL_MS)
  }

  async function startStudio() {
    setPhase('starting')
    setError(null)
    try {
      const res = await fetch('/api/studio/start', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setPhase('failed')
        setError(data.error ?? 'Studio 시작에 실패했습니다.')
        return
      }
      if (data.alreadyRunning) {
        setPhase('ready')
        setIframeKey(k => k + 1)
        return
      }
      // Newly spawned — poll until ready
      startPolling()
    } catch (err) {
      setPhase('failed')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const studioUrl = `http://localhost:${STUDIO_PORT}`

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Control bar */}
      <div className="flex items-center gap-3 shrink-0">
        {phase === 'idle' && (
          <button
            onClick={startStudio}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Launch Remotion Studio
          </button>
        )}

        {phase === 'starting' && (
          <div className="flex items-center gap-2 text-blue-600 text-sm">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Remotion Studio 시작 중... (최대 {MAX_WAIT_MS / 1000}초)
          </div>
        )}

        {phase === 'ready' && (
          <>
            <span className="text-sm text-green-600 font-medium">Remotion Studio 실행 중</span>
            <a
              href={studioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-blue-600 underline"
            >
              {studioUrl} 새 탭으로 열기
            </a>
            <button
              onClick={() => setIframeKey(k => k + 1)}
              className="ml-auto px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              새로고침
            </button>
          </>
        )}

        {phase === 'failed' && (
          <>
            <span className="text-sm text-red-600">{error}</span>
            <button
              onClick={startStudio}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              다시 시도
            </button>
          </>
        )}
      </div>

      {/* Open in new tab — iframe is blocked by Remotion Studio's X-Frame-Options */}
      {phase === 'ready' && (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-green-300 gap-4">
          <div className="text-5xl">🎬</div>
          <p className="text-sm font-medium text-gray-700">Remotion Studio가 실행 중입니다</p>
          <p className="text-xs text-gray-400">보안 정책으로 인해 iframe 임베딩이 차단됩니다. 새 탭에서 열어주세요.</p>
          <a
            href={studioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Remotion Studio 열기 →
          </a>
          <span className="text-xs text-gray-400">{studioUrl}</span>
        </div>
      )}

      {phase === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400 gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">위의 버튼을 눌러 Remotion Studio를 시작하세요</p>
        </div>
      )}

      {phase === 'starting' && (
        <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <div className="text-sm text-gray-400">Remotion Studio 준비 중...</div>
        </div>
      )}
    </div>
  )
}
