import { readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(3)

if (args.includes('--help') || args.includes('-h')) {
  printHelp()
  process.exit(0)
}

const options = parseArgs(args)

if (!options.path || !options.typeName || !options.outputFile || !options.replacePattern) {
  printHelp()
  process.exit(1)
}

const inputDir = path.resolve(process.cwd(), options.path)
const outputFile = path.resolve(process.cwd(), options.outputFile)
const replacePattern = parseReplacePattern(options.replacePattern)
const entries = readdirSync(inputDir)
  .filter((entry) => statSync(path.join(inputDir, entry)).isFile())
  .sort((first, second) => first.localeCompare(second))

const typeValues = new Set(
  entries
    .map((entry) => applyReplace(entry, replacePattern))
    .filter(Boolean),
)

if (typeValues.size === 0) {
  throw new Error(`No type values generated from: ${inputDir}`)
}

const declaration = `declare type ${options.typeName} = ${[...typeValues].map((value) => `'${value}'`).join(' | ')}\n`
writeFileSync(outputFile, declaration, 'utf8')

console.log(`✅ Types generated for ${options.typeName}`)
console.log(`   input:  ${inputDir}`)
console.log(`   output: ${outputFile}`)

function applyReplace(value, replacePattern) {
  if (replacePattern instanceof RegExp) {
    return value.replace(replacePattern, '')
  }

  return value.replaceAll(replacePattern, '')
}

function parseArgs(rawArgs) {
  const options = {
    outputFile: null,
    path: null,
    replacePattern: null,
    typeName: null,
  }
  const positional = []

  for (let index = 0; index < rawArgs.length; index += 1) {
    const value = rawArgs[index]

    if (value === '--path') {
      options.path = rawArgs[index + 1] ?? null
      index += 1
      continue
    }

    if (value === '--type-name') {
      options.typeName = rawArgs[index + 1] ?? null
      index += 1
      continue
    }

    if (value === '--output-file') {
      options.outputFile = rawArgs[index + 1] ?? null
      index += 1
      continue
    }

    if (value === '--replace-pattern') {
      options.replacePattern = rawArgs[index + 1] ?? null
      index += 1
      continue
    }

    positional.push(value)
  }

  if (!options.path) {
    options.path = positional[0] ?? null
  }

  if (!options.typeName) {
    options.typeName = positional[1] ?? null
  }

  if (!options.outputFile) {
    options.outputFile = positional[2] ?? null
  }

  if (!options.replacePattern) {
    options.replacePattern = positional[3] ?? null
  }

  return options
}

function parseReplacePattern(value) {
  const match = value.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/)

  if (match) {
    return new RegExp(match[1], match[2])
  }

  return value
}

function printHelp() {
  console.log(`brick types <path> <typeName> <outputFile> <replacePattern>

Usage:
  brick types ./path/to/files IconName ./types/icon.d.ts .svg
  brick types ./path/to/files IconName ./types/icon.d.ts /\\.svg$/
  brick types --path ./path/to/files --type-name IconName --output-file ./types/icon.d.ts --replace-pattern /\\.svg$/

Notes:
  path: directory with source files
  typeName: generated TypeScript type name
  outputFile: file to write declaration into
  replacePattern: string or regex literal used in replace(..., '') for each filename`)
}
