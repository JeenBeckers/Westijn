'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

type Invite = {
  id: string
  token: string
  candidate_name: string
  candidate_email: string
  status: string
  expires_at: string
}

type RepeatableItem = {
  id: string
  [key: string]: string
}

type ExtraOpleiding = RepeatableItem & { naam: string; onderwerpen: string; begindatum: string; einddatum: string }
type SoftwareProject = RepeatableItem & { doel: string; talen: string; begindatum: string; einddatum: string }
type Stage = RepeatableItem & { organisatie: string; tooling: string; begindatum: string; einddatum: string }
type PraktijkProject = RepeatableItem & { watGedaan: string; tools: string; begindatum: string; einddatum: string }
type CloudProject = RepeatableItem & { project: string; technologieen: string; begindatum: string; einddatum: string }

function makeItem(fields: Record<string, string>): RepeatableItem {
  return { id: crypto.randomUUID(), ...fields }
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      <div className="px-6 py-3" style={{ background: '#1a2b4b' }}>
        <h2 className="text-white font-semibold text-sm tracking-wide uppercase">{title}</h2>
      </div>
      <div className="bg-white p-6 space-y-4">{children}</div>
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1272d] focus:border-transparent"
      />
    </div>
  )
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1272d] focus:border-transparent resize-y"
      />
    </div>
  )
}

function MonthYear({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="month"
        value={value ? `${value.split('-')[1]}-${value.split('-')[0]}` : ''}
        onChange={(e) => {
          if (e.target.value) {
            const [yr, mo] = e.target.value.split('-')
            onChange(`${mo}-${yr}`)
          } else {
            onChange('')
          }
        }}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1272d] focus:border-transparent"
      />
    </div>
  )
}

function RepeatableSection<T extends RepeatableItem>({
  items,
  onChange,
  renderItem,
  onAdd,
  addLabel = '+ Toevoegen',
  maxItems,
}: {
  items: T[]
  onChange: (items: T[]) => void
  renderItem: (item: T, update: (field: string, value: string) => void) => React.ReactNode
  onAdd: () => T
  addLabel?: string
  maxItems?: number
}) {
  const updateItem = (id: string, field: string, value: string) => {
    onChange(items.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  }
  const removeItem = (id: string) => {
    onChange(items.filter((it) => it.id !== id))
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="border border-gray-200 rounded-md p-4 relative">
          {renderItem(item, (field, value) => updateItem(item.id, field, value))}
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            className="mt-3 text-xs text-red-600 hover:text-red-800"
          >
            × Verwijder
          </button>
        </div>
      ))}
      {(!maxItems || items.length < maxItems) && (
        <button
          type="button"
          onClick={() => onChange([...items, onAdd()])}
          className="text-sm font-medium text-[#1a2b4b] hover:text-[#c1272d] border border-[#1a2b4b] rounded-md px-3 py-1.5 transition-colors"
        >
          {addLabel}
        </button>
      )}
    </div>
  )
}

