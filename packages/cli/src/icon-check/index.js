import crypto from 'crypto'
import fs from 'fs'
import { globSync } from 'glob'
import looksSame from 'looks-same'
import path from 'path'
import sharp from 'sharp'
import { optimize } from 'svgo'
import { fileURLToPath } from 'url'

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

const iconsDir = path.resolve(process.cwd(), options.path)
const scopeName = options.name || path.basename(iconsDir)

if (!fs.existsSync(iconsDir)) {
  throw new Error(`Icon directory not found: ${iconsDir}`)
}

if (!fs.statSync(iconsDir).isDirectory()) {
  throw new Error(`Icon path must be a directory: ${iconsDir}`)
}

const allowedDuplicateIconPairs = new Set([
  'bounty::affiliate-block-percent::clock-filled',
  'bounty::cs2-icon-mobile::statistics-stat-players_total',
])

const D_HASH_SIZE = 32
const STRICT_HASH_SIZE = 128
const PHASH_IMAGE_SIZE = 32
const PHASH_MATRIX_SIZE = 8
const ALPHA_THRESHOLD = 8
const SIMPLE_SIMILARITY_THRESHOLD = 90
const SIMPLE_IOU_THRESHOLD_PERCENT = 70
const MAX_FILL_RATIO_DELTA_PERCENT = 10
const STEP2_DIRECT_SIMILARITY_MIN = 88
const STEP2_DIRECT_IOU_MIN = 92
const STEP2_DIRECT_FILL_DELTA_MAX = 8
const LOOKS_SAME_CONCURRENCY = 8
const LOOKS_SAME_OPTIONS = {
  ignoreAntialiasing: false,
  tolerance: 65,
}

function addEdgeByIndexes(graph, entries, firstIndex, secondIndex) {
  addUndirectedEdge(graph, entries[firstIndex].filePath, entries[secondIndex].filePath)
}

function addUndirectedEdge(graph, firstNode, secondNode) {
  graph.get(firstNode)?.add(secondNode)
  graph.get(secondNode)?.add(firstNode)
}

function buildDuplicateGroups(graph, projectDir) {
  const visited = new Set()
  const groups = []

  for (const filePath of [...graph.keys()].sort((first, second) => first.localeCompare(second))) {
    if (visited.has(filePath)) {
      continue
    }

    const neighbors = graph.get(filePath)

    if (!neighbors || neighbors.size === 0) {
      continue
    }

    const queue = [filePath]
    const component = []
    visited.add(filePath)

    while (queue.length > 0) {
      const currentFilePath = queue.shift()

      if (!currentFilePath) {
        continue
      }

      component.push(currentFilePath)

      for (const neighborPath of graph.get(currentFilePath) ?? []) {
        if (visited.has(neighborPath)) {
          continue
        }

        visited.add(neighborPath)
        queue.push(neighborPath)
      }
    }

    if (component.length > 1) {
      const iconNames = component
        .map((iconPath) => path.relative(projectDir, iconPath).replace(/\.svg$/u, ''))
        .sort((first, second) => first.localeCompare(second))

      groups.push({
        duplicateIcons: iconNames.slice(1),
        iconName: iconNames[0],
      })
    }
  }

  return groups.sort((first, second) => first.iconName.localeCompare(second.iconName))
}

function buildExactHashMap(entries) {
  const dHashToIndexes = new Map()

  entries.forEach((entry, index) => {
    if (!dHashToIndexes.has(entry.dHash)) {
      dHashToIndexes.set(entry.dHash, [])
    }

    dHashToIndexes.get(entry.dHash).push(index)
  })

  const exactGroups = []

  for (const indexes of dHashToIndexes.values()) {
    if (indexes.length < 2) {
      continue
    }

    const strictHashToIndexes = new Map()

    for (const index of indexes) {
      const strictHash = entries[index].strictHash

      if (!strictHashToIndexes.has(strictHash)) {
        strictHashToIndexes.set(strictHash, [])
      }

      strictHashToIndexes.get(strictHash).push(index)
    }

    for (const strictIndexes of strictHashToIndexes.values()) {
      if (strictIndexes.length > 1) {
        exactGroups.push(strictIndexes)
      }
    }
  }

  return exactGroups
}

