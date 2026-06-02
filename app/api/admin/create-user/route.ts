import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { email, full_name, password, role } = await request.json()

    if (!email || !full_name || !password) {
      return Response.json({ error: 'Missende velden' }, { status: 400 })
    }

    const adminClient = await createAdminClient()

    // Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) throw createError
    if (!newUser.user) throw new Error('Gebruiker aanmaken mislukt')

    // Create profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: newUser.user.id,
        full_name,
        role: role || 'user',
      })

    if (profileError) throw profileError

    return Response.json({ success: true, userId: newUser.user.id })
  } catch (error) {
    console.error('Create user error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Aanmaken mislukt' },
      { status: 500 }
    )
  }
}
