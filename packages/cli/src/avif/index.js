import fs from 'fs'
import { globSync } from 'glob'
import path from 'path'

const args = process.argv.slice(3)
const extensions = '.{png,jpg,jpeg,webp}'

if (args.includes('--help') || args.includes('-h')) {
  printHelp()
  process.exit(0)
}

if (!args[0]) {
  printHelp()
  process.exit(1)
}

console.log('\x1b[32m', '\rIMG Optimize')

const patternPrefix = resolvePatternPrefix(args[0])
const searchPattern = `${patternPrefix}${extensions}`
const imgList = globSync(searchPattern)

if (imgList.length === 0) {
  console.log(`\nNothing found for pattern: ${searchPattern}`)
  console.log('\x1b[0m', '')
  process.exit(0)
}

const { default: sharp } = await import('sharp')

for (let i = 0; i < imgList.length; i++) {
  const imgPath = imgList[i]
  await sharp(imgPath)
    .avif({
      effort: 7,
      quality: 70,
    })
    .toFile(`${imgPath.replace(/\.(png|jpg|jpeg|webp)$/i, '')}.avif`)

  const percent = Math.round(((i + 1) * 100) / imgList.length)
  fs.unlinkSync(imgPath)
  process.stdout.write(`\r💎 Optimizing: [${'🌹'.repeat((percent * 10) / 100)}]  ${percent}%`)
}

console.log('\x1b[0m', '')

function printHelp() {
  console.log(`brick avif <pattern>

Usage:
  brick avif ../brick/public/**/*
  brick avif ./src/assets/**/*
  brick avif ./src/assets

Notes:
  The command always searches only for ${extensions}
  Pass a directory or a glob prefix without the extension part`)
}

function resolvePatternPrefix(input) {
  if (/[?*[\]{}]/.test(input)) {
    return stripTrailingExtensionGroup(input)
  }

  if (/[\\/]$/.test(input)) {
    return `${input}**/*`
  }

  if (fs.existsSync(input) && fs.statSync(input).isDirectory()) {
    return path.join(input, '**/*').replace(/\\/g, '/')
  }

  return stripTrailingExtensionGroup(input)
}

function stripTrailingExtensionGroup(input) {
  return input.replace(/\.\{png,jpg,jpeg,webp\}$/i, '')
}
