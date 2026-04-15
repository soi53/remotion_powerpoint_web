import StepNav from '@/components/StepNav'
import Link from 'next/link'

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen">
      {/* Global top nav with step breadcrumb */}
      <div className="flex items-center justify-between px-6 py-2 bg-white border-b border-gray-100 shrink-0">

        {/* Logo → 홈으로 이동 */}
        <Link href="/" className="flex items-center gap-2 group shrink-0 select-none">
          <span className="text-2xl leading-none">🎬</span>
          <div className="flex flex-col leading-tight">
            <span
              className="text-[10px] font-black tracking-[0.18em] uppercase"
              style={{
                background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 60%, #ec4899 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              KR-ACADEMY
            </span>
            <span className="text-[13px] font-extrabold tracking-widest text-gray-800 uppercase group-hover:text-indigo-600 transition-colors">
              MOVIE MAKER
            </span>
          </div>
        </Link>

        <StepNav />

        {/* spacer to balance the logo on the left */}
        <div className="w-32" />
      </div>
      {/* Page content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
