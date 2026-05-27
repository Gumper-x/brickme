import { exec } from 'child_process'
import fs from 'fs'
import { globSync } from 'glob'
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
const packageJsonPaths = globSync('**/package.json', {
  absolute: true,
  cwd: workspaceRoot,
  ignore: ['**/node_modules/**'],
}).sort()

console.log('\x1b[32m', '\rPackage update')

let index = 0

for await (const packageJsonPath of packageJsonPaths) {
  index += 1

  const packageJson = JSON.parse(
    fs.readFileSync(packageJsonPath, {
      encoding: 'utf-8',
    }),
  )

  await updateJson(packageJson)
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)

  const percent = Math.round((index * 100) / packageJsonPaths.length)
  process.stdout.write(`\r💎 Updating: [${'🔩'.repeat((percent * 10) / 100)}]  ${percent}%`)
}

process.stdout.write('\n')
console.log('\x1b[0m', '')

function isWorkspaceVersion(value) {
  return value === 'workspace:*' || value === 'workspace: *'
}

function printHelp() {
  console.log(`brick latest

Usage:
  brick latest

  Notes:
  Scans all package.json files in the repository, including the root one
  Updates dependencies and devDependencies to the latest npm versions
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

async function updateJson(jsonData) {
  await Promise.all([
    ...Object.entries(jsonData.dependencies || {}).map(async ([key, value]) => {
      if (isWorkspaceVersion(value)) {
        return
      }

      const version = await readLatestVersion(key)

      if (version) {
        jsonData.dependencies[key] = version
      }
    }),
    ...Object.entries(jsonData.devDependencies || {}).map(async ([key, value]) => {
      if (isWorkspaceVersion(value)) {
        return
      }

      const version = await readLatestVersion(key)

      if (version) {
        jsonData.devDependencies[key] = version
      }
    }),
  ])
}
