import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import { randomBytes } from 'crypto'

const HARVEST_CONTACTS = {
  jeen: { name: 'Jeen Beckers', email: 'jeen.beckers@harvest.nl', phone: '+31 6 29070100' },
  marlie: { name: 'Marlie Ekdom', email: 'marlie.ekdom@harvest.nl', phone: '+31 6 38596717' },
  julieta: { name: 'Julieta van Hierden', email: 'julieta.van.hierden@harvest.nl', phone: '+31 6 51759566' },
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      candidateId,
      apolloContactId,
      apolloContactName,
      apolloContactEmail,
      apolloCompany,
      harvestContact,
      contextNote,
    } = await request.json()

    if (!candidateId || !apolloContactName || !apolloContactEmail || !harvestContact) {
      return Response.json({ error: 'Verplichte velden ontbreken' }, { status: 400 })
    }

    const adminSupabase = await createAdminClient()
    const { data: candidate, error: candidateError } = await adminSupabase
      .from('candidates')
      .select('first_name, last_name, role, city, availability, cv_html')
      .eq('id', candidateId)
      .single()

    if (candidateError || !candidate?.cv_html) {
      return Response.json({ error: 'Kandidaat niet gevonden' }, { status: 404 })
    }

    const harvestContactInfo = HARVEST_CONTACTS[harvestContact as keyof typeof HARVEST_CONTACTS]
    if (!harvestContactInfo) {
      return Response.json({ error: 'Ongeldige Harvest contactpersoon' }, { status: 400 })
    }

    // Generate personalized cover letter
    const coverLetterMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'Je bent een professionele recruitment schrijver voor Harvest Talent. Schrijf zakelijke, warme aanbiedingsbrieven in correct Nederlands. Geen markdown, alleen platte tekst met alinea-breaks.',
      messages: [{
        role: 'user',
        content: `Schrijf een professionele aanbiedingsbrief voor het aanbieden van een kandidaat aan een opdrachtgever.

KANDIDAAT:
- Naam: ${candidate.first_name} ${candidate.last_name}
- Rol: ${candidate.role}
- Woonplaats: ${candidate.city || 'onbekend'}
- Beschikbaarheid: ${candidate.availability || 'nader te bespreken'}

ONTVANGER:
- Naam: ${apolloContactName}
- Bedrijf: ${apolloCompany || 'het bedrijf'}

HARVEST CONTACTPERSOON (voor vragen):
- Naam: ${harvestContactInfo.name}
- E-mail: ${harvestContactInfo.email}
- Telefoon: ${harvestContactInfo.phone}

${contextNote ? `EXTRA CONTEXT:\n${contextNote}\n` : ''}

INSTRUCTIES:
- Begin met "Beste ${apolloContactName},"
- Introduceer de kandidaat met voornaam en rol
- Beschrijf kort waarom deze kandidaat interessant kan zijn (op basis van rol en beschikbaarheid)
- Vermeld dat het CV via de link te bekijken is
- Sluit af met een uitnodiging voor contact via ${harvestContactInfo.name}
- Onderteken als "${harvestContactInfo.name} | Harvest Talent"
- Maximaal 150 woorden
- Gebruik GEEN em-dashes (—) of en-dashes (–)
- Schrijf in de "je/jij" vorm naar de ontvanger`,
      }],
    })

    const coverLetter = coverLetterMessage.content[0].type === 'text'
      ? coverLetterMessage.content[0].text.trim()
      : ''

    // Generate unique token
    const token = randomBytes(24).toString('base64url')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Save share to DB
    const { data: share, error: shareError } = await adminSupabase
      .from('cv_shares')
      .insert({
        candidate_id: candidateId,
        token,
        apollo_contact_id: apolloContactId || null,
        apollo_contact_name: apolloContactName,
        apollo_contact_email: apolloContactEmail,
        apollo_company: apolloCompany || '',
        harvest_contact: harvestContact,
        cover_letter: coverLetter,
        expires_at: expiresAt,
        created_by: user.id,
        context_note: contextNote || null,
      })
      .select()
      .single()

    if (shareError) {
      console.error('Share insert error:', shareError)
      return Response.json({ error: 'Opslaan mislukt: ' + shareError.message }, { status: 500 })
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://westijn.vercel.app'}/cv/share/${token}`

    // Build Apollo email body
    const emailBody = `${coverLetter}

---
CV bekijken: ${shareUrl}
(Link geldig tot ${new Date(expiresAt).toLocaleDateString('nl-NL')})
`

    return Response.json({
      shareId: share.id,
      token,
      shareUrl,
      coverLetter,
      emailBody,
      subject: `Aanbieding: ${candidate.first_name} ${candidate.last_name} — ${candidate.role}`,
      recipientEmail: apolloContactEmail,
      recipientName: apolloContactName,
    })
  } catch (error) {
    console.error('share-cv error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Aanbieding klaarzetten mislukt' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const candidateId = searchParams.get('candidateId')
    if (!candidateId) return Response.json({ error: 'candidateId vereist' }, { status: 400 })

    const adminSupabase = await createAdminClient()
    const { data: shares, error } = await adminSupabase
      .from('cv_shares')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return Response.json({ shares })
  } catch (error) {
    return Response.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
