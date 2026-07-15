'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Printer, Code, Pencil, Check, X, Undo2, Redo2 } from 'lucide-react'
import Button from '@/components/ui/Button'

interface CVPreviewProps {
  html: string
  candidateName: string
  onSave?: (updatedHtml: string) => Promise<void>
  saving?: boolean
}

export function CVPreview({ html, candidateName, onSave, saving }: CVPreviewProps) {
  const viewIframeRef = useRef<HTMLIFrameElement>(null)
  const editIframeRef = useRef<HTMLIFrameElement>(null)
  const [editMode, setEditMode] = useState(false)
  const htmlRef = useRef(html)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Keep htmlRef in sync so handleSaveEdit always sees the latest html
  useEffect(() => {
    htmlRef.current = html
  }, [html])

  function getEditHtml(): string | null {
    const doc = editIframeRef.current?.contentDocument
    if (!doc) return null
    return '<!DOCTYPE html>' + doc.documentElement.outerHTML
  }

  const triggerAutoSave = useCallback(() => {
    if (!onSave) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      const updatedHtml = getEditHtml()
      if (!updatedHtml) return
      setAutoSaveStatus('saving')
      try {
        await onSave(updatedHtml)
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus('idle'), 2500)
      } catch {
        setAutoSaveStatus('idle')
      }
    }, 4000)
  }, [onSave])

  // When entering edit mode, write current html into the edit iframe and enable designMode
  useEffect(() => {
    if (!editMode || !editIframeRef.current) return

    const iframe = editIframeRef.current

    function initDesignMode() {
      const doc = iframe.contentDocument
      if (!doc) return
      doc.open()
      doc.write(htmlRef.current)
      doc.close()
      setTimeout(() => {
        try {
          doc.designMode = 'on'
          // Listen for any input to trigger auto-save
          doc.addEventListener('input', triggerAutoSave)
        } catch {
          // ignore cross-origin errors
        }
      }, 80)
    }

    if (iframe.contentDocument?.readyState === 'complete') {
      initDesignMode()
    } else {
      iframe.addEventListener('load', initDesignMode, { once: true })
    }

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [editMode, triggerAutoSave])

  async function handleSaveEdit() {
    if (!editIframeRef.current?.contentDocument || !onSave) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    const doc = editIframeRef.current.contentDocument
    try {
      doc.designMode = 'off'
    } catch { /* ignore */ }
    const updatedHtml = '<!DOCTYPE html>' + doc.documentElement.outerHTML
    await onSave(updatedHtml)
    setEditMode(false)
    setAutoSaveStatus('idle')
  }

  function handleCancelEdit() {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    setEditMode(false)
    setAutoSaveStatus('idle')
  }

  function handleUndo() {
    const doc = editIframeRef.current?.contentDocument
    if (!doc) return
    doc.execCommand('undo')
  }

  function handleRedo() {
    const doc = editIframeRef.current?.contentDocument
    if (!doc) return
    doc.execCommand('redo')
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
    if (!html) return
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return
    const printHtml = html.replace('<body>', '<body style="margin:0;padding:0;">')
    printWindow.document.open()
    printWindow.document.write(printHtml)
    printWindow.document.close()
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus()
        printWindow.print()
      }, 800)
    }
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
            <Button variant="secondary" size="sm" onClick={handleUndo} title="Ongedaan maken (Ctrl+Z)">
              <Undo2 size={14} />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleRedo} title="Opnieuw (Ctrl+Y)">
              <Redo2 size={14} />
            </Button>
            <Button size="sm" onClick={handleSaveEdit} loading={saving}>
              <Check size={14} className="mr-1.5" />
              Opslaan
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
              <X size={14} className="mr-1.5" />
              Annuleren
            </Button>
            {autoSaveStatus === 'saving' && (
              <span className="text-xs text-gray-400 italic">Opslaan…</span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="text-xs text-green-600 font-medium">✓ Automatisch opgeslagen</span>
            )}
          </>
        )}
      </div>

      {/* View iframe — always mounted, hidden in edit mode */}
      <div
        className="border border-harvest-bg rounded overflow-hidden bg-gray-100"
        style={{ display: editMode ? 'none' : undefined }}
      >
        <iframe
          ref={viewIframeRef}
          srcDoc={html}
          className="w-full"
          style={{ height: '1200px' }}
          sandbox="allow-same-origin allow-popups-to-escape-sandbox"
          title={`CV van ${candidateName}`}
        />
      </div>

      {/* Edit iframe — only shown in edit mode, no sandbox so designMode works */}
      {editMode && (
        <div className="border-2 border-harvest-green rounded overflow-hidden" style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: '6px 12px',
              background: '#162518',
              zIndex: 10,
              fontSize: '11px',
              fontWeight: 600,
              color: '#E8DFD0',
              letterSpacing: '0.08em',
            }}
          >
            ✏️ Bewerkingsmodus — klik op tekst om te bewerken &nbsp;·&nbsp; Ctrl+Z om ongedaan te maken
          </div>
          <iframe
            ref={editIframeRef}
            className="w-full"
            style={{ height: '1200px', paddingTop: '30px' }}
            title="CV bewerken"
          />
        </div>
      )}
    </div>
  )
}
