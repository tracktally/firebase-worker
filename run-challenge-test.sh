#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )



function check_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: '$1' is not installed"
    exit 1
  fi
}

check_bin node
check_bin npm
check_bin npx


cd "$SCRIPT_DIR"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

set -x
npx ts-node ./run/challenge-run-test.ts