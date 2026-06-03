import { anthropic } from './anthropic'
import type { Candidate, CVData } from '@/types'

const CONTACT_PERSONS: Record<string, { name: string; email: string; phone: string }[]> = {
  marlie: [{ name: 'Marlie Ekdom', email: 'marlie@harvesttalent.nl', phone: '+31 6 38596717' }],
  julieta: [{ name: 'Julieta van Hierden', email: 'julieta@harvesttalent.nl', phone: '+31 6 51759566' }],
  beiden: [
    { name: 'Marlie Ekdom', email: 'marlie@harvesttalent.nl', phone: '+31 6 38596717' },
    { name: 'Julieta van Hierden', email: 'julieta@harvesttalent.nl', phone: '+31 6 51759566' },
  ],
}

function buildContactHTML(contacts: { name: string; email: string; phone: string }[]): string {
  return contacts.map(c => `
    <div class="contact-block">
      <div class="contact-name">${c.name}</div>
      <div class="contact-line">${c.phone}</div>
      <div class="contact-line">${c.email}</div>
    </div>`).join('\n')
}

export async function generateCV(candidate: Candidate, intakeData?: CVData, additionalInstructions?: string): Promise<string> {
  const contacts = CONTACT_PERSONS[candidate.contact_person] || CONTACT_PERSONS.marlie
  const isNl = candidate.language === 'nl'
  const reviewLabel = candidate.review_tone === 'formal'
    ? (isNl ? '— Beoordeling' : '— Review')
    : (isNl ? `Over ${candidate.first_name}` : `About ${candidate.first_name}`)

  const cvData: CVData = { ...(candidate.cv_json || {}), ...(intakeData || {}) } as CVData
  const fullName = `${candidate.first_name} ${candidate.last_name}`
  const photoTag = candidate.photo_url
    ? `<img src="${candidate.photo_url}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center 18%;display:block;">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Source Serif 4',serif;font-size:64px;color:rgba(9,40,18,0.32);">${candidate.first_name[0]}${candidate.last_name[0]}</div>`

  const contactBlocksHTML = buildContactHTML(contacts)

  const systemPrompt = `You are a professional CV generator for Harvest Talent. Output ONLY a complete, valid HTML document. No markdown, no code fences, no explanation. Start with <!DOCTYPE html> and end with </html>.`

  const importedContent: string | undefined = (cvData as CVData & { importedContent?: string }).importedContent
    || (candidate.cv_json as (CVData & { importedContent?: string }) | null)?.importedContent

  const importedContentBlock = importedContent ? `
SOURCE DOCUMENT (use this as primary source of truth):
The following text was extracted from an existing CV. Use the information in this document — especially education, work experience, and projects — verbatim as the basis for the new CV. Do NOT invent or substitute data.

${importedContent}

---
IMPORTANT RULES FOR IMPORTED CVs:
- All education entries (BSc, MSc, HBO, etc.) MUST come from the source document above
- All work experience MUST come from the source document
- Do not replace any university or institution with a different one
- If the source shows MSc at Utrecht University, the new CV must also show MSc at Utrecht University
- Only the formatting, layout and Harvest branding are new — the content is from the source

` : ''

  const userPrompt = `Generate a Harvest Talent CV HTML document for ${fullName}.
${importedContentBlock}
CANDIDATE DATA:
${JSON.stringify({ ...candidate, ...cvData }, null, 2)}

TYPOGRAPHY RULE (strictly enforced):
- NEVER use em-dashes (—) anywhere in the CV text content.
- Replace any em-dash with a comma, colon, hyphen (-), or rewrite the sentence.
- This applies to ALL text: review, education, skills, work experience, projects, tagline.
- The only exception is the review-mark label (e.g. "— Review") which is a decorative element, not body text.

KEYWORD TAGS RULE (strictly enforced):
- The red keyword tags (.kw .tag elements) under work experience entries and project entries must contain ONLY technical skills and tools.
- Examples of what belongs: Python, React, PyTorch, Docker, SQL, Azure, Git, REST API, scikit-learn, MONAI, etc.
- Examples of what does NOT belong: "Teamwork", "Stakeholder management", "Agile/Scrum" (as a soft skill), "Communication", "Leadership", "Problem solving", etc.
- Agile/Scrum is acceptable ONLY if it refers to the methodology used in the project (not as a soft skill label).
- Soft skills belong ONLY in the `.pill.soft` elements on the Skills page — never in `.kw .tag` elements.
- Keep the tag list short: max 6 tags per entry. Prefer the most specific and technical tags.

OUTPUT RULES:
- Output ONLY the complete HTML document, starting with <!DOCTYPE html>
- No markdown, no \`\`\`html fences, no explanations before or after
- Language: ${isNl ? 'Dutch (Nederlands)' : 'English'}
- Review label: "${reviewLabel}"
- All text content must be in ${isNl ? 'Dutch' : 'English'} unless it is a proper name or technical term

CRITICAL: You MUST generate exactly 3 <section class="page"> elements — no more, no less.
- Page 1: sidebar + main with review and education
- Page 2: no-sidebar, skills and work experience
- Page 3: no-sidebar, projects
If content is too long, cut it to fit. Never add a 4th page.
Each page has height: 1123px and overflow: hidden — content that doesn't fit will be cut off.

PAGE CONTENT RULES (FIXED — never mix across pages):
- Page 1 right column: "${reviewLabel}" paragraph + Education section ONLY — MAX 2600 characters including spaces
- Page 2 right column: Skills section + Work Experience section ONLY — MAX 2600 characters including spaces
- Page 3 right column: Projects section ONLY — MAX 2600 characters including spaces
- Left/sidebar column does NOT count toward character limits
- Count characters carefully and cut/summarize content to stay within limits

PHOTO PLACEHOLDER (use exactly as-is — DO NOT change):
${photoTag}

CONTACT BLOCKS (use exactly as-is — DO NOT change):
${contactBlocksHTML}

Use the following EXACT HTML structure and CSS:

<!DOCTYPE html>
<html lang="${isNl ? 'nl' : 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CV ${fullName} — Harvest Talent</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #E8E0D8; font-family: 'Libre Franklin', sans-serif; padding: 32px; }
.pages { display: flex; flex-direction: column; gap: 24px; align-items: center; }

/* PAGE */
.page { width: 794px; height: 1123px; background: #FFFBF5; display: flex; flex-direction: column; box-shadow: 0 4px 20px rgba(0,0,0,0.18); overflow: hidden; }


/* HEADER */
.page-header { background: #092B13; height: 70px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; flex-shrink: 0; }
.logo-text { font-family: 'Source Serif 4', serif; font-size: 20px; font-weight: 400; color: #FFFBF5; letter-spacing: 0.12em; }
.header-meta { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 500; color: rgba(255,251,245,0.75); }

/* FOOTER */
.page-footer { background: #092B13; height: 32px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; flex-shrink: 0; }
.footer-left { display: flex; align-items: center; gap: 8px; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,251,245,0.75); }
.footer-dot { width: 4px; height: 4px; border-radius: 50%; background: #FFFBF5; flex-shrink: 0; }
.footer-right { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,251,245,0.75); }

/* PAGE BODY */
.page-body { display: flex; flex: 1; overflow: hidden; }

/* SIDEBAR (page 1 only) */
.sidebar { width: 220px; background: #E4DCD3; padding: 28px 22px; display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden; }
.photo-wrap { width: 100%; aspect-ratio: 1/1; overflow: hidden; margin-bottom: 18px; }
.sb-block { margin-bottom: 18px; }
.sb-label-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.sb-label { font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; color: #092B13; white-space: nowrap; }
.sb-rule { flex: 1; border: none; border-top: 1px solid rgba(9,40,18,0.30); }
.sb-value { font-size: 12.5px; line-height: 1.4; color: #1c1f1a; }
.sb-list { list-style: none; }
.sb-list li { font-size: 12.5px; line-height: 1.4; color: #1c1f1a; padding-left: 14px; position: relative; margin-bottom: 3px; }
.sb-list li::before { content: ''; position: absolute; left: 0; top: 6px; width: 5px; height: 5px; border-radius: 50%; background: #782410; }
.sb-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.sb-chip { background: #092B13; color: #FFFBF5; font-size: 10px; padding: 4px 9px; border-radius: 5px; font-family: 'Libre Franklin', sans-serif; }
.sb-spacer { flex: 1; }
.contact-block { margin-bottom: 10px; }
.contact-name { font-size: 12.5px; font-weight: 600; color: #1c1f1a; }
.contact-line { font-size: 10.5px; color: #5b5750; }

/* MAIN COLUMN */
.main { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.main-p1 { padding: 28px 36px 32px; overflow: hidden; }
.main-full { padding: 32px 56px 36px; overflow: hidden; }

/* PAGE 1 MAIN */
.eyebrow { font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 500; color: #782410; margin-bottom: 4px; }
.cand-name { font-family: 'Source Serif 4', serif; font-weight: 400; font-size: 38px; line-height: 1.05; letter-spacing: -0.01em; white-space: nowrap; color: #092B13; }
.cand-name .age { font-style: italic; color: #782410; }
.tagline { font-style: italic; font-size: 13px; color: #3c3a35; margin-top: 5px; }
.review-mark { font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 500; color: #092B13; margin: 22px 0 8px; }
.review-body p { font-size: 12px; line-height: 1.55; color: #1c1f1a; margin: 0 0 8px; text-wrap: pretty; }

/* SECTION HEAD */
.section-head { display: flex; align-items: baseline; gap: 14px; margin: 22px 0 12px; }
.section-head.first { margin-top: 0; }
.section-head h2 { font-family: 'Source Serif 4', serif; font-weight: 600; font-size: 24px; color: #092B13; white-space: nowrap; }
.section-rule { flex: 1; border: none; border-top: 1px solid rgba(9,40,18,0.30); }
.section-count { font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 500; color: rgba(9,40,18,0.55); white-space: nowrap; }

/* ENTRY */
.entry { padding: 10px 0 14px; border-bottom: 1px dashed rgba(9,40,18,0.20); }
.entry:last-child { border-bottom: none; }
.entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-bottom: 3px; }
.entry-title { font-size: 13.5px; font-weight: 700; color: #092B13; }
.entry-date { font-size: 11.5px; color: rgba(9,40,18,0.55); white-space: nowrap; }
.entry-org { font-size: 12px; color: #3c3a35; margin: 0 0 6px; }
.entry-body { font-size: 11.5px; line-height: 1.55; color: #1c1f1a; }
.entry-list { list-style: none; margin: 4px 0 0; }
.entry-list li { font-size: 11.5px; line-height: 1.55; color: #1c1f1a; padding-left: 13px; position: relative; margin-bottom: 2px; }
.entry-list li::before { content: ''; position: absolute; left: 0; top: 6px; width: 4px; height: 4px; border-radius: 50%; background: #782410; }
.kw { background: #F4D9CE; color: #782410; font-size: 10px; padding: 2px 7px; border-radius: 3px; font-weight: 500; display: inline-block; margin: 2px 2px 0 0; }

/* SKILLS PAGE */
.skills-sub { font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; color: #092B13; margin: 16px 0 10px; }
.skills-sub:first-child { margin-top: 0; }
.skills-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.pill { background: #092B13; color: #FFFBF5; font-size: 11.5px; padding: 5px 11px; border-radius: 5px; font-family: 'Libre Franklin', sans-serif; }
.pill.soft { background: transparent; color: #092812; border: 1px solid rgba(9,40,18,0.30); }

@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: white; }
  .pages { gap: 0; display: block; }
  .page {
    box-shadow: none;
    page-break-after: always;
    page-break-inside: avoid;
    width: 794px;
    height: 1123px;
    overflow: hidden;
    margin: 0;
  }
  .page:last-child { page-break-after: auto; }
}
</style>
</head>
<body>
<div class="pages">

  <!-- PAGE 1 -->
  <div class="page">
    <div class="page-header">
      <img src="https://westijn.vercel.app/harvest-logo-white.png" alt="Harvest" style="height:26px;display:block;">
      <div class="header-meta">Curriculum vitae · Confidential</div>
    </div>
    <div class="page-body">
      <div class="sidebar">
        <div class="photo-wrap">
          [PHOTO_PLACEHOLDER]
        </div>

        <div class="sb-block">
          <div class="sb-label-row"><span class="sb-label">${isNl ? 'Woonplaats' : 'Location'}</span><hr class="sb-rule"></div>
          <div class="sb-value">[CITY]</div>
        </div>

        <div class="sb-block">
          <div class="sb-label-row"><span class="sb-label">${isNl ? 'Beschikbaarheid' : 'Availability'}</span><hr class="sb-rule"></div>
          <div class="sb-value">[AVAILABILITY]</div>
        </div>

        <div class="sb-block">
          <div class="sb-label-row"><span class="sb-label">${isNl ? 'Relevante skills' : 'Relevant skills'}</span><hr class="sb-rule"></div>
          <div class="sb-chips">
            [SKILL_CHIPS — 4 to 6 most relevant skills as <span class="sb-chip">Skill</span> elements]
          </div>
        </div>

        <div class="sb-block">
          <div class="sb-label-row"><span class="sb-label">${isNl ? 'Interesses & hobbies' : 'Interests & hobbies'}</span><hr class="sb-rule"></div>
          <ul class="sb-list">
            [HOBBIES as <li> items]
          </ul>
        </div>

        <div class="sb-block">
          <div class="sb-label-row"><span class="sb-label">${isNl ? 'Talen' : 'Languages'}</span><hr class="sb-rule"></div>
          <ul class="sb-list">
            [LANGUAGES as <li> items with level, e.g. "Nederlands — Moedertaal"]
          </ul>
        </div>

        <div class="sb-spacer"></div>

        <div class="sb-block" style="margin-bottom:0;">
          <div class="sb-label-row"><span class="sb-label">${isNl ? 'Contact' : 'Contact'}</span><hr class="sb-rule"></div>
          [CONTACT_BLOCKS]
        </div>
      </div>

      <div class="main">
        <div class="main-p1">
          <div class="eyebrow">${isNl ? 'Profiel young professional' : 'Profile young professional'}</div>
          <div class="cand-name">[FIRST_NAME] [LAST_NAME]${candidate.age ? `, <span class="age">${candidate.age}</span>` : ''}</div>
          <div class="tagline">[ROLE] · [SHORT_DESCRIPTOR — e.g. "Analytisch, gedreven en klantgericht"]</div>
          <div class="review-mark">${reviewLabel}</div>
          <div class="review-body">
            [2–4 paragraphs <p>...</p> about the candidate — personal, professional strengths, ambitions. MAX combined with education below: 2600 chars]
          </div>

          <div class="section-head">
            <h2>${isNl ? 'Opleiding' : 'Education'}</h2>
            <hr class="section-rule">
            <span class="section-count">[N] ${isNl ? 'opleidingen' : 'degrees'}</span>
          </div>

          [EDUCATION ENTRIES — use .entry structure:
          <div class="entry">
            <div class="entry-head">
              <span class="entry-title">[DEGREE] [FIELD]</span>
              <span class="entry-date">[YEAR]</span>
            </div>
            <div class="entry-org">[INSTITUTION]</div>
            <div class="entry-body">[SHORT DESCRIPTION if any]</div>
          </div>
          ]

EDUCATION RULES (strictly enforced):
- ALWAYS include BSc and MSc degrees — these are NEVER cut, even if the 2600 char limit is tight.
- If the character limit is at risk, shorten the review text instead — education degrees take priority.
- Within education entries: prefer higher degrees (MSc > BSc > HBO > MBO > VWO/Havo) and more recent over older.
- For each degree: always show institution, title, period, and graduation status. Thesis and courses are optional and can be shortened or removed to save space.
- Never omit a university degree to make room for secondary school or short courses.
- If both BSc and MSc are present, always show both. A completed HBO counts as equivalent to BSc.
        </div>
      </div>
    </div>
    <div class="page-footer">
      <div class="footer-left">
        <div class="footer-dot"></div>
        <span>${fullName}</span>
        <div class="footer-dot"></div>
        <span>Harvest Young Professional</span>
      </div>
      <div class="footer-right">1 / 3</div>
    </div>
  </div>

  <!-- PAGE 2 -->
  <div class="page">
    <div class="page-header">
      <img src="https://westijn.vercel.app/harvest-logo-white.png" alt="Harvest" style="height:26px;display:block;">
      <div class="header-meta">${fullName} · ${isNl ? 'Skills & Ervaring' : 'Skills & Experience'}</div>
    </div>
    <div class="page-body">
      <div class="main">
        <div class="main-full">
          <div class="section-head first">
            <h2>Skills</h2>
            <hr class="section-rule">
          </div>

          [SKILLS CONTENT — structure:
          <div class="skills-sub">${isNl ? 'Soft skills' : 'Soft skills'}</div>
          <div class="skills-pills">
            [soft skill pills as <span class="pill soft">Skill</span>]
          </div>

          Then for each technical category (e.g. Programming languages, Libraries & frameworks, Tools & platforms, Domain):
          <div class="skills-sub">[Category name]</div>
          <div class="skills-pills">
            [hard skill pills as <span class="pill">Skill</span>]
          </div>
          ]

          <div class="section-head">
            <h2>${isNl ? 'Werkervaring' : 'Work experience'}</h2>
            <hr class="section-rule">
            <span class="section-count">[N] ${isNl ? 'posities' : 'positions'}</span>
          </div>

          [WORK EXPERIENCE ENTRIES — use .entry structure with entry-list bullets and kw tags:
          <div class="entry">
            <div class="entry-head">
              <span class="entry-title">[ROLE]</span>
              <span class="entry-date">[PERIOD]</span>
            </div>
            <div class="entry-org">[COMPANY]</div>
            <ul class="entry-list">
              <li>[bullet point]</li>
            </ul>
            <div style="margin-top:6px;">
              <span class="kw">[keyword]</span>
            </div>
          </div>
          ]
        </div>
      </div>
    </div>
    <div class="page-footer">
      <div class="footer-left">
        <div class="footer-dot"></div>
        <span>${fullName}</span>
        <div class="footer-dot"></div>
        <span>Harvest Young Professional</span>
      </div>
      <div class="footer-right">2 / 3</div>
    </div>
  </div>

  <!-- PAGE 3 -->
  <div class="page">
    <div class="page-header">
      <img src="https://westijn.vercel.app/harvest-logo-white.png" alt="Harvest" style="height:26px;display:block;">
      <div class="header-meta">${fullName} · ${isNl ? 'Projecten & Onderzoek' : 'Projects & Research'}</div>
    </div>
    <div class="page-body">
      <div class="main">
        <div class="main-full">
          <div class="section-head first">
            <h2>${isNl ? 'Projecten' : 'Projects'}</h2>
            <hr class="section-rule">
            <span class="section-count">[N] ${isNl ? 'projecten' : 'projects'}</span>
          </div>

          [PROJECT ENTRIES — use .entry structure:
          <div class="entry">
            <div class="entry-head">
              <span class="entry-title">[PROJECT NAME]</span>
              <span class="entry-date">[PERIOD]</span>
            </div>
            <div class="entry-org">[CONTEXT / INSTITUTION if applicable]</div>
            <div class="entry-body">[DESCRIPTION — concise, max ~150 chars per project]</div>
            <div style="margin-top:6px;">
              <span class="kw">[tech/keyword]</span>
            </div>
          </div>
          ]

          [If page 3 has space left (more than ~400px worth), add a motivational closing quote or short personal statement in a styled block:
          <div style="margin-top:24px;padding:16px 20px;border-left:3px solid #782410;background:#F4D9CE22;">
            <p style="font-style:italic;font-size:12px;line-height:1.6;color:#3c3a35;">"[CLOSING QUOTE OR PERSONAL STATEMENT]"</p>
          </div>
          ]
        </div>
      </div>
    </div>
    <div class="page-footer">
      <div class="footer-left">
        <div class="footer-dot"></div>
        <span>${fullName}</span>
        <div class="footer-dot"></div>
        <span>Harvest Young Professional</span>
      </div>
      <div class="footer-right">3 / 3</div>
    </div>
  </div>

</div>
</body>
</html>

INSTRUCTIONS FOR FILLING IN THE TEMPLATE:
1. Replace ALL [PLACEHOLDER] markers with real content derived from the candidate data provided.
2. Use the PHOTO PLACEHOLDER provided above exactly — do not modify it.
3. Use the CONTACT BLOCKS provided above exactly — do not modify them.
4. Page 1 right column: "${reviewLabel}" text + Education. Count chars, stay ≤ 2600. When counting characters for the 2600 limit on page 1: if you are close to the limit, shorten the review paragraphs first. Education (BSc/MSc) is non-negotiable.
5. Page 2 right column: Skills (pills) + Work Experience. Count chars, stay ≤ 2600. Cut bullet points or entries if needed.
6. Page 3 right column: Projects only. Count chars, stay ≤ 2600. Cut descriptions if needed.
7. If data is missing for a section, use reasonable professional placeholders.
8. The output must be a single complete HTML document with NO placeholders remaining.
9. Output ONLY the HTML. Do not add any text before <!DOCTYPE html> or after </html>.${additionalInstructions ? `

ADDITIONAL INSTRUCTIONS FROM RECRUITER:
${additionalInstructions}

Follow these instructions while respecting all page limits and layout rules above.` : ''}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
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

  // Strip markdown fences if present
  let html = content.text
  const htmlMatch = html.match(/```html\n?([\s\S]*?)```/)
  if (htmlMatch) {
    html = htmlMatch[1]
  }
  // Also strip any leading/trailing backtick-only fences
  html = html.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '')

  // Post-process: ensure the photo placeholder is replaced with the actual photo tag
  // (Claude may not always follow the instruction to use the placeholder exactly)
  html = html.replace(/\[PHOTO_PLACEHOLDER\]/g, photoTag)

  // Also handle the case where Claude leaves the photo-wrap empty or uses a wrong src
  // If the candidate has a photo_url, ensure it appears in the img tag within photo-wrap
  if (candidate.photo_url) {
    // Replace any placeholder img src that Claude might have invented
    html = html.replace(
      /(<div class="photo-wrap">[^<]*<img[^>]+src=")(?!https?:\/\/)[^"]*("[^>]*>)/g,
      `$1${candidate.photo_url}$2`
    )
  }

  // Post-process: remove em-dashes from text content (not inside HTML tags)
  html = html.replace(/—/g, '-')

  return html.trim()
}

export async function refineCV(
  currentHtml: string,
  instruction: string,
  sectionNotes?: Record<string, string>
): Promise<string> {
  const sectionLabels: Record<string, string> = {
    review: 'Beoordeling/Review',
    opleiding: 'Opleiding',
    relevanteSkills: 'Relevante skills (sidebar)',
    interesses: 'Interesses & hobbies',
    talen: 'Talen',
    skills: 'Skills (pagina 2)',
    werkervaring: 'Werkervaring',
    projecten: 'Projecten',
  }

  let userContent: string

  if (sectionNotes) {
    const nonEmptyNotes = Object.entries(sectionNotes).filter(([, v]) => v.trim())
    if (nonEmptyNotes.length > 0) {
      const noteLines = nonEmptyNotes
        .map(([k, v]) => `- ${sectionLabels[k] ?? k}: ${v}`)
        .join('\n')
      userContent = `Refine the following sections of the CV based on these instructions. Keep all other sections exactly as they are. Respect all page limits (≤2600 chars per right column per page) and layout rules.\n\nSECTION-SPECIFIC INSTRUCTIONS:\n${noteLines}\n\nCurrent CV HTML:\n\n${currentHtml}\n\nReturn the complete updated HTML only, starting with <!DOCTYPE html> and ending with </html>. No markdown fences, no explanation.`
    } else {
      userContent = `Here is the current CV HTML:\n\n${currentHtml}\n\nPlease make the following change: ${instruction}\n\nReturn the complete updated HTML only, starting with <!DOCTYPE html> and ending with </html>. No markdown fences, no explanation.`
    }
  } else {
    userContent = `Here is the current CV HTML:\n\n${currentHtml}\n\nPlease make the following change: ${instruction}\n\nReturn the complete updated HTML only, starting with <!DOCTYPE html> and ending with </html>. No markdown fences, no explanation.`
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
    system: 'You are a professional CV designer for Harvest Talent. Modify the provided HTML CV as instructed. Return ONLY the complete HTML document starting with <!DOCTYPE html>. No markdown fences, no explanation.\n\nTYPOGRAPHY RULE (strictly enforced): NEVER use em-dashes (—) anywhere in the CV text content. Replace any em-dash with a comma, colon, hyphen (-), or rewrite the sentence. This applies to ALL text: review, education, skills, work experience, projects, tagline. The only exception is the review-mark label (e.g. "— Review") which is a decorative element, not body text.\n\nKEYWORD TAGS RULE (strictly enforced): The red keyword tags (.kw .tag elements) under work experience entries and project entries must contain ONLY technical skills and tools. Soft skills belong ONLY in the .pill.soft elements on the Skills page — never in .kw .tag elements. Keep the tag list short: max 6 tags per entry.',
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
  html = html.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '')

  // Post-process: remove em-dashes from text content (not inside HTML tags)
  html = html.replace(/—/g, '-')

  return html.trim()
}
