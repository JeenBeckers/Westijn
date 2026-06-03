'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { PlusCircle, FileUp } from 'lucide-react'
import type { Profile, Candidate, CandidateEditor } from '@/types'

type CandidateInvite = {
  id: string
  candidate_name: string
  candidate_email: string
  status: string
  created_at: string
  expires_at: string
  submitted_at: string | null
  token: string
}

type CandidateWithProfile = Candidate & { profiles: { full_name: string } | null }

type SortColumn = 'name' | 'created_by' | 'created_at'
type SortDir = 'asc' | 'desc'

function InviteStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    submitted: 'bg-green-100 text-green-800 border-green-200',
    expired: 'bg-gray-100 text-gray-500 border-gray-200',
  }
  const labels: Record<string, string> = {
    pending: 'In behandeling',
    submitted: 'Ingediend',
    expired: 'Verlopen',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[status] ?? styles.expired}`}>
      {labels[status] ?? status}
    </span>
  )
}

function CandidateStatusBadge({ status }: { status: string }) {
  if (status === 'review') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ background: '#c1272d', color: '#fff' }}>
        Review
      </span>
    )
  }
  if (status === 'in_behandeling') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        In behandeling
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
      Archief
    </span>
  )
}

function NewInviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (invite: CandidateInvite) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CandidateInvite | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateName: name, candidateEmail: email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Mislukt'); return }
      setCreated(data.invite)
      onSuccess(data.invite)
    } catch {
      setError('Er is iets misgegaan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="font-serif text-lg font-semibold text-[#1a2b4b] mb-4">Kandidaat uitnodigen</h2>
        {created ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
              Uitnodiging verstuurd naar {created.candidate_email}!
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Portal link:</p>
              <p className="text-xs font-mono bg-gray-50 border rounded px-2 py-1 break-all">
                https://westijn.vercel.app/candidate/{created.token}
              </p>
            </div>
            <button onClick={onClose} className="w-full py-2 rounded bg-[#1a2b4b] text-white text-sm font-medium">Sluiten</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Naam kandidaat</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1272d]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mailadres</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1272d]"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Annuleren</button>
              <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded bg-[#c1272d] text-white font-medium hover:bg-[#a01f24] disabled:opacity-60">
                {loading ? 'Versturen…' : 'Uitnodigen'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const url = `https://westijn.vercel.app/candidate/${token}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors text-gray-600"
      title={url}
    >
      {copied ? '✓ Gekopieerd' : '🔗 Kopieer link'}
    </button>
  )
}

