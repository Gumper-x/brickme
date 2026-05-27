import { FontAssetType, generateFonts, OtherAssetType } from 'fantasticon'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(currentDir, '../../../..')
const args = process.argv.slice(3)

if (args.includes('--help') || args.includes('-h')) {
  printHelp()
  process.exit(0)
}

const options = parseArgs(args)

if (!options.path) {
  printHelp()
  process.exit(1)
}

const inputDir = path.resolve(process.cwd(), options.path)
const iconName = options.name || path.basename(inputDir)
const outputDir = options.output
  ? path.resolve(process.cwd(), options.output)
  : path.resolve(workspaceRoot, `brick/assets/icons/${iconName}`)

if (!fs.existsSync(inputDir)) {
  throw new Error(`Icon input directory is not found: ${inputDir}`)
}

if (!fs.statSync(inputDir).isDirectory()) {
  throw new Error(`Icon input path must be a directory: ${inputDir}`)
}

if (/[\\/]/.test(iconName)) {
  throw new Error(`Icon name must not contain path separators: ${iconName}`)
}

fs.mkdirSync(outputDir, { recursive: true })

await generateFonts({
  assetTypes: [OtherAssetType.CSS, OtherAssetType.JSON],
  fontsUrl: '.',
  fontTypes: [FontAssetType.EOT, FontAssetType.WOFF2, FontAssetType.WOFF],
  formatOptions: {
    json: {
      indent: 2,
    },
  },
  inputDir,
  name: iconName,
  normalize: true,
  outputDir,
})

const cssSourceFile = [`${iconName}.css`, 'icons.css', 'icon.css'].find((file) =>
  fs.existsSync(path.join(outputDir, file)),
)

if (!cssSourceFile) {
  throw new Error(`CSS output file was not generated for icon set "${iconName}"`)
}

const cssPath = path.join(outputDir, cssSourceFile)
const minifiedCssPath = path.join(outputDir, `${path.parse(cssSourceFile).name}.minify.css`)
const cssContent = fs.readFileSync(cssPath, 'utf8')
const normalizedCssContent = normalizeGeneratedCss(cssContent)

if (normalizedCssContent !== cssContent) {
  fs.writeFileSync(cssPath, normalizedCssContent)
}

fs.writeFileSync(minifiedCssPath, minifyCss(normalizedCssContent))

console.log(`✅ Icons generated for ${iconName}`)
console.log(`   input:  ${inputDir}`)
console.log(`   output: ${outputDir}`)

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    .replace(/;\}/g, '}')
    .trim()
}

function normalizeGeneratedCss(css) {
  return `${css
    .replace(/"/g, "'")
    .replace(/^ {4}/gm, '  ')
    .replace(/src: ([^\n]+),\n([^\n]+),\n([^\n]+);/, 'src:\n    $1,\n    $2,\n    $3;')
    .replace(
      /i\[class\^='icon-'\]:before, i\[class\*=' icon-'\]:before \{/,
      "i[class^='icon-']:before,\ni[class*=' icon-']:before {",
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`
}

function parseArgs(rawArgs) {
  const parsedOptions = {
    name: null,
    output: null,
    path: null,
  }
  const positional = []

  for (let index = 0; index < rawArgs.length; index += 1) {
    const value = rawArgs[index]

    if (value === '--path') {
      parsedOptions.path = rawArgs[index + 1] ?? null
      index += 1
      continue
    }

    if (value === '--name') {
      parsedOptions.name = rawArgs[index + 1] ?? null
      index += 1
      continue
    }

    if (value === '--output') {
      parsedOptions.output = rawArgs[index + 1] ?? null
      index += 1
      continue
    }

    positional.push(value)
  }

  if (!parsedOptions.path) {
    parsedOptions.path = positional[0] ?? null
  }

  if (!parsedOptions.name) {
    parsedOptions.name = positional[1] ?? null
  }

  if (!parsedOptions.output) {
    parsedOptions.output = positional[2] ?? null
  }

  return parsedOptions
}

function printHelp() {
  console.log(`brick icon <path> [name] [output]

Usage:
  brick icon ./path/to/svg-icons
  brick icon ./path/to/svg-icons marketing
  brick icon ./path/to/svg-icons marketing ./path/to/output
  brick icon --path ./path/to/svg-icons --name marketing --output ./path/to/output

Notes:
  path: directory with source .svg icons
  name: icon set name and generated asset prefix
  output: directory for generated files; default is brick/assets/icons/<name>`)
}
