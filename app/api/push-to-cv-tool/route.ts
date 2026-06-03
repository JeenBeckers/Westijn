import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CV_TOOL_URL = 'https://avircyzuhmpysqjnyadh.supabase.co'
const CV_TOOL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2aXJjeXp1aG1weXNxam55YWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzM0NDksImV4cCI6MjA5NTkwOTQ0OX0.Bly2QRlSNlyvQxbBi8tuEVny8p2YsF2lgwYTrge5b40'

function guessTalentClass(role: string): string {
  const r = role.toLowerCase()
  if (r.includes('data engineer')) return 'DE'
  if (r.includes('data science') || r.includes('ai engineer') || r.includes('machine learning')) return 'DE'
  if (r.includes('software engineer') || r.includes('developer') || r.includes('frontend') || r.includes('backend') || r.includes('fullstack')) return 'SE'
  if (r.includes('business analyst') || r.includes('product owner') || r.includes('scrum')) return 'BA'
  return 'SE'
}

export async function POST(req: NextRequest) {
  try {
    const { candidateId } = await req.json()
    if (!candidateId) return NextResponse.json({ error: 'candidateId required' }, { status: 400 })

    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch candidate from generator DB
    const { data: candidate, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single()

    if (error || !candidate) return NextResponse.json({ error: 'Kandidaat niet gevonden' }, { status: 404 })

    // Map skills
    const skills: string[] = (candidate.cv_json?.skills || []).map((s: { name: string }) => s.name).filter(Boolean)

    // Build CV Tool candidate row
    const row = {
      id: 'gen_' + candidate.id,
      name: `${candidate.first_name} ${candidate.last_name}`.trim(),
      role: candidate.role || '',
      talent_class: guessTalentClass(candidate.role || ''),
      city: candidate.city || '',
      province: '',
      availability: candidate.availability || '',
      sales_owner: candidate.contact_person || '',
      recruit_owner: '',
      bureau: 'Eigen Werving',
      status: 'Actief zoeken',
      language: candidate.language || 'nl',
      skills,
      notes: '',
      notes_history: [],
      drive_url: '',
      push: false,
      archived: false,
      archived_date: null,
      source: 'generator',
      updated_at: new Date().toISOString(),
    }

    // Push to CV Tool Supabase
    const res = await fetch(`${CV_TOOL_URL}/rest/v1/candidates?on_conflict=id`, {
      method: 'POST',
      headers: {
        'apikey': CV_TOOL_KEY,
        'Authorization': `Bearer ${CV_TOOL_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(row),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('CV Tool push failed:', err)
      return NextResponse.json({ error: 'Push naar CV Tool mislukt: ' + err }, { status: 500 })
    }

    return NextResponse.json({ success: true, candidateName: row.name })
  } catch (e) {
    console.error('push-to-cv-tool error:', e)
    return NextResponse.json({ error: 'Onverwachte fout' }, { status: 500 })
  }
}
