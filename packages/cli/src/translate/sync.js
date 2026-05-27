#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { globSync } from 'glob'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import {
  compileVueToJS,
  extractStrings,
  getTranslationPaths,
  listWorkspaceFiles,
  sortObjectKeys,
  stringifySortedJson,
} from './utils.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(currentDir, '../../../..')
const activeGeneratedDirs = new Set()
const cleanupRoots = new Set()
const STATIC_CLEANUP_ROOTS = [
  resolve(workspaceRoot, 'packages/brick/global'),
  ...globSync('apps/*/global', {
    absolute: true,
    cwd: workspaceRoot,
  }),
]

function cleanupGeneratedDirs() {
  for (const rootDir of cleanupRoots) {
    if (!existsSync(rootDir)) {
      continue
    }

    for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }

      const targetDir = resolve(rootDir, entry.name)

      if (!activeGeneratedDirs.has(targetDir)) {
        removeDir(targetDir)
      }
    }
  }
}

function createProgress(total) {
  let done = 0
  const start = Date.now()

  return function update(currentFile) {
    done += 1

    const percent = Math.round((done * 100) / total)
    const filled = Math.round(percent / 5)
    const empty = 20 - filled

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    const shortName = currentFile.split('/').slice(-3).join('/')

    process.stdout.write(
      `\r⚙️  Processing: [${'█'.repeat(filled)}${' '.repeat(empty)}] ` +
        `${percent}% (${done}/${total}) ` +
        `⏱ ${elapsed}s ` +
        `\x1b[90m${shortName}\x1b[0m\x1b[K`,
    )
  }
}

// ---------- progress ----------

function detectEol(filePath) {
  if (!existsSync(filePath)) {
    return '\n'
  }

  const text = readFileSync(filePath, 'utf-8')
  return text.includes('\r\n') ? '\r\n' : '\n'
}

// ---------- core ----------

function ensureSortedJsonFile(filePath) {
  if (!existsSync(filePath)) {
    return false
  }

  const currentText = readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(currentText)
  const sortedText = stringifySortedJson(parsed)

  if (normalizeJsonEol(currentText) === normalizeJsonEol(sortedText)) {
    return false
  }

  writeTextPreservingEol(filePath, sortedText)
  return true
}

function ensureSortedTranslationJsons(baseDir, samplePath) {
  const filesToCheck = [samplePath, resolve(baseDir, 'ai-context.json')]
  const generatedDir = resolve(baseDir, 'generated')

  if (existsSync(generatedDir)) {
    for (const entry of readdirSync(generatedDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        filesToCheck.push(resolve(generatedDir, entry.name))
      }
    }
  }

  for (const filePath of filesToCheck) {
    try {
      if (ensureSortedJsonFile(filePath)) {
        console.log('\n🔤 Sorted keys:', filePath)
      }
    } catch (error) {
      console.error('\n❌ invalid translation json:', filePath, error)
    }
  }
}

function normalizeJsonEol(content) {
  return String(content).replace(/\r\n/g, '\n')
}

// ---------- core ----------

function processFile(filePath) {
  let code = readFileSync(filePath, 'utf-8')

  try {
    if (filePath.endsWith('.vue')) {
      code = compileVueToJS(code, filePath)
    }

    const strings = extractStrings(code, filePath)

    writeTranslations(filePath, strings)
  } catch (e) {
    console.error('\n❌ error:', filePath, e)
  }
}

// ---------- translations ----------

function removeDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { force: true, recursive: true })
  }
}

function writeTextPreservingEol(filePath, content) {
  const eol = detectEol(filePath)
  const normalized = String(content).replace(/\r?\n/g, eol)
  writeFileSync(filePath, normalized, 'utf-8')
}

function writeTranslations(id, strings) {
  const paths = getTranslationPaths(id)

  if (!paths) {
    return
  }

  const { baseDir, isComponent, isLayout, isPage, isScript, samplePath } = paths

  if (isPage || isLayout || isScript) {
    cleanupRoots.add(dirname(baseDir))
  }

  if (strings.size === 0) {
    if (isComponent || isPage || isLayout || isScript) {
      removeDir(baseDir)
    }
    return
  }

  if (isPage || isLayout || isScript) {
    activeGeneratedDirs.add(baseDir)
  }

  mkdirSync(baseDir, { recursive: true })

  let prev = {}

  if (existsSync(samplePath)) {
    try {
      prev = JSON.parse(readFileSync(samplePath, 'utf-8'))
    } catch {
      prev = {}
    }
  }

  const next = {}

  for (const [k, v] of strings) {
    next[k] = v
  }

  const sortedNext = sortObjectKeys(next)
  const isSame =
    Object.keys(prev).length === Object.keys(sortedNext).length &&
    Object.keys(prev).every((k) => prev[k] === sortedNext[k])

  if (!isSame) {
    writeTextPreservingEol(samplePath, stringifySortedJson(sortedNext))
    console.log('\n🧪 Updated:', samplePath)
  }

  ensureSortedTranslationJsons(baseDir, samplePath)
}

// ---------- run ----------

const files = listWorkspaceFiles(workspaceRoot).filter(
  (file) => /\.(?:js|ts|vue)$/.test(file) && !file.endsWith('.d.ts'),
)

const filtered = files.filter((file) => getTranslationPaths(file))
for (const rootDir of STATIC_CLEANUP_ROOTS) {
  cleanupRoots.add(rootDir)
}

const progress = createProgress(filtered.length)

for (const file of filtered) {
  processFile(file)
  progress(file)
}

cleanupGeneratedDirs()

process.stdout.write('\n')
console.log('✅ Done')
