// src/utils/claudeApi.js
// Utilitar pentru apeluri Anthropic API — Modul SEO

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const API_URL = 'https://api.anthropic.com/v1/messages'

// ─────────────────────────────────────────
// Funcție de bază
// ─────────────────────────────────────────
export async function callClaude({ systemPrompt, userMessage, maxTokens = 1500 }) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('VITE_ANTHROPIC_API_KEY lipsă din .env. Adaugă-l pentru a folosi asistența AI.')
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error ${response.status}`)
  }

  const data = await response.json()
  return data.content.find(b => b.type === 'text')?.text || ''
}

// ─────────────────────────────────────────
// Funcție helper: parsare JSON sigură
// ─────────────────────────────────────────
function parseJsonResponse(text) {
  const clean = text.replace(/```json\n?|```\n?/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Răspunsul AI nu conține JSON valid.')
  return JSON.parse(match[0])
}

// ─────────────────────────────────────────
// 1. Generare rețetă SEO completă
// ─────────────────────────────────────────
export async function generateSeoRecipe({ pageName, pageType, siteDomain, platform, existingKeywords = [] }) {
  const system = `Ești expert SEO pentru e-commerce românesc. Cunoști piața locală, comportamentul cumpărătorilor români și algoritmii Google pentru România. Returnezi EXCLUSIV JSON valid, fără markdown, fără text în afara JSON-ului.`

  const user = `Generează o rețetă SEO completă pentru:
Pagină: "${pageName}"
Tip pagină: ${pageType}
Site: ${siteDomain} (platformă: ${platform || 'necunoscută'})
${existingKeywords.length ? `Keywords deja identificate: ${existingKeywords.join(', ')}` : ''}

Returnează JSON cu exact aceste câmpuri:
{
  "cuvant_principal": "string — cuvântul cheie principal recomandat",
  "motiv_cuvant": "string — de ce acest cuvânt cheie (volum estimat, intenție)",
  "tip_pagina": "string — confirmă sau sugerează alt tip (categorie/produs/blog)",
  "title_tag": "string — max 60 caractere, include cuvântul cheie",
  "meta_description": "string — max 155 caractere, include CTA",
  "h1": "string — H1 recomandat, diferit de title tag",
  "url_slug": "string — slug SEO-friendly fără diacritice",
  "cuvinte_secundare": ["array cu 5 cuvinte cheie secundare"],
  "long_tail": ["array cu 3 expresii long-tail"],
  "structura_descriere": ["array cu 5-6 secțiuni/paragrafe recomandate pentru descriere"],
  "dificultate_estimata": "mica | medie | mare",
  "sfat_strategic": "string — sfat practic specific acestui produs/pagini"
}`

  const text = await callClaude({ systemPrompt: system, userMessage: user, maxTokens: 2000 })
  return parseJsonResponse(text)
}

// ─────────────────────────────────────────
// 2. Sugestii keywords cu volum
// ─────────────────────────────────────────
export async function suggestKeywords({ pageName, pageType, siteDomain, primaryKeyword }) {
  const system = `Ești expert SEO pentru e-commerce românesc. Returnezi EXCLUSIV JSON valid.`

  const user = `Sugerează keywords pentru pagina "${pageName}" (${pageType}) de pe ${siteDomain}.
Cuvânt cheie principal curent: ${primaryKeyword || 'nesetat'}

Returnează JSON:
{
  "keywords": [
    {
      "keyword": "string",
      "monthly_volume": number (estimat),
      "keyword_type": "primary | secondary | long_tail",
      "difficulty": "mica | medie | mare",
      "notes": "string scurt — de ce este relevant"
    }
  ]
}
Sugerează 12-15 keywords diverse: câteva secundare cu volum bun, câteva long-tail specifice, câteva variante sinonimice.`

  const text = await callClaude({ systemPrompt: system, userMessage: user, maxTokens: 2000 })
  return parseJsonResponse(text)
}

// ─────────────────────────────────────────
// 3. Verificare și îmbunătățire meta tags
// ─────────────────────────────────────────
export async function checkMeta({ pageName, primaryKeyword, titleTag, metaDescription, h1 }) {
  const system = `Ești expert SEO pentru e-commerce românesc. Returnezi EXCLUSIV JSON valid.`

  const user = `Analizează meta tag-urile acestei pagini și oferă feedback detaliat:

