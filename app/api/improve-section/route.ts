import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sectionHtml, sectionName, candidateContext, extraInstructions } = await request.json()

    if (!sectionHtml || !sectionName) {
      return Response.json({ error: 'sectionHtml and sectionName zijn verplicht' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: `Je bent een professionele CV-schrijver voor Harvest Talent, een Nederlands recruitmentbureau.
Je taak is het verbeteren van één sectie van een Harvest Talent CV.

REGELS:
- Behoud exact dezelfde HTML-structuur en CSS-klassen — wijzig geen tags, klassen, of layout
- Verbeter alleen de tekstinhoud: maak het scherper, professioneler en overtuigender
- Schrijf in het Nederlands (tenzij de inhoud al in het Engels was)
- Gebruik GEEN em-dashes (—) in de tekst
- Gebruik in keyword-tags (.kw .tag) ALLEEN technische vaardigheden en tools, geen soft skills
- GRAAD FORMAT REGEL (strikt — geen uitzonderingen): schrijf ALTIJD "BSc" (nooit "Bachelor", "Bachelor of Science", "Bachelor's", of een andere vorm) en ALTIJD "MSc" (nooit "Master", "Master of Science", "Master's", "MA", of een andere vorm)
- Geef ALLEEN de verbeterde HTML-fragment terug, geen uitleg, geen markdown, geen code fences`,
      messages: [
        {
          role: 'user',
          content: `Verbeter de volgende CV-sectie: "${sectionName}"

Kandidaatcontext: ${candidateContext || 'Niet beschikbaar'}
${extraInstructions ? `\nExtra instructies: ${extraInstructions}` : ''}

Huidige HTML van de sectie:
${sectionHtml}

Geef ALLEEN de verbeterde HTML terug, exact dezelfde structuur maar met betere tekst.`,
        },
      ],
    })

    let improvedHtml = message.content[0].type === 'text' ? message.content[0].text.trim() : sectionHtml

    // Post-process: enforce degree format and remove em-dashes
    improvedHtml = improvedHtml.replace(/—/g, '-')
    improvedHtml = improvedHtml.replace(/Bachelor(?:'s)?(?:\s+of\s+\w+)?/g, 'BSc')
    improvedHtml = improvedHtml.replace(/Bacheloropleiding/gi, 'BSc')
    improvedHtml = improvedHtml.replace(/Master(?:'s)?(?:\s+of\s+\w+)?/g, 'MSc')
    improvedHtml = improvedHtml.replace(/Masteropleiding/gi, 'MSc')

    return Response.json({ improvedHtml })
  } catch (error) {
    console.error('Improve section error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Verbeteren mislukt' },
      { status: 500 }
    )
  }
}
