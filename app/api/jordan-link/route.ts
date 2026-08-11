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

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function jaroSimilarity(s1: string, t1: string): number {
  const s = s1, t = t1
  if (s === t) return 1
  const sLen = s.length, tLen = t.length
  const matchDist = Math.max(Math.floor(Math.max(sLen, tLen) / 2) - 1, 0)
  const sMatches = new Array(sLen).fill(false)
  const tMatches = new Array(tLen).fill(false)
  let matches = 0, transpositions = 0
  for (let i = 0; i < sLen; i++) {
    const start = Math.max(0, i - matchDist)
    const end = Math.min(i + matchDist + 1, tLen)
    for (let j = start; j < end; j++) {
      if (tMatches[j] || s[i] !== t[j]) continue
      sMatches[i] = true; tMatches[j] = true; matches++; break
    }
  }
  if (!matches) return 0
  let k = 0
  for (let i = 0; i < sLen; i++) {
    if (!sMatches[i]) continue
    while (!tMatches[k]) k++
    if (s[i] !== t[k]) transpositions++
    k++
  }
  return (matches / sLen + matches / tLen + (matches - transpositions / 2) / matches) / 3
}

function jaroWinkler(s: string, t: string): number {
  const jaro = jaroSimilarity(s, t)
  let prefix = 0
  for (let i = 0; i < Math.min(4, Math.min(s.length, t.length)); i++) {
    if (s[i] === t[i]) prefix++; else break
  }
  return jaro + prefix * 0.1 * (1 - jaro)
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  // Full name similarity
  const full = jaroWinkler(na, nb)
  // Also try reversed order (Jordan may store "Jeen Beckers", Westijn "Beckers, Jeen")
  const partsA = na.split(' ')
  const partsB = nb.split(' ')
  const reversed = jaroWinkler(partsA.join(' '), [...partsB].reverse().join(' '))
  return Math.max(full, reversed)
}

// GET /api/jordan-link?westijn_name=X — list Jordan candidates, optionally with auto-match score
export async function GET(req: NextRequest) {
  try {
    const westijnName = req.nextUrl.searchParams.get('westijn_name') || ''
    const westijnId = req.nextUrl.searchParams.get('westijn_candidate_id') || ''

    const res = await jordanFetch('/candidates?archived=eq.false&select=id,name,role,recruit_status&order=name.asc&limit=300')
    if (!res.ok) return NextResponse.json({ error: 'Jordan fetch failed' }, { status: 502 })
    const data: { id: string; name: string; role: string; recruit_status: string }[] = await res.json()

    if (!westijnName) return NextResponse.json(data)

    // Score all candidates
    const scored = data.map(c => ({ ...c, score: nameSimilarity(westijnName, c.name) }))
    const best = scored.reduce((a, b) => a.score > b.score ? a : b, scored[0])

    // Auto-link if ≥ 90% and a westijn candidate id was provided
    if (best && best.score >= 0.90 && westijnId) {
      const supabase = await createClient()
      await supabase.from('candidates').update({ jordan_id: best.id }).eq('id', westijnId)
      await jordanFetch(
        `/candidates?id=eq.${encodeURIComponent(best.id)}`,
        { method: 'PATCH', body: JSON.stringify({ westijn_id: westijnId }) }
      )
      return NextResponse.json({ auto_linked: true, match: best, candidates: scored })
    }

    return NextResponse.json({ auto_linked: false, best_match: best || null, candidates: scored })
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

    // If unlinking, fetch old jordan_id first to clear westijn_id there
    if (!jordan_candidate_id) {
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

    // Update Westijn candidate with jordan_id
    const { error: westijnErr } = await supabase
      .from('candidates')
      .update({ jordan_id: jordan_candidate_id || null })
      .eq('id', westijn_candidate_id)
    if (westijnErr) return NextResponse.json({ error: westijnErr.message }, { status: 500 })

    // Update Jordan candidate with westijn_id
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

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
