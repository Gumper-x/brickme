import fs from 'fs'
import { globSync } from 'glob'

const args = process.argv.slice(3)

if (args.includes('--help') || args.includes('-h')) {
  printHelp()
  process.exit(0)
}

if (args.length > 0) {
  printHelp()
  process.exit(1)
}

console.log('\x1b[32m', '\rFilename analyse')
const dsStore = globSync('./**/.DS_Store')
if (dsStore.length > 0) {
  console.log('\x1b[0m', '')
  dsStore.forEach((item) => {
    fs.unlinkSync(item)
    console.log(item)
  })

  throw `🥌 Remove .DS_Store ${dsStore[0]}`
}

const allFile = globSync('./**/*.*')

let errorFilename = ''
allFile.forEach((path) => {
  if (/\.md/.test(path)) {
    return
  }
  if (/node_modules/.test(path)) {
    return
  }
  const filename = path.match(/([^/\\]+).[a-z\d]$/)?.[0]
  if (!filename) {
    console.warn(path)
  }
  if (/[A-Z]{3}.svg/.test(filename)) {
    return
  }
  const isKebabCase = !/[^a-z./\d_-]/.test(filename)
  if (!isKebabCase) {
    errorFilename = `${errorFilename}
      🍖 No Kebab  🗺️ ${path} | ${filename}
    `
  }
})

if (errorFilename.length > 0) {
  console.log('\x1b[0m', '')
  throw errorFilename
}

console.log('\x1b[0m', '')

function printHelp() {
  console.log(`brick filename

Usage:
  brick filename

Notes:
  Scans files under the current working directory
  Removes .DS_Store files and fails on non-kebab-case filenames
  Ignores markdown files and node_modules`)
}
