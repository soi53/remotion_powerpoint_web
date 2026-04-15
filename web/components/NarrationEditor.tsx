'use client'

import { useState, useEffect, useRef } from 'react'
import type { Slide, SlideMotion } from '@/lib/config'

interface Props {
  slide: Slide
  imageUrl: string
  index: number
  total: number
  onSave: (narration: string, duration: number) => Promise<void>
  onNavigate: (direction: 'prev' | 'next') => void
}

// Drag box in image-relative coordinates (0–1 range)
interface DragBox { left: number; top: number; right: number; bottom: number }

function clamp(v: number, min = 0, max = 1) { return Math.min(max, Math.max(min, v)) }

export default function NarrationEditor({ slide, imageUrl, index, total, onSave, onNavigate }: Props) {
  const [narration, setNarration] = useState(slide.narration)
  const [duration, setDuration] = useState(slide.duration)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // zoom_to editing
  const imgContainerRef = useRef<HTMLDivElement>(null)
  const [zoomEnabled, setZoomEnabled] = useState(false)
  const [zoomBox, setZoomBox] = useState<DragBox | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const [zoomSaving, setZoomSaving] = useState(false)
  const [zoomSaved, setZoomSaved] = useState(false)

  // Reset state when slide changes
  useEffect(() => {
    setNarration(slide.narration)
    setDuration(slide.duration)
    setDirty(false)
    setSaved(false)

    // Load existing zoom_to target if any
    const motion = slide.motion ?? slide.motions?.[0]
    if (motion?.type === 'zoom_to' && motion.target) {
      setZoomBox(motion.target)
      setZoomEnabled(true)
    } else {
      setZoomBox(null)
      setZoomEnabled(false)
    }
    setZoomSaved(false)
  }, [slide.id, slide.narration, slide.duration, slide.motion, slide.motions])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [narration])

  function handleNarrationChange(val: string) {
    setNarration(val)
    setDirty(true)
    setSaved(false)
  }

  function handleDurationChange(val: string) {
    const num = parseFloat(val)
    if (!isNaN(num) && num > 0) {
      setDuration(num)
      setDirty(true)
      setSaved(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(narration, duration)
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  // Keyboard shortcut: Ctrl+S or Cmd+S
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (dirty && !saving) handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // ── zoom_to drag logic ─────────────────────────────────────────────

  function getRelativePos(e: React.MouseEvent): { x: number; y: number } | null {
    const el = imgContainerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return {
      x: clamp((e.clientX - rect.left) / rect.width),
      y: clamp((e.clientY - rect.top) / rect.height),
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!zoomEnabled) return
    e.preventDefault()
    const pos = getRelativePos(e)
    if (!pos) return
    dragStart.current = pos
    setZoomBox(null)
    setDragging(true)
    setZoomSaved(false)
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging || !dragStart.current) return
    const pos = getRelativePos(e)
    if (!pos) return
    const s = dragStart.current
    setZoomBox({
      left: Math.min(s.x, pos.x),
      top: Math.min(s.y, pos.y),
      right: Math.max(s.x, pos.x),
      bottom: Math.max(s.y, pos.y),
    })
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!dragging) return
    setDragging(false)
    handleMouseMove(e) // finalize
  }

  async function saveZoomTo() {
    if (!zoomBox) return
    setZoomSaving(true)
    try {
      const newMotion: SlideMotion = {
        type: 'zoom_to',
        target: {
          left: parseFloat(zoomBox.left.toFixed(4)),
          top: parseFloat(zoomBox.top.toFixed(4)),
          right: parseFloat(zoomBox.right.toFixed(4)),
          bottom: parseFloat(zoomBox.bottom.toFixed(4)),
        },
      }
      const res = await fetch(`/api/config/slide/${slide.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motion: newMotion }),
      })
      if (res.ok) {
        setZoomSaved(true)
        setTimeout(() => setZoomSaved(false), 2000)
      }
    } finally {
      setZoomSaving(false)
    }
  }

  async function clearZoomTo() {
    setZoomBox(null)
    setZoomEnabled(false)
    await fetch(`/api/config/slide/${slide.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motion: null }),
    })
  }

  const wordCount = narration.trim() ? narration.trim().split(/\s+/).length : 0
  const charCount = narration.length

  // Percent string for rectangle overlay
  const boxStyle = zoomBox ? {
    left: `${zoomBox.left * 100}%`,
    top: `${zoomBox.top * 100}%`,
    width: `${(zoomBox.right - zoomBox.left) * 100}%`,
    height: `${(zoomBox.bottom - zoomBox.top) * 100}%`,
  } : {}

  return (
    <div className="flex flex-col h-full">
      {/* Slide image with optional zoom_to draw overlay */}
      <div
        ref={imgContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={[
          'relative aspect-video bg-gray-100 rounded-xl overflow-hidden shrink-0',
          zoomEnabled ? 'cursor-crosshair select-none' : '',
        ].join(' ')}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`Slide ${index + 1}`}
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />
        <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded">
          {index + 1} / {total}
        </div>

        {/* zoom_to selection box */}
        {zoomEnabled && zoomBox && (
          <div
            className="absolute border-2 border-yellow-400 bg-yellow-400/20 pointer-events-none"
            style={boxStyle}
          >
            {/* Corner handles */}
            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-yellow-400 rounded-sm" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-sm" />
            <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-yellow-400 rounded-sm" />
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-sm" />
          </div>
        )}

        {/* Hint overlay when zoom mode active */}
        {zoomEnabled && !zoomBox && !dragging && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg">
              이미지 위에서 드래그하여 줌 영역을 지정하세요
            </div>
          </div>
        )}
      </div>

      {/* Editor area */}
      <div className="mt-4 flex flex-col gap-3 flex-1">
        {/* Narration textarea */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            나레이션 텍스트
          </label>
          <textarea
            ref={textareaRef}
            value={narration}
            onChange={(e) => handleNarrationChange(e.target.value)}
            placeholder="나레이션을 입력하세요..."
            className="w-full min-h-[8rem] resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed overflow-hidden"
            rows={4}
          />
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>{charCount}자 / {wordCount}단어</span>
            <span className="text-gray-400">Ctrl+S 저장</span>
          </div>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-600 shrink-0">
            슬라이드 길이 (초)
          </label>
          <input
            type="number"
            value={duration}
            onChange={(e) => handleDurationChange(e.target.value)}
            min={1}
            step={0.5}
            className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">TTS 생성 후 자동 갱신됩니다</span>
        </div>

        {/* zoom_to section */}
        <div className="border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-2">
              <span>🔍 zoom_to 설정</span>
              {zoomBox && (
                <span className="text-[10px] font-normal text-gray-400">
                  ({(zoomBox.left * 100).toFixed(1)}%, {(zoomBox.top * 100).toFixed(1)}%)
                  → ({(zoomBox.right * 100).toFixed(1)}%, {(zoomBox.bottom * 100).toFixed(1)}%)
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              {/* Toggle draw mode */}
              <button
                onClick={() => setZoomEnabled(v => !v)}
                className={[
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                  zoomEnabled
                    ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-block w-3 h-3 rounded-full border-2',
                    zoomEnabled ? 'bg-yellow-400 border-yellow-400' : 'bg-white border-gray-300',
                  ].join(' ')}
                />
                {zoomEnabled ? '편집 중' : '영역 지정'}
              </button>

              {/* Save zoom */}
              {zoomBox && (
                <button
                  onClick={saveZoomTo}
                  disabled={zoomSaving}
                  className="px-2.5 py-1 bg-yellow-500 text-white text-xs rounded-md hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                >
                  {zoomSaving ? '저장중...' : zoomSaved ? '✓ 저장됨' : '저장'}
                </button>
              )}

              {/* Clear zoom */}
              {(zoomBox || zoomEnabled) && (
                <button
                  onClick={clearZoomTo}
                  className="px-2.5 py-1 text-xs border border-red-200 text-red-500 rounded-md hover:bg-red-50 transition-colors"
                >
                  제거
                </button>
              )}
            </div>
          </div>

          {!zoomEnabled && !zoomBox && (
            <p className="text-xs text-gray-400">
              &apos;영역 지정&apos; 버튼을 누른 후 슬라이드 이미지에서 드래그하여 줌인할 영역을 선택합니다.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {/* Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => onNavigate('prev')}
              disabled={index === 0}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← 이전
            </button>
            <button
              onClick={() => onNavigate('next')}
              disabled={index === total - 1}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              다음 →
            </button>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={[
              'px-4 py-1.5 text-sm rounded-lg font-medium transition-all',
              saved
                ? 'bg-green-500 text-white'
                : dirty
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-default',
            ].join(' ')}
          >
            {saving ? '저장 중...' : saved ? '저장됨' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
