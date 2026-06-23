'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { CVPreview } from '@/components/cv/CVPreview'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Wand2, Send, ArrowLeft, User, MapPin, Clock, Globe, ArrowUpRight, Pencil, X } from 'lucide-react'
import { BookmarkPlus, Trash2, Clock3 } from 'lucide-react'
import type { Candidate, Profile, IntakeResponse, CvVersion } from '@/types'

const SECTIONS = [
  { value: 'samenvatting', label: 'Samenvatting / Beoordeling' },
  { value: 'werkervaring', label: 'Werkervaring' },
  { value: 'opleiding', label: 'Opleiding' },
  { value: 'skills', label: 'Skills' },
  { value: 'relevanteSkills', label: 'Relevante skills' },
  { value: 'projecten', label: 'Projecten' },
  { value: 'talen', label: 'Talen' },
  { value: 'interesses', label: 'Interesses & hobbies' },
]

export default function CandidateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [intakeResponse, setIntakeResponse] = useState<IntakeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sendingIntake, setSendingIntake] = useState(false)
  const [intakeEmail, setIntakeEmail] = useState('')
  const [intakeSent, setIntakeSent] = useState(false)
  const [generationNotes, setGenerationNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [pushSuccess, setPushSuccess] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoStatus, setPhotoStatus] = useState<'' | 'removing' | 'uploading'>('')
  const [photoCacheBust, setPhotoCacheBust] = useState(0)
  const [editingAge, setEditingAge] = useState(false)
  const [ageInput, setAgeInput] = useState<string>('')
  const [savingAge, setSavingAge] = useState(false)

  // Edit panel
  const [editPanelOpen, setEditPanelOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'claude' | 'manual'>('claude')
  const [editSection, setEditSection] = useState('samenvatting')

  // Tab A — Claude improvement
  const [editInstructions, setEditInstructions] = useState('')
  const [improving, setImproving] = useState(false)
  const [improvedHtml, setImprovedHtml] = useState<string | null>(null)
  const [improveError, setImproveError] = useState<string | null>(null)

  // Tab B — Manual edit
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Extra docs upload
  const [extraDocs, setExtraDocs] = useState<File[]>([])
  const [updatingWithDocs, setUpdatingWithDocs] = useState(false)

  // Inline CV editing
  const [savingInline, setSavingInline] = useState(false)

  // CV Versioning
  const [cvVersions, setCvVersions] = useState<CvVersion[]>([])
  const [savingVersion, setSavingVersion] = useState(false)
  const [versionNameModalOpen, setVersionNameModalOpen] = useState(false)
  const [versionName, setVersionName] = useState('')
  const [previewVersion, setPreviewVersion] = useState<CvVersion | null>(null)

  // Claude quality check modal
  const [claudeCheckOpen, setClaudeCheckOpen] = useState(false)
  const [claudeChecking, setClaudeChecking] = useState(false)
  const [claudeCheckFindings, setClaudeCheckFindings] = useState<string[]>([])
  const [claudeCheckError, setClaudeCheckError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)

      const { data: candidateData } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', params.id)
        .single()
      setCandidate(candidateData)

      const { data: intakeForm } = await supabase
        .from('intake_forms')
        .select('id, completed_at')
        .eq('candidate_id', params.id)
        .not('completed_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (intakeForm) {
        const { data: response } = await supabase
          .from('intake_responses')
          .select('*')
          .eq('intake_form_id', intakeForm.id)
          .single()
        setIntakeResponse(response)
      }

      // Load saved CV versions (ignore error if table doesn't exist yet)
      const { data: versions } = await supabase
        .from('cv_versions')
        .select('*')
        .eq('candidate_id', params.id)
        .order('created_at', { ascending: false })
      if (versions) {
        setCvVersions(versions)
        // If a version id is passed via URL (?version=<id>), activate it immediately
        const versionIdParam = searchParams?.get('version')
        if (versionIdParam) {
          const found = versions.find((v: CvVersion) => v.id === versionIdParam)
          if (found) setPreviewVersion(found)
        }
      }

      setLoading(false)
    }
    load()
  }, [params.id])

  async function handleGenerateCV() {
    if (!candidate) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          intakeData: intakeResponse?.responses,
          additionalInstructions: generationNotes || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Genereren mislukt')
      }
      const { html } = await res.json()
      setCandidate(prev => prev ? { ...prev, cv_html: html } : null)
      setSavedAt(new Date())
      await trackEditor()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Genereren mislukt')
    } finally {
      setGenerating(false)
    }
  }

  async function trackEditor() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profileData } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      if (!profileData) return
      const newEditor = { user_id: user.id, full_name: profileData.full_name, edited_at: new Date().toISOString() }
      const currentEditors = (candidate?.editors || []) as { user_id: string; full_name: string; edited_at: string }[]
      const filtered = currentEditors.filter((e) => e.user_id !== user.id)
      const updatedEditors = [...filtered, newEditor].slice(-3)
      await supabase.from('candidates').update({ editors: updatedEditors }).eq('id', params.id as string)
      setCandidate(prev => prev ? { ...prev, editors: updatedEditors } : null)
    } catch (editorErr) {
      console.error('Failed to track editor:', editorErr)
    }
  }

  async function handleStatusUpdate(newStatus: 'review' | 'in_behandeling' | 'archief') {
    if (!candidate) return
    setStatusUpdating(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('candidates')
        .update({ status: newStatus })
        .eq('id', candidate.id)
      if (updateError) throw updateError
      setCandidate(prev => prev ? { ...prev, status: newStatus } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status bijwerken mislukt')
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleSendIntake() {
    if (!candidate || !intakeEmail) return
    setSendingIntake(true)
    setError(null)
    try {
      const res = await fetch('/api/send-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidate.id, email: intakeEmail }),
      })
      if (!res.ok) throw new Error('Versturen mislukt')
      setIntakeSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Versturen mislukt')
    } finally {
      setSendingIntake(false)
    }
  }

  async function handleSaveAge() {
    if (!candidate) return
    const newAge = ageInput === '' ? null : parseInt(ageInput, 10)
    if (ageInput !== '' && (isNaN(newAge!) || newAge! < 16 || newAge! > 80)) return
    setSavingAge(true)
    const { error: dbError } = await supabase
      .from('candidates')
      .update({ age: newAge })
      .eq('id', candidate.id)
    setSavingAge(false)
    if (!dbError) {
      setCandidate(prev => prev ? { ...prev, age: newAge } : null)
      setEditingAge(false)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !candidate) return
    setUploadingPhoto(true)
    setPhotoStatus('removing')
    setError(null)
    try {
      // If already a transparent PNG, skip background removal to avoid failures
      const isPng = file.type === 'image/png'
      let transparentBlob: Blob

      if (isPng) {
        transparentBlob = file
      } else {
        const bgRemovalModule = await import('@imgly/background-removal')
        const removeBackground = bgRemovalModule.default as unknown as (input: File) => Promise<Blob>
        transparentBlob = await removeBackground(file)
      }

      const img = new Image()
      img.src = URL.createObjectURL(transparentBlob)
      await new Promise<void>((r) => { img.onload = () => r() })

      const bgCanvas = document.createElement('canvas')
      bgCanvas.width = img.naturalWidth
      bgCanvas.height = img.naturalHeight
      const bgCtx = bgCanvas.getContext('2d')!
      bgCtx.fillStyle = '#E8DFD0'
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height)
      bgCtx.drawImage(img, 0, 0)
      URL.revokeObjectURL(img.src)

      const processedBlob = await new Promise<Blob>((resolve) =>
        bgCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85)
      )

      setPhotoStatus('uploading')

      const bitmap = await createImageBitmap(processedBlob)
      const maxSize = 600
      const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.75)
      )

      const path = `photos/${candidate.id}/photo.jpg`
      const { error: uploadError } = await supabase.storage
        .from('candidate-uploads')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError

      const { data: signedData, error: signedError } = await supabase.storage
        .from('candidate-uploads')
        .createSignedUrl(path, 315360000)
      if (signedError) throw signedError

      const photoUrl = signedData.signedUrl
      const { error: dbError } = await supabase
        .from('candidates')
        .update({ photo_url: photoUrl })
        .eq('id', candidate.id)
      if (dbError) throw dbError

      setCandidate(prev => prev ? { ...prev, photo_url: photoUrl } : null)
      setPhotoCacheBust(n => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Foto uploaden mislukt')
    } finally {
      setUploadingPhoto(false)
      setPhotoStatus('')
      e.target.value = ''
    }
  }

  // --- Section extraction helpers ---

  function extractSectionHtml(cvHtml: string, sectionName: string): string {
    const parser = new DOMParser()
    const doc = parser.parseFromString(cvHtml, 'text/html')

    const sectionMap: Record<string, string[]> = {
      werkervaring: ['werkervaring', 'work experience', 'werkervar'],
      opleiding: ['opleiding', 'education', 'opleidingen'],
      skills: ['skills', 'vaardigheden', 'competenties'],
      projecten: ['projecten', 'projects'],
      talen: ['talen', 'languages'],
      interesses: ['interesses', 'hobbies', 'hobbys', 'interests'],
      samenvatting: ['samenvatting', 'profiel', 'over ', 'beoordeling', 'review'],
      relevanteSkills: ['relevante skills', 'relevante vaardigheden', 'key skills'],
    }

    const keywords = sectionMap[sectionName] || [sectionName.toLowerCase()]
    const headings = doc.querySelectorAll('h2')
    for (const h2 of headings) {
      const text = h2.textContent?.toLowerCase() || ''
      if (keywords.some(kw => text.includes(kw))) {
        const sectionDiv = h2.closest('.section-head')?.parentElement
        if (sectionDiv) return sectionDiv.outerHTML
        return h2.parentElement?.outerHTML || h2.outerHTML
      }
    }

    const allDivs = doc.querySelectorAll('[class]')
    for (const el of allDivs) {
      const cls = el.className?.toLowerCase() || ''
      if (keywords.some(kw => cls.includes(kw.replace(' ', '-')))) {
        return (el as HTMLElement).outerHTML
      }
    }

    return ''
  }

  function htmlToPlainText(html: string): string {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    // Add newlines around block elements before stripping
    tmp.querySelectorAll('p, div, li, h1, h2, h3, h4, br').forEach(el => {
      el.insertAdjacentText('afterend', '\n')
    })
    return (tmp.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
  }

  function patchSectionHtml(cvHtml: string, sectionName: string, newSectionHtml: string): string {
    const original = extractSectionHtml(cvHtml, sectionName)
    if (!original) return cvHtml
    return cvHtml.replace(original, newSectionHtml)
  }

  function patchSectionWithText(cvHtml: string, sectionName: string, newText: string): string {
    const sectionHtml = extractSectionHtml(cvHtml, sectionName)
    if (!sectionHtml) return cvHtml

    const parser = new DOMParser()
    const doc = parser.parseFromString(sectionHtml, 'text/html')
    const body = doc.querySelector('.section-body') || doc.body.firstElementChild

    if (body) {
      const paragraphs = newText.split(/\n\n+/).filter(p => p.trim())
      body.innerHTML = paragraphs
        .map(p => `<p>${p.trim().replace(/\n/g, '<br/>')}</p>`)
        .join('')
    }

    const newSectionHtml = doc.body.innerHTML
    return cvHtml.replace(sectionHtml, newSectionHtml)
  }

  // --- Edit panel handlers ---

  function openEditPanel(tab: 'claude' | 'manual') {
    setActiveTab(tab)
    setImprovedHtml(null)
    setImproveError(null)
    setEditText('')
    setEditPanelOpen(true)
  }

  function handleTabChange(tab: 'claude' | 'manual') {
    setActiveTab(tab)
    setImprovedHtml(null)
    setImproveError(null)
    setEditText('')
  }

  function handleSectionChange(section: string) {
    setEditSection(section)
    setImprovedHtml(null)
    setImproveError(null)
    if (activeTab === 'manual' && candidate?.cv_html) {
      const sectionHtml = extractSectionHtml(candidate.cv_html, section)
      setEditText(sectionHtml ? htmlToPlainText(sectionHtml) : '')
    }
  }

  useEffect(() => {
    if (activeTab === 'manual' && editPanelOpen && candidate?.cv_html) {
      const sectionHtml = extractSectionHtml(candidate.cv_html, editSection)
      setEditText(sectionHtml ? htmlToPlainText(sectionHtml) : '')
    }
  }, [activeTab, editPanelOpen])

  async function handleImproveSection() {
    if (!candidate?.cv_html) return
    setImproving(true)
    setImproveError(null)
    setImprovedHtml(null)

    const sectionHtml = extractSectionHtml(candidate.cv_html, editSection)
    if (!sectionHtml) {
      setImproveError(`Sectie "${editSection}" niet gevonden in het CV.`)
      setImproving(false)
      return
    }

    try {
      const candidateContext = `${candidate.first_name} ${candidate.last_name}, ${candidate.role || 'kandidaat'}${candidate.city ? `, ${candidate.city}` : ''}`
      const res = await fetch('/api/improve-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionHtml,
          sectionName: editSection,
          candidateContext,
          extraInstructions: editInstructions || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Verbeteren mislukt')
      }
      const { improvedHtml: html } = await res.json()
      setImprovedHtml(html)
    } catch (err) {
      setImproveError(err instanceof Error ? err.message : 'Verbeteren mislukt')
    } finally {
      setImproving(false)
    }
  }

  async function handleAcceptImprovement() {
    if (!candidate || !improvedHtml) return
    // Re-fetch to avoid stale snapshot issues on second round
    const { data: fresh } = await supabase.from('candidates').select('cv_html').eq('id', candidate.id).single()
    const baseHtml = fresh?.cv_html || candidate.cv_html || ''
    const updatedHtml = patchSectionHtml(baseHtml, editSection, improvedHtml)
    const { error: dbError } = await supabase
      .from('candidates')
      .update({ cv_html: updatedHtml, updated_at: new Date().toISOString() })
      .eq('id', candidate.id)
    if (dbError) { setImproveError(dbError.message); return }
    setCandidate(prev => prev ? { ...prev, cv_html: updatedHtml } : null)
    setSavedAt(new Date())
    setImprovedHtml(null)
    setEditInstructions('')
    await trackEditor()
  }

  async function handleSaveManualEdit() {
    if (!candidate || !editText.trim()) return
    setSavingEdit(true)
    // Re-fetch to avoid stale snapshot issues on second round
    const { data: fresh } = await supabase.from('candidates').select('cv_html').eq('id', candidate.id).single()
    const baseHtml = fresh?.cv_html || candidate.cv_html || ''
    const updatedHtml = patchSectionWithText(baseHtml, editSection, editText)
    const { error: dbError } = await supabase
      .from('candidates')
      .update({ cv_html: updatedHtml, updated_at: new Date().toISOString() })
      .eq('id', candidate.id)
    setSavingEdit(false)
    if (dbError) { setError(dbError.message); return }
    setCandidate(prev => prev ? { ...prev, cv_html: updatedHtml } : null)
    setSavedAt(new Date())
    await trackEditor()
  }

  async function handleUpdateWithDocs() {
    if (!candidate || extraDocs.length === 0) return
    setUpdatingWithDocs(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('candidateId', candidate.id)
      for (const file of extraDocs) {
        formData.append('files', file)
      }
      const res = await fetch('/api/update-cv-with-docs', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Verwerken mislukt')
      }
      const { html } = await res.json()
      setCandidate(prev => prev ? { ...prev, cv_html: html } : null)
      setSavedAt(new Date())
      setExtraDocs([])
      await trackEditor()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verwerken mislukt')
    } finally {
      setUpdatingWithDocs(false)
    }
  }

  async function handleSaveCVInline(updatedHtml: string) {
    if (!candidate) return
    const { error: dbError } = await supabase
      .from('candidates')
      .update({ cv_html: updatedHtml, updated_at: new Date().toISOString() })
      .eq('id', candidate.id)
    if (dbError) { setError(dbError.message); return }
    setCandidate(prev => prev ? { ...prev, cv_html: updatedHtml } : null)
    setSavedAt(new Date())
    await trackEditor()
  }

  async function handleSaveCVInlineWithState(updatedHtml: string) {
    setSavingInline(true)
    try {
      await handleSaveCVInline(updatedHtml)
    } finally {
      setSavingInline(false)
    }
  }

  // --- CV Versioning ---

  async function handleSaveVersion() {
    if (!candidate?.cv_html || !versionName.trim()) return
    setSavingVersion(true)
    const { data, error: dbError } = await supabase
      .from('cv_versions')
      .insert({ candidate_id: candidate.id, name: versionName.trim(), cv_html: candidate.cv_html })
      .select()
      .single()
    setSavingVersion(false)
    if (dbError) { setError('Versie opslaan mislukt: ' + dbError.message); return }
    if (data) setCvVersions(prev => [data, ...prev])
    setVersionNameModalOpen(false)
    setVersionName('')
  }

  async function handleDeleteVersion(versionId: string) {
    const { error: dbError } = await supabase.from('cv_versions').delete().eq('id', versionId)
    if (!dbError) setCvVersions(prev => prev.filter(v => v.id !== versionId))
  }

  async function handleRestoreVersion(version: CvVersion) {
    if (!candidate) return
    const { error: dbError } = await supabase
      .from('candidates')
      .update({ cv_html: version.cv_html, updated_at: new Date().toISOString() })
      .eq('id', candidate.id)
    if (dbError) { setError(dbError.message); return }
    setCandidate(prev => prev ? { ...prev, cv_html: version.cv_html } : null)
    setPreviewVersion(null)
    setSavedAt(new Date())
  }

  // --- Claude quality check + push ---

  async function handleClaudeCheck() {
    if (!candidate?.cv_html) return
    setClaudeCheckOpen(true)
    setClaudeChecking(true)
    setClaudeCheckFindings([])
    setClaudeCheckError(null)
    try {
      const res = await fetch('/api/cv-quality-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvHtml: candidate.cv_html,
          candidateName: `${candidate.first_name} ${candidate.last_name}`,
        }),
      })
      if (!res.ok) throw new Error('Kwaliteitscheck mislukt')
      const { findings } = await res.json()
      setClaudeCheckFindings(findings || [])
    } catch (err) {
      setClaudeCheckError(err instanceof Error ? err.message : 'Kwaliteitscheck mislukt')
    } finally {
      setClaudeChecking(false)
    }
  }

  async function doPushToCVTool() {
    if (!candidate) return
    setClaudeCheckOpen(false)
    setPushing(true)
    setError(null)
    try {
      const res = await fetch('/api/push-to-cv-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidate.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Push mislukt')
      }
      setPushSuccess(true)
      setTimeout(() => setPushSuccess(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Push naar CV Tool mislukt')
    } finally {
      setPushing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-harvest-bg">
        <div className="animate-spin w-8 h-8 border-2 border-harvest-green border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-harvest-bg">
        <p className="text-harvest-muted">Kandidaat niet gevonden</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} />
      <div className="flex-1 flex flex-col">
        <Header profile={profile} />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/dashboard')} className="text-harvest-muted hover:text-harvest-dark">
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1">
                <h1 className="font-serif text-2xl text-harvest-dark">
                  {candidate.first_name} {candidate.last_name}
                </h1>
                <p className="text-harvest-green text-sm font-medium">{candidate.role}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {candidate.status === 'review' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#9C2A12', color: '#fff' }}>
                    Review vereist
                  </span>
                )}
                {candidate.status === 'in_behandeling' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#1a2b4b', color: '#fff' }}>
                    In behandeling
                  </span>
                )}
                {candidate.status === 'archief' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#5b5750', color: '#fff' }}>
                    Archief
                  </span>
                )}

                {candidate.status === 'review' && (
                  <button
                    onClick={() => handleStatusUpdate('in_behandeling')}
                    disabled={statusUpdating}
                    className="px-3 py-1 text-xs rounded border font-medium transition-colors disabled:opacity-60"
                    style={{ borderColor: '#1a2b4b', color: '#1a2b4b' }}
                  >
                    {statusUpdating ? '…' : 'Markeer als in behandeling'}
                  </button>
                )}
                {candidate.status === 'in_behandeling' && (
                  <button
                    onClick={() => handleStatusUpdate('archief')}
                    disabled={statusUpdating}
                    className="px-3 py-1 text-xs rounded border font-medium transition-colors disabled:opacity-60"
                    style={{ borderColor: '#5b5750', color: '#5b5750' }}
                  >
                    {statusUpdating ? '…' : 'Naar archief'}
                  </button>
                )}
                {candidate.status === 'archief' && (
                  <button
                    onClick={() => handleStatusUpdate('in_behandeling')}
                    disabled={statusUpdating}
                    className="px-3 py-1 text-xs rounded border font-medium transition-colors disabled:opacity-60"
                    style={{ borderColor: '#1a2b4b', color: '#1a2b4b' }}
                  >
                    {statusUpdating ? '…' : 'Terug naar bewerken'}
                  </button>
                )}

                {intakeResponse && <Badge variant="success">Intake ontvangen</Badge>}
                {candidate.cv_html && <Badge variant="info">CV gegenereerd</Badge>}
                {savedAt && (
                  <span className="text-xs text-green-600 font-medium">Opgeslagen ✓</span>
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-harvest-error rounded text-harvest-error text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left panel */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Kandidaatgegevens</CardTitle>
                  </CardHeader>
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-col gap-2">
                      {candidate.photo_url && (
                        <img
                          key={photoCacheBust}
                          src={candidate.photo_url}
                          alt="Foto"
                          className="w-20 h-20 rounded-full object-cover border-2 border-harvest-brown"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoUpload}
                            disabled={uploadingPhoto}
                          />
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-harvest-muted rounded text-harvest-muted hover:border-harvest-green hover:text-harvest-green transition-colors">
                            {uploadingPhoto && (
                              <span className="inline-block w-3 h-3 border border-harvest-green border-t-transparent rounded-full animate-spin" />
                            )}
                            {photoStatus === 'removing'
                              ? 'Achtergrond verwijderen…'
                              : photoStatus === 'uploading'
                              ? 'Uploaden…'
                              : 'Foto vervangen'}
                          </span>
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-harvest-muted">
                      <User size={14} />
                      {editingAge ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={16}
                            max={80}
                            value={ageInput}
                            onChange={e => setAgeInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveAge(); if (e.key === 'Escape') setEditingAge(false) }}
                            autoFocus
                            className="w-16 px-1.5 py-0.5 text-sm border border-harvest-green rounded focus:outline-none focus:ring-1 focus:ring-harvest-green"
                            placeholder="leeftijd"
                          />
                          <button
                            onClick={handleSaveAge}
                            disabled={savingAge}
                            className="text-xs px-2 py-0.5 rounded bg-harvest-green text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {savingAge ? '…' : 'Opslaan'}
                          </button>
                          <button onClick={() => setEditingAge(false)} className="text-xs text-harvest-muted hover:text-harvest-dark">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAgeInput(candidate.age ? String(candidate.age) : ''); setEditingAge(true) }}
                          className="hover:text-harvest-dark underline decoration-dotted cursor-pointer text-sm"
                          title="Klik om leeftijd te wijzigen"
                        >
                          {candidate.age ? `${candidate.age} jaar` : 'Leeftijd onbekend'}
                        </button>
                      )}
                    </div>
                    {candidate.city && (
                      <div className="flex items-center gap-2 text-harvest-muted">
                        <MapPin size={14} />
                        <span>{candidate.city}</span>
                      </div>
                    )}
                    {candidate.availability && (
                      <div className="flex items-center gap-2 text-harvest-muted">
                        <Clock size={14} />
                        <span>{candidate.availability}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-harvest-muted">
                      <Globe size={14} />
                      <span>{candidate.language === 'nl' ? 'Nederlands' : 'English'}</span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Acties</CardTitle>
                  </CardHeader>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-harvest-green mb-1">
                        Aanvullende instructies voor de generator
                      </label>
                      <textarea
                        value={generationNotes}
                        onChange={(e) => setGenerationNotes(e.target.value)}
                        placeholder="Bijv. focus op data-ervaring, houd review kort, benoem stage bij ASML expliciet…"
                        rows={3}
                        className="w-full px-3 py-2 text-sm bg-harvest-bg border border-harvest-bg rounded focus:outline-none focus:ring-2 focus:ring-harvest-green resize-none"
                        style={{ minHeight: '80px' }}
                      />
                      <p className="text-xs text-harvest-muted mt-1">
                        Optioneel — Claude houdt hier rekening mee bij het genereren
                      </p>
                    </div>
                    <Button
                      onClick={handleGenerateCV}
                      loading={generating}
                      className="w-full"
                    >
                      <Wand2 size={16} className="mr-2" />
                      {candidate.cv_html ? 'CV opnieuw genereren' : 'CV genereren'}
                    </Button>

                    <div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt,.md"
                          multiple
                          className="hidden"
                          onChange={e => {
                            const files = Array.from(e.target.files || [])
                            setExtraDocs(prev => [...prev, ...files])
                            e.target.value = ''
                          }}
                        />
                        <span className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium border rounded border-harvest-muted text-harvest-muted hover:border-harvest-green hover:text-harvest-green transition-colors w-full justify-center cursor-pointer">
                          Documenten toevoegen
                        </span>
                      </label>
                      {extraDocs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {extraDocs.map((f, i) => (
                            <span key={i} className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-harvest-bg border border-harvest-muted text-harvest-muted">
                              {f.name}
                              <button
                                onClick={() => setExtraDocs(prev => prev.filter((_, j) => j !== i))}
                                className="hover:text-harvest-dark"
                              >✕</button>
                            </span>
                          ))}
                        </div>
                      )}
                      {extraDocs.length > 0 && candidate.cv_html && (
                        <button
                          onClick={handleUpdateWithDocs}
                          disabled={updatingWithDocs}
                          className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-60"
                          style={{ background: '#162518', color: '#E8DFD0', border: 'none', cursor: updatingWithDocs ? 'not-allowed' : 'pointer' }}
                        >
                          {updatingWithDocs && (
                            <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          )}
                          {updatingWithDocs ? 'Verwerken…' : 'Verwerk documenten in CV'}
                        </button>
                      )}
                    </div>

                    {candidate.cv_html && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditPanel('claude')}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium border transition-colors"
                          style={{ borderColor: '#162518', color: '#162518', background: 'transparent' }}
                        >
                          <Pencil size={15} />
                          CV bewerken
                        </button>
                        <button
                          onClick={() => { setVersionName(''); setVersionNameModalOpen(true) }}
                          className="flex items-center justify-center gap-1 px-3 py-2 rounded text-sm font-medium border transition-colors"
                          style={{ borderColor: '#162518', color: '#162518', background: 'transparent' }}
                          title="Versie opslaan"
                        >
                          <BookmarkPlus size={15} />
                        </button>
                      </div>
                    )}

                    <Button
                      onClick={handleClaudeCheck}
                      loading={pushing}
                      disabled={pushing || !candidate.cv_html}
                      variant="secondary"
                      className="w-full"
                    >
                      <ArrowUpRight size={16} className="mr-2" />
                      {pushSuccess ? 'Toegevoegd aan CV Tool ✓' : 'Push naar CV Tool'}
                    </Button>
                    {pushSuccess && (
                      <p className="text-xs text-green-600 text-center">
                        Kandidaat staat nu in de{' '}
                        <a href="https://harvest-cv-tool.vercel.app" target="_blank" rel="noopener noreferrer" className="underline">
                          CV Tool
                        </a>
                      </p>
                    )}

                    <div className="pt-3 border-t border-harvest-bg">
                      <p className="text-xs font-medium text-harvest-dark mb-2">Intake versturen</p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={intakeEmail}
                          onChange={(e) => setIntakeEmail(e.target.value)}
                          placeholder="email@kandidaat.nl"
                          className="flex-1 px-2 py-1.5 text-sm bg-harvest-bg border border-harvest-bg rounded focus:outline-none focus:ring-1 focus:ring-harvest-green"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleSendIntake}
                          loading={sendingIntake}
                          disabled={!intakeEmail}
                        >
                          <Send size={14} />
                        </Button>
                      </div>
                      {intakeSent && (
                        <p className="text-xs text-green-600 mt-1">Verstuurd!</p>
                      )}
                    </div>
                  </div>
                </Card>

                {intakeResponse && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Intake ontvangen</CardTitle>
                    </CardHeader>
                    <div className="text-sm text-harvest-muted space-y-1">
                      {intakeResponse.responses.self_introduction && (
                        <p className="italic text-harvest-dark">
                          &ldquo;{intakeResponse.responses.self_introduction}&rdquo;
                        </p>
                      )}
                      <p>{intakeResponse.responses.education?.length || 0} opleidingen</p>
                      <p>{intakeResponse.responses.work_experience?.length || 0} ervaringen</p>
                      <p>{intakeResponse.responses.skills?.length || 0} vaardigheden</p>
                    </div>
                  </Card>
                )}
              </div>

              {/* Right panel - CV Preview */}
              <div className="lg:col-span-2 space-y-4">
                {candidate.cv_html ? (
                  <>
                    {/* Version preview banner */}
                    {previewVersion && (
                      <div className="flex items-center justify-between px-4 py-2.5 rounded-lg text-sm" style={{ background: '#162518', color: '#E8DFD0' }}>
                        <span>
                          <Clock3 size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                          Versie bekijken: <strong>{previewVersion.name}</strong>
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRestoreVersion(previewVersion)}
                            className="text-xs px-3 py-1 rounded font-semibold"
                            style={{ background: '#d94f4f', color: '#fff', border: 'none', cursor: 'pointer' }}
                          >
                            Terugzetten
                          </button>
                          <button
                            onClick={() => setPreviewVersion(null)}
                            className="text-xs px-3 py-1 rounded font-semibold"
                            style={{ background: 'rgba(255,255,255,0.15)', color: '#E8DFD0', border: 'none', cursor: 'pointer' }}
                          >
                            Sluiten
                          </button>
                        </div>
                      </div>
                    )}

                    <CVPreview
                      html={previewVersion ? previewVersion.cv_html : candidate.cv_html}
                      candidateName={`${candidate.first_name} ${candidate.last_name}`}
                      onSave={previewVersion ? undefined : handleSaveCVInlineWithState}
                      saving={savingInline}
                    />

                    {/* Saved versions list */}
                    {cvVersions.length > 0 && (
                      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #e0d8d0' }}>
                        <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: '#F2EBE5' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5b5750' }}>
                            Opgeslagen versies
                          </span>
                          <span style={{ fontSize: '11px', color: '#9c9690' }}>{cvVersions.length} versie{cvVersions.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="divide-y" style={{ borderColor: '#e0d8d0' }}>
                          {cvVersions.map(v => (
                            <div key={v.id} className="flex items-center justify-between px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-harvest-dark">{v.name}</p>
                                <p className="text-xs text-harvest-muted">
                                  {new Date(v.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setPreviewVersion(previewVersion?.id === v.id ? null : v)}
                                  className="text-xs px-2.5 py-1 rounded border font-medium transition-colors"
                                  style={{ borderColor: previewVersion?.id === v.id ? '#162518' : '#c0b8b0', color: previewVersion?.id === v.id ? '#162518' : '#5b5750', background: 'transparent' }}
                                >
                                  {previewVersion?.id === v.id ? 'Actief' : 'Bekijken'}
                                </button>
                                <button
                                  onClick={() => handleDeleteVersion(v.id)}
                                  className="p-1 rounded transition-colors hover:text-harvest-error text-harvest-muted"
                                  title="Verwijderen"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <Card className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <Wand2 size={40} className="text-harvest-brown mx-auto mb-3" />
                      <h3 className="font-serif text-lg text-harvest-dark mb-2">Nog geen CV</h3>
                      <p className="text-harvest-muted text-sm mb-4">
                        Klik op &ldquo;CV genereren&rdquo; om een professioneel CV te maken.
                      </p>
                      <Button onClick={handleGenerateCV} loading={generating}>
                        <Wand2 size={16} className="mr-2" />
                        CV genereren
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Edit panel — right slide-out drawer */}
      {editPanelOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setEditPanelOpen(false)}
          />

          {/* Drawer */}
          <div
            className="fixed top-0 right-0 h-full z-50 flex flex-col shadow-2xl overflow-hidden"
            style={{ width: '420px', background: '#FFFBF5', borderLeft: '1px solid #e0d8d0' }}
          >
            {/* Drawer header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ background: '#162518', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            >
              <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E8DFD0' }}>
                CV Bewerken
              </span>
              <button
                onClick={() => setEditPanelOpen(false)}
                style={{ color: '#E8DFD0', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex shrink-0" style={{ borderBottom: '1px solid #e0d8d0' }}>
              {(['claude', 'manual'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className="flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors"
                  style={{
                    borderBottom: activeTab === tab ? '2px solid #162518' : '2px solid transparent',
                    color: activeTab === tab ? '#162518' : '#9c9690',
                    background: 'transparent',
                  }}
                >
                  {tab === 'claude' ? '✨ Verbeter met Claude' : 'Handmatig bewerken'}
                </button>
              ))}
            </div>

            {/* Section selector */}
            <div className="px-5 pt-4 shrink-0">
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5b5750', marginBottom: '6px' }}>
                Sectie
              </label>
              <select
                value={editSection}
                onChange={e => handleSectionChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-harvest-green"
                style={{ background: '#F2EBE5', borderColor: '#e0d8d0', color: '#162518' }}
              >
                {SECTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {activeTab === 'claude' ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5b5750', marginBottom: '6px' }}>
                      Extra instructies (optioneel)
                    </label>
                    <textarea
                      value={editInstructions}
                      onChange={e => setEditInstructions(e.target.value)}
                      placeholder="Bijv. maak beknopter, benadruk leiderschapskwaliteiten…"
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-harvest-green resize-none"
                      style={{ background: '#F2EBE5', borderColor: '#e0d8d0', color: '#162518' }}
                    />
                  </div>

                  <button
                    onClick={handleImproveSection}
                    disabled={improving}
                    className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-opacity"
                    style={{ background: '#d94f4f', color: '#fff', border: 'none', cursor: improving ? 'not-allowed' : 'pointer', opacity: improving ? 0.7 : 1 }}
                  >
                    {improving && (
                      <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    )}
                    {improving ? 'Claude werkt…' : 'Verbeter deze sectie'}
                  </button>

                  {improveError && (
                    <p className="text-sm" style={{ color: '#d94f4f' }}>{improveError}</p>
                  )}

                  {improvedHtml && (
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #e0d8d0' }}>
                      <div className="px-3 py-2" style={{ background: '#162518' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E8DFD0' }}>
                          Voorstel van Claude
                        </span>
                      </div>
                      <div
                        className="p-3 text-sm overflow-y-auto"
                        style={{ background: '#FFFBF5', maxHeight: '260px', lineHeight: 1.6, fontFamily: 'Libre Franklin, sans-serif', color: '#1c1f1a' }}
                        dangerouslySetInnerHTML={{ __html: improvedHtml }}
                      />
                      <div className="flex gap-2 p-3" style={{ borderTop: '1px solid #e0d8d0', background: '#F2EBE5' }}>
                        <button
                          onClick={handleAcceptImprovement}
                          className="flex-1 py-2 rounded text-sm font-semibold"
                          style={{ background: '#162518', color: '#E8DFD0', border: 'none', cursor: 'pointer' }}
                        >
                          Overnemen
                        </button>
                        <button
                          onClick={() => setImprovedHtml(null)}
                          className="flex-1 py-2 rounded text-sm font-semibold"
                          style={{ background: 'transparent', color: '#162518', border: '1px solid #c0b8b0', cursor: 'pointer' }}
                        >
                          Negeren
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5b5750', marginBottom: '6px' }}>
                      Tekst bewerken
                    </label>
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={16}
                      placeholder="Laad een sectie via het dropdown hierboven…"
                      className="w-full px-3 py-2 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-harvest-green"
                      style={{ background: '#F2EBE5', borderColor: '#e0d8d0', color: '#162518', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                    />
                    <p className="text-xs mt-1" style={{ color: '#9c9690' }}>
                      Bewerk de tekst van deze sectie. Opmaak (vetgedrukt, bullets) wordt vereenvoudigd bij opslaan.
                    </p>
                  </div>

                  <button
                    onClick={handleSaveManualEdit}
                    disabled={savingEdit || !editText.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-opacity"
                    style={{ background: '#162518', color: '#E8DFD0', border: 'none', cursor: savingEdit || !editText.trim() ? 'not-allowed' : 'pointer', opacity: savingEdit || !editText.trim() ? 0.6 : 1 }}
                  >
                    {savingEdit ? '…' : 'Opslaan'}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Claude quality check modal */}
      {claudeCheckOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-xl overflow-hidden shadow-2xl" style={{ background: '#FFFBF5' }}>
            <div className="px-6 py-4" style={{ background: '#162518' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#E8DFD0', margin: 0 }}>
                ✨ Claude controleert het CV
              </h2>
            </div>

            <div className="px-6 py-5">
              {claudeChecking ? (
                <div className="flex flex-col items-center py-6 gap-3">
                  <div className="w-8 h-8 border-2 border-harvest-green border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-harvest-muted">Even geduld, Claude leest het CV…</p>
                </div>
              ) : claudeCheckError ? (
                <div className="py-4">
                  <p className="text-sm" style={{ color: '#d94f4f' }}>{claudeCheckError}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-harvest-dark">
                    Claude heeft de volgende punten gevonden:
                  </p>
                  <ul className="space-y-2">
                    {claudeCheckFindings.map((finding, i) => (
                      <li key={i} className="flex gap-2 text-sm text-harvest-dark">
                        <span style={{ color: '#d94f4f', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div
              className="flex gap-3 px-6 py-4"
              style={{ borderTop: '1px solid #e0d8d0', background: '#F2EBE5' }}
            >
              <button
                onClick={() => setClaudeCheckOpen(false)}
                className="flex-1 py-2.5 rounded text-sm font-semibold"
                style={{ background: 'transparent', color: '#162518', border: '1px solid #c0b8b0', cursor: 'pointer' }}
              >
                Terug naar bewerken
              </button>
              <button
                onClick={doPushToCVTool}
                disabled={claudeChecking}
                className="flex-1 py-2.5 rounded text-sm font-semibold"
                style={{ background: '#162518', color: '#E8DFD0', border: 'none', cursor: claudeChecking ? 'not-allowed' : 'pointer', opacity: claudeChecking ? 0.6 : 1 }}
              >
                Toch doorzetten
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version name modal */}
      {versionNameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-xl overflow-hidden shadow-2xl" style={{ background: '#FFFBF5' }}>
            <div className="px-6 py-4" style={{ background: '#162518' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#E8DFD0', margin: 0 }}>
                Versie opslaan
              </h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-harvest-muted">Geef deze versie een naam, bijvoorbeeld de klant of de taal.</p>
              <input
                type="text"
                value={versionName}
                onChange={e => setVersionName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveVersion(); if (e.key === 'Escape') setVersionNameModalOpen(false) }}
                placeholder="Bijv. Shell — Engels, Accenture v2, NL-versie…"
                autoFocus
                className="w-full px-3 py-2 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-harvest-green"
                style={{ background: '#F2EBE5', borderColor: '#e0d8d0', color: '#162518' }}
              />
            </div>
            <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #e0d8d0', background: '#F2EBE5' }}>
              <button
                onClick={() => setVersionNameModalOpen(false)}
                className="flex-1 py-2 rounded text-sm font-semibold"
                style={{ background: 'transparent', color: '#162518', border: '1px solid #c0b8b0', cursor: 'pointer' }}
              >
                Annuleren
              </button>
              <button
                onClick={handleSaveVersion}
                disabled={savingVersion || !versionName.trim()}
                className="flex-1 py-2 rounded text-sm font-semibold"
                style={{ background: '#162518', color: '#E8DFD0', border: 'none', cursor: savingVersion || !versionName.trim() ? 'not-allowed' : 'pointer', opacity: savingVersion || !versionName.trim() ? 0.6 : 1 }}
              >
                {savingVersion ? '…' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
