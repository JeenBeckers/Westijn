'use client'

import { useRef, useState } from 'react'
import { Download, Printer, Code } from 'lucide-react'
import Button from '@/components/ui/Button'

interface CVPreviewProps {
  html: string
  candidateName: string
}

export function CVPreview({ html, candidateName }: CVPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function handleDownloadHtml() {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cv-${candidateName.toLowerCase().replace(/\s+/g, '-')}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handlePrint() {
    const iframe = iframeRef.current
    if (!iframe) return
    iframe.contentWindow?.print()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="secondary" size="sm" onClick={handleDownloadHtml}>
          <Code size={14} className="mr-1.5" />
          HTML downloaden
        </Button>
        <Button variant="secondary" size="sm" onClick={handlePrint}>
          <Printer size={14} className="mr-1.5" />
          Afdrukken / PDF
        </Button>
      </div>

      <div className="border border-harvest-bg rounded overflow-hidden bg-gray-100">
        <iframe
          ref={iframeRef}
          srcDoc={html}
          className="w-full"
          style={{ height: '1200px' }}
          sandbox="allow-same-origin allow-popups-to-escape-sandbox"
          title={`CV van ${candidateName}`}
        />
      </div>
    </div>
  )
}
