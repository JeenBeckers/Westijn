'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, CheckCircle, Upload } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { IntakeFormData, EducationEntry, WorkExperienceEntry, SkillEntry, LanguageEntry, ProjectEntry } from '@/types'

interface IntakeFormProps {
  token: string
  candidateName: string
}

interface FormValues {
  full_name: string
  date_of_birth: string
  nationality: string
  city: string
  phone: string
  email: string
  linkedin: string
  education: EducationEntry[]
  work_experience: WorkExperienceEntry[]
  skills: SkillEntry[]
  languages: LanguageEntry[]
  projects: ProjectEntry[]
  availability: string
  salary_expectation: string
  self_introduction: string
}

export function IntakeForm({ token, candidateName }: IntakeFormProps) {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      education: [{ institution: '', degree: '', field: '', graduation_year: '' }],
      work_experience: [{ company: '', role: '', period: '', description: '' }],
      skills: [{ name: '', level: 'intermediate' }],
      languages: [{ language: '', level: '' }],
      projects: [],
    },
  })

  const eduFields = useFieldArray({ control, name: 'education' })
  const workFields = useFieldArray({ control, name: 'work_experience' })
  const skillFields = useFieldArray({ control, name: 'skills' })
  const langFields = useFieldArray({ control, name: 'languages' })
  const projFields = useFieldArray({ control, name: 'projects' })

  const selfIntro = watch('self_introduction') || ''

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function onSubmit(data: FormValues) {
    setLoading(true)
    setError(null)
    try {
      let photoBase64: string | undefined
      if (photoFile) {
        photoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.onerror = reject
          reader.readAsDataURL(photoFile)
        })
      }

      const res = await fetch('/api/intake-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, responses: data, photoBase64 }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Verzending mislukt')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <CheckCircle size={56} className="text-harvest-green mx-auto mb-4" />
        <h2 className="font-serif text-2xl text-harvest-dark mb-2">Bedankt!</h2>
        <p className="text-harvest-muted">Je intake is succesvol ontvangen. Wij nemen snel contact met je op.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
      {error && (
        <div className="p-3 bg-red-50 border border-harvest-error rounded text-harvest-error text-sm">
          {error}
        </div>
      )}

      {/* Personal */}
      <section>
        <h2 className="font-serif text-xl text-harvest-dark mb-4 pb-2 border-b-2 border-harvest-brown">
          Persoonlijke gegevens
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Volledige naam *" {...register('full_name', { required: true })} />
          <Input label="Geboortedatum" type="date" {...register('date_of_birth')} />
          <Input label="Nationaliteit" {...register('nationality')} />
          <Input label="Woonplaats" {...register('city')} />
          <Input label="Telefoonnummer" type="tel" {...register('phone')} />
          <Input label="E-mailadres" type="email" {...register('email')} />
          <div className="sm:col-span-2">
            <Input label="LinkedIn URL" {...register('linkedin')} placeholder="https://linkedin.com/in/..." />
          </div>
        </div>
      </section>

      {/* Photo */}
      <section>
        <h2 className="font-serif text-xl text-harvest-dark mb-4 pb-2 border-b-2 border-harvest-brown">
          Pasfoto
        </h2>
        <div className="flex items-center gap-6">
          {photoPreview ? (
            <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-harvest-brown" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-harvest-bg border-2 border-dashed border-harvest-brown flex items-center justify-center">
              <Upload size={20} className="text-harvest-brown" />
            </div>
          )}
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-harvest-surface border border-harvest-brown text-harvest-dark rounded text-sm hover:bg-harvest-bg transition-colors">
              <Upload size={16} />
              Foto uploaden
            </span>
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handlePhotoChange} />
          </label>
        </div>
      </section>

      {/* Education */}
      <section>
        <h2 className="font-serif text-xl text-harvest-dark mb-4 pb-2 border-b-2 border-harvest-brown">
          Opleiding
        </h2>
        <div className="space-y-4">
          {eduFields.fields.map((field, i) => (
            <div key={field.id} className="p-4 bg-harvest-bg/50 rounded border border-harvest-bg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Instelling" {...register(`education.${i}.institution`)} />
                <Input label="Diploma/Titel" {...register(`education.${i}.degree`)} />
                <Input label="Studierichting" {...register(`education.${i}.field`)} />
                <Input label="Afstudeerjaar" {...register(`education.${i}.graduation_year`)} />
              </div>
              {eduFields.fields.length > 1 && (
                <button type="button" onClick={() => eduFields.remove(i)} className="mt-2 text-harvest-error text-xs flex items-center gap-1 hover:underline">
                  <Trash2 size={12} /> Verwijderen
                </button>
              )}
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => eduFields.append({ institution: '', degree: '', field: '', graduation_year: '' })}>
            <Plus size={14} className="mr-1" /> Opleiding toevoegen
          </Button>
        </div>
      </section>

      {/* Work experience */}
      <section>
        <h2 className="font-serif text-xl text-harvest-dark mb-4 pb-2 border-b-2 border-harvest-brown">
          Werkervaring
        </h2>
        <div className="space-y-4">
          {workFields.fields.map((field, i) => (
            <div key={field.id} className="p-4 bg-harvest-bg/50 rounded border border-harvest-bg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Bedrijf" {...register(`work_experience.${i}.company`)} />
                <Input label="Functie" {...register(`work_experience.${i}.role`)} />
                <Input label="Periode" {...register(`work_experience.${i}.period`)} placeholder="2022 - heden" />
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-sm font-medium text-harvest-dark">Omschrijving</label>
                  <textarea
                    {...register(`work_experience.${i}.description`)}
                    rows={3}
                    className="w-full px-3 py-2 bg-harvest-surface border border-harvest-bg rounded text-sm focus:outline-none focus:ring-2 focus:ring-harvest-green"
                  />
                </div>
              </div>
              {workFields.fields.length > 1 && (
                <button type="button" onClick={() => workFields.remove(i)} className="mt-2 text-harvest-error text-xs flex items-center gap-1 hover:underline">
                  <Trash2 size={12} /> Verwijderen
                </button>
              )}
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => workFields.append({ company: '', role: '', period: '', description: '' })}>
            <Plus size={14} className="mr-1" /> Werkervaring toevoegen
          </Button>
        </div>
      </section>

      {/* Skills */}
      <section>
        <h2 className="font-serif text-xl text-harvest-dark mb-4 pb-2 border-b-2 border-harvest-brown">
          Vaardigheden
        </h2>
        <div className="space-y-2">
          {skillFields.fields.map((field, i) => (
            <div key={field.id} className="flex items-center gap-3">
              <Input {...register(`skills.${i}.name`)} placeholder="bijv. React, Python..." className="flex-1" />
              <select
                {...register(`skills.${i}.level`)}
                className="px-3 py-2 bg-harvest-surface border border-harvest-bg rounded text-sm focus:outline-none focus:ring-2 focus:ring-harvest-green"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Gevorderd</option>
                <option value="advanced">Expert</option>
                <option value="expert">Meester</option>
              </select>
              {skillFields.fields.length > 1 && (
                <button type="button" onClick={() => skillFields.remove(i)} className="text-harvest-error hover:text-harvest-error/70">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => skillFields.append({ name: '', level: 'intermediate' })}>
            <Plus size={14} className="mr-1" /> Vaardigheid toevoegen
          </Button>
        </div>
      </section>

      {/* Languages */}
      <section>
        <h2 className="font-serif text-xl text-harvest-dark mb-4 pb-2 border-b-2 border-harvest-brown">
          Talen
        </h2>
        <div className="space-y-2">
          {langFields.fields.map((field, i) => (
            <div key={field.id} className="flex items-center gap-3">
              <Input {...register(`languages.${i}.language`)} placeholder="bijv. Nederlands" className="flex-1" />
              <Input {...register(`languages.${i}.level`)} placeholder="bijv. Moedertaal, C1" className="flex-1" />
              {langFields.fields.length > 1 && (
                <button type="button" onClick={() => langFields.remove(i)} className="text-harvest-error hover:text-harvest-error/70">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => langFields.append({ language: '', level: '' })}>
            <Plus size={14} className="mr-1" /> Taal toevoegen
          </Button>
        </div>
      </section>

      {/* Projects */}
      <section>
        <h2 className="font-serif text-xl text-harvest-dark mb-4 pb-2 border-b-2 border-harvest-brown">
          Projecten (optioneel)
        </h2>
        <div className="space-y-4">
          {projFields.fields.map((field, i) => (
            <div key={field.id} className="p-4 bg-harvest-bg/50 rounded border border-harvest-bg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Projectnaam" {...register(`projects.${i}.name`)} />
                <Input label="Periode" {...register(`projects.${i}.period`)} />
                <Input label="Technologieën/Tools" {...register(`projects.${i}.tech`)} className="sm:col-span-2" />
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-sm font-medium text-harvest-dark">Omschrijving</label>
                  <textarea
                    {...register(`projects.${i}.description`)}
                    rows={2}
                    className="w-full px-3 py-2 bg-harvest-surface border border-harvest-bg rounded text-sm focus:outline-none focus:ring-2 focus:ring-harvest-green"
                  />
                </div>
              </div>
              <button type="button" onClick={() => projFields.remove(i)} className="mt-2 text-harvest-error text-xs flex items-center gap-1 hover:underline">
                <Trash2 size={12} /> Verwijderen
              </button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => projFields.append({ name: '', description: '', tech: '', period: '' })}>
            <Plus size={14} className="mr-1" /> Project toevoegen
          </Button>
        </div>
      </section>

      {/* Other */}
      <section>
        <h2 className="font-serif text-xl text-harvest-dark mb-4 pb-2 border-b-2 border-harvest-brown">
          Overige informatie
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Beschikbaarheid" {...register('availability')} placeholder="bijv. Per direct" />
          <Input label="Salarisindicatie" {...register('salary_expectation')} placeholder="bijv. €4000 - €5000 bruto" />
        </div>
        <div className="mt-4 space-y-1">
          <label className="block text-sm font-medium text-harvest-dark">
            Korte introductie <span className="text-harvest-muted">(max 300 tekens)</span>
          </label>
          <textarea
            {...register('self_introduction', { maxLength: { value: 300, message: 'Max 300 tekens' } })}
            rows={4}
            maxLength={300}
            className="w-full px-3 py-2 bg-harvest-surface border border-harvest-bg rounded text-sm focus:outline-none focus:ring-2 focus:ring-harvest-green"
            placeholder="Vertel in een paar zinnen wie je bent en wat je drijft..."
          />
          <p className="text-xs text-harvest-muted text-right">{selfIntro.length}/300</p>
        </div>
      </section>

      <div className="pt-6 border-t border-harvest-bg">
        <Button type="submit" loading={loading} size="lg">
          Intake indienen
        </Button>
      </div>
    </form>
  )
}
