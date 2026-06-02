import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

function checkApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  return token === process.env.API_SECRET_KEY
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkApiKey(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const supabase = await createAdminClient()

    const { data: candidate, error } = await supabase
      .from('candidates')
      .select('*, profiles(full_name)')
      .eq('id', id)
      .single()

    if (error || !candidate) {
      return Response.json({ error: 'Kandidaat niet gevonden' }, { status: 404 })
    }

    // Also get intake response
    const { data: intakeForm } = await supabase
      .from('intake_forms')
      .select('id, completed_at, email')
      .eq('candidate_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let intakeResponse = null
    if (intakeForm?.completed_at) {
      const { data } = await supabase
        .from('intake_responses')
        .select('*')
        .eq('intake_form_id', intakeForm.id)
        .single()
      intakeResponse = data
    }

    return Response.json({ candidate, intakeResponse })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Fout' },
      { status: 500 }
    )
  }
}