Pagină: "${pageName}"
Cuvânt cheie principal: "${primaryKeyword || 'nesetat'}"
Title tag actual: "${titleTag || 'nesetat'}"
Meta description actuală: "${metaDescription || 'nesetată'}"
H1 actual: "${h1 || 'nesetat'}"

Returnează JSON:
{
  "title_score": number (1-10),
  "title_issues": ["lista problemelor găsite la title"],
  "title_suggestion": "string — variantă îmbunătățită",
  "meta_score": number (1-10),
  "meta_issues": ["lista problemelor găsite la meta description"],
  "meta_suggestion": "string — variantă îmbunătățită",
  "h1_score": number (1-10),
  "h1_issues": ["lista problemelor găsite la H1"],
  "h1_suggestion": "string — variantă îmbunătățită",
  "overall_verdict": "string — concluzie generală și cel mai important lucru de îmbunătățit"
}`

  const text = await callClaude({ systemPrompt: system, userMessage: user, maxTokens: 2000 })
  return parseJsonResponse(text)
}

// ─────────────────────────────────────────
// 4. Analiză competiție SERP
// ─────────────────────────────────────────
export async function analyzeCompetition({ primaryKeyword, pageType, competitors }) {
  const system = `Ești expert SEO pentru e-commerce românesc. Analizezi concurența din SERP și oferi recomandări concrete. Returnezi EXCLUSIV JSON valid.`

  const compText = competitors
    .filter(c => c.title || c.metaDesc || c.h1)
    .map((c, i) => `
Concurent #${i + 1}: ${c.url}
  Title: ${c.title || 'lipsă'} (${(c.title||'').length} car.)
  Meta: ${c.metaDesc || 'lipsă'} (${(c.metaDesc||'').length} car.)
  H1: ${c.h1 || 'lipsă'}
  H2-uri: ${(c.h2s||[]).join(' | ') || 'lipsă'}
`).join('\n')

  const user = `Analizează concurența pentru keyword-ul "${primaryKeyword}" (pagină tip: ${pageType}).

${compText}

Returnează JSON cu exact aceste câmpuri:
{
  "pattern_title": "string — ce pattern folosesc în title (ex: keyword + brand, beneficiu + keyword)",
  "pattern_meta": "string — ce pattern folosesc în meta description",
  "avg_title_len": number,
  "avg_meta_len": number,
  "keywords_in_title": ["keywords comune găsite în title-urile concurenților"],
  "oportunitati": ["3-4 oportunități de diferențiere față de concurență"],
  "recomandare_title": "string — title recomandat bazat pe analiza concurenței, max 60 car.",
  "recomandare_meta": "string — meta description recomandată bazată pe analiza concurenței, max 155 car.",
  "recomandare_h1": "string — H1 recomandat diferit de title",
  "concluzie": "string — concluzie practică despre ce trebuie să faci diferit față de concurență"
}`

  const text = await callClaude({ systemPrompt: system, userMessage: user, maxTokens: 2000 })
  return JSON.parse(text.replace(/```json\n?|```\n?/g, '').trim().match(/\{[\s\S]*\}/)[0])
}

// ─────────────────────────────────────────
// 5. Chat liber cu context pagină
// ─────────────────────────────────────────
export async function chatWithContext({ pageContext, userQuestion, chatHistory = [] }) {
  const system = `Ești expert SEO pentru e-commerce românesc, consultantul personal al acestui utilizator.

Context pagină curentă:
- Nume pagină: ${pageContext.name}
- Tip: ${pageContext.page_type}
- Site: ${pageContext.siteDomain}
- Cuvânt cheie principal: ${pageContext.primary_keyword || 'nesetat'}
- Title tag: ${pageContext.title_tag || 'nesetat'}
- Meta description: ${pageContext.meta_description || 'nesetată'}
- Status: ${pageContext.status}

Răspunzi concis, practic, specific pentru această pagină. Când dai exemple, folosește contextul real al paginii. Răspunzi în română.`

  const messages = [
    ...chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: userQuestion }
  ]

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system,
      messages,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error ${response.status}`)
  }

  const data = await response.json()
  return data.content.find(b => b.type === 'text')?.text || ''
}
