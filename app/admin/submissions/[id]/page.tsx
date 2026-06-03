'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import type { Profile } from '@/types'

type Invite = {
  id: string
  candidate_name: string
  candidate_email: string
  submitted_at: string | null
  photo_url: string | null
  cv_url: string | null
  grade_list_url: string | null
  extra_doc_urls: string[] | null
  questionnaire_answers: Record<string, unknown> | null
  notes: string | null
  status: string
}

function DownloadButton({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.storage
      .from('candidate-uploads')
      .createSignedUrl(path, 60)
    if (data?.signedUrl) {
      setUrl(data.signedUrl)
      window.open(data.signedUrl, '_blank')
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-sm text-[#c1272d] hover:underline disabled:opacity-50"
    >
      {loading ? 'Laden…' : label}
    </button>
  )
}

function PhotoThumbnail({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.storage
      .from('candidate-uploads')
      .createSignedUrl(path, 300)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl)
      })
  }, [path])

  if (!url) return <div className="w-24 h-24 bg-gray-100 rounded animate-pulse" />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Profielfoto" className="w-24 h-24 object-cover rounded border" />
  )
}

function AnswerSection({ title, data }: { title: string; data: unknown }) {
  if (!data) return null
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b">
        <h3 className="font-semibold text-sm text-[#1a2b4b]">{title}</h3>
      </div>
      <div className="p-4">
        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  )
}

export default function SubmissionPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [profile, setProfile] = useState<Profile | null>(null)
  const [invite, setInvite] = useState<Invite | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        setProfile(data as Profile | null)
      })
    })
  }, [router])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('candidate_invites')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { router.push('/dashboard'); return }
        setInvite(data as Invite)
        setNotes(data.notes || '')
        setLoading(false)
      })
  }, [id, router])

  const saveNotes = async () => {
    setSavingNotes(true)
    const supabase = createClient()
    await supabase.from('candidate_invites').update({ notes }).eq('id', id)
    setSavingNotes(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  const answers = invite?.questionnaire_answers as Record<string, unknown> | null

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} />
      <div className="flex-1 flex flex-col">
        <Header profile={profile} />
        <main className="flex-1 p-8">
          {loading ? (
            <p className="text-sm text-gray-400 italic">Laden…</p>
          ) : invite ? (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center gap-3">
                <Link href="/dashboard" className="text-sm text-gray-500 hover:text-[#1a2b4b]">← Dashboard</Link>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start gap-6">
                  {invite.photo_url && <PhotoThumbnail path={invite.photo_url} />}
                  <div>
                    <h1 className="font-serif text-2xl text-[#1a2b4b] font-bold">{invite.candidate_name}</h1>
                    <p className="text-gray-500 text-sm">{invite.candidate_email}</p>
                    {invite.submitted_at && (
                      <p className="text-gray-400 text-xs mt-1">
                        Ingediend op {new Date(invite.submitted_at).toLocaleString('nl-NL')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-4">
                  {invite.cv_url && (
                    <DownloadButton path={invite.cv_url} label="Download CV (PDF)" />
                  )}
                  {invite.grade_list_url && (
                    <DownloadButton path={invite.grade_list_url} label="Download Cijferlijst (PDF)" />
                  )}
                  {invite.extra_doc_urls?.map((url, i) => (
                    <DownloadButton key={i} path={url} label={`Extra document ${i + 1}`} />
                  ))}
                </div>

                <div className="mt-6">
                  <Link
                    href={`/candidates/new-from-docs?name=${encodeURIComponent(invite.candidate_name)}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded border text-sm font-medium transition-colors"
                    style={{ borderColor: 'rgba(9,40,18,0.25)', color: '#092B13', background: '#F2EBE5' }}
                  >
                    Genereer CV
                  </Link>
                </div>
              </div>

              {answers && (
                <div className="space-y-4">
                  <h2 className="font-semibold text-[#1a2b4b]">Vragenlijst antwoorden</h2>
                  <AnswerSection title="Studie – Bachelor" data={answers.bachelor} />
                  <AnswerSection title="Studie – Master" data={answers.master} />
                  <AnswerSection title="Extra opleidingen / certificeringen" data={answers.extraOpleidingen} />
                  <AnswerSection title="Beste softwareprojecten" data={answers.softwareProjecten} />
                  <AnswerSection title="Externe stage-ervaring" data={answers.stages} />
                  <AnswerSection title="Praktijkprojecten / werkervaring" data={answers.praktijkProjecten} />
                  <AnswerSection title="Technische vaardigheden" data={answers.technicalSkills} />
                  <AnswerSection title="Cloud ervaring" data={answers.cloudProjecten} />
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="font-semibold text-[#1a2b4b] mb-3">Notities</h2>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1272d]"
                  placeholder="Interne notities over deze kandidaat…"
                />
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="px-4 py-2 text-sm rounded font-medium text-white transition-colors disabled:opacity-60"
                    style={{ background: '#1a2b4b' }}
                  >
                    {savingNotes ? 'Opslaan…' : 'Notities opslaan'}
                  </button>
                  {notesSaved && <span className="text-sm text-green-600">Opgeslagen!</span>}
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}
