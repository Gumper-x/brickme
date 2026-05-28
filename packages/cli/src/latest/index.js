import { exec } from 'child_process'
import fs from 'fs'
import { globSync } from 'glob'

import { resolveWorkspaceRoot } from '../shared/workspace-root.js'

const args = process.argv.slice(3)
const filters = args.filter((arg) => arg !== '--help' && arg !== '-h')

if (args.includes('--help') || args.includes('-h')) {
  printHelp()
  process.exit(0)
}

if (filters.some((filter) => !isValidFilter(filter))) {
  printHelp()
  process.exit(1)
}

const workspaceRoot = resolveWorkspaceRoot()
const packageJsonPaths = globSync('**/package.json', {
  absolute: true,
  cwd: workspaceRoot,
  ignore: ['**/node_modules/**'],
}).sort()
const latestVersions = await readLatestVersions(packageJsonPaths, filters)

if (latestVersions.size === 0) {
  const scopeLabel = filters.length > 0 ? ` matching "${filters.join('", "')}"` : ''

  console.log(`No packages found${scopeLabel}`)
  process.exit(0)
}

console.log('\x1b[32m', '\rPackage update')

let index = 0

for await (const packageJsonPath of packageJsonPaths) {
  index += 1

  const packageJson = JSON.parse(
    fs.readFileSync(packageJsonPath, {
      encoding: 'utf-8',
    }),
  )

  updateJson(packageJson, latestVersions)
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)

  const percent = Math.round((index * 100) / packageJsonPaths.length)
  process.stdout.write(`\r💎 Updating: [${'🔩'.repeat((percent * 10) / 100)}]  ${percent}%`)
}

process.stdout.write('\n')
console.log('\x1b[0m', '')

function collectPackageNames(filePaths, packageFilters) {
  const packageNames = new Set()

  for (const filePath of filePaths) {
    const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    for (const [dependencyName, dependencyVersion] of Object.entries(packageJson.dependencies || {})) {
      if (shouldUpdateDependency(dependencyName, dependencyVersion, packageFilters)) {
        packageNames.add(dependencyName)
      }
    }

    for (const [dependencyName, dependencyVersion] of Object.entries(packageJson.devDependencies || {})) {
      if (shouldUpdateDependency(dependencyName, dependencyVersion, packageFilters)) {
        packageNames.add(dependencyName)
      }
    }
  }

  return [...packageNames].sort()
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}

function isValidFilter(value) {
  return typeof value === 'string' && value.length > 0
}

function isWorkspaceVersion(value) {
  return value === 'workspace:*' || value === 'workspace: *'
}

function matchesAnyFilter(packageName, packageFilters) {
  if (packageFilters.length === 0) {
    return true
  }

  return packageFilters.some((filter) => matchesFilter(packageName, filter))
}

function matchesFilter(packageName, filter) {
  const pattern = escapeRegex(filter).replace(/\*/g, '.*').replace(/\?/g, '.')

  return new RegExp(`^${pattern}$`).test(packageName)
}

function printHelp() {
  console.log(`brick latest

Usage:
  brick latest
  brick latest "@brickflow/*"
  brick latest "vue" "@brickflow/*"

  Notes:
  Scans all package.json files in the repository, including the root one
  Updates dependencies and devDependencies to the latest npm versions
  Optional wildcard filters limit which package names are updated
  Skips workspace:* versions`)
}

function readLatestVersion(packageName) {
  return new Promise((resolve) => {
    exec(`npm view ${packageName} version`, (error, stdout) => {
      if (error) {
        console.info(error.message)
        resolve(null)
        return
      }

      resolve(String(stdout).trim().replace('\n', ''))
    })
  })
}

async function readLatestVersions(filePaths, packageFilters) {
  const packageNames = collectPackageNames(filePaths, packageFilters)
  const versionsMap = new Map()

  await Promise.all(
    packageNames.map(async (packageName) => {
      const version = await readLatestVersion(packageName)

      if (version) {
        versionsMap.set(packageName, version)
      }
    }),
  )

  return versionsMap
}

function shouldUpdateDependency(packageName, version, packageFilters) {
  return !isWorkspaceVersion(version) && matchesAnyFilter(packageName, packageFilters)
}

function updateJson(jsonData, versionsMap) {
  for (const [dependencyName, version] of Object.entries(jsonData.dependencies || {})) {
    if (isWorkspaceVersion(version)) {
      continue
    }

    if (versionsMap.has(dependencyName)) {
      jsonData.dependencies[dependencyName] = versionsMap.get(dependencyName)
    }
  }

  for (const [dependencyName, version] of Object.entries(jsonData.devDependencies || {})) {
    if (isWorkspaceVersion(version)) {
      continue
    }

    if (versionsMap.has(dependencyName)) {
      jsonData.devDependencies[dependencyName] = versionsMap.get(dependencyName)
    }
  }
}
