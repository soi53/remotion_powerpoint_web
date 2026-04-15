'use client'

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import SlideGrid, { SlideItem } from '@/components/SlideGrid'

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

export default function UploadPage() {
  const router = useRouter()

  // PPTX upload state
  const [pptxState, setPptxState] = useState<UploadState>('idle')
  const [pptxDragging, setPptxDragging] = useState(false)
  const [pptxFile, setPptxFile] = useState<File | null>(null)
  const [pptxLogs, setPptxLogs] = useState<string[]>([])
  const [pptxError, setPptxError] = useState<string | null>(null)
  const pptxInputRef = useRef<HTMLInputElement>(null)

  // Script upload state
  const [scriptState, setScriptState] = useState<UploadState>('idle')
  const [scriptDragging, setScriptDragging] = useState(false)
  const [scriptResult, setScriptResult] = useState<{ applied: number; warnings?: string[] } | null>(null)
  const [scriptError, setScriptError] = useState<string | null>(null)
  const scriptInputRef = useRef<HTMLInputElement>(null)

  // Overwrite confirmation dialog
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  // Reset confirmation dialog
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Slides after upload
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [hasProject, setHasProject] = useState(false)
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set())
  const [savingEnabled, setSavingEnabled] = useState(false)

  // 마운트 시 기존 프로젝트 슬라이드 로드
  useEffect(() => {
    fetchSlides()
  }, [])

  // ── PPTX upload ──────────────────────────────────────────────────

  async function startPptxUpload(file: File, overwrite = false) {
    setPptxFile(file)
    setPptxState('uploading')
    setPptxLogs([])
    setPptxError(null)

    const form = new FormData()
    form.append('file', file)

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: overwrite ? { 'x-overwrite-confirm': 'true' } : {},
      body: form,
    })

    if (res.status === 409) {
      const data = await res.json()
      if (data.error === 'PROJECT_EXISTS') {
        setPptxState('idle')
        setPendingFile(file)
        setShowOverwriteDialog(true)
        return
      }
      setPptxState('error')
      setPptxError(data.error ?? '중복 작업이 실행 중입니다.')
      return
    }

    if (!res.ok) {
      setPptxState('error')
      const data = await res.json().catch(() => ({}))
      setPptxError(data.error ?? `서버 오류 (${res.status})`)
      return
    }

    const { jobId } = await res.json()
    setPptxState('processing')

    // Subscribe to SSE
    const sse = new EventSource(`/api/upload?jobId=${jobId}`)
    sse.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'log') {
        setPptxLogs(prev => [...prev, msg.line])
      } else if (msg.type === 'done') {
        sse.close()
        if (msg.status === 'done') {
          setPptxState('done')
          fetchSlides()
        } else {
          setPptxState('error')
          setPptxError('PPTX 변환에 실패했습니다. 로그를 확인하세요.')
        }
      }
    }
    sse.onerror = () => {
      sse.close()
      setPptxState('error')
      setPptxError('SSE 연결이 끊어졌습니다.')
    }
  }

  async function fetchSlides() {
    const [slidesRes, configRes] = await Promise.all([
      fetch('/api/slides'),
      fetch('/api/config'),
    ])
    if (slidesRes.ok) {
      const data = await slidesRes.json()
      const list: SlideItem[] = data.slides ?? []
      setSlides(list)
      setHasProject(list.length > 0)

      // Build enabledIds from config (undefined or true = enabled)
      if (configRes.ok) {
        const config = await configRes.json()
        const ids = new Set<string>(
          (config.slides ?? [])
            .filter((s: { id: string; enabled?: boolean }) => s.enabled !== false)
            .map((s: { id: string }) => s.id)
        )
        setEnabledIds(ids)
      } else {
        // No config yet — treat all slides as enabled
        setEnabledIds(new Set(list.map(s => s.id)))
      }
    }
  }

  function handleToggleEnabled(id: string) {
    setEnabledIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function saveEnabledState(ids: Set<string>) {
    setSavingEnabled(true)
    try {
      const configRes = await fetch('/api/config')
      if (!configRes.ok) return
      const config = await configRes.json()
      const patched = {
        ...config,
        slides: config.slides.map((s: { id: string }) => ({
          ...s,
          enabled: ids.has(s.id),
        })),
      }
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patched),
      })
    } finally {
      setSavingEnabled(false)
    }
  }

  async function confirmReset() {
    setShowResetDialog(false)
    setResetting(true)
    try {
      await fetch('/api/reset', { method: 'POST' })
      setSlides([])
      setHasProject(false)
      setPptxState('idle')
      setPptxFile(null)
      setPptxLogs([])
      setPptxError(null)
      setScriptState('idle')
      setScriptResult(null)
      setScriptError(null)
    } finally {
      setResetting(false)
    }
  }

  function handlePptxDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setPptxDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handlePptxFile(file)
  }

  function handlePptxChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handlePptxFile(file)
    e.target.value = ''
  }

  function handlePptxFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pptx')) {
      setPptxError('.pptx 파일만 업로드할 수 있습니다.')
      return
    }
    startPptxUpload(file)
  }

  // ── Script upload ────────────────────────────────────────────────

  async function handleScriptFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setScriptError('.txt 파일만 업로드할 수 있습니다.')
      return
    }

    setScriptState('uploading')
    setScriptError(null)
    setScriptResult(null)

    const form = new FormData()
    form.append('file', file)

    const res = await fetch('/api/upload-script', { method: 'POST', body: form })
    const data = await res.json()

    if (!res.ok) {
      setScriptState('error')
      setScriptError(data.error ?? `서버 오류 (${res.status})`)
      return
    }

    setScriptState('done')
    setScriptResult({ applied: data.applied, warnings: data.warnings })
  }

  function handleScriptDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setScriptDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleScriptFile(file)
  }

  function handleScriptChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleScriptFile(file)
    e.target.value = ''
  }

  // ── Overwrite dialog ─────────────────────────────────────────────

  function confirmOverwrite() {
    setShowOverwriteDialog(false)
    if (pendingFile) {
      startPptxUpload(pendingFile, true)
      setPendingFile(null)
    }
  }

  function cancelOverwrite() {
    setShowOverwriteDialog(false)
    setPendingFile(null)
  }

  const isProcessing = pptxState === 'uploading' || pptxState === 'processing'

  return (
    <main className="max-w-5xl mx-auto p-8 space-y-8 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">파일 업로드</h1>
          <p className="text-gray-500 mt-1 text-sm">
            PPTX 파일을 업로드하여 슬라이드를 추출합니다. 스크립트 파일(선택)로 나레이션을 자동 입력할 수 있습니다.
          </p>
        </div>
        {hasProject && (
          <button
            onClick={() => setShowResetDialog(true)}
            disabled={isProcessing || resetting}
            className="shrink-0 px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {resetting ? '초기화 중...' : '프로젝트 초기화'}
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* PPTX Drop Zone */}
        <section className="space-y-3">
          <h2 className="font-semibold text-gray-700">
            PPTX 파일 <span className="text-red-500">*</span>
          </h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setPptxDragging(true) }}
            onDragLeave={() => setPptxDragging(false)}
            onDrop={handlePptxDrop}
            onClick={() => !isProcessing && pptxInputRef.current?.click()}
            className={[
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
              pptxDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50',
              isProcessing ? 'pointer-events-none opacity-60' : '',
            ].join(' ')}
          >
            <input
              ref={pptxInputRef}
              type="file"
              accept=".pptx"
              className="hidden"
              onChange={handlePptxChange}
            />
            <div className="text-4xl mb-2">📊</div>
            {pptxFile ? (
              <p className="text-sm font-medium text-gray-700 truncate">{pptxFile.name}</p>
            ) : (
              <p className="text-sm text-gray-500">
                .pptx 파일을 드래그하거나 클릭하여 선택하세요
              </p>
            )}
          </div>

          {pptxState === 'uploading' && (
            <StatusBadge color="blue" text="업로드 중..." />
          )}
          {pptxState === 'processing' && (
            <div className="space-y-2">
              <StatusBadge color="blue" text="슬라이드 변환 중..." spinner />
              <LogBox lines={pptxLogs} />
            </div>
          )}
          {pptxState === 'done' && (
            <StatusBadge color="green" text={`완료! 슬라이드 ${slides.length}장 추출됨`} />
          )}
          {pptxState === 'error' && pptxError && (
            <StatusBadge color="red" text={pptxError} />
          )}
        </section>

        {/* Script Drop Zone */}
        <section className="space-y-3">
          <h2 className="font-semibold text-gray-700">
            스크립트 파일 <span className="text-gray-400 text-xs font-normal">(선택)</span>
          </h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setScriptDragging(true) }}
            onDragLeave={() => setScriptDragging(false)}
            onDrop={handleScriptDrop}
            onClick={() => scriptInputRef.current?.click()}
            className={[
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
              scriptDragging
                ? 'border-purple-400 bg-purple-50'
                : 'border-gray-300 hover:border-purple-300 hover:bg-gray-50',
              pptxState !== 'done' ? 'opacity-50 pointer-events-none' : '',
            ].join(' ')}
          >
            <input
              ref={scriptInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={handleScriptChange}
            />
            <div className="text-4xl mb-2">📝</div>
            <p className="text-sm text-gray-500">[1], [2] 태그로 구분된 .txt 파일</p>
            <p className="text-xs text-gray-400 mt-1">PPTX 업로드 후 활성화됩니다</p>
          </div>

          {scriptState === 'uploading' && (
            <StatusBadge color="purple" text="파싱 중..." spinner />
          )}
          {scriptState === 'done' && scriptResult && (
            <div className="space-y-1">
              <StatusBadge color="green" text={`${scriptResult.applied}개 슬라이드에 나레이션 적용됨`} />
              {scriptResult.warnings?.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded">
                  {w}
                </p>
              ))}
            </div>
          )}
          {scriptState === 'error' && scriptError && (
            <StatusBadge color="red" text={scriptError} />
          )}
        </section>
      </div>

      {/* Slide Grid */}
      {slides.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-700">
                슬라이드 미리보기 ({slides.length}장)
              </h2>
              <span className="text-xs text-gray-500">
                {enabledIds.size}장 선택됨
              </span>
              <button
                onClick={() => {
                  const allIds = new Set(slides.map(s => s.id))
                  setEnabledIds(allIds)
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                전체 선택
              </button>
              <button
                onClick={() => setEnabledIds(new Set())}
                className="text-xs text-gray-500 hover:underline"
              >
                전체 해제
              </button>
            </div>
            <button
              onClick={async () => {
                await saveEnabledState(enabledIds)
                router.push('/editor/narration')
              }}
              disabled={savingEnabled || enabledIds.size === 0}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingEnabled ? '저장 중...' : `다음: 나레이션 편집 →`}
            </button>
          </div>
          <SlideGrid
            slides={slides}
            enabledIds={enabledIds}
            onToggleEnabled={handleToggleEnabled}
          />
        </section>
      )}

      {/* Reset Confirmation Dialog */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">프로젝트 초기화</h3>
            <p className="text-sm text-gray-600">
              현재 작업 중인 슬라이드, 오디오, 나레이션 설정이 모두 삭제됩니다.
              이 작업은 되돌릴 수 없습니다.
            </p>
            <p className="text-sm font-medium text-gray-800">계속 진행하시겠습니까?</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowResetDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={confirmReset}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overwrite Confirmation Dialog */}
      {showOverwriteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">기존 프로젝트 덮어쓰기</h3>
            <p className="text-sm text-gray-600">
              현재 작업 중인 프로젝트가 있습니다. 새 파일을 업로드하면 슬라이드, 나레이션,
              오디오가 모두 초기화됩니다.
            </p>
            <p className="text-sm font-medium text-gray-800">계속 진행하시겠습니까?</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={cancelOverwrite}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={confirmOverwrite}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                덮어쓰기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────

function StatusBadge({
  color,
  text,
  spinner,
}: {
  color: 'blue' | 'green' | 'red' | 'purple'
  text: string
  spinner?: boolean
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${colors[color]}`}>
      {spinner && (
        <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
          />
        </svg>
      )}
      <span>{text}</span>
    </div>
  )
}

function LogBox({ lines }: { lines: string[] }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 max-h-32 overflow-y-auto font-mono text-xs text-green-400 space-y-0.5">
      {lines.length === 0 ? (
        <span className="text-gray-500">대기 중...</span>
      ) : (
        lines.map((line, i) => <div key={i}>{line}</div>)
      )}
    </div>
  )
}
