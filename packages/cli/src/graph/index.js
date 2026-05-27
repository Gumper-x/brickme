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

const dependenciesMap = new Map()

for (const packageJsonPath of packageJsonPaths) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const packageLabel = getPackageLabel(packageJsonPath)

  addDependencies(packageLabel, packageJson.dependencies)
  addDependencies(packageLabel, packageJson.devDependencies)
}

const table = {}

for (const [dependencyName, versionsByPackage] of dependenciesMap) {
  const uniqueVersions = new Set(Object.values(versionsByPackage))

  if (uniqueVersions.size > 1) {
    table[dependencyName] = versionsByPackage
  }
}

console.table(table)

function addDependencies(packageLabel, dependencyGroup) {
  if (!dependencyGroup) {
    return
  }

  for (const [dependencyName, version] of Object.entries(dependencyGroup)) {
    const currentVersions = dependenciesMap.get(dependencyName) ?? {}
    dependenciesMap.set(dependencyName, {
      ...currentVersions,
      [packageLabel]: version,
    })
  }
}

function getPackageLabel(packageJsonPath) {
  const relativePath = path.relative(workspaceRoot, packageJsonPath).replace(/\\/g, '/')
  const packageDir = path.dirname(relativePath)

  return packageDir === '.' ? 'root' : packageDir
}
