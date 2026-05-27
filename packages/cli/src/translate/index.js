import fs from 'fs'
import { globSync } from 'glob'
import { dirname, join, relative, resolve } from 'path'
import { fileURLToPath } from 'url'

import { ensureAiContext, getAiContextState } from './ai-context.js'
import { translateBatch } from './ai.js'
import { getTranslationPaths, listWorkspaceFiles, sortObjectKeys } from './utils.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(currentDir, '../../../..')
const DEFAULT_LANGUAGE_CODES = [
  'bn',
  'cz',
  'dk',
  'de',
  'en',
  'es',
  'fi',
  'fr',
  'hi',
  'hu',
  'it',
  'ja',
  'nl',
  'no',
  'pl',
  'pt',
  'ru',
  'si',
  'se',
  'sk',
]
const BATCH_MAX_ITEMS = readPositiveInt('TRANSLATE_BATCH_MAX_ITEMS', 30)
const BATCH_MAX_CHARS = readPositiveInt('TRANSLATE_BATCH_MAX_CHARS', 3500)
const languagePaths = globSync(
  '{packages/brick,apps/*}/{components/**/translate,pages-translate/*,layouts/**,global/*}/generated/*.json',
  {
    absolute: true,
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/.nuxt/**', '**/dist/**', '**/.output/**', '**/coverage/**', '**/public/**'],
  },
).sort()

const languageCodes = [
  ...new Set([
    ...languagePaths.map((filePath) => filePath.replace(/.*\/([^/]+)\.json$/, '$1')),
    ...DEFAULT_LANGUAGE_CODES,
  ]),
].sort()

const sourceFiles = listWorkspaceFiles(workspaceRoot).filter(
  (filePath) => /\.(?:js|ts|vue)$/.test(filePath) && !filePath.endsWith('.d.ts'),
)

const sampleToSource = new Map()

for (const sourceFilePath of sourceFiles) {
  const samplePath = getTranslationPaths(sourceFilePath)?.samplePath

  if (samplePath && fs.existsSync(samplePath) && !sampleToSource.has(samplePath)) {
    sampleToSource.set(samplePath, sourceFilePath)
  }
}

const samplePaths = [...sampleToSource.keys()].sort()

const tasks = samplePaths.map((samplePath) => ({
  sample: readJson(samplePath),
  samplePath,
  sourceFilePath: sampleToSource.get(samplePath),
}))

const total = tasks.reduce((count, task) => count + Object.keys(task.sample).length * languageCodes.length, 0)
const progress = createProgress(total)

if (tasks.length === 0) {
  console.log('✅ No translation sample folders found')
  process.exit(0)
}

for (const task of tasks) {
  await processSample(task)
}

process.stdout.write('\n')
console.log(
  `✅ Done: ${samplePaths.length} sample folders, ${languageCodes.length} languages, batch=${BATCH_MAX_ITEMS}/${BATCH_MAX_CHARS}`,
)

function createProgress(total) {
  let done = 0
  let lastRenderedAt = 0
  const start = Date.now()

  return function update(languageCode, samplePath) {
    done++

    const now = Date.now()
    if (done !== total && now - lastRenderedAt < 80) {
      return
    }

    lastRenderedAt = now

    const percent = total === 0 ? 100 : Math.round((done * 100) / total)
    const filled = Math.round(percent / 5)
    const empty = 20 - filled
    const elapsed = ((now - start) / 1000).toFixed(1)
    const shortName = shortenPath(relative(workspaceRoot, samplePath))

    process.stdout.write(
      `\r🌍 Translation: [${'█'.repeat(filled)}${' '.repeat(empty)}] ` +
        `${percent}% (${done}/${total}) ` +
        `⏱ ${elapsed}s ` +
        `\x1b[90m${languageCode} ${shortName}\x1b[0m\x1b[K`,
    )
  }
}

function detectEol(filePath) {
  if (!fs.existsSync(filePath)) {
    return '\n'
  }

  const text = fs.readFileSync(filePath, 'utf-8')
  return text.includes('\r\n') ? '\r\n' : '\n'
}

function estimateEntryChars(entry) {
  return String(entry.key).length + String(entry.text).length + String(entry.filePath ?? '').length + 32
}

function existsJson(filePath) {
  return fs.existsSync(filePath)
}

async function processSample({ sample, samplePath, sourceFilePath }) {
  const generatedDir = join(dirname(samplePath), 'generated')
  const enPath = join(generatedDir, 'en.json')
  const currentEn = existsJson(enPath) ? readJson(enPath) : {}
  const currentByLanguage = new Map(
    languageCodes.map((languageCode) => [
      languageCode,
      existsJson(join(generatedDir, `${languageCode}.json`))
        ? readJson(join(generatedDir, `${languageCode}.json`))
        : {},
    ]),
  )
  const resultByLanguage = new Map(languageCodes.map((languageCode) => [languageCode, {}]))
  const pendingEntriesByLocales = new Map()

  fs.mkdirSync(generatedDir, { recursive: true })

  for (const [key, sampleValue] of Object.entries(sample)) {
    const missingLocales = []

    for (const languageCode of languageCodes) {
      const languageResult = resultByLanguage.get(languageCode)

      if (!languageResult) {
        continue
      }

      if (languageCode === 'en' || typeof sampleValue !== 'string') {
        languageResult[key] = sampleValue
        progress(languageCode, samplePath)
        continue
      }

      const currentLang = currentByLanguage.get(languageCode) ?? {}

      if (typeof currentLang[key] === 'string' && currentEn[key] === sampleValue) {
        languageResult[key] = currentLang[key]
        progress(languageCode, samplePath)
        continue
      }

      missingLocales.push(languageCode)
    }

    if (typeof sampleValue === 'string' && missingLocales.length > 0) {
      const localeKey = missingLocales.join(',')
      const entries = pendingEntriesByLocales.get(localeKey) ?? []

      entries.push({
        filePath: relative(workspaceRoot, samplePath),
        key,
        text: sampleValue,
      })

      pendingEntriesByLocales.set(localeKey, entries)
    }
  }

  let componentContext = null

  if (pendingEntriesByLocales.size > 0) {
    const contextState = getAiContextState({
      samplePath,
      sourceFilePath,
    })

    componentContext = contextState.shouldRegenerate
      ? await ensureAiContext({
          sample,
          samplePath,
          sourceFilePath,
        })
      : contextState.description
  }

  for (const [localeKey, entries] of pendingEntriesByLocales) {
    const targetLocales = localeKey.split(',').filter(Boolean)
    const chunks = splitIntoBatches(entries, BATCH_MAX_ITEMS, BATCH_MAX_CHARS)

    for (const chunk of chunks) {
      const translations = await translateChunk(chunk, samplePath, targetLocales, componentContext)

      for (const languageCode of targetLocales) {
        const languageResult = resultByLanguage.get(languageCode)
        const localizedValues = translations[languageCode]

        if (!languageResult || !localizedValues) {
          throw new Error(
            `Missing locale "${languageCode}" in AI response for ${relative(workspaceRoot, samplePath)}`,
          )
        }

        for (const entry of chunk) {
          const translatedValue = localizedValues[entry.key]

          if (typeof translatedValue !== 'string' || translatedValue.length === 0) {
            throw new Error(
              `Missing translation for ${languageCode} ${relative(workspaceRoot, samplePath)} :: ${entry.key}`,
            )
          }

          languageResult[entry.key] = translatedValue
          progress(languageCode, samplePath)
        }
      }
    }
  }

  for (const languageCode of languageCodes) {
    const generatedPath = join(generatedDir, `${languageCode}.json`)
    const languageResult = sortObjectKeys(resultByLanguage.get(languageCode) ?? {})
    writeTextPreservingEol(generatedPath, JSON.stringify(languageResult, null, 2))
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function readPositiveInt(name, fallback) {
  const raw = process.env[name]

  if (!raw) {
    return fallback
  }

  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function shortenPath(filePath, maxLength = 72) {
  if (filePath.length <= maxLength) {
    return filePath
  }

  return `...${filePath.slice(-(maxLength - 3))}`
}

function splitIntoBatches(entries, maxItems, maxChars) {
  const batches = []
  let current = []
  let currentChars = 0

  for (const entry of entries) {
    const entryChars = estimateEntryChars(entry)
    const shouldFlush = current.length > 0 && (current.length >= maxItems || currentChars + entryChars > maxChars)

    if (shouldFlush) {
      batches.push(current)
      current = []
      currentChars = 0
    }

    current.push(entry)
    currentChars += entryChars
  }

  if (current.length > 0) {
    batches.push(current)
  }

  return batches
}

async function translateChunk(entries, samplePath, targetLocales, componentContext) {
  try {
    console.log(entries)

    return await translateBatch(entries, {
      componentContext,
      sourceLocale: 'en',
      targetLocales,
    })
  } catch (error) {
    throw new Error(
      `Translation failed for ${relative(workspaceRoot, samplePath)} (${entries.length} strings, ${targetLocales.join(', ')})`,
      { cause: error },
    )
  }
}

function writeTextPreservingEol(filePath, content) {
  const eol = detectEol(filePath)
  const normalized = String(content).replace(/\r?\n/g, eol)
  fs.writeFileSync(filePath, normalized, 'utf-8')
}