function buildSimpleCandidatePairs(entries, exactPairKeys, progressTracker) {
  const totalPairs = (entries.length * (entries.length - 1)) / 2

  if (totalPairs === 0) {
    return {
      candidatePairs: [],
      directPairs: [],
      totalPairs,
    }
  }

  const candidatePairs = []
  const directPairs = []

  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      progressTracker?.tick()

      const pairKey = pairKeyFromIndexes(leftIndex, rightIndex)

      if (exactPairKeys.has(pairKey)) {
        continue
      }

      const leftEntry = entries[leftIndex]
      const rightEntry = entries[rightIndex]
      const hammingDistance = calculateHammingDistance(leftEntry.shapeHash, rightEntry.shapeHash)
      const similarityPercent = Math.round((1 - hammingDistance / leftEntry.shapeHash.length) * 100)

      if (similarityPercent < SIMPLE_SIMILARITY_THRESHOLD) {
        continue
      }

      const iouPercent = calculateIoU(leftEntry.normalizedMask, rightEntry.normalizedMask)

      if (iouPercent < SIMPLE_IOU_THRESHOLD_PERCENT) {
        continue
      }

      const fillRatioDeltaPercent = Math.abs(leftEntry.fillRatio - rightEntry.fillRatio) * 100

      if (fillRatioDeltaPercent > MAX_FILL_RATIO_DELTA_PERCENT) {
        continue
      }

      const shouldSendDirectToResult =
        similarityPercent >= STEP2_DIRECT_SIMILARITY_MIN &&
        iouPercent >= STEP2_DIRECT_IOU_MIN &&
        fillRatioDeltaPercent <= STEP2_DIRECT_FILL_DELTA_MAX &&
        leftEntry.componentsCount === rightEntry.componentsCount

      if (shouldSendDirectToResult) {
        directPairs.push([leftIndex, rightIndex])
      } else {
        candidatePairs.push([leftIndex, rightIndex])
      }
    }
  }

  return {
    candidatePairs,
    directPairs,
    totalPairs,
  }
}

function calculateHammingDistance(firstBits, secondBits) {
  let distance = 0

  for (let bitIndex = 0; bitIndex < firstBits.length; bitIndex += 1) {
    if (firstBits[bitIndex] !== secondBits[bitIndex]) {
      distance += 1
    }
  }

  return distance
}

function calculateIoU(firstMask, secondMask) {
  let intersection = 0
  let union = 0

  for (let index = 0; index < firstMask.length; index += 1) {
    const firstFilled = firstMask[index] === 1
    const secondFilled = secondMask[index] === 1

    if (firstFilled && secondFilled) {
      intersection += 1
    }

    if (firstFilled || secondFilled) {
      union += 1
    }
  }

  if (union === 0) {
    return 0
  }

  return (intersection / union) * 100
}

function countConnectedComponents(mask, size) {
  const totalPixels = size * size
  const visited = new Uint8Array(totalPixels)
  const queue = []
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]

  let componentsCount = 0

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
    if (visited[pixelIndex] || mask[pixelIndex] !== 1) {
      continue
    }

    componentsCount += 1
    visited[pixelIndex] = 1
    queue.push(pixelIndex)

    while (queue.length > 0) {
      const currentPixelIndex = queue.pop()
      const x = currentPixelIndex % size
      const y = Math.floor(currentPixelIndex / size)

      for (const [deltaX, deltaY] of directions) {
        const nextX = x + deltaX
        const nextY = y + deltaY

        if (nextX < 0 || nextY < 0 || nextX >= size || nextY >= size) {
          continue
        }

        const nextPixelIndex = nextY * size + nextX

        if (visited[nextPixelIndex] || mask[nextPixelIndex] !== 1) {
          continue
        }

        visited[nextPixelIndex] = 1
        queue.push(nextPixelIndex)
      }
    }
  }

  return componentsCount
}

function createDHashFromRawResult(rawResult) {
  const width = D_HASH_SIZE + 1
  const height = D_HASH_SIZE
  const { data: rgbaPixels, info } = rawResult
  const channels = info.channels

  let bitString = ''

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width

    for (let x = 0; x < width - 1; x += 1) {
      const leftAlphaIndex = (rowStart + x) * channels + 3
      const rightAlphaIndex = (rowStart + x + 1) * channels + 3
      const left = rgbaPixels[leftAlphaIndex]
      const right = rgbaPixels[rightAlphaIndex]
      bitString += left > right ? '1' : '0'
    }
  }

  return bitString
}

