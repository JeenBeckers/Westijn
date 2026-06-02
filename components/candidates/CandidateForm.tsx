'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, AlertCircle, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { CandidateFormData } from '@/types'

export function CandidateForm() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFoundInHtml, setPhotoFoundInHtml] = useState(false)
  const [htmlImportedPhoto, setHtmlImportedPhoto] = useState<string | null>(null)
  const [importedHtmlContent, setImportedHtmlContent] = useState<string | null>(null)
  const [intakeEmail, setIntakeEmail] = useState('')
  const [savedCandidateId, setSavedCandidateId] = useState<string | null>(null)
  const [intakeSending, setIntakeSending] = useState(false)
  const [intakeSent, setIntakeSent] = useState(false)
  const htmlInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<CandidateFormData>({
    defaultValues: {
      language: 'nl',
      review_tone: 'formal',
      contact_person: 'marlie',
    },
  })

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function extractTextFromHtml(html: string): string {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    // Remove script and style elements
    doc.querySelectorAll('script, style').forEach(el => el.remove())
    return doc.body?.innerText || doc.body?.textContent || ''
  }

  function handleHtmlImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const html = ev.target?.result as string
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      // Extract and store full text content as imported content
      doc.querySelectorAll('script, style').forEach(el => el.remove())
      const textContent = doc.body?.innerText || doc.body?.textContent || ''
      setImportedHtmlContent(textContent || null)

      // Extract photo
      const imgs = doc.querySelectorAll('img')
      let foundPhoto = false
      for (const img of imgs) {
        const src = img.getAttribute('src') || ''
        if (src.startsWith('data:image/') || (src.startsWith('http') && src.length > 10)) {
          setHtmlImportedPhoto(src)
          setPhotoFoundInHtml(true)
          setPhotoPreview(src)
          foundPhoto = true
          break
        }
      }
      if (!foundPhoto) setPhotoFoundInHtml(false)
    }
    reader.readAsText(file)
  }

  async function onSubmit(data: CandidateFormData) {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Niet ingelogd')

      let photoUrl: string | null = null

      // Upload photo if provided
      const photoToUpload = photoFile
      if (photoToUpload) {
        const ext = photoToUpload.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(path, photoToUpload)
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
        photoUrl = urlData.publicUrl
      } else if (htmlImportedPhoto && htmlImportedPhoto.startsWith('data:image/')) {
        // Store base64 from HTML import as photo_url (we'll reference it)
        // For base64 images from HTML import, we upload them too
        const blob = await fetch(htmlImportedPhoto).then(r => r.blob())
        const path = `${user.id}/${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(path, blob)
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
          photoUrl = urlData.publicUrl
        }
      }

      const { data: candidate, error: insertError } = await supabase
        .from('candidates')
        .insert({
          ...data,
          age: data.age ? Number(data.age) : null,
          created_by: user.id,
          photo_url: photoUrl,
          cv_json: importedHtmlContent
            ? { name: `${data.first_name} ${data.last_name}`, role: data.role, importedContent: importedHtmlContent }
            : null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      setSavedCandidateId(candidate.id)

      // If intake email provided, send it automatically
      if (intakeEmail) {
        await sendIntake(candidate.id)
      } else {
        router.push(`/candidates/${candidate.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden')
    } finally {
      setLoading(false)
    }
  }

  async function sendIntake(candidateId: string) {
    if (!intakeEmail) return
    setIntakeSending(true)
    try {
      const res = await fetch('/api/send-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, email: intakeEmail }),
      })
      if (!res.ok) throw new Error('Versturen mislukt')
      setIntakeSent(true)
      setTimeout(() => router.push(`/candidates/${candidateId}`), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Intake versturen mislukt')
    } finally {
      setIntakeSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-harvest-error rounded text-harvest-error text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Personal info */}
      <div>
        <h2 className="font-serif text-lg text-harvest-dark mb-4">Persoonlijke gegevens</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Voornaam *"
            {...register('first_name', { required: 'Verplicht veld' })}
            error={errors.first_name?.message}
          />
          <Input
            label="Achternaam *"
            {...register('last_name', { required: 'Verplicht veld' })}
            error={errors.last_name?.message}
          />
          <Input
            label="Leeftijd"
            type="number"
            {...register('age', { min: { value: 16, message: 'Min. 16' }, max: { value: 99, message: 'Max. 99' } })}
            error={errors.age?.message}
          />
          <Input
            label="Woonplaats"
            {...register('city')}
          />
          <div className="sm:col-span-2">
            <Input
              label="Functie / Rol *"
              {...register('role', { required: 'Verplicht veld' })}
              error={errors.role?.message}
              placeholder="bijv. Frontend Developer"
            />
          </div>
          <Input
            label="Beschikbaarheid"
            {...register('availability')}
            placeholder="bijv. Per direct / 1 maand"
          />
        </div>
      </div>

      {/* CV settings */}
      <div>
        <h2 className="font-serif text-lg text-harvest-dark mb-4">CV instellingen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-harvest-dark">Taal</label>
            <select
              {...register('language')}
              className="w-full px-3 py-2 bg-harvest-surface border border-harvest-bg rounded text-sm focus:outline-none focus:ring-2 focus:ring-harvest-green"
            >
              <option value="nl">Nederlands</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-harvest-dark">Toon beoordeling</label>
            <select
              {...register('review_tone')}
              className="w-full px-3 py-2 bg-harvest-surface border border-harvest-bg rounded text-sm focus:outline-none focus:ring-2 focus:ring-harvest-green"
            >
              <option value="formal">Formeel (Beoordeling)</option>
              <option value="warm">Warm (Over [naam])</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-harvest-dark">Contactpersoon</label>
            <select
              {...register('contact_person')}
              className="w-full px-3 py-2 bg-harvest-surface border border-harvest-bg rounded text-sm focus:outline-none focus:ring-2 focus:ring-harvest-green"
            >
              <option value="marlie">Marlie Ekdom</option>
              <option value="julieta">Julieta van Hierden</option>
              <option value="beiden">Beiden</option>
            </select>
          </div>
        </div>
      </div>

      {/* Photo upload */}
      <div>
        <h2 className="font-serif text-lg text-harvest-dark mb-4">Foto</h2>
        <div className="flex items-start gap-6">
          {photoPreview ? (
            <img src={photoPreview} alt="Preview" className="w-24 h-24 rounded-full object-cover border-2 border-harvest-brown" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-harvest-bg border-2 border-dashed border-harvest-brown flex items-center justify-center">
              <Upload size={24} className="text-harvest-brown" />
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-harvest-surface border border-harvest-brown text-harvest-dark rounded text-sm hover:bg-harvest-bg transition-colors">
                  <Upload size={16} />
                  Foto uploaden
                </span>
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>
            <div>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-harvest-surface border border-harvest-bg text-harvest-muted rounded text-sm hover:bg-harvest-bg transition-colors">
                  <Upload size={16} />
                  HTML CV importeren
                </span>
                <input ref={htmlInputRef} type="file" accept=".html,.htm" className="hidden" onChange={handleHtmlImport} />
              </label>
              {photoFoundInHtml && (
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <CheckCircle size={12} /> Pasfoto gevonden in HTML
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Intake form */}
      <div>
        <h2 className="font-serif text-lg text-harvest-dark mb-4">Intakeformulier versturen</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              label="E-mailadres kandidaat"
              type="email"
              value={intakeEmail}
              onChange={(e) => setIntakeEmail(e.target.value)}
              placeholder="kandidaat@email.nl"
            />
          </div>
        </div>
        <p className="text-xs text-harvest-muted mt-1">
          Optioneel: stuur direct een intakeformulier na het opslaan.
        </p>
        {intakeSent && (
          <p className="text-sm text-green-600 flex items-center gap-1 mt-2">
            <CheckCircle size={14} /> Intake succesvol verstuurd!
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-harvest-bg">
        <Button type="submit" loading={loading || intakeSending} size="lg">
          Kandidaat opslaan
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/dashboard')}
        >
          Annuleren
        </Button>
      </div>
    </form>
  )
}
