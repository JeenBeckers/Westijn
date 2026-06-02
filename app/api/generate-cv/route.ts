import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCV, refineCV } from '@/lib/cv-generator'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { candidateId, intakeData, additionalInstructions } = await request.json()

    const { data: candidate } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single()

    if (!candidate) {
      return Response.json({ error: 'Kandidaat niet gevonden' }, { status: 404 })
    }

    const html = await generateCV(candidate, intakeData, additionalInstructions)

    // Save the generated HTML and JSON to the candidate
    await supabase
      .from('candidates')
      .update({
        cv_html: html,
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidateId)

    return Response.json({ html })
  } catch (error) {
    console.error('CV generation error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Genereren mislukt' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { candidateId, currentHtml, instruction } = await request.json()

    const html = await refineCV(currentHtml, instruction)

    // Save refined HTML
    await supabase
      .from('candidates')
      .update({
        cv_html: html,
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidateId)

    return Response.json({ html })
  } catch (error) {
    console.error('CV refine error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Verfijnen mislukt' },
      { status: 500 }
    )
  }
}
