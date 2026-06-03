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

    // Create the user without a password (OTP login)
    const { data: newUserData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (createError) throw createError

    const newUser = newUserData.user

    // Insert profile row
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: newUser.id,
        full_name: email.split('@')[0],
        role: 'user',
      })

    if (profileError) throw profileError

    // Send welcome email via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'office@harvest.nl',
        to: email,
        subject: 'Welkom bij Westijn – het CV-platform van Harvest',
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2b4b;">
  <div style="background: #1a2b4b; padding: 24px 32px;">
    <h1 style="color: white; margin: 0; font-size: 22px;">Westijn</h1>
  </div>
  <div style="padding: 32px;">
    <p>Hoi,</p>
    <p>Je bent toegevoegd aan <strong>Westijn</strong>, het CV-platform van Harvest.</p>
    <p>Inloggen gaat eenvoudig:</p>
    <ol>
      <li>Ga naar <a href="https://westijn.vercel.app/login" style="color: #c1272d;">westijn.vercel.app</a></li>
      <li>Vul je e-mailadres in</li>
      <li>Ontvang een inlogcode in je mailbox</li>
      <li>Voer de code in en je bent binnen</li>
    </ol>
    <p>Geen wachtwoord nodig!</p>
  </div>
</div>
        `,
      }),
    })

    if (!resendRes.ok) {
      console.error('Resend error:', await resendRes.text())
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Invite colleague error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Uitnodiging mislukt' },
      { status: 500 }
    )
  }
}
