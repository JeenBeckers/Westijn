import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resend, FROM_EMAIL } from '@/lib/resend'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { candidateId, email } = await request.json()

    if (!candidateId || !email) {
      return Response.json({ error: 'Missende velden' }, { status: 400 })
    }

    // Get candidate info
    const { data: candidate } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single()

    if (!candidate) {
      return Response.json({ error: 'Kandidaat niet gevonden' }, { status: 404 })
    }

    // Create intake form record
    const { data: intakeForm, error: insertError } = await supabase
      .from('intake_forms')
      .insert({
        candidate_id: candidateId,
        email,
      })
      .select()
      .single()

    if (insertError) throw insertError

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const intakeUrl = `${appUrl}/intake/${intakeForm.token}`

    // Send email via Resend
    const { error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Intakeformulier van Harvest Talent voor ${candidate.first_name} ${candidate.last_name}`,
      html: `
        <!DOCTYPE html>
        <html lang="nl">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #d8d3c9; margin: 0; padding: 40px 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #FFFBF5; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: #092B13; padding: 32px 40px; }
            .logo { color: #B8865F; font-size: 24px; font-weight: 700; letter-spacing: 3px; }
            .header-sub { color: rgba(255,255,255,0.6); font-size: 13px; margin-top: 4px; }
            .body { padding: 40px; }
            h1 { color: #092B13; font-size: 22px; margin: 0 0 16px; }
            p { color: #5b5750; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
            .button { display: inline-block; background: #092B13; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 8px 0 24px; }
            .footer { background: #d8d3c9; padding: 24px 40px; text-align: center; color: #5b5750; font-size: 12px; }
            .divider { height: 2px; background: #B8865F; margin: 24px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">HARVEST</div>
              <div class="header-sub">Talent Recruitment</div>
            </div>
            <div class="body">
              <h1>Hallo ${candidate.first_name},</h1>
              <p>
                We zijn verheugd je te begeleiden bij het opstellen van een professioneel CV voor de functie van
                <strong>${candidate.role}</strong>.
              </p>
              <p>
                Klik op de knop hieronder om het intakeformulier in te vullen. Dit duurt ongeveer 10–15 minuten.
                Op basis van jouw antwoorden stellen wij een professioneel Harvest CV voor je op.
              </p>
              <a href="${intakeUrl}" class="button">Intakeformulier invullen →</a>
              <div class="divider"></div>
              <p style="font-size:13px;">
                Of kopieer deze link in je browser:<br>
                <a href="${intakeUrl}" style="color:#2F6B3A; word-break:break-all;">${intakeUrl}</a>
              </p>
              <p style="font-size:13px;">
                Deze link is 7 dagen geldig. Heb je vragen? Neem dan contact met ons op.
              </p>
            </div>
            <div class="footer">
              <strong style="color:#B8865F; letter-spacing:2px;">HARVEST TALENT</strong><br>
              Marlie Ekdom &bull; marlie.ekdom@harvest.nl<br><br>
              &copy; ${new Date().getFullYear()} Harvest Talent Recruitment
            </div>
          </div>
        </body>
        </html>
      `,
    })

    if (emailError) throw emailError

    // Mark intake as sent
    await supabase
      .from('candidates')
      .update({ intake_sent_at: new Date().toISOString() })
      .eq('id', candidateId)

    return Response.json({ success: true, token: intakeForm.token })
  } catch (error) {
    console.error('Send intake error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Versturen mislukt' },
      { status: 500 }
    )
  }
}
