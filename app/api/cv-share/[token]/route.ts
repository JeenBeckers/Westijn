import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = await createAdminClient()

    const { data: share, error } = await supabase
      .from('cv_shares')
      .select('candidate_id, expires_at')
      .eq('token', token)
      .single()

    if (error || !share) {
      return Response.json({ error: 'Link niet gevonden' }, { status: 404 })
    }

    if (new Date(share.expires_at) < new Date()) {
      return Response.json({ error: 'Deze link is verlopen' }, { status: 410 })
    }

    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('first_name, last_name, cv_html')
      .eq('id', share.candidate_id)
      .single()

    if (candidateError || !candidate?.cv_html) {
      return Response.json({ error: 'CV niet gevonden' }, { status: 404 })
    }

    // Replace full name with first name only for privacy
    const fullName = `${candidate.first_name} ${candidate.last_name}`
    const firstName = candidate.first_name
    const anonymisedHtml = candidate.cv_html
      .split(fullName).join(firstName)

    return Response.json({
      cv_html: anonymisedHtml,
      first_name: firstName,
    })
  } catch (error) {
    return Response.json({ error: 'Er is iets misgegaan' }, { status: 500 })
  }
}
