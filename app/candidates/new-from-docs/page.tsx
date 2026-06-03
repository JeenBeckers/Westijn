'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { createClient } from '@/lib/supabase/client'
import { Upload, FileText, Image, AlertCircle, Loader2, ArrowLeft, FileUp } from 'lucide-react'

const MAX_FILE_SIZE_MB = 4
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

function FileDrop({
  label,
  icon,
  accept,
  multiple,
  required,
  files,
  onFiles,
  hint,
}: {
  label: string
  icon: React.ReactNode
  accept: string
  multiple?: boolean
  required?: boolean
  files: File[]
  onFiles: (files: File[]) => void
  hint?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    onFiles(Array.from(e.target.files))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (!e.dataTransfer.files) return
    onFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: '#092B13' }}>
        {label} {required && <span style={{ color: '#782410' }}>*</span>}
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="cursor-pointer rounded-lg border-2 border-dashed transition-colors px-4 py-4"
        style={{
          borderColor: files.length > 0 ? '#092B13' : 'rgba(9,40,18,0.25)',
          background: files.length > 0 ? 'rgba(9,40,18,0.04)' : '#FDFAF7',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={handleChange}
        />
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0" style={{ color: files.length > 0 ? '#092B13' : '#8a847a' }}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            {files.length === 0 ? (
              <div>
                <p className="text-sm" style={{ color: '#3c3a35' }}>
                  Sleep bestand hierheen of <span className="underline" style={{ color: '#092B13' }}>klik om te bladeren</span>
                </p>
                {hint && <p className="text-xs mt-0.5" style={{ color: '#8a847a' }}>{hint}</p>}
              </div>
            ) : (
              <div className="space-y-1">
                {files.map((f) => (
                  <div key={f.name} className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate" style={{ color: '#092B13' }}>{f.name}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: '#8a847a' }}>
                      ({(f.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                    {f.size > MAX_FILE_SIZE_BYTES && (
                      <span className="text-xs" style={{ color: '#782410' }}>— te groot!</span>
                    )}
                  </div>
                ))}
                <p className="text-xs" style={{ color: '#8a847a' }}>Klik om te wijzigen</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: '#092B13' }}>
        {label} {required && <span style={{ color: '#782410' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full px-3 py-2 rounded border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#092B13]/20'
const inputStyle = {
  borderColor: 'rgba(9,40,18,0.2)',
  background: '#FDFAF7',
  color: '#1c1f1a',
}

export default function NewFromDocsPage() {
  const router = useRouter()

  const [profile, setProfile] = useState<{ full_name: string } | null>(null)
  const [cvFile, setCvFile] = useState<File[]>([])
  const [questionnaireFile, setQuestionnaireFile] = useState<File[]>([])
  const [notesFiles, setNotesFiles] = useState<File[]>([])
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([])
  const [photoFile, setPhotoFile] = useState<File[]>([])
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState('')
  const [city, setCity] = useState('')
  const [availability, setAvailability] = useState('')
  const [language, setLanguage] = useState<'nl' | 'en'>('nl')
  const [reviewTone, setReviewTone] = useState<'formal' | 'warm'>('formal')
  const [contactPerson, setContactPerson] = useState<'marlie' | 'julieta' | 'beiden'>('marlie')
  const [additionalInstructions, setAdditionalInstructions] = useState('')

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load profile for sidebar
  useState(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        setProfile(data)
      })
    })
  })

  function handlePhotoChange(files: File[]) {
    setPhotoFile(files)
    if (files[0]) {
      const reader = new FileReader()
      reader.onload = (e) => setPhotoPreview(e.target?.result as string)
      reader.readAsDataURL(files[0])
    } else {
      setPhotoPreview(null)
    }
  }

  function allFilesOk() {
    const allFiles = [...cvFile, ...questionnaireFile, ...notesFiles, ...additionalFiles, ...photoFile]
    return allFiles.every((f) => f.size <= MAX_FILE_SIZE_BYTES)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!firstName.trim() || !lastName.trim() || !role.trim()) {
      setError('Vul voornaam, achternaam en gewenste rol in.')
      return
    }
    if (cvFile.length === 0) {
      setError('Upload minimaal een CV (PDF).')
      return
    }
    if (!allFilesOk()) {
      setError(`Een of meer bestanden zijn groter dan ${MAX_FILE_SIZE_MB} MB. Verklein de bestanden en probeer opnieuw.`)
      return
    }

    setGenerating(true)

    try {
      const formData = new FormData()
      formData.append('firstName', firstName.trim())
      formData.append('lastName', lastName.trim())
      formData.append('role', role.trim())
      formData.append('city', city.trim())
      formData.append('availability', availability.trim())
      formData.append('language', language)
      formData.append('reviewTone', reviewTone)
      formData.append('contactPerson', contactPerson)
      formData.append('additionalInstructions', additionalInstructions.trim())

      if (cvFile[0]) formData.append('cv', cvFile[0])
      if (questionnaireFile[0]) formData.append('questionnaire', questionnaireFile[0])
      notesFiles.forEach((f) => formData.append('notes', f))
      additionalFiles.forEach((f) => formData.append('additional', f))
      if (photoFile[0]) formData.append('photo', photoFile[0])

      const res = await fetch('/api/generate-cv-from-docs', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server fout: ${res.status}`)
      }

      const { candidateId } = await res.json()
      router.push(`/candidates/${candidateId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden.')
      setGenerating(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile as Parameters<typeof Sidebar>[0]['profile']} />
      <div className="flex-1 flex flex-col">
        <Header profile={profile as Parameters<typeof Header>[0]['profile']} />
        <main className="flex-1 p-8">
          <div className="max-w-3xl mx-auto">
            {/* Back link */}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm mb-5 hover:underline"
              style={{ color: '#5b5750' }}
            >
              <ArrowLeft size={14} />
              Terug naar dashboard
            </Link>

            {/* Page title */}
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: '#782410' }}>
                Stap 1 van 2 — Documenten uploaden
              </p>
              <h1 className="font-serif text-2xl" style={{ color: '#092B13' }}>Genereer CV via documenten</h1>
              <p className="text-sm mt-1" style={{ color: '#5b5750' }}>
                Upload het CV, de vragenlijst en eventuele gespreksnotities. Claude leest alles en genereert direct een Harvest CV.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Documents card */}
              <div className="rounded-xl shadow-sm border p-8 space-y-5" style={{ background: '#FFFBF5', borderColor: 'rgba(9,40,18,0.08)' }}>
                <h2 className="font-serif text-lg" style={{ color: '#092B13' }}>Documenten</h2>

                <FileDrop
                  label="CV / Resume"
                  icon={<FileText size={18} />}
                  accept=".pdf"
                  required
                  files={cvFile}
                  onFiles={setCvFile}
                  hint="PDF — verplicht"
                />

                <FileDrop
                  label="Vragenlijst Harvest"
                  icon={<FileUp size={18} />}
                  accept=".pdf"
                  files={questionnaireFile}
                  onFiles={setQuestionnaireFile}
                  hint="PDF — optioneel maar aanbevolen"
                />

                <FileDrop
                  label="Gespreksnotities"
                  icon={<FileText size={18} />}
                  accept=".pdf,.doc,.docx,.txt"
                  multiple
                  files={notesFiles}
                  onFiles={setNotesFiles}
                  hint="PDF, Word of tekst — optioneel"
                />

                <FileDrop
                  label="Aanvullende documenten"
                  icon={<FileUp size={18} />}
                  accept=".pdf"
                  multiple
                  files={additionalFiles}
                  onFiles={setAdditionalFiles}
                  hint="PDF — optioneel, bijv. cijferlijsten"
                />

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#092B13' }}>
                    Pasfoto <span style={{ color: '#782410' }}>*</span>
                  </label>
                  <div className="flex items-start gap-4">
                    <div
                      className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border"
                      style={{ borderColor: 'rgba(9,40,18,0.15)', background: '#E4DCD3' }}
                    >
                      {photoPreview ? (
                        <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image size={24} style={{ color: '#8a847a' }} />
                        </div>
                      )}
                    </div>
                    <FileDrop
                      label=""
                      icon={<Upload size={18} />}
                      accept=".jpg,.jpeg,.png,.webp"
                      files={photoFile}
                      onFiles={handlePhotoChange}
                      hint="JPG of PNG"
                    />
                  </div>
                </div>

                <p className="text-xs" style={{ color: '#8a847a' }}>
                  Maximale bestandsgrootte: {MAX_FILE_SIZE_MB} MB per bestand (Vercel limiet)
                </p>
              </div>

              {/* Basic info card */}
              <div className="rounded-xl shadow-sm border p-8 space-y-5" style={{ background: '#FFFBF5', borderColor: 'rgba(9,40,18,0.08)' }}>
                <h2 className="font-serif text-lg" style={{ color: '#092B13' }}>Basisgegevens</h2>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Voornaam" required>
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jan"
                      required
                    />
                  </FormField>
                  <FormField label="Achternaam" required>
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="de Vries"
                      required
                    />
                  </FormField>
                </div>

                <FormField label="Gewenste rol" required>
                  <input
                    className={inputClass}
                    style={inputStyle}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Data Scientist, Software Engineer, …"
                    required
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Woonplaats">
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Amsterdam"
                    />
                  </FormField>
                  <FormField label="Beschikbaarheid">
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={availability}
                      onChange={(e) => setAvailability(e.target.value)}
                      placeholder="Per direct, 40 uur/week"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField label="Taal CV">
                    <select
                      className={inputClass}
                      style={inputStyle}
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as 'nl' | 'en')}
                    >
                      <option value="nl">Nederlands</option>
                      <option value="en">English</option>
                    </select>
                  </FormField>

                  <FormField label="Review-toon">
                    <select
                      className={inputClass}
                      style={inputStyle}
                      value={reviewTone}
                      onChange={(e) => setReviewTone(e.target.value as 'formal' | 'warm')}
                    >
                      <option value="formal">Formeel (Beoordeling)</option>
                      <option value="warm">Warm (Over ...)</option>
                    </select>
                  </FormField>

                  <FormField label="Contactpersoon">
                    <select
                      className={inputClass}
                      style={inputStyle}
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value as 'marlie' | 'julieta' | 'beiden')}
                    >
                      <option value="marlie">Marlie</option>
                      <option value="julieta">Julieta</option>
                      <option value="beiden">Beiden</option>
                    </select>
                  </FormField>
                </div>

                <FormField label="Aanvullende instructies">
                  <textarea
                    className={inputClass}
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    placeholder="Optioneel: specifieke wensen voor de recruiter of Claude, zoals nadruk op bepaalde projecten of vaardigheden."
                    rows={3}
                  />
                </FormField>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="flex items-start gap-3 px-4 py-3 rounded-lg text-sm"
                  style={{ background: '#FEF2F0', color: '#782410', border: '1px solid rgba(120,36,16,0.2)' }}
                >
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={generating}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-medium text-white transition-colors disabled:opacity-60"
                  style={{ background: generating ? '#5b5750' : '#092B13' }}
                >
                  {generating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Claude leest de documenten en genereert het CV…
                    </>
                  ) : (
                    'Genereer CV'
                  )}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}
