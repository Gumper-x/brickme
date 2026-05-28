#!/usr/bin/env node

import fs from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { fileURLToPath } from 'url'

import { generateContentWithLimits } from './gemini.js'
import {
  buildTranslateHelp,
  DEFAULT_CONTEXT_MODEL,
  getTranslateRuntimeConfig,
  parseTranslateRuntimeArgs,
  setTranslateRuntimeConfig,
} from './runtime-config.js'
import { listTranslationTargets, stringifySortedJson } from './utils.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(currentDir, '../../../..')
const CONTEXT_FILE_NAME = 'ai-context.json'
const CHANGE_THRESHOLD = readFloat('TRANSLATE_CONTEXT_MIN_CHANGE', 0.3)
const SOURCE_MAX_CHARS = readPositiveInt('TRANSLATE_CONTEXT_SOURCE_MAX_CHARS', 16000)

export function calculateChangeRatio(previousSource, nextSource) {
  const before = normalizeSource(previousSource)
  const after = normalizeSource(nextSource)

  if (before === after) {
    return 0
  }

  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  const commonLines = longestCommonSubsequenceLength(beforeLines, afterLines)
  const maxLines = Math.max(beforeLines.length, afterLines.length, 1)

  return 1 - commonLines / maxLines
}

export async function ensureAiContext({ force = false, sample, samplePath, sourceFilePath }) {
  const state = getAiContextState({ force, samplePath, sourceFilePath })

  if (!state.shouldRegenerate) {
    return state.description
  }

  const description = await generateContextDescription({
    sample,
    samplePath,
    sourceCode: state.sourceCode,
    sourceFilePath: state.sourceFilePath,
  })

  const next = {
    changeRatio: state.changeRatio,
    description,
    samplePath: relative(workspaceRoot, samplePath),
    sourceFilePath: relative(workspaceRoot, state.sourceFilePath),
    sourceSnapshot: state.sourceCode,
    updatedAt: new Date().toISOString(),
    version: 1,
  }

  writeTextPreservingEol(state.contextPath, stringifySortedJson(next))

  return description
}

export function getAiContextState({ force = false, samplePath, sourceFilePath }) {
  if (!samplePath || !sourceFilePath || !fs.existsSync(sourceFilePath)) {
    return {
      changeRatio: 0,
      contextPath: samplePath ? getContextFilePath(samplePath) : null,
      description: null,
      existing: null,
      reason: 'missing_source',
      shouldRegenerate: false,
      sourceCode: null,
      sourceFilePath,
    }
  }

  const contextPath = getContextFilePath(samplePath)
  const sourceCode = fs.readFileSync(sourceFilePath, 'utf-8')
  const existing = readContextFile(contextPath)
  const changeRatio = existing?.sourceSnapshot ? calculateChangeRatio(existing.sourceSnapshot, sourceCode) : 1
  const hasDescription = typeof existing?.description === 'string' && existing.description.length > 0
  const shouldRegenerate = force || !hasDescription || changeRatio >= CHANGE_THRESHOLD

  let reason = 'reuse'

  if (force) {
    reason = 'force'
  } else if (!hasDescription) {
    reason = 'missing_context'
  } else if (changeRatio >= CHANGE_THRESHOLD) {
    reason = 'changed_30_percent'
  }

  return {
    changeRatio,
    contextPath,
    description: hasDescription ? existing.description : null,
    existing,
    reason,
    shouldRegenerate,
    sourceCode,
    sourceFilePath,
  }
}

export function getContextFilePath(samplePath) {
  return join(dirname(samplePath), CONTEXT_FILE_NAME)
}

function buildContextContents({ sampleEntries, samplePath, sourceCode, sourceFilePath }) {
  return [
    `Sample path: ${samplePath}`,
    `Source file: ${sourceFilePath}`,
    '',
    'Known translation keys and sample texts:',
    JSON.stringify(sampleEntries, null, 2),
    '',
    'Source code:',
    sourceCode,
  ].join('\n')
}