async function createIconArtifacts(normalizedSvg, svgPath) {
  try {
    const [dHashRaw, strictHashRaw, shapeRaw, looksSamePng] = await Promise.all([
      renderForDHash(normalizedSvg),
      renderForStrictHash(normalizedSvg),
      renderForShape(normalizedSvg),
      renderForLooksSameNormalized(normalizedSvg),
    ])

    const dHash = createDHashFromRawResult(dHashRaw)
    const strictHash = createStrictHashFromRawResult(strictHashRaw)
    const { componentsCount, fillRatio, normalizedMask } = createNormalizedMaskFromRawShape(shapeRaw)
    const shapeHash = createPHash(normalizedMask)

    return {
      componentsCount,
      dHash,
      fillRatio,
      looksSamePng,
      normalizedMask,
      shapeHash,
      strictHash,
    }
  } catch (error) {
    throw new Error(`Failed to process SVG: ${svgPath}\n${error.message}`)
  }
}

function createNormalizedMaskFromRawShape(rawResult) {
  const { data: rgbaPixels, info } = rawResult
  const channels = info.channels
  const size = PHASH_IMAGE_SIZE
  const alphaMask = new Uint8Array(size * size)

  for (let pixelIndex = 0; pixelIndex < alphaMask.length; pixelIndex += 1) {
    alphaMask[pixelIndex] = rgbaPixels[pixelIndex * channels + 3] > ALPHA_THRESHOLD ? 1 : 0
  }

  let minX = size
  let minY = size
  let maxX = -1
  let maxY = -1
  let filledPixels = 0

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = alphaMask[y * size + x]

      if (value === 0) {
        continue
      }

      filledPixels += 1
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX === -1 || maxY === -1) {
    return {
      componentsCount: 0,
      fillRatio: 0,
      normalizedMask: alphaMask,
    }
  }

  const boxWidth = maxX - minX + 1
  const boxHeight = maxY - minY + 1
  const normalizedMask = new Uint8Array(size * size)

  for (let y = 0; y < size; y += 1) {
    const sourceY = minY + Math.min(boxHeight - 1, Math.floor((y / size) * boxHeight))

    for (let x = 0; x < size; x += 1) {
      const sourceX = minX + Math.min(boxWidth - 1, Math.floor((x / size) * boxWidth))
      normalizedMask[y * size + x] = alphaMask[sourceY * size + sourceX]
    }
  }

  return {
    componentsCount: countConnectedComponents(normalizedMask, size),
    fillRatio: filledPixels / (size * size),
    normalizedMask,
  }
}

function createPHash(mask) {
  const matrix = []

  for (let rowIndex = 0; rowIndex < PHASH_IMAGE_SIZE; rowIndex += 1) {
    const row = new Float64Array(PHASH_IMAGE_SIZE)

    for (let columnIndex = 0; columnIndex < PHASH_IMAGE_SIZE; columnIndex += 1) {
      row[columnIndex] = mask[rowIndex * PHASH_IMAGE_SIZE + columnIndex]
    }

    matrix.push(row)
  }

  const dct = dct2d(matrix, PHASH_IMAGE_SIZE)
  const lowFrequencyValues = []

  for (let rowIndex = 0; rowIndex < PHASH_MATRIX_SIZE; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < PHASH_MATRIX_SIZE; columnIndex += 1) {
      if (rowIndex === 0 && columnIndex === 0) {
        continue
      }

      lowFrequencyValues.push(dct[rowIndex][columnIndex])
    }
  }

  const sortedValues = [...lowFrequencyValues].sort((first, second) => first - second)
  const median = sortedValues[Math.floor(sortedValues.length / 2)]
  const bits = new Uint8Array(PHASH_MATRIX_SIZE * PHASH_MATRIX_SIZE)
  let bitIndex = 0

  for (let rowIndex = 0; rowIndex < PHASH_MATRIX_SIZE; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < PHASH_MATRIX_SIZE; columnIndex += 1) {
      if (rowIndex === 0 && columnIndex === 0) {
        bits[bitIndex] = 0
      } else {
        bits[bitIndex] = dct[rowIndex][columnIndex] > median ? 1 : 0
      }

      bitIndex += 1
    }
  }

  return bits
}

