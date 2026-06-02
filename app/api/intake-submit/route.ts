import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { token, responses, photoBase64 } = await request.json()

    if (!token || !responses) {
      return Response.json({ error: 'Missende velden' }, { status: 400 })
    }

    // Get intake form by token
    const { data: intakeForm } = await supabase
      .from('intake_forms')
      .select('*')
      .eq('token', token)
      .single()

    if (!intakeForm) {
      return Response.json({ error: 'Formulier niet gevonden' }, { status: 404 })
    }

    if (intakeForm.completed_at) {
      return Response.json({ error: 'Formulier al ingevuld' }, { status: 409 })
    }

    if (new Date(intakeForm.expires_at) < new Date()) {
      return Response.json({ error: 'Formulier verlopen' }, { status: 410 })
    }

    let photoUrl: string | null = null

    // Upload photo if provided
    if (photoBase64) {
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const ext = photoBase64.includes('image/png') ? 'png' : 'jpg'
      const path = `intake/${intakeForm.candidate_id}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, buffer, {
          contentType: `image/${ext}`,
        })

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
        photoUrl = urlData.publicUrl

        // Update candidate photo_url if not already set
        await supabase
          .from('candidates')
          .update({ photo_url: photoUrl })
          .eq('id', intakeForm.candidate_id)
          .is('photo_url', null)
      }
    }

    // Save intake response
    const { error: responseError } = await supabase
      .from('intake_responses')
      .insert({
        intake_form_id: intakeForm.id,
        responses,
        photo_url: photoUrl,
      })

    if (responseError) throw responseError

    // Mark intake form as completed
    const { error: updateError } = await supabase
      .from('intake_forms')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', intakeForm.id)

    if (updateError) throw updateError

    return Response.json({ success: true })
  } catch (error) {
    console.error('Intake submit error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Indienen mislukt' },
      { status: 500 }
    )
  }
}