export default function CandidatePortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const [token, setToken] = useState<string | null>(null)
  const [invite, setInvite] = useState<Invite | null>(null)
  const [pageStatus, setPageStatus] = useState<'loading' | 'expired' | 'submitted' | 'pending' | 'error'>('loading')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Form state
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [gradeListFile, setGradeListFile] = useState<File | null>(null)

  // Section 2: Studie
  const [bachelorGrade, setBachelorGrade] = useState('')
  const [masterGrade, setMasterGrade] = useState('')
  const [bachelorStart, setBachelorStart] = useState('')
  const [bachelorEnd, setBachelorEnd] = useState('')
  const [masterStart, setMasterStart] = useState('')
  const [masterEnd, setMasterEnd] = useState('')
  const [bachelorCourses, setBachelorCourses] = useState('')
  const [masterCourses, setMasterCourses] = useState('')
  const [bachelorThesisTitle, setBachelorThesisTitle] = useState('')
  const [bachelorThesisGrade, setBachelorThesisGrade] = useState('')
  const [bachelorThesisStart, setBachelorThesisStart] = useState('')
  const [bachelorThesisEnd, setBachelorThesisEnd] = useState('')
  const [masterThesisTitle, setMasterThesisTitle] = useState('')
  const [masterThesisGrade, setMasterThesisGrade] = useState('')
  const [masterThesisStart, setMasterThesisStart] = useState('')
  const [masterThesisEnd, setMasterThesisEnd] = useState('')

  // Section 3: Extra opleidingen
  const [extraOpleidingen, setExtraOpleidingen] = useState<ExtraOpleiding[]>([])

  // Section 4: Beste softwareprojecten
  const [softwareProjecten, setSoftwareProjecten] = useState<SoftwareProject[]>([])

  // Section 5: Externe stage
  const [stages, setStages] = useState<Stage[]>([])

  // Section 6: Praktijkprojecten
  const [praktijkProjecten, setPraktijkProjecten] = useState<PraktijkProject[]>([])

  // Section 7: Tools & talen
  const [programmeertalen, setProgrammeertalen] = useState('')
  const [libraries, setLibraries] = useState('')
  const [tools, setTools] = useState('')
  const [platforms, setPlatforms] = useState('')
  const [toolsToelichting, setToolsToelichting] = useState('')

  // Section 8: Cloud ervaring
  const [cloudProjecten, setCloudProjecten] = useState<CloudProject[]>([])

  useEffect(() => {
    params.then((p) => setToken(p.token))
  }, [params])

  useEffect(() => {
    if (!token) return
    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        if (res.status === 404) { setPageStatus('error'); return }
        if (res.status === 410) { setPageStatus('expired'); return }
        const data = await res.json()
        setInvite(data.invite)
        if (data.invite.status === 'submitted') {
          setPageStatus('submitted')
        } else {
          setPageStatus('pending')
        }
      })
      .catch(() => setPageStatus('error'))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cvFile) { setSubmitError('CV is verplicht.'); return }
    setSubmitting(true)
    setSubmitError(null)

    const answers = {
      bachelor: {
        grade: bachelorGrade,
        start: bachelorStart,
        end: bachelorEnd,
        courses: bachelorCourses,
        thesis: { title: bachelorThesisTitle, grade: bachelorThesisGrade, start: bachelorThesisStart, end: bachelorThesisEnd },
      },
      master: {
        grade: masterGrade,
        start: masterStart,
        end: masterEnd,
        courses: masterCourses,
        thesis: { title: masterThesisTitle, grade: masterThesisGrade, start: masterThesisStart, end: masterThesisEnd },
      },
      extraOpleidingen,
      softwareProjecten,
      stages,
      praktijkProjecten,
      technicalSkills: { programmeertalen, libraries, tools, platforms, toelichting: toolsToelichting },
      cloudProjecten,
    }

    const fd = new FormData()
    fd.append('questionnaireAnswers', JSON.stringify(answers))
    if (photoFile) fd.append('photo', photoFile)
    fd.append('cvFile', cvFile)
    if (gradeListFile) fd.append('gradeList', gradeListFile)

    try {
      const res = await fetch(`/api/invites/${token}`, { method: 'PUT', body: fd })
      if (!res.ok) {
        const data = await res.json()
        setSubmitError(data.error || 'Er is iets misgegaan.')
        return
      }
      setPageStatus('submitted')
    } catch {
      setSubmitError('Er is iets misgegaan. Probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  if (pageStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Laden…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Image src="/harvest-logo-dark.png" alt="Harvest" width={120} height={36} className="object-contain" />
          <span className="text-gray-400">|</span>
          <span className="text-[#1a2b4b] font-semibold">Kandidaatsportaal</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {pageStatus === 'expired' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700 font-medium">Deze link is verlopen.</p>
            <p className="text-red-600 text-sm mt-1">Neem contact op met je Harvest consultant.</p>
          </div>
        )}

        {pageStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700 font-medium">Ongeldige link.</p>
            <p className="text-red-600 text-sm mt-1">Neem contact op met je Harvest consultant.</p>
          </div>
        )}

        {pageStatus === 'submitted' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <div className="text-4xl mb-4">✓</div>
            <p className="text-green-800 font-semibold text-lg">Bedankt! Je gegevens zijn ontvangen.</p>
            <p className="text-green-700 text-sm mt-2">Je consultant neemt contact met je op.</p>
          </div>
        )}

        {pageStatus === 'pending' && invite && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h1 className="font-bold text-2xl text-[#1a2b4b]">Welkom, {invite.candidate_name}</h1>
              <p className="text-gray-500 text-sm mt-1">Vul onderstaande gegevens zo volledig mogelijk in.</p>
            </div>

            {/* Section 1: Profielfoto */}
            <SectionCard title="1. Profielfoto">
              <p className="text-sm text-gray-500">Upload een nette, recente pasfoto (liefst van voren genomen)</p>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="block text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-[#1a2b4b] file:text-white hover:file:bg-[#c1272d] file:cursor-pointer"
              />
              {photoFile && <p className="text-xs text-gray-500">{photoFile.name}</p>}
            </SectionCard>

            {/* Section 2: Studie */}
            <SectionCard title="2. Studie">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Gemiddeld cijfer bachelor" value={bachelorGrade} onChange={setBachelorGrade} placeholder="bijv. 7.5" />
                <Input label="Gemiddeld cijfer master" value={masterGrade} onChange={setMasterGrade} placeholder="bijv. 8.0" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <MonthYear label="Bachelor begindatum" value={bachelorStart} onChange={setBachelorStart} />
                <MonthYear label="Bachelor einddatum" value={bachelorEnd} onChange={setBachelorEnd} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <MonthYear label="Master begindatum" value={masterStart} onChange={setMasterStart} />
                <MonthYear label="Master einddatum" value={masterEnd} onChange={setMasterEnd} />
              </div>
              <Textarea label="Vakken bachelor" value={bachelorCourses} onChange={setBachelorCourses} placeholder="Lijst van gevolgde vakken" />
              <Textarea label="Vakken master" value={masterCourses} onChange={setMasterCourses} placeholder="Lijst van gevolgde vakken" />
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-[#1a2b4b] mb-3">Thesis bachelor</p>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Titel" value={bachelorThesisTitle} onChange={setBachelorThesisTitle} />
                  <Input label="Cijfer" value={bachelorThesisGrade} onChange={setBachelorThesisGrade} />
                  <MonthYear label="Begindatum" value={bachelorThesisStart} onChange={setBachelorThesisStart} />
                  <MonthYear label="Einddatum" value={bachelorThesisEnd} onChange={setBachelorThesisEnd} />
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-[#1a2b4b] mb-3">Thesis master</p>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Titel" value={masterThesisTitle} onChange={setMasterThesisTitle} />
                  <Input label="Cijfer" value={masterThesisGrade} onChange={setMasterThesisGrade} />
                  <MonthYear label="Begindatum" value={masterThesisStart} onChange={setMasterThesisStart} />
                  <MonthYear label="Einddatum" value={masterThesisEnd} onChange={setMasterThesisEnd} />
                </div>
              </div>
            </SectionCard>

            {/* Section 3: Extra opleidingen */}
            <SectionCard title="3. Extra opleidingen / certificeringen">
              <RepeatableSection<ExtraOpleiding>
                items={extraOpleidingen}
                onChange={setExtraOpleidingen}
                onAdd={() => makeItem({ naam: '', onderwerpen: '', begindatum: '', einddatum: '' }) as ExtraOpleiding}
                addLabel="+ Opleiding toevoegen"
                renderItem={(item, update) => (
                  <div className="space-y-3">
                    <Input label="Naam" value={item.naam} onChange={(v) => update('naam', v)} />
                    <Textarea label="Onderwerpen / talen / frameworks" value={item.onderwerpen} onChange={(v) => update('onderwerpen', v)} />
                    <div className="grid grid-cols-2 gap-4">
                      <MonthYear label="Begindatum" value={item.begindatum} onChange={(v) => update('begindatum', v)} />
                      <MonthYear label="Einddatum" value={item.einddatum} onChange={(v) => update('einddatum', v)} />
                    </div>
                  </div>
                )}
              />
            </SectionCard>

            {/* Section 4: Beste softwareprojecten */}
            <SectionCard title="4. Beste softwareprojecten tijdens studie">
              <RepeatableSection<SoftwareProject>
                items={softwareProjecten}
                onChange={setSoftwareProjecten}
                onAdd={() => makeItem({ doel: '', talen: '', begindatum: '', einddatum: '' }) as SoftwareProject}
                addLabel="+ Project toevoegen"
                renderItem={(item, update) => (
                  <div className="space-y-3">
                    <Textarea label="Doel / opdracht" value={item.doel} onChange={(v) => update('doel', v)} />
                    <Textarea label="Programmeertalen / frameworks" value={item.talen} onChange={(v) => update('talen', v)} />
                    <div className="grid grid-cols-2 gap-4">
                      <MonthYear label="Begindatum" value={item.begindatum} onChange={(v) => update('begindatum', v)} />
                      <MonthYear label="Einddatum" value={item.einddatum} onChange={(v) => update('einddatum', v)} />
                    </div>
                  </div>
                )}
              />
            </SectionCard>

            {/* Section 5: Externe stage */}
            <SectionCard title="5. Externe stage-ervaring">
              <RepeatableSection<Stage>
                items={stages}
                onChange={setStages}
                onAdd={() => makeItem({ organisatie: '', tooling: '', begindatum: '', einddatum: '' }) as Stage}
                addLabel="+ Stage toevoegen"
                renderItem={(item, update) => (
                  <div className="space-y-3">
                    <Input label="Organisatie" value={item.organisatie} onChange={(v) => update('organisatie', v)} />
                    <Textarea label="Tooling / frameworks / talen" value={item.tooling} onChange={(v) => update('tooling', v)} />
                    <div className="grid grid-cols-2 gap-4">
                      <MonthYear label="Begindatum" value={item.begindatum} onChange={(v) => update('begindatum', v)} />
                      <MonthYear label="Einddatum" value={item.einddatum} onChange={(v) => update('einddatum', v)} />
                    </div>
                  </div>
                )}
              />
            </SectionCard>

            {/* Section 6: Praktijkprojecten */}
            <SectionCard title="6. Praktijkprojecten / werkervaring">
              <RepeatableSection<PraktijkProject>
                items={praktijkProjecten}
                onChange={setPraktijkProjecten}
                onAdd={() => makeItem({ watGedaan: '', tools: '', begindatum: '', einddatum: '' }) as PraktijkProject}
                addLabel="+ Project toevoegen"
                renderItem={(item, update) => (
                  <div className="space-y-3">
                    <Textarea label="Wat gedaan / gebouwd" value={item.watGedaan} onChange={(v) => update('watGedaan', v)} />
                    <Textarea label="Tools / talen / platforms" value={item.tools} onChange={(v) => update('tools', v)} />
                    <div className="grid grid-cols-2 gap-4">
                      <MonthYear label="Begindatum" value={item.begindatum} onChange={(v) => update('begindatum', v)} />
                      <MonthYear label="Einddatum" value={item.einddatum} onChange={(v) => update('einddatum', v)} />
                    </div>
                  </div>
                )}
              />
            </SectionCard>

            {/* Section 7: Technical skills */}
            <SectionCard title="7. Programmeertalen, libraries, tools, platforms">
              <Textarea label="Programmeertalen" value={programmeertalen} onChange={setProgrammeertalen} placeholder="bijv. Java, Python, TypeScript" />
              <Textarea label="Libraries / Frameworks" value={libraries} onChange={setLibraries} placeholder="bijv. React, Spring Boot, Django" />
              <Textarea label="Tools" value={tools} onChange={setTools} placeholder="bijv. Git, Docker, CI/CD" />
              <Textarea label="Platforms" value={platforms} onChange={setPlatforms} placeholder="bijv. AWS, Azure, GitHub" />
              <Textarea label="Per item toelichting" value={toolsToelichting} onChange={setToolsToelichting} placeholder="In welk project, wat gedaan, wanneer" />
            </SectionCard>

            {/* Section 8: Cloud */}
            <SectionCard title="8. Cloud ervaring">
              <RepeatableSection<CloudProject>
                items={cloudProjecten}
                onChange={setCloudProjecten}
                onAdd={() => makeItem({ project: '', technologieen: '', begindatum: '', einddatum: '' }) as CloudProject}
                addLabel="+ Cloud project toevoegen"
                maxItems={3}
                renderItem={(item, update) => (
                  <div className="space-y-3">
                    <Input label="Project / vak" value={item.project} onChange={(v) => update('project', v)} />
                    <Textarea label="Technologieën / diensten" value={item.technologieen} onChange={(v) => update('technologieen', v)} />
                    <div className="grid grid-cols-2 gap-4">
                      <MonthYear label="Begindatum" value={item.begindatum} onChange={(v) => update('begindatum', v)} />
                      <MonthYear label="Einddatum" value={item.einddatum} onChange={(v) => update('einddatum', v)} />
                    </div>
                  </div>
                )}
              />
            </SectionCard>

            {/* File uploads */}
            <SectionCard title="Bestanden">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CV (PDF) <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">Upload je huidige CV (PDF)</p>
                <input
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                  className="block text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-[#1a2b4b] file:text-white hover:file:bg-[#c1272d] file:cursor-pointer"
                />
                {cvFile && <p className="text-xs text-gray-500 mt-1">{cvFile.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cijferlijsten (PDF, optioneel)</label>
                <p className="text-xs text-gray-500 mb-2">Upload je cijferlijsten (bachelor en/of master)</p>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setGradeListFile(e.target.files?.[0] ?? null)}
                  className="block text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-[#1a2b4b] file:text-white hover:file:bg-[#c1272d] file:cursor-pointer"
                />
                {gradeListFile && <p className="text-xs text-gray-500 mt-1">{gradeListFile.name}</p>}
              </div>
            </SectionCard>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: submitting ? '#999' : '#c1272d' }}
            >
              {submitting ? 'Versturen…' : 'Verstuur mijn gegevens'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