function createProgressTracker(label, total) {
  let done = 0
  const safeTotal = Math.max(total, 1)
  let currentTotal = safeTotal
  const barWidth = 18
  let lastRenderedPercent = -1

  const render = (force = false) => {
    const percent = Math.round((done / currentTotal) * 100)

    if (!force && percent === lastRenderedPercent) {
      return
    }

    const filledCells = Math.round((percent * barWidth) / 100)
    const bar = `${'#'.repeat(filledCells)}${'.'.repeat(barWidth - filledCells)}`

    process.stdout.write(`\r  ${label}: [${bar}] ${String(percent).padStart(3)}% ${done}/${currentTotal}`)

    lastRenderedPercent = percent

    if (done >= currentTotal) {
      process.stdout.write('\n')
    }
  }

  render(true)

  const tick = (step = 1) => {
    done = Math.min(done + step, currentTotal)
    render(done >= currentTotal)
  }

  return {
    setLabel(nextLabel) {
      label = nextLabel
      render(true)
    },
    setTotal(nextTotal) {
      currentTotal = Math.max(nextTotal, 1)
      done = Math.min(done, currentTotal)
      render(true)
    },
    tick,
  }
}

function createStrictHashFromRawResult(rawResult) {
  const { data: rgbaPixels, info } = rawResult
  const channels = info.channels
  const alphaPixels = Buffer.alloc(STRICT_HASH_SIZE * STRICT_HASH_SIZE)

  for (let pixelIndex = 0; pixelIndex < alphaPixels.length; pixelIndex += 1) {
    alphaPixels[pixelIndex] = rgbaPixels[pixelIndex * channels + 3]
  }

  return crypto.createHash('sha256').update(alphaPixels).digest('hex')
}

function dct1d(values) {
  const length = values.length
  const output = new Float64Array(length)
  const factor = Math.PI / (2 * length)

  for (let frequency = 0; frequency < length; frequency += 1) {
    let sum = 0

    for (let index = 0; index < length; index += 1) {
      sum += values[index] * Math.cos((2 * index + 1) * frequency * factor)
    }

    output[frequency] = sum * (frequency === 0 ? Math.sqrt(1 / length) : Math.sqrt(2 / length))
  }

  return output
}

function dct2d(matrix, size) {
  const rowTransformed = Array.from({ length: size }, () => new Float64Array(size))

  for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
    rowTransformed[rowIndex] = dct1d(matrix[rowIndex])
  }

  const output = Array.from({ length: size }, () => new Float64Array(size))

  for (let columnIndex = 0; columnIndex < size; columnIndex += 1) {
    const column = new Float64Array(size)

    for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
      column[rowIndex] = rowTransformed[rowIndex][columnIndex]
    }

    const transformedColumn = dct1d(column)

    for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
      output[rowIndex][columnIndex] = transformedColumn[rowIndex]
    }
  }

  return output
}

function duplicateIconPairKey(scope, firstIconName, secondIconName) {
  const [leftIconName, rightIconName] = [firstIconName, secondIconName].sort((first, second) =>
    first.localeCompare(second),
  )

  return `${scope}::${leftIconName}::${rightIconName}`
}

function formatDuration(milliseconds) {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  }

  return `${(milliseconds / 1000).toFixed(2)}s`
}

function parseArgs(rawArgs) {
  const options = {
    name: null,
    path: null,
  }
  const positional = []

  for (let index = 0; index < rawArgs.length; index += 1) {
    const value = rawArgs[index]

    if (value === '--path') {
      options.path = rawArgs[index + 1] ?? null
      index += 1
      continue
    }

    if (value === '--name') {
      options.name = rawArgs[index + 1] ?? null
      index += 1
      continue
    }

    positional.push(value)
  }

  if (!options.path) {
    options.path = positional[0] ?? null
  }

  if (!options.name) {
    options.name = positional[1] ?? null
  }

  return options
}

function printHelp() {
  console.log(`brick icon-check <path> [name]

Usage:
  brick icon-check ./path/to/svg-icons
  brick icon-check ./path/to/svg-icons bounty
  brick icon-check --path ./path/to/svg-icons --name bounty

Notes:
  path: directory with source .svg icons
  name: label for logs and allowed duplicate pairs; default is the directory name`)
}

function isAllowedDuplicateIconPair(scope, firstIconName, secondIconName) {
  return allowedDuplicateIconPairs.has(duplicateIconPairKey(scope, firstIconName, secondIconName))
}

