import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'

/** Simple Word document text extraction using mammoth */
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
    return result.value || ''
  } catch {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const candidateId = (formData.get('candidateId') as string | null)?.trim()
    if (!candidateId) {
      return Response.json({ error: 'candidateId is required' }, { status: 400 })
    }

    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) {
      return Response.json({ error: 'At least one file is required' }, { status: 400 })
    }

    // Fetch candidate from Supabase
    const { data: candidate, error: fetchError } = await supabase
      .from('candidates')
      .select('cv_html, first_name, last_name')
      .eq('id', candidateId)
      .single()

    if (fetchError || !candidate) {
      return Response.json({ error: 'Kandidaat niet gevonden' }, { status: 404 })
    }

    if (!candidate.cv_html) {
      return Response.json({ error: 'Kandidaat heeft nog geen CV' }, { status: 400 })
    }

    // Build content blocks for Claude
    type ContentBlock =
      | { type: 'document'; source: { type: 'base64'; media_type: string; data: string }; title: string }
      | { type: 'text'; text: string }

    const contentBlocks: ContentBlock[] = []

    for (const file of files) {
      if (!file || file.size === 0) continue
      const name = file.name.toLowerCase()
      const buffer = await file.arrayBuffer()

      if (name.endsWith('.pdf')) {
        const base64 = Buffer.from(buffer).toString('base64')
        contentBlocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          title: file.name,
        })
      } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
        const text = await extractDocxText(buffer)
        if (text.trim()) {
          contentBlocks.push({
            type: 'text',
            text: `=== ${file.name} ===\n${text.trim()}`,
          })
        }
      } else {
        // txt, md, or other text
        const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
        if (text.trim()) {
          contentBlocks.push({
            type: 'text',
            text: `=== ${file.name} ===\n${text.trim()}`,
          })
        }
      }
    }

    if (contentBlocks.length === 0) {
      return Response.json({ error: 'Geen leesbare inhoud gevonden in de bestanden' }, { status: 400 })
    }

    // Add the prompt
    const existingCvTruncated = candidate.cv_html.slice(0, 6000)
    const prompt = `You are updating an existing Harvest CV with new information from additional documents.

EXISTING CV (HTML — preserve this structure exactly):
${existingCvTruncated}

NEW DOCUMENTS contain updated/additional information about the candidate. Extract relevant new facts (new jobs, education, skills, projects, certifications) and insert them into the correct sections of the CV.

RULES:
- Keep the EXACT same HTML structure, CSS classes, and layout
- Only update sections where new information is relevant
- Do NOT invent information not present in the documents
- Keep all existing information unless the documents explicitly supersede it
- Return the COMPLETE updated HTML document (all 3 pages)
- NEVER use em-dashes (—) — use comma or hyphen instead
- Logo img src must remain: https://westijn.vercel.app/harvest-logo-white.png

Output ONLY the complete HTML document, starting with <!DOCTYPE html> and ending with </html>. No markdown fences, no explanation.`

    contentBlocks.push({ type: 'text', text: prompt })

    // Call Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system:
        'You are a professional CV editor for Harvest Talent. Output ONLY a complete, valid HTML document. No markdown, no code fences, no explanation. Start with <!DOCTYPE html> and end with </html>.',
      messages: [
        {
          role: 'user',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: contentBlocks as any,
        },
      ],
    })

    const responseContent = message.content[0]
    if (responseContent.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    let html = responseContent.text

    // Strip markdown fences if present
    const htmlMatch = html.match(/```html\n?([\s\S]*?)```/)
    if (htmlMatch) html = htmlMatch[1]
    html = html.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '')

    // Post-process: replace logo src, remove em-dashes
    html = html.replace(/—/g, '-')
    html = html.replace(
      /(<img[^>]*src=")[^"]*harvest[^"]*logo[^"]*("|'[^']*harvest[^']*logo[^']*')/gi,
      '$1https://westijn.vercel.app/harvest-logo-white.png"'
    )
    // Ensure logo URL is correct (fallback replacement)
    html = html.replace(
      /src="[^"]*harvest-logo[^"]*"/gi,
      'src="https://westijn.vercel.app/harvest-logo-white.png"'
    )

    html = html.trim()

    // Save to DB
    const { error: updateError } = await supabase
      .from('candidates')
      .update({ cv_html: html, updated_at: new Date().toISOString() })
      .eq('id', candidateId)

    if (updateError) {
      return Response.json({ error: 'Opslaan mislukt: ' + updateError.message }, { status: 500 })
    }

    return Response.json({ html })
  } catch (error) {
    console.error('update-cv-with-docs error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Verwerken mislukt' },
      { status: 500 }
    )
  }
}
