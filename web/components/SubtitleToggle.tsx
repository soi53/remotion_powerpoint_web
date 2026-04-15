'use client'

import { useState, useEffect } from 'react'

interface Props {
  disabled?: boolean
}

export default function SubtitleToggle({ disabled }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  // Load current subtitle setting from config
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          // Default true if not set
          setEnabled(data.meta?.subtitle !== false)
        }
      })
      .catch(() => {})
  }, [])

  async function toggle() {
    if (enabled === null || saving) return
    const next = !enabled
    setSaving(true)
    try {
      const configRes = await fetch('/api/config')
      if (!configRes.ok) return
      const config = await configRes.json()

      const updated = {
        ...config,
        meta: { ...config.meta, subtitle: next },
      }

      const putRes = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (putRes.ok) setEnabled(next)
    } finally {
      setSaving(false)
    }
  }

  if (enabled === null) return null

  return (
    <button
      onClick={toggle}
      disabled={disabled || saving}
      title="자막 표시 여부 (slide-config.json의 meta.subtitle)"
      className={[
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
        enabled
          ? 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100',
        (disabled || saving) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {/* Toggle pill */}
      <span
        className={[
          'relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors',
          enabled ? 'bg-indigo-500' : 'bg-gray-300',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform mt-0.5',
            enabled ? 'translate-x-3.5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
      자막
    </button>
  )
}
