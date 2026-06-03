import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

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
      .select('id, expires_at, status')
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

    return Response.json({ invite: updated })
  } catch (error) {
    console.error('Submit invite error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Indienen mislukt' },
      { status: 500 }
    )
  }
}
