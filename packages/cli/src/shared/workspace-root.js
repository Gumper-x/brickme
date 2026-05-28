import fs from 'fs'
import path from 'path'

const WORKSPACE_MARKERS = ['.git', 'pnpm-workspace.yaml', 'lerna.json', 'turbo.json']

export function resolveWorkspaceRoot(startDir = process.cwd()) {
  let currentDir = path.resolve(startDir)
  let packageRoot = null

  while (true) {
    if (hasAnyFile(currentDir, WORKSPACE_MARKERS)) {
      return currentDir
    }

    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      packageRoot = currentDir
    }

    const parentDir = path.dirname(currentDir)

    if (parentDir === currentDir) {
      return packageRoot || startDir
    }

    currentDir = parentDir
  }
}

function hasAnyFile(directoryPath, fileNames) {
  return fileNames.some((fileName) => fs.existsSync(path.join(directoryPath, fileName)))
}
