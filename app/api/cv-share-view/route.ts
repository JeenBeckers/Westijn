import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token) return Response.json({ error: 'Token vereist' }, { status: 400 })

    const supabase = await createAdminClient()

    const { data: share, error } = await supabase
      .from('cv_shares')
      .select('id, candidate_id, expires_at, view_count')
      .eq('token', token)
      .single()

    if (error || !share) return Response.json({ error: 'Link niet gevonden' }, { status: 404 })

    if (new Date(share.expires_at) < new Date()) {
      return Response.json({ error: 'Link verlopen' }, { status: 410 })
    }

    // Log view
    await supabase.from('cv_share_views').insert({
      share_id: share.id,
      viewed_at: new Date().toISOString(),
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      user_agent: request.headers.get('user-agent') || null,
    })

    // Update view count
    await supabase
      .from('cv_shares')
      .update({
        view_count: share.view_count + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq('id', share.id)

    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: 'Mislukt' }, { status: 500 })
  }
}
