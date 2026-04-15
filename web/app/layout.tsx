import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PowerPoint to Video',
  description: 'Convert PowerPoint presentations to animated MP4 videos',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
