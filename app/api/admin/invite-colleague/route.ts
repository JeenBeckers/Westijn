import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email } = await request.json()
    if (!email) {
      return Response.json({ error: 'E-mailadres vereist' }, { status: 400 })
    }

    if (!email.endsWith('@harvest.nl')) {
      return Response.json({ error: 'Alleen @harvest.nl e-mailadressen zijn toegestaan' }, { status: 400 })
    }

    const adminClient = await createAdminClient()

    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'https://westijn.vercel.app/auth/callback',
    })

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    console.error('Invite colleague error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Uitnodiging mislukt' },
      { status: 500 }
    )
  }
}
