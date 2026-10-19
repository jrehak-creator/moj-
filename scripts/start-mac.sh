#!/usr/bin/env bash
set -euo pipefail

nest_project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$nest_project_dir"

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf '%s\n' 'This helper is for a Mac. On other systems, follow README.md.'
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' 'First install Node.js 24 LTS using the macOS Installer (.pkg) from https://nodejs.org/en/download.'
  printf '%s\n' 'Then close Terminal, open it again, and repeat the start command.'
  exit 1
fi

if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) === 24 ? 0 : 1)'; then
  printf '%s\n' 'This prototype uses Node.js 24 LTS. Install version 24 from https://nodejs.org/en/download.'
  printf '%s\n' 'Then close Terminal, open it again, and repeat the start command.'
  exit 1
fi

if [[ ! -f dist/index.html ]]; then
  printf '%s\n' 'The ready-to-run web files are missing. Extract the complete Mac test package first.'
  printf '%s\n' 'If using the source checkout, follow the build instructions in README.md.'
  exit 1
fi

printf '\n%s\n\n' 'Preparing Nest. The first start needs an internet connection.'
npm ci --omit=dev --cache "$nest_project_dir/.npm-cache" --no-audit --no-fund
printf '\n%s\n' 'Keep this Terminal window open and keep your Mac awake during the iPad test.'
printf '%s\n' 'Press Control+C in this window when you want to stop Nest.'
node scripts/ipad-address.mjs
printf '\n'
exec node server/index.mjs
