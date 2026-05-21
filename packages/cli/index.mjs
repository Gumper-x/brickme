#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const cliDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(cliDir, '../..')
const workspaceRoots = ['apps', 'packages']

async function getWorkspacePackageJsonPaths() {
  const packagePaths = []

  for (const workspaceRoot of workspaceRoots) {
    const rootPath = path.join(repoRoot, workspaceRoot)
    const entries = await readdir(rootPath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      packagePaths.push(path.join(rootPath, entry.name, 'package.json'))
    }
  }

  return packagePaths
}

async function main() {
  const [command] = process.argv.slice(2)

  switch (command) {
    case 'latest':
      await runLatest()
      return
    default:
      printHelp()
      process.exitCode = 1
  }
}

function printHelp() {
  console.log(`brick cli

Usage:
  brick latest`)
}

function renderProgress(percent) {
  const completed = Math.round(percent / 10)
  return `${'#'.repeat(completed)}${'.'.repeat(10 - completed)}`
}

async function runLatest() {
  console.log('\x1b[32mPackage update')

  const packagePaths = await getWorkspacePackageJsonPaths()
  let index = 0

  for (const packagePath of packagePaths) {
    index += 1

    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
    await updatePackageVersions(packageJson)
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

    const percent = Math.round((index * 100) / packagePaths.length)
    process.stdout.write(`\rUpdating: [${renderProgress(percent)}] ${percent}%`)
  }

  process.stdout.write('\n')
  console.log('\x1b[0m')
}

async function updatePackageVersions(packageJson) {
  const dependencyEntries = [
    ...Object.entries(packageJson.dependencies || {}).map(([name, version]) => ({
      group: 'dependencies',
      name,
      version,
    })),
    ...Object.entries(packageJson.devDependencies || {}).map(([name, version]) => ({
      group: 'devDependencies',
      name,
      version,
    })),
  ]

  await Promise.all(
    dependencyEntries.map(async ({ group, name, version }) => {
      if (version === 'workspace:*' || version === 'workspace: *') {
        return
      }

      try {
        const { stdout } = await execFileAsync('npm', ['view', name, 'version'])
        packageJson[group][name] = stdout.trim()
      } catch (error) {
        console.info(error instanceof Error ? error.message : String(error))
      }
    }),
  )
}

await main()
