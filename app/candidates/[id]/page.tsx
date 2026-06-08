'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { CVPreview } from '@/components/cv/CVPreview'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Wand2, Send, ArrowLeft, User, MapPin, Clock, Globe, ArrowUpRight } from 'lucide-react'
import type { Candidate, Profile, IntakeResponse } from '@/types'

export default function CandidateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [intakeResponse, setIntakeResponse] = useState<IntakeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sendingIntake, setSendingIntake] = useState(false)
  const [intakeEmail, setIntakeEmail] = useState('')
  const [intakeSent, setIntakeSent] = useState(false)
  const [refineText, setRefineText] = useState('')
  const [refining, setRefining] = useState(false)
  const [generationNotes, setGenerationNotes] = useState('')
  const [sectionNotesOpen, setSectionNotesOpen] = useState(false)
  const [sectionNotes, setSectionNotes] = useState<Record<string, string>>({
    review: '',
    opleiding: '',
    relevanteSkills: '',
    interesses: '',
    talen: '',
    skills: '',
    werkervaring: '',
    projecten: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [pushSuccess, setPushSuccess] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoStatus, setPhotoStatus] = useState<'' | 'removing' | 'uploading'>('')
  const [editingAge, setEditingAge] = useState(false)
  const [ageInput, setAgeInput] = useState<string>('')
  const [savingAge, setSavingAge] = useState(false)

  // Per-section improvement state
  const [improvePanelOpen, setImprovePanelOpen] = useState(false)
  const [improveSection, setImproveSection] = useState('werkervaring')
  const [improveInstructions, setImproveInstructions] = useState('')
  const [improving, setImproving] = useState(false)
  const [improvedHtml, setImprovedHtml] = useState<string | null>(null)
  const [improveError, setImproveError] = useState<string | null>(null)

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

      // Get intake response if exists
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

  async function handleRefineCV() {
    if (!candidate?.cv_html || !refineText.trim()) return
    setRefining(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-cv', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          currentHtml: candidate.cv_html,
          instruction: refineText,
        }),
      })
      if (!res.ok) throw new Error('Verfijnen mislukt')
      const { html } = await res.json()
      setCandidate(prev => prev ? { ...prev, cv_html: html } : null)
      setRefineText('')
      setSavedAt(new Date())
      await trackEditor()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verfijnen mislukt')
    } finally {
      setRefining(false)
    }
  }

  async function handlePushToCVTool() {
    if (!candidate) return
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

  async function handleRefineBySections() {
    if (!candidate?.cv_html) return
    const hasNotes = Object.values(sectionNotes).some(v => v.trim())
    if (!hasNotes) return
    setRefining(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-cv', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          currentHtml: candidate.cv_html,
          instruction: '',
          sectionNotes,
        }),
      })
      if (!res.ok) throw new Error('Verfijnen mislukt')
      const { html } = await res.json()
      setCandidate(prev => prev ? { ...prev, cv_html: html } : null)
      setSavedAt(new Date())
      await trackEditor()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verfijnen mislukt')
    } finally {
      setRefining(false)
    }
  }

  // Extract a named section from full CV HTML using heuristics on class names / headings
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

    // Find h2 headings that match the section name
    const headings = doc.querySelectorAll('h2')
    for (const h2 of headings) {
      const text = h2.textContent?.toLowerCase() || ''
      if (keywords.some(kw => text.includes(kw))) {
        // Return the closest ancestor div that wraps this section
        const sectionDiv = h2.closest('.section-head')?.parentElement
        if (sectionDiv) return sectionDiv.outerHTML
        return h2.parentElement?.outerHTML || h2.outerHTML
      }
    }

    // Fallback: find elements with data-section attribute or matching class
    const allDivs = doc.querySelectorAll('[class]')
    for (const el of allDivs) {
      const cls = el.className?.toLowerCase() || ''
      if (keywords.some(kw => cls.includes(kw.replace(' ', '-')))) {
        return (el as HTMLElement).outerHTML
      }
    }

    return ''
  }

  function patchSectionHtml(cvHtml: string, sectionName: string, newSectionHtml: string): string {
    const original = extractSectionHtml(cvHtml, sectionName)
    if (!original) return cvHtml
    return cvHtml.replace(original, newSectionHtml)
  }

  async function handleImproveSection() {
    if (!candidate?.cv_html) return
    setImproving(true)
    setImproveError(null)
    setImprovedHtml(null)

    const sectionHtml = extractSectionHtml(candidate.cv_html, improveSection)
    if (!sectionHtml) {
      setImproveError(`Sectie "${improveSection}" niet gevonden in het CV. Probeer een andere sectie.`)
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
          sectionName: improveSection,
          candidateContext,
          extraInstructions: improveInstructions || undefined,
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
    if (!candidate?.cv_html || !improvedHtml) return
    const updatedHtml = patchSectionHtml(candidate.cv_html, improveSection, improvedHtml)
    const { error: dbError } = await supabase
      .from('candidates')
      .update({ cv_html: updatedHtml, updated_at: new Date().toISOString() })
      .eq('id', candidate.id)
    if (dbError) {
      setImproveError(dbError.message)
      return
    }
    setCandidate(prev => prev ? { ...prev, cv_html: updatedHtml } : null)
    setSavedAt(new Date())
    setImprovedHtml(null)
    setImproveInstructions('')
    await trackEditor()
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
      // Step 1: Remove background using @imgly/background-removal (browser-based, no API key)
      const bgRemovalModule = await import('@imgly/background-removal')
      const removeBackground = bgRemovalModule.default as unknown as (input: File) => Promise<Blob>
      const transparentBlob = await removeBackground(file)

      // Step 2: Composite onto harvest beige background using Canvas
      const img = new Image()
      img.src = URL.createObjectURL(transparentBlob)
      await new Promise<void>((r) => { img.onload = () => r() })

      const bgCanvas = document.createElement('canvas')
      bgCanvas.width = img.naturalWidth
      bgCanvas.height = img.naturalHeight
      const bgCtx = bgCanvas.getContext('2d')!
      bgCtx.fillStyle = '#E8DFD0' // harvest beige
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height)
      bgCtx.drawImage(img, 0, 0)
      URL.revokeObjectURL(img.src)

      const processedBlob = await new Promise<Blob>((resolve) =>
        bgCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85)
      )

      setPhotoStatus('uploading')

      // Step 3: Compress via Canvas API (resize to max 600px)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Foto uploaden mislukt')
    } finally {
      setUploadingPhoto(false)
      setPhotoStatus('')
      e.target.value = ''
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
                {/* Status badge */}
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

                {/* Status transition buttons */}
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
                {/* Candidate info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Kandidaatgegevens</CardTitle>
                  </CardHeader>
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-col gap-2">
                      {candidate.photo_url && (
                        <img
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
                            {uploadingPhoto ? (
                              <span className="inline-block w-3 h-3 border border-harvest-green border-t-transparent rounded-full animate-spin" />
                            ) : null}
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

                {/* Actions */}
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

                    <Button
                      onClick={handlePushToCVTool}
                      loading={pushing}
                      disabled={pushing}
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

                {/* Intake response summary */}
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
                    <CVPreview
                      html={candidate.cv_html}
                      candidateName={`${candidate.first_name} ${candidate.last_name}`}
                    />

                    {/* Refine CV */}
                    <Card>
                      <CardHeader>
                        <CardTitle>CV verfijnen</CardTitle>
                      </CardHeader>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={refineText}
                          onChange={(e) => setRefineText(e.target.value)}
                          placeholder="Bijv: Maak de beoordeling korter, voeg hobby&apos;s toe..."
                          className="flex-1 px-3 py-2 text-sm bg-harvest-bg border border-harvest-bg rounded focus:outline-none focus:ring-2 focus:ring-harvest-green"
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRefineCV() }}
                        />
                        <Button
                          onClick={handleRefineCV}
                          loading={refining}
                          disabled={!refineText.trim()}
                        >
                          Aanpassen
                        </Button>
                      </div>
                    </Card>

                    {/* Per-section AI improvement */}
                    <div style={{ background: '#162518', borderRadius: '8px', overflow: 'hidden' }}>
                      <button
                        onClick={() => { setImprovePanelOpen(o => !o); setImprovedHtml(null); setImproveError(null) }}
                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                        style={{ background: 'transparent' }}
                      >
                        <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8DFD0' }}>
                          ✨ Per sectie verbeteren met Claude
                        </span>
                        <span style={{ color: '#E8DFD0', fontSize: '14px' }}>
                          {improvePanelOpen ? '▾' : '▸'}
                        </span>
                      </button>

                      {improvePanelOpen && (
                        <div className="px-4 pb-4 space-y-3">
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8DFD0', marginBottom: '6px' }}>
                              Sectie
                            </label>
                            <select
                              value={improveSection}
                              onChange={(e) => { setImproveSection(e.target.value); setImprovedHtml(null); setImproveError(null) }}
                              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#E8DFD0', color: '#162518', border: 'none', borderRadius: '6px', fontFamily: 'inherit' }}
                            >
                              <option value="werkervaring">Werkervaring</option>
                              <option value="opleiding">Opleiding</option>
                              <option value="skills">Skills</option>
                              <option value="samenvatting">Samenvatting / Profiel / Beoordeling</option>
                              <option value="projecten">Projecten</option>
                              <option value="talen">Talen</option>
                              <option value="interesses">Interesses & hobbies</option>
                              <option value="relevanteSkills">Relevante skills</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8DFD0', marginBottom: '6px' }}>
                              Extra instructies (optioneel)
                            </label>
                            <textarea
                              value={improveInstructions}
                              onChange={(e) => setImproveInstructions(e.target.value)}
                              placeholder="Bijv. maak beknopter, benadruk leiderschapskwaliteiten…"
                              rows={2}
                              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#E8DFD0', color: '#162518', border: 'none', borderRadius: '6px', resize: 'none', fontFamily: 'inherit' }}
                            />
                          </div>

                          <button
                            onClick={handleImproveSection}
                            disabled={improving}
                            style={{ background: '#d94f4f', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: improving ? 'not-allowed' : 'pointer', opacity: improving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            {improving && <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                            {improving ? 'Claude werkt…' : 'Verbeter deze sectie'}
                          </button>

                          {improveError && (
                            <p style={{ fontSize: '12px', color: '#f87171', margin: 0 }}>{improveError}</p>
                          )}

                          {improvedHtml && (
                            <div style={{ background: '#E8DFD0', borderRadius: '6px', padding: '12px' }}>
                              <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#162518', marginBottom: '8px' }}>
                                Verbeterde sectie — preview
                              </p>
                              <div
                                style={{ background: '#FFFBF5', borderRadius: '4px', padding: '12px', fontSize: '12px', lineHeight: 1.5, color: '#1c1f1a', maxHeight: '220px', overflowY: 'auto', fontFamily: 'Libre Franklin, sans-serif' }}
                                dangerouslySetInnerHTML={{ __html: improvedHtml }}
                              />
                              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                <button
                                  onClick={handleAcceptImprovement}
                                  style={{ background: '#162518', color: '#E8DFD0', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  Overnemen
                                </button>
                                <button
                                  onClick={() => { setImprovedHtml(null) }}
                                  style={{ background: 'transparent', color: '#162518', border: '1px solid rgba(22,37,24,0.4)', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  Negeren
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Per-section refinement */}
                    <div style={{ background: '#F2EBE5' }} className="rounded-lg overflow-hidden">
                      <button
                        onClick={() => setSectionNotesOpen(o => !o)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                        style={{ background: 'transparent' }}
                      >
                        <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#092B13' }}>
                          Verfijn per sectie
                        </span>
                        <span style={{ color: '#092B13', fontSize: '14px' }}>
                          {sectionNotesOpen ? '▾' : '▸'}
                        </span>
                      </button>

                      {sectionNotesOpen && (
                        <div className="px-4 pb-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {([
                              { key: 'review', label: 'Beoordeling' },
                              { key: 'opleiding', label: 'Opleiding' },
                              { key: 'relevanteSkills', label: 'Relevante skills' },
                              { key: 'interesses', label: 'Interesses & hobbies' },
                              { key: 'talen', label: 'Talen' },
                              { key: 'skills', label: 'Skills (pagina 2)' },
                              { key: 'werkervaring', label: 'Werkervaring' },
                              { key: 'projecten', label: 'Projecten' },
                            ] as { key: string; label: string }[]).map(({ key, label }) => (
                              <div key={key}>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#092B13', marginBottom: '4px' }}>
                                  {label}
                                </label>
                                <textarea
                                  value={sectionNotes[key]}
                                  onChange={(e) => setSectionNotes(prev => ({ ...prev, [key]: e.target.value }))}
                                  placeholder="Bijv. maak korter / voeg X toe / verwijder Y…"
                                  style={{ minHeight: '60px', background: '#FFFBF5', border: '1px solid rgba(9,40,18,0.18)' }}
                                  className="w-full px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-harvest-green resize-none"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="mt-4">
                            <Button
                              onClick={handleRefineBySections}
                              loading={refining}
                              disabled={!Object.values(sectionNotes).some(v => v.trim())}
                              style={{ background: '#092B13', color: '#fff' }}
                            >
                              Verfijn CV
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
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
    </div>
  )
}
