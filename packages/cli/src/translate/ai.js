import { generateContentWithLimits } from './gemini.js'
const MODEL = process.env.TRANSLATE_AI_MODEL || 'gemini-3.1-flash-lite-preview'

export async function translateBatch(strings, options) {
  const { componentContext = '', sourceLocale = 'en', targetLocales = [] } = options ?? {}

  if (!Array.isArray(strings) || strings.length === 0) {
    return Object.fromEntries(targetLocales.map((locale) => [locale, {}]))
  }

  const contents = buildContents(strings, sourceLocale, targetLocales, componentContext)
  const systemInstruction = buildSystemInstruction()
  const maxRetries = 3

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const raw = await requestTranslation(contents, systemInstruction)
      const parsed = safeParse(raw)
      return normalizeTranslations(parsed, strings, targetLocales)
    } catch (error) {
      console.warn(`AI translate attempt ${attempt}/${maxRetries} failed`)

      if (attempt === maxRetries) {
        throw new Error('Translation failed after retries', { cause: error })
      }
    }
  }

  return Object.fromEntries(targetLocales.map((locale) => [locale, {}]))
}

function buildContents(strings, sourceLocale, targetLocales, componentContext) {
  const payload = strings.map((item) => ({
    component: item.component || extractComponent(item.filePath),
    key: item.key,
    text: item.text,
    type: detectType(item.text),
  }))

  return [
    `Source locale: ${sourceLocale}`,
    `Target locales: ${targetLocales.join(', ')}`,
    '',
    'Component context for translators:',
    componentContext || 'No extra component context available.',
    '',
    'Return this exact schema:',
    '{',
    '  "pl": { "some.key": "..." },',
    '  "ru": { "some.key": "..." }',
    '}',
    '',
    'Input strings:',
    JSON.stringify(payload, null, 2),
  ].join('\n')
}

function buildSystemInstruction() {
  return [
    'You are a professional localization engine for a paid adult content platform.',
    '',
    'PRODUCT CONTEXT:',
    '- This product allows creators to upload and sell content collections (bundles of media).',
    '- A collection is a curated set of content (images, videos, or links).',
    '- Some content is free, some is VIP (paid).',
    '- Users can preview content before unlocking it.',
    '- Unlock means paying to access premium content.',
    '- VIP means paid access to content inside a collection.',
    '- The tone should be natural, modern, slightly casual, and conversion-oriented.',
    '- Do not censor or soften adult-related wording if present in the source.',
    '',
    'TERMINOLOGY:',
    '- Collection = curated content pack, not a generic folder.',
    '- Asset = a content item such as an image, video, or link.',
    '- Unlock = get paid access to content.',
    '- VIP = paid content inside a collection.',
    '- Creator = user who uploads and sells content.',
    '- Preview = visible part before purchase.',
    '',
    'TONE:',
    '- Keep translations natural and native-sounding.',
    '- Prefer product and marketing language over literal translation when meaning stays intact.',
    '- Avoid robotic or overly formal phrasing.',
    '- Keep emotional and persuasive tone when present.',
    '',
    'RULES:',
    '- Return only raw JSON.',
    '- Preserve JSON shape exactly.',
    '- Do not omit keys or locales.',
    '- Never remove words, qualifiers, examples, slang, or awkward fragments from the source.',
    '- Preserve the full meaning of the source even if the text is clumsy, ungrammatical, explicit, or repetitive.',
    '- If the source contains an unusual word or phrase, translate it or preserve it, but do not silently drop it.',
    '- Preserve placeholders like {count}, {price}, %s, :name, \\n and HTML tags.',
    '- Do not translate product or brand names unless source text clearly localizes them.',
    '- Keep short labels concise only when the source itself is short. Do not compress longer messages.',
    '- Example rule: "Username can contain from %s to %s characters only with dildo" must keep the final phrase in translation and must not be shortened.',
  ].join('\n')
}

function cleanJson(text) {
  return text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
}

function detectType(text) {
  if (text.length <= 12) {
    return 'short_ui'
  }
  if (text.includes('?')) {
    return 'question'
  }
  if (text.includes('{') || text.includes('%')) {
    return 'template'
  }
  return 'text'
}

function extractComponent(filePath) {
  if (!filePath) {
    return 'Unknown'
  }

  const parts = filePath.split('/').filter(Boolean)
  const file = parts[parts.length - 2] || parts[parts.length - 1]

  return file || 'Unknown'
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/)
  return match ? match[0] : text
}

function normalizeTranslations(parsed, strings, targetLocales) {
  const keys = strings.map((item) => item.key)
  const result = {}

  for (const locale of targetLocales) {
    const localeValues = parsed?.[locale]

    if (!localeValues || typeof localeValues !== 'object' || Array.isArray(localeValues)) {
      throw new Error(`Invalid locale block: ${locale}`)
    }

    result[locale] = {}

    for (const key of keys) {
      const value = localeValues[key]

      if (typeof value !== 'string') {
        throw new Error(`Missing translation for ${locale}.${key}`)
      }

      result[locale][key] = value.trim()
    }
  }

  return result
}

async function requestTranslation(contents, systemInstruction) {
  return await generateContentWithLimits({
    config: {
      systemInstruction,
    },
    contents,
    model: MODEL,
  })
}

function safeParse(text) {
  const cleaned = extractJson(cleanJson(text))
  return JSON.parse(cleaned)
}
