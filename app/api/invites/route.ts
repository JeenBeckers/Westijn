import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { candidateEmail, candidateName } = await request.json()
    if (!candidateEmail || !candidateName) {
      return Response.json({ error: 'Missende velden' }, { status: 400 })
    }

    const adminClient = await createAdminClient()

    const { data: invite, error } = await adminClient
      .from('candidate_invites')
      .insert({
        candidate_email: candidateEmail,
        candidate_name: candidateName,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    // Send email via Resend
    const expiresAt = new Date(invite.expires_at)
    const deadline = expiresAt.toLocaleDateString('nl-NL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const portalUrl = `https://westijn.vercel.app/candidate/${invite.token}`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: candidateEmail,
        subject: 'Welkom bij Harvest – vul je vragenlijst in',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2b4b;">
            <div style="background: #1a2b4b; padding: 24px 32px;">
              <h1 style="color: white; margin: 0; font-size: 22px;">Harvest</h1>
            </div>
            <div style="padding: 32px;">
              <p style="font-size: 16px;">Beste ${candidateName},</p>
              <p>Welkom bij Harvest! We nodigen je uit om je profiel in te vullen via onze kandidaatsportal.</p>
              <p>Klik op de knop hieronder om je vragenlijst in te vullen:</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${portalUrl}" style="background: #c1272d; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
                  Vul je vragenlijst in
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">Of kopieer deze link: <a href="${portalUrl}" style="color: #c1272d;">${portalUrl}</a></p>
              <p><strong>Deadline:</strong> ${deadline}</p>
              <p>Neem contact op met jouw Harvest consultant als je vragen hebt.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #888; font-size: 12px;">Dit bericht is verstuurd door Harvest. Je kunt niet direct op dit bericht antwoorden.</p>
            </div>
          </div>
        `,
      }),
    })

    if (!resendRes.ok) {
      console.error('Resend error:', await resendRes.text())
    }

    return Response.json({ invite })
  } catch (error) {
    console.error('Create invite error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Aanmaken mislukt' },
      { status: 500 }
    )
  }
}
