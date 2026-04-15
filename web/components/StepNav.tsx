'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const STEPS = [
  { label: '업로드', path: '/editor/upload', step: 1 },
  { label: '나레이션', path: '/editor/narration', step: 2 },
  { label: 'TTS 생성', path: '/editor/voiceover', step: 3 },
  { label: '프리뷰', path: '/editor/preview', step: 4 },
  { label: '렌더', path: '/editor/render', step: 5 },
] as const

export default function StepNav() {
  const pathname = usePathname()

  const currentStep = STEPS.find(s => pathname.startsWith(s.path))?.step ?? 0

  return (
    <nav aria-label="편집 단계" className="flex items-center gap-1 select-none">
      {STEPS.map((step, idx) => {
        const isCurrent = step.step === currentStep
        const isDone = step.step < currentStep

        return (
          <div key={step.path} className="flex items-center">
            {/* Connector line */}
            {idx > 0 && (
              <div
                className={[
                  'w-8 h-px mx-1 transition-colors',
                  isDone ? 'bg-indigo-400' : 'bg-gray-200',
                ].join(' ')}
              />
            )}

            <Link
              href={step.path}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                isCurrent
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isDone
                  ? 'text-indigo-600 hover:bg-indigo-50'
                  : 'text-gray-400 hover:bg-gray-100',
              ].join(' ')}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {/* Step circle */}
              <span
                className={[
                  'flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0',
                  isCurrent
                    ? 'bg-white text-indigo-600'
                    : isDone
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-400',
                ].join(' ')}
              >
                {isDone ? '✓' : step.step}
              </span>
              {step.label}
            </Link>
          </div>
        )
      })}
    </nav>
  )
}