function normalizeSvg(svg, svgPath) {
  const optimized = optimize(svg, {
    multipass: true,
    path: svgPath,
    plugins: ['preset-default', 'sortAttrs'],
  })

  return optimized.data.trim()
}

function pairKeyFromIndexes(firstIndex, secondIndex) {
  return firstIndex < secondIndex ? `${firstIndex}:${secondIndex}` : `${secondIndex}:${firstIndex}`
}

function renderForDHash(svgContent) {
  const width = D_HASH_SIZE + 1
  const height = D_HASH_SIZE

  return sharp(Buffer.from(svgContent, 'utf8'))
    .resize(width, height, {
      background: {
        alpha: 0,
        b: 0,
        g: 0,
        r: 0,
      },
      fit: 'fill',
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
}

async function renderForLooksSameNormalized(svgContent) {
  const input = Buffer.from(svgContent, 'utf8')
  const renderSize = 256
  const outputSize = 128

  const { data, info } = await sharp(input)
    .resize(renderSize, renderSize, {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      fit: 'contain',
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let minX = info.width
  let minY = info.height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3]

      if (alpha > ALPHA_THRESHOLD) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (maxX === -1 || maxY === -1) {
    return sharp(data, {
      raw: {
        channels: info.channels,
        height: info.height,
        width: info.width,
      },
    })
      .resize(outputSize, outputSize, {
        background: { alpha: 1, b: 255, g: 255, r: 255 },
        fit: 'contain',
      })
      .flatten({ background: { b: 255, g: 255, r: 255 } })
      .png()
      .toBuffer()
  }

  const left = Math.max(0, minX)
  const top = Math.max(0, minY)
  const width = Math.max(1, Math.min(info.width - left, maxX - minX + 1))
  const height = Math.max(1, Math.min(info.height - top, maxY - minY + 1))

  return sharp(data, {
    raw: {
      channels: info.channels,
      height: info.height,
      width: info.width,
    },
  })
    .extract({
      height,
      left,
      top,
      width,
    })
    .resize(outputSize, outputSize, {
      background: { alpha: 1, b: 255, g: 255, r: 255 },
      fit: 'contain',
    })
    .flatten({ background: { b: 255, g: 255, r: 255 } })
    .png()
    .toBuffer()
}
function renderForShape(svgContent) {
  return sharp(Buffer.from(svgContent, 'utf8'))
    .resize(PHASH_IMAGE_SIZE, PHASH_IMAGE_SIZE, {
      background: {
        alpha: 0,
        b: 0,
        g: 0,
        r: 0,
      },
      fit: 'contain',
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
}

function renderForStrictHash(svgContent) {
  return sharp(Buffer.from(svgContent, 'utf8'))
    .resize(STRICT_HASH_SIZE, STRICT_HASH_SIZE, {
      background: {
        alpha: 0,
        b: 0,
        g: 0,
        r: 0,
      },
      fit: 'contain',
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
}

async function runLooksSameOnCandidates(entries, candidatePairs, progressTracker) {
  const duplicatePairKeys = new Set()

  if (candidatePairs.length === 0) {
    return duplicatePairKeys
  }

  let nextPairIndex = 0

  const worker = async () => {
    while (true) {
      const pairIndex = nextPairIndex
      nextPairIndex += 1

      if (pairIndex >= candidatePairs.length) {
        break
      }

      const [leftIndex, rightIndex] = candidatePairs[pairIndex]
      const leftImage = entries[leftIndex].looksSamePng
      const rightImage = entries[rightIndex].looksSamePng
      const { equal } = await looksSame(leftImage, rightImage, LOOKS_SAME_OPTIONS)

      if (equal) {
        duplicatePairKeys.add(pairKeyFromIndexes(leftIndex, rightIndex))
      }

      progressTracker?.tick()
    }
  }

  const workers = Array.from(
    { length: Math.min(LOOKS_SAME_CONCURRENCY, Math.max(candidatePairs.length, 1)) },
    () => worker(),
  )

  await Promise.all(workers)

  return duplicatePairKeys
}

const startAt = Date.now()
const svgFiles = globSync('**/*.svg', {
  absolute: true,
  cwd: iconsDir,
  nodir: true,
}).sort()

if (svgFiles.length < 2) {
  console.log(`[${scopeName}] skip: ${svgFiles.length} icon(s)`)
  process.exit(0)
}

console.log(`Start icon-check for "${scopeName}"`)
console.log(`[${scopeName}] ${svgFiles.length} icons`)

const totalPairsEstimate = (svgFiles.length * (svgFiles.length - 1)) / 2
const progress = createProgressTracker(`${scopeName} pipeline step 1/3 hash & render`, svgFiles.length + totalPairsEstimate + 1)
const entries = []

for (const svgPath of svgFiles) {
  const svg = fs.readFileSync(svgPath, 'utf8')
  const normalizedSvg = normalizeSvg(svg, svgPath)
  const artifacts = await createIconArtifacts(normalizedSvg, svgPath)

  entries.push({
    ...artifacts,
    filePath: svgPath,
  })

  progress.tick()
}

const duplicateGraph = new Map(entries.map((entry) => [entry.filePath, new Set()]))
const exactPairKeys = new Set()
const exactGroups = buildExactHashMap(entries)

for (const indexes of exactGroups) {
  for (let leftIndex = 0; leftIndex < indexes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < indexes.length; rightIndex += 1) {
      const firstEntryIndex = indexes[leftIndex]
      const secondEntryIndex = indexes[rightIndex]
      exactPairKeys.add(pairKeyFromIndexes(firstEntryIndex, secondEntryIndex))
      addEdgeByIndexes(duplicateGraph, entries, firstEntryIndex, secondEntryIndex)
    }
  }
}

console.log(`  ${scopeName} step 1/3 exact hash pairs: ${exactPairKeys.size}`)

progress.setLabel(`${scopeName} pipeline step 2/3 simple filter`)
const { candidatePairs, directPairs, totalPairs } = buildSimpleCandidatePairs(entries, exactPairKeys, progress)

for (const [leftIndex, rightIndex] of directPairs) {
  addEdgeByIndexes(duplicateGraph, entries, leftIndex, rightIndex)
}

console.log(
  `  ${scopeName} step 2/3 direct(semantic 100%)=${directPairs.length}, candidates=${candidatePairs.length} (similarity >= ${SIMPLE_SIMILARITY_THRESHOLD}% and IoU >= ${SIMPLE_IOU_THRESHOLD_PERCENT}%)`,
)

progress.setTotal(svgFiles.length + totalPairs + candidatePairs.length)
progress.setLabel(`${scopeName} pipeline step 3/3 looks-same`)
const looksSamePairs = await runLooksSameOnCandidates(entries, candidatePairs, progress)

for (const pairKey of looksSamePairs) {
  const [leftIndexRaw, rightIndexRaw] = pairKey.split(':')
  const leftIndex = Number(leftIndexRaw)
  const rightIndex = Number(rightIndexRaw)

  if (!Number.isInteger(leftIndex) || !Number.isInteger(rightIndex)) {
    continue
  }

  addEdgeByIndexes(duplicateGraph, entries, leftIndex, rightIndex)
}

console.log(`  ${scopeName} step 3/3 looks-same duplicates: ${looksSamePairs.size}`)

const duplicateGroups = buildDuplicateGroups(duplicateGraph, iconsDir)
  .map((group) => ({
    ...group,
    duplicateIcons: group.duplicateIcons.filter((duplicateIcon) => {
      return !isAllowedDuplicateIconPair(scopeName, group.iconName, duplicateIcon)
    }),
  }))
  .filter((group) => group.duplicateIcons.length > 0)

console.log(`  ${scopeName} done in ${formatDuration(Date.now() - startAt)}; groups: ${duplicateGroups.length}`)
console.log(`\nicon-check finished in ${formatDuration(Date.now() - startAt)}`)

if (duplicateGroups.length === 0) {
  console.log('✅ No duplicate icons found')
  process.exit(0)
}

console.error('❌ Duplicate icons found:')
console.error(
  `Pipeline: step1 exact-hash -> step2 simple-similarity>=${SIMPLE_SIMILARITY_THRESHOLD}% + IoU>=${SIMPLE_IOU_THRESHOLD_PERCENT}% -> step3 looks-same (strict equal only, tolerance=${LOOKS_SAME_OPTIONS.tolerance}, ignoreAntialiasing=${LOOKS_SAME_OPTIONS.ignoreAntialiasing})`,
)
console.error(`\n[${scopeName}]`)

for (const group of duplicateGroups) {
  console.error(`${group.iconName} - [${group.duplicateIcons.join(', ')}]`)
}

process.exit(1)
