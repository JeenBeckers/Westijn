import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import { compressImage } from '@/lib/compress-image'

const CONTACT_PERSONS: Record<string, { name: string; email: string; phone: string }[]> = {
  marlie: [{ name: 'Marlie Ekdom', email: 'marlie@harvesttalent.nl', phone: '+31 6 38596717' }],
  julieta: [{ name: 'Julieta van Hierden', email: 'julieta@harvesttalent.nl', phone: '+31 6 51759566' }],
  beiden: [
    { name: 'Marlie Ekdom', email: 'marlie@harvesttalent.nl', phone: '+31 6 38596717' },
    { name: 'Julieta van Hierden', email: 'julieta@harvesttalent.nl', phone: '+31 6 51759566' },
  ],
}

function buildContactHTML(contacts: { name: string; email: string; phone: string }[]): string {
  return contacts
    .map(
      (c) => `
    <div class="contact-block">
      <div class="contact-name">${c.name}</div>
      <div class="contact-line">${c.phone}</div>
      <div class="contact-line">${c.email}</div>
    </div>`
    )
    .join('\n')
}

/** Simple Word document (.docx) text extraction — no external dep beyond built-in zip */
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  try {
    // Dynamically import mammoth (server-side only)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
    return result.value || ''
  } catch {
    // Fallback: decode as UTF-8 and strip XML tags (works for many docx files)
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
}