function buildContextSystemInstruction() {
  const { productContext, terminology, tone } = getTranslateRuntimeConfig()

  return [
    'You are generating translation context for a UI component.',
    'Write a compact but informative description for translators.',
    'Product context:',
    productContext,
    'Terminology:',
    terminology,
    'Tone:',
    tone,
    'Focus on:',
    '- what the component or page does',
    '- main user actions',
    '- important entities and domain meaning',
    '- what the shown strings likely refer to',
    '- tone or UX intent if obvious',
    'Rules:',
    '- Return plain text only.',
    '- Write 4 to 8 short sentences.',
    '- Be concrete, not generic.',
    '- Do not repeat raw code.',
    '- Mention adult-content context only if it is actually visible in the code or strings.',
  ].join('\n')
}

function cleanText(text) {
  return text
    .replace(/```text/gi, '')
    .replace(/```/g, '')
    .trim()
}

function detectEol(filePath) {
  if (!fs.existsSync(filePath)) {
    return '\n'
  }

  const text = fs.readFileSync(filePath, 'utf-8')
  return text.includes('\r\n') ? '\r\n' : '\n'
}

async function generateContextDescription({ sample, samplePath, sourceCode, sourceFilePath }) {
  const sampleEntries = Object.entries(sample ?? {})
    .slice(0, 40)
    .map(([key, text]) => ({
      key,
      text,
    }))
  const responseText = await generateContentWithLimits({
    apiKey: getTranslateRuntimeConfig().apiKey,
    config: {
      systemInstruction: buildContextSystemInstruction(),
    },
    contents: buildContextContents({
      sampleEntries,
      samplePath: relative(workspaceRoot, samplePath),
      sourceCode: sourceCode.slice(0, SOURCE_MAX_CHARS),
      sourceFilePath: relative(workspaceRoot, sourceFilePath),
    }),
    model: getTranslateRuntimeConfig().contextModel || DEFAULT_CONTEXT_MODEL,
  })

  return cleanText(responseText)
}

function longestCommonSubsequenceLength(left, right) {
  const rows = left.length + 1
  const cols = right.length + 1
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      if (left[i - 1] === right[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  return dp[left.length][right.length]
}

function normalizeSource(source) {
  return String(source)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim()
}

function readContextFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function readFloat(name, fallback) {
  const raw = process.env[name]

  if (!raw) {
    return fallback
  }

  const value = Number.parseFloat(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function readPositiveInt(name, fallback) {
  const raw = process.env[name]

  if (!raw) {
    return fallback
  }

  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function buildAiContextHelp(command = 'brick translate-context') {
  return `${buildTranslateHelp(command)}\n\nExtra:\n  --force`
}

export async function runAiContextCli(rawArgs = process.argv.slice(3), command = 'brick translate-context') {
  const helpText = buildAiContextHelp(command)

  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    console.log(helpText)
    process.exit(0)
  }

  const force = rawArgs.includes('--force')
  const filteredArgs = rawArgs.filter((arg) => arg !== '--force')
  const { options, positional } = parseTranslateRuntimeArgs(filteredArgs)

  try {
    setTranslateRuntimeConfig(options)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    console.error('')
    console.error(helpText)
    process.exit(1)
  }

  const targets = listTranslationTargets(workspaceRoot)
  const requestedSamplePaths =
    positional.length > 0 ? new Set(positional.map((samplePath) => resolve(workspaceRoot, samplePath))) : null
  const targetEntries = requestedSamplePaths
    ? targets.filter(({ samplePath }) => requestedSamplePaths.has(samplePath))
    : targets

  for (const { samplePath, sourceFilePath } of targetEntries) {
    if (!sourceFilePath || !fs.existsSync(samplePath)) {
      continue
    }

    const description = await ensureAiContext({
      force,
      sample: JSON.parse(fs.readFileSync(samplePath, 'utf-8')),
      samplePath,
      sourceFilePath,
    })

    if (description) {
      console.log(`🧠 Context updated: ${relative(workspaceRoot, samplePath)}`)
    }
  }
}

function writeTextPreservingEol(filePath, content) {
  const eol = detectEol(filePath)
  const normalized = String(content).replace(/\r?\n/g, eol)
  fs.writeFileSync(filePath, normalized, 'utf-8')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runAiContextCli(process.argv.slice(2), 'node packages/cli/src/translate/ai-context.js')
}
