'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RenderProgressPanel from '@/components/RenderProgressPanel'

export default function RenderPage() {
  const router = useRouter()

  const [jobId, setJobId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [jobError, setJobError] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)

  async function handleStart() {
    setJobError(null)
    setIsDone(false)
    setIsRunning(true)

    const res = await fetch('/api/render', { method: 'POST' })
    const data = await res.json()

    if (res.status === 409) {
      // Already running — attach to existing job
      setJobId(data.jobId)
      return
    }
    if (!res.ok) {
      setJobError(data.error ?? '렌더를 시작하지 못했습니다.')
      setIsRunning(false)
      return
    }

    setJobId(data.jobId)
  }

  function handleComplete() {
    setIsRunning(false)
    setIsDone(true)
  }

  return (
    <main className="flex flex-col h-full">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-900">렌더 &amp; 다운로드</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/editor/preview')}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← 프리뷰
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full">
        {/* Controls card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800">MP4 렌더</h2>
          <p className="text-sm text-gray-500">
            Remotion으로 프레젠테이션을 MP4 파일로 렌더링합니다. 슬라이드 수에 따라 수 분이 소요될 수 있습니다.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-gray-400">💾 저장 경로:</span>
            <code className="text-gray-700 font-mono text-xs break-all">다운로드 폴더 / presentation.mp4</code>
          </div>

          {/* Start button */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleStart}
              disabled={isRunning}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? '렌더링 중...' : '렌더 시작'}
            </button>

            {isDone && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-green-600 text-lg">✅</span>
                  <div>
                    <p className="text-sm font-medium text-green-800">렌더 완료!</p>
                    <p className="text-xs text-green-600">다운로드 폴더에 <strong>presentation.mp4</strong> 저장됨</p>
                  </div>
                </div>
                <a
                  href="/api/render/download"
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  다시 다운로드
                </a>
              </div>
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
            <RenderProgressPanel
              jobId={jobId}
              onComplete={handleComplete}
            />
          </div>
        )}
      </div>
    </main>
  )
}