function buildDocumentCVPrompt(opts: {
  firstName: string
  lastName: string
  role: string
  city: string
  availability: string
  language: 'nl' | 'en'
  reviewTone: 'formal' | 'warm'
  contactPerson: string
  additionalInstructions: string
  hasPhoto: boolean
  contactBlocksHTML: string
}): string {
  const {
    firstName,
    lastName,
    role,
    city,
    availability,
    language,
    reviewTone,
    contactPerson,
    additionalInstructions,
    hasPhoto,
    contactBlocksHTML,
  } = opts

  const isNl = language === 'nl'
  const fullName = `${firstName} ${lastName}`
  const reviewLabel =
    reviewTone === 'formal'
      ? isNl
        ? '— Beoordeling'
        : '— Review'
      : isNl
        ? `Over ${firstName}`
        : `About ${firstName}`

  return `You are generating a professional Harvest CV for ${fullName}, applying as ${role}.

CANDIDATE BASICS:
- Name: ${fullName}
- Role: ${role}
- City: ${city || '(extract from documents)'}
- Availability: ${availability || '(extract from documents)'}
- Language: ${isNl ? 'Dutch (Nederlands)' : 'English'}
- Contact person: ${contactPerson}

SOURCE DOCUMENTS: The attached documents contain all candidate information (CV/resume, questionnaire, interview notes, grade lists). Use ALL documents as the source of truth. Extract and synthesize the following:
- Education: ALL degrees (BSc, MSc, HBO) with institution, period, grade average, thesis title+grade
- Work experience: all roles with company, period, location, responsibilities
- Projects: all significant projects with description, tools, results
- Skills: programming languages, frameworks, tools, soft skills
- Languages: with proficiency level
- Hobbies/interests
- Any additional context from interview notes or questionnaire

TONE OF VOICE (strictly enforced — this is the Harvest writing style):
The "Over [naam]" / review section must follow this exact style, based on real Harvest CVs:
- Open with "Graag stel ik je voor aan [voornaam]." OR directly "[Voornaam] is een [eigenschap] en [eigenschap] [rol]..."
- Write in warm, personal, yet professional Dutch. Third person throughout.
- Structure the intro as: personal qualities first → academic background (specific degrees, universities, thesis) → work experience highlights (specific companies, projects, achievements by name) → personal note (hobbies, volunteer work, coaching) → closing ambition sentence.
- Be specific and concrete: name the exact university, company, project, role, result. Avoid vague generalisations.
- The tone is enthusiastic but credible — not marketing speak. Think: a colleague introducing a talented friend.
- Sentences flow naturally. Vary sentence length. Use connecting words ("Zo heeft hij...", "Naast zijn studie...", "In zijn vrije tijd...").
- End with what the candidate is looking for: "is op zoek naar een organisatie waar hij/zij..." or similar.
- NEVER use hollow phrases like "passie voor", "hands-on", "gedreven professional", "track record".
- Write 2-4 natural paragraphs. No bullet points in the review section.

LOCATION RULE (strictly enforced):
- Use ONLY the city name. Examples: "Rotterdam", "Amsterdam", "Eindhoven", "Delft".
- NEVER add country, region, or any geographic qualifier like "Nederland", "the Netherlands", "NL".
- If the location contains a comma (e.g. "Nijmegen, Nederland"), strip everything after the comma.
- This applies to: sidebar Woonplaats, entry-org fields, and anywhere else location appears.

HOBBIES RULE (strictly enforced):
- Only include genuine leisure activities: sports (hardlopen, wielrennen, hockey, voetbal, schaatsen), music (piano, gitaar), travel, cooking, reading, volunteering, etc.
- NEVER include work-related interests or professional/technical topics such as: energietransitie, verduurzaming, AI, digitalisering, innovatie, technology trends, sustainability, or similar.
- If the source documents include such topics under hobbies/interests, replace them with personal leisure activities or omit them entirely.

TYPOGRAPHY RULE (strictly enforced):
- NEVER use em-dashes (—) or en-dashes (–) anywhere in the CV text content.
- Replace any em-dash or en-dash with a comma, colon, hyphen (-), or rewrite the sentence.
- This applies to ALL text: review, education, skills, work experience, projects, tagline.

KEYWORD TAGS RULE (strictly enforced):
- The red keyword tags (.kw elements) under work experience entries and project entries must contain ONLY technical skills and tools.
- Examples of what belongs: Python, React, PyTorch, Docker, SQL, Azure, Git, REST API, scikit-learn, etc.
- Examples of what does NOT belong: "Teamwork", "Stakeholder management", "Communication", "Leadership", "Problem solving".
- Agile/Scrum is acceptable ONLY if it refers to the methodology used in the project.
- Soft skills belong ONLY in the '.pill.soft' elements on the Skills page.
- Keep the tag list short: max 6 tags per entry.

OUTPUT RULES:
- Output ONLY the complete HTML document, starting with <!DOCTYPE html>
- No markdown, no \`\`\`html fences, no explanations before or after
- Language: ${isNl ? 'Dutch (Nederlands)' : 'English'}
- Review label: "${reviewLabel}"
- All text content must be in ${isNl ? 'Dutch' : 'English'} unless it is a proper name or technical term

CRITICAL: You MUST generate exactly 3 <section> elements with class="page" — no more, no less.
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

PHOTO PLACEHOLDER: In the sidebar photo-wrap div, always put exactly [PHOTO_PLACEHOLDER] as a literal string — do NOT generate an <img> tag or any other element there. The TypeScript code will replace [PHOTO_PLACEHOLDER] with the actual image after generation.

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
      <img src="https://harvest-cv-tool.vercel.app/harvest-logo-white.png" alt="Harvest" style="height:26px;display:block;">
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
          <div class="cand-name">[FIRST_NAME] [LAST_NAME] <span class="age">([AGE if known, else omit this span entirely])</span></div>
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

          [EDUCATION ENTRIES — use this EXACT structure for every degree:
          <div class="entry">
            <div class="entry-head">
              <span class="entry-title">[DEGREE] [FIELD]</span>
              <span class="entry-date">[Mon YYYY - Mon YYYY]</span>
            </div>
            <div class="entry-org">[INSTITUTION] · [CITY only, no country]</div>
            <div class="entry-body">[1-2 sentence description of the programme focus and/or thesis]</div>
            <div class="entry-body"><em>Courses: [Course 1, Course 2, Course 3, Course 4]</em></div>
            <div class="kw">[HARD SKILL TAGS from courses/thesis]</div>
          </div>
          ]

          The .kw div must contain <span class="tag"> elements for the main technical topics covered. Example:
          <div class="kw"><span class="tag">Python</span><span class="tag">Machine Learning</span><span class="tag">NLP</span></div>

EDUCATION RULES (strictly enforced):
- ALWAYS include BSc and MSc degrees — these are NEVER cut, even if the 2600 char limit is tight.
- If the character limit is at risk, shorten the review text instead — education degrees take priority.
- Within education entries: prefer higher degrees (MSc > BSc > HBO > MBO > VWO/Havo) and more recent over older.
- For EVERY education entry: always show institution, title, period, courses line, and .kw tags. Never omit the courses line or tags.
- The courses line must list 3-5 relevant courses from the programme. If not known, infer typical courses for that degree.
- The .kw tags must reflect the hard technical skills from that degree. Max 5 tags per entry.
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
      <img src="https://harvest-cv-tool.vercel.app/harvest-logo-white.png" alt="Harvest" style="height:26px;display:block;">
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
      <img src="https://harvest-cv-tool.vercel.app/harvest-logo-white.png" alt="Harvest" style="height:26px;display:block;">
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

          [Do NOT add any closing quote, personal statement, or decorative text block at the end of page 3. Leave remaining space empty.]
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
1. Replace ALL [PLACEHOLDER] markers with real content derived from the source documents.
2. Use the PHOTO PLACEHOLDER provided above exactly — do not modify it.
3. Use the CONTACT BLOCKS provided above exactly — do not modify them.
4. Page 1 right column: "${reviewLabel}" text + Education. Count chars, stay ≤ 2600. When close to the limit, shorten review paragraphs first. Education (BSc/MSc) is non-negotiable.
5. Page 2 right column: Skills (pills) + Work Experience. Count chars, stay ≤ 2600. Cut bullet points or entries if needed.
6. Page 3 right column: Projects only. Count chars, stay ≤ 2600. Cut descriptions if needed.
7. If data is missing for a section, use reasonable professional placeholders or leave the section minimal.
8. The output must be a single complete HTML document with NO placeholders remaining.
9. Output ONLY the HTML. Do not add any text before <!DOCTYPE html> or after </html>.
${
  hasPhoto
    ? 'PHOTO: A photo has been provided. Place [PHOTO_PLACEHOLDER] exactly in the photo-wrap div — the TypeScript post-processor will inject the actual <img> tag.'
    : `PHOTO: No photo provided. Place [PHOTO_PLACEHOLDER] exactly in the photo-wrap div — the TypeScript post-processor will inject an initials placeholder.`
}
${
  additionalInstructions
    ? `\nADDITIONAL INSTRUCTIONS FROM RECRUITER:\n${additionalInstructions}\n\nFollow these instructions while respecting all page limits and layout rules above.`
    : ''
}`
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

    // Basic fields
    const firstName = (formData.get('firstName') as string | null)?.trim() || ''
    const lastName = (formData.get('lastName') as string | null)?.trim() || ''
    const role = (formData.get('role') as string | null)?.trim() || ''
    const city = (formData.get('city') as string | null)?.trim() || ''
    const availability = (formData.get('availability') as string | null)?.trim() || ''
    const language = ((formData.get('language') as string | null) || 'nl') as 'nl' | 'en'
    const reviewTone = ((formData.get('reviewTone') as string | null) || 'formal') as 'formal' | 'warm'
    const contactPerson = (formData.get('contactPerson') as string | null) || 'marlie'
    const additionalInstructions = (formData.get('additionalInstructions') as string | null)?.trim() || ''

    if (!firstName || !lastName || !role) {
      return Response.json({ error: 'Voornaam, achternaam en rol zijn verplicht.' }, { status: 400 })
    }

    // Collect document content blocks
    type ContentBlock =
      | { type: 'document'; source: { type: 'base64'; media_type: string; data: string }; title: string }
      | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
      | { type: 'text'; text: string }

    const contentBlocks: ContentBlock[] = []

    /** Helper: add a PDF file as a document block */
    async function addPdfBlock(file: File, title: string) {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      contentBlocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        title,
      })
    }

    /** Helper: add a Word/text file as a text block */
    async function addTextBlock(file: File, title: string) {
      const buffer = await file.arrayBuffer()
      let text = ''
      const name = file.name.toLowerCase()
      if (name.endsWith('.docx') || name.endsWith('.doc')) {
        text = await extractDocxText(buffer)
      } else {
        text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
      }
      if (text.trim()) {
        contentBlocks.push({
          type: 'text',
          text: `=== ${title} ===\n${text.trim()}`,
        })
      }
    }

    // CV file (PDF required)
    const cvFile = formData.get('cv') as File | null
    if (!cvFile) {
      return Response.json({ error: 'CV bestand is verplicht.' }, { status: 400 })
    }
    await addPdfBlock(cvFile, 'CV / Resume')

    // Questionnaire (PDF optional)
    const questionnaireFile = formData.get('questionnaire') as File | null
    if (questionnaireFile && questionnaireFile.size > 0) {
      await addPdfBlock(questionnaireFile, 'Vragenlijst Harvest')
    }

    // Notes — can be multiple, PDF or Word
    const notesEntries = formData.getAll('notes') as File[]
    for (const f of notesEntries) {
      if (!f || f.size === 0) continue
      const name = f.name.toLowerCase()
      if (name.endsWith('.pdf')) {
        await addPdfBlock(f, `Gespreksnotities: ${f.name}`)
      } else {
        await addTextBlock(f, `Gespreksnotities: ${f.name}`)
      }
    }

    // Additional documents — PDFs only
    const additionalEntries = formData.getAll('additional') as File[]
    for (const f of additionalEntries) {
      if (!f || f.size === 0) continue
      await addPdfBlock(f, `Aanvullend document: ${f.name}`)
    }

    // Photo — upload to Supabase Storage first, then use URL in the CV
    const photoFile = formData.get('photo') as File | null
    let photoUrl: string | null = null
    let photoBase64: string | null = null
    let photoMimeType = 'image/jpeg'

    if (photoFile && photoFile.size > 0) {
      const rawBuffer = await photoFile.arrayBuffer()
      const compressed = await compressImage(rawBuffer)
      photoBase64 = compressed.toString('base64')
      photoMimeType = 'image/jpeg'

      // Upload compressed photo to Supabase storage
      const tempPath = `temp/${user.id}-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(tempPath, compressed, {
          contentType: 'image/jpeg',
          upsert: true,
        })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(tempPath)
        photoUrl = urlData.publicUrl
      }
    }

    // Build contact blocks HTML
    const contacts = CONTACT_PERSONS[contactPerson] || CONTACT_PERSONS.marlie
    const contactBlocksHTML = buildContactHTML(contacts)

    // If photo was uploaded, add it as an image block for Claude to see
    if (photoBase64) {
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: photoMimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: photoBase64 },
      })
    }

    // Build the text prompt
    const promptText = buildDocumentCVPrompt({
      firstName,
      lastName,
      role,
      city,
      availability,
      language,
      reviewTone,
      contactPerson,
      additionalInstructions,
      hasPhoto: !!photoUrl,
      contactBlocksHTML,
    })

    contentBlocks.push({ type: 'text', text: promptText })

    // Call Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system:
        'You are a professional CV generator for Harvest Talent. Output ONLY a complete, valid HTML document. No markdown, no code fences, no explanation. Start with <!DOCTYPE html> and end with </html>.',
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

    // Inject photo into CV HTML
    if (photoUrl) {
      const photoImgTag = `<img src="${photoUrl}" alt="${firstName} ${lastName}" style="width:100%;height:100%;object-fit:cover;object-position:center 18%;display:block;">`
      html = html.replace('[PHOTO_PLACEHOLDER]', photoImgTag)
      // Also fix any photo-wrap that Claude may have generated without the placeholder
      html = html.replace(
        /<div class="photo-wrap">[\s\S]*?<\/div>/,
        `<div class="photo-wrap">${photoImgTag}</div>`
      )
    } else {
      // No photo — replace placeholder with initials div
      const initialsDiv = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Source Serif 4',serif;font-size:64px;color:rgba(9,40,18,0.32);">${firstName[0] || '?'}${lastName[0] || '?'}</div>`
      html = html.replace(/\[PHOTO_PLACEHOLDER\]/g, initialsDiv)
    }

    // Post-process: remove em-dashes from text content
    html = html.replace(/—/g, '-')

    html = html.trim()

    // Save candidate to database
    const { data: candidate, error: insertError } = await supabase
      .from('candidates')
      .insert({
        created_by: user.id,
        first_name: firstName,
        last_name: lastName,
        role,
        city: city || null,
        availability: availability || null,
        language,
        review_tone: reviewTone,
        contact_person: contactPerson,
        photo_url: photoUrl,
        cv_html: html,
        cv_json: null,
      })
      .select()
      .single()

    if (insertError || !candidate) {
      console.error('Insert error:', insertError)
      return Response.json({ error: 'Opslaan mislukt: ' + (insertError?.message || 'onbekende fout') }, { status: 500 })
    }

    // Move photo to final path if it was uploaded to temp
    if (photoUrl && photoFile) {
      const ext = photoFile.name.split('.').pop() || 'jpg'
      const finalPath = `${candidate.id}/photo.${ext}`
      const { error: moveError } = await supabase.storage
        .from('photos')
        .move(`temp/${user.id}-${Date.now()}.${ext}`, finalPath)
      if (!moveError) {
        const { data: finalUrlData } = supabase.storage.from('photos').getPublicUrl(finalPath)
        const finalUrl = finalUrlData.publicUrl
        // Update candidate photo_url and replace in HTML
        await supabase.from('candidates').update({ photo_url: finalUrl }).eq('id', candidate.id)
        html = html.replace(new RegExp(photoUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), finalUrl)
        await supabase.from('candidates').update({ cv_html: html }).eq('id', candidate.id)
      }
    }

    return Response.json({ candidateId: candidate.id })
  } catch (error) {
    console.error('CV from docs error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Genereren mislukt' },
      { status: 500 }
    )
  }
}
