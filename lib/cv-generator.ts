import { anthropic } from './anthropic'
import type { Candidate, CVData } from '@/types'

const CONTACT_PERSONS: Record<string, { name: string; email: string; phone: string }> = {
  marlie: { name: 'Marlie Ekdom', email: 'marlie@harvesttalent.nl', phone: '+31 6 12 34 56 78' },
  julieta: { name: 'Julieta van Hierden', email: 'julieta@harvesttalent.nl', phone: '+31 6 87 65 43 21' },
  beiden: { name: 'Marlie Ekdom & Julieta van Hierden', email: 'info@harvesttalent.nl', phone: '+31 6 12 34 56 78' },
}

export async function generateCV(candidate: Candidate, intakeData?: CVData): Promise<string> {
  const contact = CONTACT_PERSONS[candidate.contact_person] || CONTACT_PERSONS.marlie
  const isNl = candidate.language === 'nl'
  const reviewLabel = candidate.review_tone === 'formal'
    ? (isNl ? 'Beoordeling' : 'Assessment')
    : (isNl ? `Over ${candidate.first_name}` : `About ${candidate.first_name}`)

  const cvData = intakeData || candidate.cv_json || {}

  const systemPrompt = `You are a professional CV designer for Harvest Talent, a Dutch recruitment agency. Generate a complete, self-contained HTML CV (3 A4 pages) with inline styles only. Use the exact Harvest brand colors and fonts specified. Output ONLY valid HTML starting with <!DOCTYPE html>.`

  const userPrompt = `Generate a professional CV in HTML for ${candidate.first_name} ${candidate.last_name} applying as ${candidate.role} at Harvest Talent.

CANDIDATE DATA:
${JSON.stringify({ ...candidate, ...cvData }, null, 2)}

STRICT PAGE RULES:
- Page 1: "${reviewLabel}" section + Education ONLY. Max 2600 characters in right column.
- Page 2: Skills + Work Experience ONLY. Max 2600 characters in right column.
- Page 3: Projects ONLY. Max 2600 characters in right column.
- Left column content does NOT count toward character limits.
- These page assignments are FIXED - never mix content across pages.

CV STRUCTURE (3 pages, each 794px × 1123px, displayed as flex-column):
Each page has:
- Left column (background: #092B13, color: white, width: 200px, padding: 24px):
  * Page 1 only: circular photo (120px) placeholder or photo_url if available
  * Candidate name in 'Source Serif 4' serif font, 20px, white
  * Role in small caps, 11px, #B8865F
  * Divider in #B8865F
  * Contact info (city, availability)
  * Language skills
  * Hobbies
  * Bottom: Harvest logo text "HARVEST" in #B8865F + contact person: ${contact.name}, ${contact.email}, ${contact.phone}
- Right column (background: #FFFBF5, flex: 1, padding: 40px):
  * Page-specific content per rules above
  * Fonts: 'Libre Franklin' for body, 'Source Serif 4' for headings
  * Section headings in #092B13, bordered bottom with #B8865F
  * Body text in #5b5750
  * Accent color #B8865F for highlights and decorations

LANGUAGE: ${isNl ? 'Dutch (Nederlands)' : 'English'}
REVIEW SECTION LABEL: "${reviewLabel}"
CONTACT PERSON: ${contact.name} | ${contact.email} | ${contact.phone}

Each page must have:
- display: flex; width: 794px; height: 1123px; overflow: hidden; margin: 0 auto 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
- Page number bottom right of right column
- Harvest contact info bottom of left column

Include Google Fonts link in <head>:
<link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@300;400;500;600;700&family=Source+Serif+4:wght@400;600;700&display=swap" rel="stylesheet">

Generate realistic, professional content based on the data provided. If data is missing, generate appropriate placeholder content.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  // Extract HTML if wrapped in code blocks
  let html = content.text
  const htmlMatch = html.match(/```html\n?([\s\S]*?)```/)
  if (htmlMatch) {
    html = htmlMatch[1]
  }

  return html.trim()
}

export async function refineCV(currentHtml: string, instruction: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `Here is the current CV HTML:\n\n${currentHtml}\n\nPlease make the following change: ${instruction}\n\nReturn the complete updated HTML only, starting with <!DOCTYPE html>.`,
      },
    ],
    system: 'You are a professional CV designer. Modify the provided HTML CV as instructed. Return ONLY the complete HTML document, no explanations.',
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  let html = content.text
  const htmlMatch = html.match(/```html\n?([\s\S]*?)```/)
  if (htmlMatch) {
    html = htmlMatch[1]
  }

  return html.trim()
}
