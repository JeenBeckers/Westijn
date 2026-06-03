import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const CV_TOOL_URL = 'https://avircyzuhmpysqjnyadh.supabase.co'
const CV_TOOL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2aXJjeXp1aG1weXNxam55YWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzM0NDksImV4cCI6MjA5NTkwOTQ0OX0.Bly2QRlSNlyvQxbBi8tuEVny8p2YsF2lgwYTrge5b40'

const GENERATOR_STORAGE_URL = 'https://yajhzdxjmripjagakrib.supabase.co'
const GENERATOR_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function guessTalentClass(role: string): string {
  const r = role.toLowerCase()
  if (r.includes('data engineer')) return 'DE'
  if (r.includes('data science') || r.includes('ai engineer') || r.includes('machine learning')) return 'DE'
  if (r.includes('software engineer') || r.includes('developer') || r.includes('frontend') || r.includes('backend') || r.includes('fullstack')) return 'SE'
  if (r.includes('business analyst') || r.includes('product owner') || r.includes('scrum')) return 'BA'
  return 'SE'
}

async function uploadCVToStorage(candidateId: string, cvHtml: string): Promise<string | null> {
  try {
    const adminSupabase = createSupabaseClient(GENERATOR_STORAGE_URL, GENERATOR_SERVICE_KEY)
    const fileName = `${candidateId}.html`
    const { error } = await adminSupabase.storage
      .from('cvs')
      .upload(fileName, new Blob([cvHtml], { type: 'text/html' }), {
        upsert: true,
        contentType: 'text/html',
      })
    if (error) {
      console.error('Storage upload failed:', error)
      return null
    }
    const { data } = adminSupabase.storage.from('cvs').getPublicUrl(fileName)
    return data.publicUrl
  } catch (e) {
    console.error('uploadCVToStorage error:', e)
    return null
  }
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

    // Upload CV HTML to storage and get public URL
    let cvUrl = ''
    if (candidate.cv_html) {
      const url = await uploadCVToStorage(candidate.id, candidate.cv_html)
      if (url) cvUrl = url
    }

    // Map skills - prefer cv_json, fall back to parsing cv_html
    let skills: string[] = (candidate.cv_json?.skills || []).map((s: { name: string }) => s.name).filter(Boolean)

    if (!skills.length && candidate.cv_html) {
      // Extract skills from HTML - look for skill tags/chips
      const skillMatches = candidate.cv_html.match(/class="[^"]*skill[^"]*"[^>]*>([^<]{2,40})<\/[a-z]+>/gi) || []
      skills = skillMatches
        .map((m: string) => m.replace(/<[^>]+>/g, '').trim())
        .filter((s: string) => s.length > 1 && s.length < 40)
        .slice(0, 20)
    }

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
      drive_url: cvUrl,
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

    return NextResponse.json({ success: true, candidateName: row.name, cvUrl })
  } catch (e) {
    console.error('push-to-cv-tool error:', e)
    return NextResponse.json({ error: 'Onverwachte fout' }, { status: 500 })
  }
}
