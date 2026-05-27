#!/usr/bin/env node

import { access, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const cliDir = path.dirname(fileURLToPath(import.meta.url))
const commandsDir = path.join(cliDir, 'src')

async function getAvailableCommands() {
  const entries = await readdir(commandsDir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function isValidCommandName(command) {
  return typeof command === 'string' && /^[a-z0-9-]+$/i.test(command)
}

async function main() {
  const [command] = process.argv.slice(2)
  const commands = await getAvailableCommands()

  if (!command || !(await runCommand(command))) {
    printHelp(commands)
    process.exitCode = 1
  }
}

function printHelp(commands) {
  console.log(`brick cli

Usage:
  brick <command>

Commands:
  ${commands.join('\n  ')}`)
}

async function runCommand(command) {
  if (!isValidCommandName(command)) {
    return false
  }

  const commandEntry = path.join(commandsDir, command, 'index.js')

  try {
    await access(commandEntry)
  } catch {
    return false
  }

  await import(pathToFileURL(commandEntry).href)
  return true
}

await main()