function ColleagueInviteSection() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.endsWith('@harvest.nl')) {
      setError('Alleen @harvest.nl e-mailadressen zijn toegestaan')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/invite-colleague', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Mislukt'); return }
      setSuccess(true)
      setEmail('')
    } catch {
      setError('Er is iets misgegaan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h2 className="font-serif font-semibold text-lg mb-4" style={{ color: '#092B13' }}>Collega uitnodigen</h2>
      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-md">
        {success ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
            Uitnodiging verstuurd naar {email || 'de opgegeven collega'}!
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mailadres collega</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null) }}
                placeholder="naam@harvest.nl"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1272d]"
              />
              {email && !email.endsWith('@harvest.nl') && (
                <p className="text-xs text-red-500 mt-1">Alleen @harvest.nl e-mailadressen zijn toegestaan</p>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || (!!email && !email.endsWith('@harvest.nl'))}
              className="px-4 py-2 text-sm rounded font-medium text-white transition-colors disabled:opacity-60"
              style={{ background: '#1a2b4b' }}
            >
              {loading ? 'Versturen…' : 'Verstuur uitnodiging'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

function DeleteModal({
  candidate,
  onConfirm,
  onCancel,
}: {
  candidate: CandidateWithProfile
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h2 className="font-serif text-lg font-semibold text-[#092B13] mb-2">CV verwijderen</h2>
        <p className="text-sm text-[#5b5750] mb-6">
          Weet je zeker dat je het CV van{' '}
          <span className="font-semibold">{candidate.first_name} {candidate.last_name}</span> wilt verwijderen?
          Dit kan niet ongedaan worden gemaakt.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border border-[rgba(9,40,18,0.15)] text-[#5b5750] hover:bg-[#F2EBE5] transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded bg-[#9C2A12] text-white hover:bg-[#7d2010] transition-colors font-medium"
          >
            Verwijderen
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewCard({ candidate }: { candidate: CandidateWithProfile }) {
  return (
    <div
      className="flex flex-col gap-3 p-[14px_16px] rounded-[6px] border transition-all duration-150"
      style={{
        background: '#FFF5F5',
        border: '1px solid rgba(156,42,18,0.15)',
        borderRadius: 6,
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = '#FDECEA'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = '#FFF5F5'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {candidate.photo_url && (
            <img
              src={candidate.photo_url}
              alt=""
              className="w-9 h-9 rounded-full object-cover shrink-0"
              style={{ border: '1.5px solid rgba(156,42,18,0.25)' }}
            />
          )}
          <div className="min-w-0">
            <p className="font-serif font-semibold truncate" style={{ fontSize: 14, color: '#092B13' }}>
              {candidate.first_name} {candidate.last_name}
            </p>
            <p className="truncate" style={{ fontSize: 12, color: '#5b5750' }}>
              Automatisch gegenereerd via kandidaatportaal
            </p>
          </div>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold"
          style={{ background: '#9C2A12', color: '#fff' }}
        >
          Review vereist
        </span>
      </div>

      <p style={{ fontSize: 10.5, color: '#8a847a' }}>
        Ingediend op {new Date(candidate.created_at).toLocaleDateString('nl-NL')}
      </p>

      <div className="flex gap-2 mt-1">
        <Link
          href={`/candidates/${candidate.id}`}
          className="flex-1 text-center px-3 py-1.5 text-xs rounded font-medium transition-colors text-white"
          style={{ background: '#9C2A12' }}
        >
          Bekijken &amp; bewerken
        </Link>
      </div>
    </div>
  )
}

function SortArrow({ col, active, dir }: { col: SortColumn; active: SortColumn; dir: SortDir }) {
  if (col !== active) return <span className="ml-1 text-gray-300">↕</span>
  return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
}

function CandidatesTable({
  candidates,
  onDelete,
}: {
  candidates: CandidateWithProfile[]
  onDelete: (c: CandidateWithProfile) => void
}) {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortColumn>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (col: SortColumn) => {
    if (col === sortCol) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return candidates.filter((c) => {
      if (!q) return true
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase()
      const role = (c.role ?? '').toLowerCase()
      const consultant = (c.profiles?.full_name ?? '').toLowerCase()
      return fullName.includes(q) || role.includes(q) || consultant.includes(q)
    })
  }, [candidates, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') {
        const an = `${a.first_name} ${a.last_name}`.toLowerCase()
        const bn = `${b.first_name} ${b.last_name}`.toLowerCase()
        cmp = an.localeCompare(bn)
      } else if (sortCol === 'created_by') {
        const an = (a.profiles?.full_name ?? '').toLowerCase()
        const bn = (b.profiles?.full_name ?? '').toLowerCase()
        cmp = an.localeCompare(bn)
      } else if (sortCol === 'created_at') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir])

  const thClass = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 select-none'
  const thSortClass = `${thClass} cursor-pointer hover:text-gray-700`

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Zoek op naam, rol of consultant..."
        className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#162518]"
      />

      <div className="bg-white w-full rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className={thSortClass} onClick={() => handleSort('name')}>
                Naam <SortArrow col="name" active={sortCol} dir={sortDir} />
              </th>
              <th className={thClass}>Rol</th>
              <th className={thClass}>Status</th>
              <th className={thSortClass} onClick={() => handleSort('created_by')}>
                Aangemaakt door <SortArrow col="created_by" active={sortCol} dir={sortDir} />
              </th>
              <th className={thSortClass} onClick={() => handleSort('created_at')}>
                Datum <SortArrow col="created_at" active={sortCol} dir={sortDir} />
              </th>
              <th className={thClass}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400 italic">
                  {search ? 'Geen kandidaten gevonden voor deze zoekopdracht' : 'Geen kandidaten'}
                </td>
              </tr>
            ) : (
              sorted.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#092B13]">
                    {c.first_name} {c.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.role || '—'}</td>
                  <td className="px-4 py-3">
                    <CandidateStatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.profiles?.full_name || 'Onbekend'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(c.created_at).toLocaleDateString('nl-NL')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/candidates/${c.id}`}
                        className="border border-gray-300 rounded px-3 py-1 text-xs hover:bg-gray-100 transition-colors text-gray-700"
                      >
                        Bekijk CV
                      </Link>
                      <button
                        onClick={() => onDelete(c)}
                        className="border border-gray-300 rounded px-3 py-1 text-xs hover:border-[#9C2A12] hover:text-[#9C2A12] transition-colors text-gray-500"
                      >
                        Verwijder
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [candidates, setCandidates] = useState<CandidateWithProfile[]>([])
  const [invites, setInvites] = useState<CandidateInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [toDelete, setToDelete] = useState<CandidateWithProfile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showNewInviteModal, setShowNewInviteModal] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const [{ data: prof }, { data: cands }, { data: inviteData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('candidates')
        .select('*, profiles:created_by(full_name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('candidate_invites')
        .select('*')
        .order('created_at', { ascending: false }),
    ])

    setProfile(prof as Profile | null)
    setCandidates((cands ?? []) as CandidateWithProfile[])
    setInvites((inviteData ?? []) as CandidateInvite[])
    setLoading(false)
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/candidates/${toDelete.id}`, { method: 'DELETE' })
      if (res.ok) {
        setCandidates((prev) => prev.filter((c) => c.id !== toDelete.id))
      }
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  const review = candidates.filter((c) => c.status === 'review')
  const nonReview = candidates.filter((c) => c.status !== 'review')

  return (
    <div className="flex min-h-screen">
      {toDelete && (
        <DeleteModal
          candidate={toDelete}
          onConfirm={handleDelete}
          onCancel={() => !deleting && setToDelete(null)}
        />
      )}
      {showNewInviteModal && (
        <NewInviteModal
          onClose={() => setShowNewInviteModal(false)}
          onSuccess={(invite) => setInvites((prev) => [invite, ...prev])}
        />
      )}
      <Sidebar profile={profile} />
      <div className="flex-1 flex flex-col">
        <Header profile={profile} />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-10">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-serif text-2xl text-harvest-dark">Kandidaten</h1>
                <p className="text-harvest-muted text-sm mt-1">
                  {loading ? '…' : `${candidates.length} kandidaten totaal`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/candidates/new-from-docs"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded border text-sm font-medium transition-colors"
                  style={{
                    borderColor: 'rgba(9,40,18,0.25)',
                    color: '#092B13',
                    background: '#F2EBE5',
                  }}
                >
                  <FileUp size={16} />
                  Genereer via documenten
                </Link>
                <Link
                  href="/candidates/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-harvest-dark text-white rounded hover:bg-harvest-green transition-colors text-sm font-medium"
                >
                  <PlusCircle size={16} />
                  ＋ Genereer via HTML
                </Link>
              </div>
            </div>

            {/* Review section — stays as cards */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif font-semibold text-lg" style={{ color: '#092B13' }}>
                  Review
                </h2>
                {!loading && review.length > 0 && (
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: '#9C2A12', color: '#fff' }}
                  >
                    {review.length} vereist
                  </span>
                )}
              </div>
              {loading ? (
                <p className="text-sm text-harvest-muted italic">Laden…</p>
              ) : review.length === 0 ? (
                <p className="text-sm text-harvest-muted italic">Geen kandidaten die review vereisen</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {review.map((c) => (
                    <ReviewCard key={c.id} candidate={c} />
                  ))}
                </div>
              )}
            </section>

            {/* Unified candidates table */}
            <section>
              <h2 className="font-serif font-semibold text-lg mb-4" style={{ color: '#092B13' }}>
                Alle kandidaten
              </h2>
              {loading ? (
                <p className="text-sm text-harvest-muted italic">Laden…</p>
              ) : (
                <CandidatesTable candidates={nonReview} onDelete={setToDelete} />
              )}
            </section>

            {/* Kandidaatuitnodigingen */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif font-semibold text-lg" style={{ color: '#092B13' }}>
                  Kandidaatuitnodigingen
                </h2>
                <button
                  onClick={() => setShowNewInviteModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white transition-colors"
                  style={{ background: '#c1272d' }}
                >
                  <PlusCircle size={16} />
                  Nieuw uitnodigen
                </button>
              </div>
              {loading ? (
                <p className="text-sm text-harvest-muted italic">Laden…</p>
              ) : invites.length === 0 ? (
                <p className="text-sm text-harvest-muted italic">Nog geen uitnodigingen verstuurd</p>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Naam</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Verzonden op</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Verloopt / Ingediend</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Link</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((inv) => (
                        <tr key={inv.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-[#092B13]">{inv.candidate_name}</td>
                          <td className="px-4 py-3 text-gray-500">{inv.candidate_email}</td>
                          <td className="px-4 py-3"><InviteStatusBadge status={inv.status} /></td>
                          <td className="px-4 py-3 text-gray-500">{new Date(inv.created_at).toLocaleDateString('nl-NL')}</td>
                          <td className="px-4 py-3 text-gray-500">
                            {inv.submitted_at
                              ? new Date(inv.submitted_at).toLocaleDateString('nl-NL')
                              : new Date(inv.expires_at).toLocaleDateString('nl-NL')}
                          </td>
                          <td className="px-4 py-3">
                            <CopyLinkButton token={inv.token} />
                          </td>
                          <td className="px-4 py-3">
                            {inv.status === 'submitted' && (
                              <Link
                                href={`/admin/submissions/${inv.id}`}
                                className="text-xs font-medium text-[#c1272d] hover:underline"
                              >
                                Bekijken
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          </div>
        </main>
      </div>
    </div>
  )
}
