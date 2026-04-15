'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SlideConfig } from '@/lib/config'
import VoiceSelector, { DEFAULT_VOICE_ID } from '@/components/VoiceSelector'
import TtsProgressPanel from '@/components/TtsProgressPanel'

type LoadState = 'loading' | 'ready' | 'error'

// Status map from audio-status.json: { "slide-01": "ok" | "failed" | "skipped" }
type AudioStatusMap = Record<string, 'ok' | 'failed' | 'skipped'>

export default function VoiceoverPage() {
  const router = useRouter()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [config, setConfig] = useState<SlideConfig | null>(null)
  const [audioStatus, setAudioStatus] = useState<AudioStatusMap>({})

  // Controls
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID)
  const [force, setForce] = useState(false)
  const [retryFailed, setRetryFailed] = useState(false)

  // Job state
  const [jobId, setJobId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [jobError, setJobError] = useState<string | null>(null)
  const [donePhase, setDonePhase] = useState<'done' | 'failed' | null>(null)

  // Load config + audio-status
  useEffect(() => {
    async function load() {
      const [configRes, statusRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/audio-status'),
      ])

      if (configRes.status === 404) {
        setLoadState('error')
        setLoadError('업로드된 프로젝트가 없습니다. 먼저 PPTX를 업로드하세요.')
        return
      }
      if (!configRes.ok) {
        setLoadState('error')
        setLoadError(`설정을 불러오지 못했습니다. (${configRes.status})`)
        return
      }

      const data: SlideConfig = await configRes.json()
      setConfig(data)

      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setAudioStatus(statusData ?? {})
      }

      setLoadState('ready')
    }
    load()
  }, [])

  async function handleStart() {
    setJobError(null)
    setDonePhase(null)
    setIsRunning(true)

    const res = await fetch('/api/voiceover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceId, force, retryFailed }),
    })
    const data = await res.json()

    if (res.status === 409) {
      // Already running — attach to existing job
      setJobId(data.jobId)
      return
    }
    if (!res.ok) {
      setJobError(data.error ?? 'TTS 생성을 시작하지 못했습니다.')
      setIsRunning(false)
      return
    }

    setJobId(data.jobId)
  }

  function handleDone(status: 'done' | 'failed') {
    setIsRunning(false)
    setDonePhase(status)
    // Reload audio-status after job finishes
    fetch('/api/audio-status')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAudioStatus(d) })
  }

  // Summary counts from audio-status
  const okCount = Object.values(audioStatus).filter(s => s === 'ok').length
  const failedCount = Object.values(audioStatus).filter(s => s === 'failed').length
  const totalSlides = config?.slides.length ?? 0
  const narrSlides = config?.slides.filter(s => s.narration?.trim()).length ?? 0

  // ── Render ──────────────────────────────────────────────────────────

  if (loadState === 'loading') {
    return (
      <main className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-sm">불러오는 중...</div>
      </main>
    )
  }

  if (loadState === 'error') {
    return (
      <main className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-600 text-sm">{loadError}</p>
        <button
          onClick={() => router.push('/editor/upload')}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          업로드 페이지로 이동
        </button>
      </main>
    )
  }

  const slides = config?.slides ?? []

  return (
    <main className="flex flex-col h-full">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-900">TTS 생성</h1>
          <span className="text-sm text-gray-500">
            슬라이드 {totalSlides}장 중 나레이션 있음 {narrSlides}장
          </span>
          {okCount > 0 && (
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
              {okCount}개 완료됨
            </span>
          )}
          {failedCount > 0 && (
            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
              {failedCount}개 실패
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/editor/narration')}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← 나레이션
          </button>
          <button
            onClick={() => router.push('/editor/preview')}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            다음: 프리뷰 →
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full">
        {/* Controls card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800">설정</h2>

          {/* Voice selector */}
          <div className="flex items-center gap-4">
            <VoiceSelector
              value={voiceId}
              onChange={setVoiceId}
              disabled={isRunning}
            />
          </div>

          {/* Options */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={force}
                onChange={e => setForce(e.target.checked)}
                disabled={isRunning}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">--force (기존 파일 덮어쓰기)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={retryFailed}
                onChange={e => setRetryFailed(e.target.checked)}
                disabled={isRunning}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">--retry-failed (실패 항목만 재시도)</span>
            </label>
          </div>

          {/* Start button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleStart}
              disabled={isRunning || narrSlides === 0}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? 'TTS 생성 중...' : 'TTS 생성 시작'}
            </button>

            {donePhase === 'done' && (
              <span className="text-sm text-green-600 font-medium">완료!</span>
            )}
            {donePhase === 'failed' && (
              <span className="text-sm text-red-600">오류 발생. 로그를 확인하세요.</span>
            )}
            {jobError && (
              <span className="text-sm text-red-600">{jobError}</span>
            )}
          </div>
        </div>

        {/* Progress panel */}
        {jobId && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">진행 상황</h2>
            <TtsProgressPanel
              jobId={jobId}
              slides={slides}
              onDone={handleDone}
            />
          </div>
        )}

        {/* Existing audio status (when no job running) */}
        {!jobId && okCount > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-3">기존 생성 상태</h2>
            <div className="flex flex-wrap gap-1.5">
              {slides.map(slide => {
                const st = audioStatus[slide.id]
                const label = st === 'ok' ? '✓' : st === 'failed' ? '✗' : st === 'skipped' ? '–' : '·'
                const cls =
                  st === 'ok' ? 'bg-green-50 border-green-300 text-green-700' :
                  st === 'failed' ? 'bg-red-50 border-red-300 text-red-600' :
                  'bg-gray-50 border-gray-200 text-gray-500'
                return (
                  <div
                    key={slide.id}
                    title={`${slide.id}: ${st ?? 'not generated'}`}
                    className={`flex items-center gap-1 px-2 py-0.5 border rounded text-xs font-mono ${cls}`}
                  >
                    {label} {slide.id.replace('slide-', '')}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
