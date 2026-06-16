import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(req: Request) {
  try {
    const { cvHtml, candidateName } = await req.json()
    if (!cvHtml) return NextResponse.json({ error: 'cv_html vereist' }, { status: 400 })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `Jij bent een kwaliteitscontroleur voor Harvest CV's. Controleer het onderstaande CV van ${candidateName || 'de kandidaat'} op de volgende punten:

1. Toon van stem: warm, persoonlijk, professioneel ("Graag stel ik je voor aan…")
2. Geen em-dashes of en-dashes (gebruik komma of nieuwe zin)
3. Locaties: alleen stad, geen land
4. Leeftijd: correct formaat "(34)" na naam — geen komma
5. Hobbies: alleen vrijetijdsactiviteiten, geen werkgerelateerde zaken
6. Taalgebruik: vloeiend Nederlands, geen anglicismen
7. Spelling en grammatica

Geef 3 tot 5 concrete bevindingen. Als alles goed is, geef dan 1-2 kleine verbeterpunten.

Antwoord UITSLUITEND als JSON in dit exacte formaat:
{"findings": ["Bevinding 1 als concrete zin.", "Bevinding 2 als concrete zin.", "Bevinding 3 als concrete zin."]}

CV HTML:
${cvHtml.substring(0, 8000)}`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Geen geldige JSON ontvangen van Claude')

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({ findings: parsed.findings || [] })
  } catch (err) {
    console.error('cv-quality-check error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Kwaliteitscheck mislukt' }, { status: 500 })
  }
}
