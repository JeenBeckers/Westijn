import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const JORDAN_URL = process.env.JORDAN_SUPABASE_URL!
const JORDAN_KEY = process.env.JORDAN_SUPABASE_ANON_KEY!

async function jordanFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${JORDAN_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': JORDAN_KEY,
      'Authorization': `Bearer ${JORDAN_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
      ...(options.headers || {}),
    },
  })
  return res
}

// GET /api/jordan-link — list all Jordan candidates (for dropdown)
export async function GET() {
  try {
    const res = await jordanFetch('/candidates?archived=eq.false&select=id,name,role,recruit_status&order=name.asc&limit=300')
    if (!res.ok) return NextResponse.json({ error: 'Jordan fetch failed' }, { status: 502 })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/jordan-link — link a Westijn candidate to a Jordan candidate
// body: { westijn_candidate_id, jordan_candidate_id }
export async function POST(req: NextRequest) {
  try {
    const { westijn_candidate_id, jordan_candidate_id } = await req.json()
    if (!westijn_candidate_id) return NextResponse.json({ error: 'Missing westijn_candidate_id' }, { status: 400 })

    const supabase = await createClient()

    // 1. Update Westijn candidate with jordan_id
    const { error: westijnErr } = await supabase
      .from('candidates')
      .update({ jordan_id: jordan_candidate_id || null })
      .eq('id', westijn_candidate_id)
    if (westijnErr) return NextResponse.json({ error: westijnErr.message }, { status: 500 })

    // 2. Update Jordan candidate with westijn_id (if linking)
    if (jordan_candidate_id) {
      const res = await jordanFetch(
        `/candidates?id=eq.${encodeURIComponent(jordan_candidate_id)}`,
        { method: 'PATCH', body: JSON.stringify({ westijn_id: westijn_candidate_id }) }
      )
      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json({ error: `Jordan update failed: ${text}` }, { status: 502 })
      }
    }

    // 3. If unlinking, clear westijn_id from old Jordan candidate
    if (!jordan_candidate_id) {
      // Fetch the old jordan_id from Westijn to clear it
      const { data: prev } = await supabase
        .from('candidates')
        .select('jordan_id')
        .eq('id', westijn_candidate_id)
        .single()
      if (prev?.jordan_id) {
        await jordanFetch(
          `/candidates?id=eq.${encodeURIComponent(prev.jordan_id)}`,
          { method: 'PATCH', body: JSON.stringify({ westijn_id: null }) }
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
