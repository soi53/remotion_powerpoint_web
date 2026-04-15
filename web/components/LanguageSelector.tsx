'use client'

const LANGUAGES = [
  { code: 'Korean', label: '한국어' },
  { code: 'English', label: 'English' },
  { code: 'Japanese', label: '日本語' },
  { code: 'Chinese (Simplified)', label: '中文 (简体)' },
  { code: 'Chinese (Traditional)', label: '中文 (繁體)' },
  { code: 'Spanish', label: 'Español' },
  { code: 'French', label: 'Français' },
  { code: 'German', label: 'Deutsch' },
  { code: 'Portuguese', label: 'Português' },
  { code: 'Vietnamese', label: 'Tiếng Việt' },
  { code: 'Thai', label: 'ภาษาไทย' },
]

interface Props {
  value: string
  onChange: (lang: string) => void
  disabled?: boolean
}

export default function LanguageSelector({ value, onChange, disabled }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">-- 언어 선택 --</option>
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  )
}
