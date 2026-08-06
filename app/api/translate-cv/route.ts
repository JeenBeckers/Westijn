import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { candidateId } = await request.json()
    if (!candidateId) return Response.json({ error: 'candidateId is required' }, { status: 400 })

    const { data: candidate, error: fetchError } = await supabase
      .from('candidates')
      .select('cv_html, first_name, last_name')
      .eq('id', candidateId)
      .single()

    if (fetchError || !candidate?.cv_html) {
      return Response.json({ error: 'Kandidaat of CV niet gevonden' }, { status: 404 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: 'You are a professional CV translator for Harvest Talent. Translate the provided HTML CV from Dutch to English. Output ONLY the complete translated HTML document starting with <!DOCTYPE html> and ending with </html>. No markdown fences, no explanation.',
      messages: [
        {
          role: 'user',
          content: `Translate this Harvest Talent CV from Dutch to English. Keep the EXACT same HTML structure, CSS classes, and layout. Only translate the text content — not HTML tags, class names, or attribute values.

TRANSLATION RULES:
- Translate all Dutch text to professional English
- Keep proper nouns as-is: company names, university names, tool names, technology names
- "Woonplaats" → "Location", "Beschikbaarheid" → "Availability", "Relevante skills" → "Relevant skills"
- "Interesses & hobbies" → "Interests & hobbies", "Talen" → "Languages", "Contact" → "Contact"
- "Opleiding" → "Education", "Werkervaring" → "Work experience", "Projecten" → "Projects", "Skills" → "Skills"
- "Profiel Young Professional" → "Profile Young Professional"
- "Over [naam]" section label → "About [name]"
- "Curriculum vitae · Vertrouwelijk" → "Curriculum vitae · Confidential"
- "Harvest Young Professional" stays as-is in the footer
- Keep all dates, numbers, and technical terms in English
- The page footer name stays: "${candidate.first_name} ${candidate.last_name}"
- NEVER change: HTML structure, CSS classes, src attributes, href attributes, style attributes
- NEVER use em-dashes (—) in the translated text
- Degree format: keep "BSc" and "MSc" as-is (already correct)
- The header-meta text "Curriculum vitae · Vertrouwelijk" → "Curriculum vitae · Confidential"
- Page 2 header-meta "Skills & Ervaring" → "Skills & Experience"
- Page 3 header-meta "Projecten & Onderzoek" → "Projects & Research"

Return ONLY the complete translated HTML document.

${candidate.cv_html}`,
        },
      ],
    })

    const responseContent = message.content[0]
    if (responseContent.type !== 'text') throw new Error('Unexpected response type')

    let html = responseContent.text
    const htmlMatch = html.match(/```html\n?([\s\S]*?)```/)
    if (htmlMatch) html = htmlMatch[1]
    html = html.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '')

    // Post-process
    html = html.replace(/—/g, '-')
    html = html.replace(/<img([^>]*)src="[^"]*harvest-logo[^"]*"([^>]*)>/g, '<img$1src="https://westijn.vercel.app/harvest-logo-white.png"$2>')
    html = html.trim()

    // Save translated version to DB
    const { error: updateError } = await supabase
      .from('candidates')
      .update({ cv_html: html, language: 'en', updated_at: new Date().toISOString() })
      .eq('id', candidateId)

    if (updateError) return Response.json({ error: 'Opslaan mislukt: ' + updateError.message }, { status: 500 })

    return Response.json({ html })
  } catch (error) {
    console.error('translate-cv error:', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Vertalen mislukt' }, { status: 500 })
  }
}
