'use client'

import { useRef, useState, useEffect } from 'react'
import { Download, Printer, Code, Pencil } from 'lucide-react'
import Button from '@/components/ui/Button'

interface CVPreviewProps {
  html: string
  candidateName: string
  onSave?: (updatedHtml: string) => Promise<void>
  saving?: boolean
}

function extractStylesAndBody(html: string): { styles: string; body: string } {
  const styleMatches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
  const styles = styleMatches.map(m => `<style>${m[1]}</style>`).join('\n')
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const body = bodyMatch ? bodyMatch[1] : html
  return { styles, body }
}

export function CVPreview({ html, candidateName, onSave, saving }: CVPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const editRef = useRef<HTMLDivElement>(null)
  const [editMode, setEditMode] = useState(false)

  const { styles, body } = extractStylesAndBody(html)

  useEffect(() => {
    if (editMode && editRef.current) {
      editRef.current.innerHTML = body
    }
  }, [editMode])

  async function handleSaveEdit() {
    if (!editRef.current || !onSave) return
    const editedBody = editRef.current.innerHTML
    const updatedHtml = html.replace(/<body[^>]*>[\s\S]*?<\/body>/i, `<body>${editedBody}</body>`)
    await onSave(updatedHtml)
    setEditMode(false)
  }

  function handleCancelEdit() {
    setEditMode(false)
    if (editRef.current) {
      editRef.current.innerHTML = ''
    }
  }

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
    if (!html) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    // Ensure body has no extra padding/margin
    const printHtml = html.replace(
      '<body>',
      '<body style="margin:0;padding:0;">'
    );

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();

    // Wait for fonts and images to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 800);
    };
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
        {onSave && !editMode && (
          <Button variant="secondary" size="sm" onClick={() => setEditMode(true)}>
            <Pencil size={14} className="mr-1.5" />
            Inline bewerken
          </Button>
        )}
        {onSave && editMode && (
          <>
            <Button size="sm" onClick={handleSaveEdit} loading={saving}>
              Opslaan
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
              Annuleren
            </Button>
          </>
        )}
      </div>

      {editMode ? (
        <div className="border border-harvest-bg rounded overflow-hidden" style={{ background: '#fff' }}>
          {/* Inject extracted CSS */}
          <div dangerouslySetInnerHTML={{ __html: styles }} />
          {/* Editable CV body */}
          <div
            ref={editRef}
            contentEditable
            suppressContentEditableWarning
            style={{ outline: 'none', minHeight: '1200px' }}
          />
        </div>
      ) : (
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
      )}
    </div>
  )
}
