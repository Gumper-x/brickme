import { exec } from 'child_process'
import fs from 'fs'
import { globSync } from 'glob'
import path from 'path'
import { fileURLToPath } from 'url'

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

async function updateJson(jsonData) {
  let counter = 0
  const maxCount =
    Object.keys(jsonData.devDependencies || {}).length + Object.keys(jsonData.dependencies || {}).length

  for (const [key, value] of Object.entries(jsonData.dependencies || {})) {
    if (isWorkspaceVersion(value)) {
      counter += 1
      continue
    }

    exec(`npm view ${key} version`, (error, stdout) => {
      counter += 1

      if (error) {
        console.info(error.message)
        return
      }

      jsonData.dependencies[key] = String(stdout).trim().replace('\n', '')
    })
  }

  for (const [key, value] of Object.entries(jsonData.devDependencies || {})) {
    if (isWorkspaceVersion(value)) {
      counter += 1
      continue
    }

    exec(`npm view ${key} version`, (error, stdout) => {
      counter += 1

      if (error) {
        console.info(error.message)
        return
      }

      jsonData.devDependencies[key] = String(stdout).trim().replace('\n', '')
    })
  }

  const op = new Promise((resolve) => {
    const timer = setInterval(() => {
      if (counter === maxCount) {
        resolve(jsonData)
        clearInterval(timer)
      }
    }, 300)
  })

  return await op
}

function isWorkspaceVersion(value) {
  return value === 'workspace:*' || value === 'workspace: *'
}
