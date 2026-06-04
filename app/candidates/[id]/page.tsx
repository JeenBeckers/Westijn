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
import { Wand2, Send, ArrowLeft, User, MapPin, Clock, Globe, ArrowUpRight, ExternalLink } from 'lucide-react'
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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !candidate) return
    setUploadingPhoto(true)
    setError(null)
    try {
      // Compress via Canvas API
      const bitmap = await createImageBitmap(file)
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
                            Foto vervangen
                          </span>
                        </label>
                      </div>
                      <a
                        href="https://www.remove.bg"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-harvest-muted underline flex items-center gap-1"
                      >
                        <ExternalLink size={11} /> Achtergrond verwijderen via remove.bg
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-harvest-muted">
                      <User size={14} />
                      <span>{candidate.age ? `${candidate.age} jaar` : 'Leeftijd onbekend'}</span>
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
