import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateCV } from '@/lib/cv-generator'
import type { Candidate } from '@/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const adminClient = await createAdminClient()

    const { data: invite, error } = await adminClient
      .from('candidate_invites')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !invite) {
      return Response.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    if (invite.status === 'expired' || new Date(invite.expires_at) < new Date()) {
      return Response.json({ error: 'Verlopen' }, { status: 410 })
    }

    return Response.json({ invite })
  } catch (error) {
    console.error('Get invite error:', error)
    return Response.json({ error: 'Serverfout' }, { status: 500 })
  }
}

function formatQuestionnaireAnswers(answers: Record<string, unknown>): string {
  const lines: string[] = []

  if (answers.cijferBachelor) lines.push(`Bachelor cijfer: ${answers.cijferBachelor}`)
  if (answers.bachelorBegin || answers.bachelorEinde) lines.push(`Bachelor periode: ${answers.bachelorBegin || '?'} - ${answers.bachelorEinde || '?'}`)
  if (answers.vakkenBachelor) lines.push(`Bachelor vakken: ${answers.vakkenBachelor}`)

  if (answers.cijferMaster) lines.push(`Master cijfer: ${answers.cijferMaster}`)
  if (answers.masterBegin || answers.masterEinde) lines.push(`Master periode: ${answers.masterBegin || '?'} - ${answers.masterEinde || '?'}`)
  if (answers.vakkenMaster) lines.push(`Master vakken: ${answers.vakkenMaster}`)

  const thesisBachelor = answers.thesisBachelor as Record<string, string> | undefined
  if (thesisBachelor?.titel) {
    lines.push(`Bachelor thesis: ${thesisBachelor.titel} (cijfer: ${thesisBachelor.cijfer || 'n.v.t.'}, periode: ${thesisBachelor.begin || '?'} - ${thesisBachelor.einde || '?'})`)
  }

  const thesisMaster = answers.thesisMaster as Record<string, string> | undefined
  if (thesisMaster?.titel) {
    lines.push(`Master thesis: ${thesisMaster.titel} (cijfer: ${thesisMaster.cijfer || 'n.v.t.'}, periode: ${thesisMaster.begin || '?'} - ${thesisMaster.einde || '?'})`)
  }

  const extraOpleidingen = answers.extraOpleidingen as Array<Record<string, string>> | undefined
  if (extraOpleidingen?.length) {
    lines.push('\nExtra opleidingen:')
    for (const o of extraOpleidingen) {
      lines.push(`- ${o.naam} (${o.begindatum || '?'} - ${o.einddatum || '?'}): ${o.onderwerpen || ''}`)
    }
  }

  const softwareProjecten = answers.softwareProjecten as Array<Record<string, string>> | undefined
  if (softwareProjecten?.length) {
    lines.push('\nSoftwareprojecten:')
    for (const p of softwareProjecten) {
      lines.push(`- Doel: ${p.doel || '?'}, Talen: ${p.talen || '?'} (${p.begindatum || '?'} - ${p.einddatum || '?'})`)
    }
  }

  const stages = answers.stages as Array<Record<string, string>> | undefined
  if (stages?.length) {
    lines.push('\nStages:')
    for (const s of stages) {
      lines.push(`- ${s.organisatie} (${s.begindatum || '?'} - ${s.einddatum || '?'}): ${s.tooling || ''}`)
    }
  }

  const praktijkProjecten = answers.praktijkProjecten as Array<Record<string, string>> | undefined
  if (praktijkProjecten?.length) {
    lines.push('\nPraktijkprojecten:')
    for (const p of praktijkProjecten) {
      lines.push(`- ${p.watGedaan || '?'} (${p.begindatum || '?'} - ${p.einddatum || '?'}): tools: ${p.tools || '?'}`)
    }
  }

  if (answers.programmeertalen) lines.push(`\nProgrammeertalen: ${answers.programmeertalen}`)
  if (answers.librariesFrameworks) lines.push(`Libraries & Frameworks: ${answers.librariesFrameworks}`)
  if (answers.tools) lines.push(`Tools: ${answers.tools}`)
  if (answers.platforms) lines.push(`Platforms: ${answers.platforms}`)
  if (answers.technologieToelichting) lines.push(`Technologie toelichting: ${answers.technologieToelichting}`)

  const cloudProjecten = answers.cloudProjecten as Array<Record<string, string>> | undefined
  if (cloudProjecten?.length) {
    lines.push('\nCloud projecten:')
    for (const c of cloudProjecten) {
      lines.push(`- ${c.project} (${c.begindatum || '?'} - ${c.einddatum || '?'}): ${c.technologieen || ''}`)
    }
  }

  return lines.join('\n')
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const adminClient = await createAdminClient()

    // Fetch the invite first
    const { data: invite, error: fetchError } = await adminClient
      .from('candidate_invites')
      .select('id, expires_at, status, candidate_name, photo_url')
      .eq('token', token)
      .single()

    if (fetchError || !invite) {
      return Response.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    if (invite.status === 'expired' || new Date(invite.expires_at) < new Date()) {
      return Response.json({ error: 'Verlopen' }, { status: 410 })
    }

    const formData = await request.formData()
    const questionnaireAnswersRaw = formData.get('questionnaireAnswers') as string | null
    const questionnaireAnswers = questionnaireAnswersRaw ? JSON.parse(questionnaireAnswersRaw) : null

    const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
      const ext = file.name.split('.').pop()
      const path = `${invite.id}/${prefix}-${Date.now()}.${ext}`
      const { error } = await adminClient.storage
        .from('candidate-uploads')
        .upload(path, file, { contentType: file.type, upsert: true })
      if (error) {
        console.error('Upload error:', error)
        return null
      }
      return path
    }

    const photoFile = formData.get('photo') as File | null
    const cvFile = formData.get('cvFile') as File | null
    const gradeListFile = formData.get('gradeList') as File | null
    const extraDocFiles = formData.getAll('extraDocs') as File[]

    const [photoUrl, cvUrl, gradeListUrl] = await Promise.all([
      photoFile && photoFile.size > 0 ? uploadFile(photoFile, 'photo') : Promise.resolve(null),
      cvFile && cvFile.size > 0 ? uploadFile(cvFile, 'cv') : Promise.resolve(null),
      gradeListFile && gradeListFile.size > 0 ? uploadFile(gradeListFile, 'grades') : Promise.resolve(null),
    ])

    const extraDocUrls: string[] = []
    for (const f of extraDocFiles) {
      if (f && f.size > 0) {
        const url = await uploadFile(f, 'extra')
        if (url) extraDocUrls.push(url)
      }
    }

    const updates: Record<string, unknown> = {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      questionnaire_answers: questionnaireAnswers,
    }
    if (photoUrl) updates.photo_url = photoUrl
    if (cvUrl) updates.cv_url = cvUrl
    if (gradeListUrl) updates.grade_list_url = gradeListUrl
    if (extraDocUrls.length > 0) updates.extra_doc_urls = extraDocUrls

    const { data: updated, error: updateError } = await adminClient
      .from('candidate_invites')
      .update(updates)
      .eq('id', invite.id)
      .select()
      .single()

    if (updateError) throw updateError

    // Auto-generate CV from questionnaire answers (non-blocking)
    try {
      const answers = questionnaireAnswers as Record<string, unknown> | null
      const formattedContent = answers ? formatQuestionnaireAnswers(answers) : ''

      const nameParts = (invite.candidate_name || '').split(' ')
      const firstName = nameParts[0] || 'Kandidaat'
      const lastName = nameParts.slice(1).join(' ') || ''

      // Build a minimal candidate object for generateCV
      const candidateForCV: Candidate = {
        id: invite.id,
        created_by: null,
        first_name: firstName,
        last_name: lastName,
        age: null,
        role: 'Software Engineer',
        city: '',
        availability: null,
        language: 'nl',
        review_tone: 'formal',
        contact_person: 'marlie',
        photo_url: invite.photo_url || null,
        cv_json: null,
        cv_html: null,
        intake_sent_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'review',
        editors: [],
        invite_id: invite.id,
      }

      const intakeData = formattedContent ? { name: `${firstName} ${lastName}`, role: 'Software Engineer', importedContent: formattedContent } : undefined

      const generatedCvHtml = await generateCV(candidateForCV, intakeData)

      const { data: candidateRecord, error: insertError } = await adminClient
        .from('candidates')
        .insert({
          first_name: firstName,
          last_name: lastName,
          role: 'Software Engineer',
          city: '',
          cv_html: generatedCvHtml,
          status: 'review',
          invite_id: invite.id,
          photo_url: invite.photo_url || null,
        })
        .select()
        .single()

      if (!insertError && candidateRecord) {
        await adminClient
          .from('candidate_invites')
          .update({ candidate_id: candidateRecord.id })
          .eq('id', invite.id)
      } else if (insertError) {
        console.error('Failed to insert candidate:', insertError)
      }
    } catch (cvError) {
      console.error('CV auto-generation failed (submission still succeeded):', cvError)
    }

    return Response.json({ invite: updated })
  } catch (error) {
    console.error('Submit invite error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Indienen mislukt' },
      { status: 500 }
    )
  }
}
