const args = process.argv.slice(3)

if (args.includes('--help') || args.includes('-h')) {
  printHelp()
  process.exit(0)
}

if (args.length > 0) {
  printHelp()
  process.exit(1)
}

await import('../translate/sync.js')

function printHelp() {
  console.log(`brick translate-sync

Usage:
  brick translate-sync

Notes:
  Scans source files and regenerates translation sample.json files
  Removes obsolete generated translation directories
  Verifies and normalizes translation JSON key ordering`)
}
