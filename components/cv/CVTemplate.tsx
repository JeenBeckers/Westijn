// This component generates a default CV template HTML string
// Used as fallback or preview skeleton

export function generateDefaultCVTemplate(params: {
  firstName: string
  lastName: string
  role: string
  city?: string
  language: string
}): string {
  const { firstName, lastName, role, city, language } = params
  const isNl = language === 'nl'

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@300;400;500;600;700&family=Source+Serif+4:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Libre Franklin', sans-serif; background: #d8d3c9; }
  .page { display: flex; width: 794px; height: 1123px; overflow: hidden; margin: 0 auto 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  .left { width: 200px; min-width: 200px; background: #092B13; color: white; padding: 24px; display: flex; flex-direction: column; }
  .right { flex: 1; background: #FFFBF5; padding: 40px; position: relative; }
  .name { font-family: 'Source Serif 4', serif; font-size: 20px; color: white; margin-top: 16px; }
  .role-label { font-size: 11px; color: #B8865F; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
  .divider { height: 1px; background: #B8865F; margin: 16px 0; }
  .section-title { font-family: 'Source Serif 4', serif; font-size: 16px; color: #092B13; border-bottom: 2px solid #B8865F; padding-bottom: 8px; margin-bottom: 16px; }
  .body-text { font-size: 11px; color: #5b5750; line-height: 1.6; }
  .contact-bottom { margin-top: auto; font-size: 9px; color: #B8865F; }
  .page-number { position: absolute; bottom: 20px; right: 30px; font-size: 10px; color: #5b5750; }
  .photo-placeholder { width: 100px; height: 100px; border-radius: 50%; background: #2F6B3A; display: flex; align-items: center; justify-content: center; color: #B8865F; font-size: 32px; font-family: 'Source Serif 4', serif; margin: 0 auto; }
</style>
</head>
<body>

<div class="page">
  <div class="left">
    <div class="photo-placeholder">${firstName[0]}${lastName[0]}</div>
    <div class="name">${firstName} ${lastName}</div>
    <div class="role-label">${role}</div>
    <div class="divider"></div>
    <div class="body-text">
      ${city ? `<div>${city}</div>` : ''}
    </div>
    <div class="contact-bottom">
      <div style="font-size:11px;font-weight:600;letter-spacing:2px;color:#B8865F;margin-bottom:8px">HARVEST</div>
      <div>Marlie Ekdom</div>
      <div>marlie@harvesttalent.nl</div>
    </div>
  </div>
  <div class="right">
    <div class="section-title">${isNl ? 'Beoordeling' : 'Assessment'}</div>
    <p class="body-text">${isNl ? 'Genereer het CV om de beoordeling te vullen.' : 'Generate the CV to fill in the assessment.'}</p>
    <div class="page-number">1 / 3</div>
  </div>
</div>

</body>
</html>`
}
