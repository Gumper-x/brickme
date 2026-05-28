import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const args = process.argv.slice(3)

if (args.includes('--help') || args.includes('-h')) {
  printHelp()
  process.exit(0)
}

if (args.length > 0) {
  printHelp()
  process.exit(1)
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(currentDir, '../../../..')
const packageJsonPaths = findPackageJsonPaths()
const localPackageNames = collectLocalBrickflowPackageNames(packageJsonPaths)

if (localPackageNames.length === 0) {
  console.log('No local @brickflow/* packages found in the repository')
  process.exit(0)
}

const latestVersions = new Map()

for (const packageName of localPackageNames) {
  const version = await readLatestVersion(packageName)

  if (version) {
    latestVersions.set(packageName, version)
  }
}

if (latestVersions.size === 0) {
  throw new Error('Could not resolve latest versions for local @brickflow/* packages')
}

console.log('\x1b[32m', '\rBrickflow package upgrade')

let changedFiles = 0
let index = 0

for (const packageJsonPath of packageJsonPaths) {
  index += 1

  const packageJson = readJson(packageJsonPath)
  const before = JSON.stringify(packageJson)

  updateDependencySections(packageJson, latestVersions)

  if (JSON.stringify(packageJson) !== before) {
    writeJson(packageJsonPath, packageJson)
    changedFiles += 1
    console.log(`\n📦 Updated ${getPackageLabel(packageJsonPath)}`)
  }

  const percent = Math.round((index * 100) / packageJsonPaths.length)
  process.stdout.write(`\r🔩 Upgrade: [${'█'.repeat(Math.round(percent / 10)).padEnd(10, ' ')}] ${percent}%`)
}

process.stdout.write('\n')
console.log(`Updated ${changedFiles} package.json file(s)`)
console.log('\x1b[0m', '')

function collectLocalBrickflowPackageNames(filePaths) {
  return filePaths
    .map((filePath) => readJson(filePath).name)
    .filter((packageName) => isBrickflowPackageName(packageName))
    .sort()
}

function findPackageJsonPaths() {
  return walkDirectoryForPackageJson(workspaceRoot).sort()
}

function getDependencySections(packageJson) {
  return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    .map((sectionName) => ({
      name: sectionName,
      value: packageJson[sectionName],
    }))
    .filter((section) => section.value && typeof section.value === 'object')
}

function getPackageLabel(packageJsonPath) {
  const relativePath = path.relative(workspaceRoot, packageJsonPath).replace(/\\/g, '/')
  const packageDir = path.dirname(relativePath)

  return packageDir === '.' ? 'root' : packageDir
}

function isBrickflowPackageName(packageName) {
  return typeof packageName === 'string' && packageName.startsWith('@brickflow/')
}

function printHelp() {
  console.log(`brick upgrade

Usage:
  brick upgrade

Notes:
  Finds local @brickflow/* package names from package.json files in the repository
  Fetches the latest published version for each of those packages
  Updates matching dependencies, devDependencies, peerDependencies and optionalDependencies in all package.json files`)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function readLatestVersion(packageName) {
  return new Promise((resolve) => {
    exec(`npm view ${packageName} version`, (error, stdout) => {
      if (error) {
        console.warn(`Skipping ${packageName}: ${error.message}`)
        resolve(null)
        return
      }

      resolve(String(stdout).trim().replace('\n', ''))
    })
  })
}

function updateDependencySections(packageJson, latestVersionsMap) {
  for (const section of getDependencySections(packageJson)) {
    for (const dependencyName of Object.keys(section.value)) {
      const latestVersion = latestVersionsMap.get(dependencyName)

      if (latestVersion) {
        section.value[dependencyName] = latestVersion
      }
    }
  }
}

function walkDirectoryForPackageJson(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true })
  const filePaths = []

  for (const entry of entries) {
    if (entry.name === 'node_modules') {
      continue
    }

    const entryPath = path.join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      filePaths.push(...walkDirectoryForPackageJson(entryPath))
      continue
    }

    if (entry.isFile() && entry.name === 'package.json') {
      filePaths.push(entryPath)
    }
  }

  return filePaths
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}
