#!/usr/bin/env node

import fs from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { fileURLToPath } from 'url'

import { generateContentWithLimits } from './gemini.js'
import { getTranslationPaths, listWorkspaceFiles } from './utils.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(currentDir, '../../../..')
const CONTEXT_FILE_NAME = 'ai-context.json'
const CONTEXT_MODEL =
  process.env.TRANSLATE_CONTEXT_AI_MODEL || process.env.TRANSLATE_AI_MODEL || 'gemini-3.1-flash-lite-preview'
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

  writeTextPreservingEol(state.contextPath, `${JSON.stringify(next, null, 2)}\n`)

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
  return [
    'You are generating translation context for a UI component.',
    'Write a compact but informative description for translators.',
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
    config: {
      systemInstruction: buildContextSystemInstruction(),
    },
    contents: buildContextContents({
      sampleEntries,
      samplePath: relative(workspaceRoot, samplePath),
      sourceCode: sourceCode.slice(0, SOURCE_MAX_CHARS),
      sourceFilePath: relative(workspaceRoot, sourceFilePath),
    }),
    model: CONTEXT_MODEL,
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

async function runCli() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const sampleArgs = args.filter((arg) => arg !== '--force')
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

  const targetSamplePaths =
    sampleArgs.length > 0
      ? sampleArgs.map((samplePath) => resolve(workspaceRoot, samplePath))
      : [...sampleToSource.keys()].sort()

  for (const samplePath of targetSamplePaths) {
    const sourceFilePath = sampleToSource.get(samplePath)

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
  await runCli()
}
