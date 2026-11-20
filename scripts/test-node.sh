#!/bin/sh
set -eu

test_root=$(mktemp -d "${TMPDIR:-/tmp}/d3code-test.XXXXXX")
trap 'rm -rf "$test_root"' EXIT
mkdir "$test_root/tmp"
export D3CODE_HOME="$test_root/home"
export TMPDIR="$test_root/tmp"
# Keep real, user-installed D3 wrappers out of the mock-session tests.
PATH=$(printf '%s\n' "$PATH" | tr ':' '\n' | grep -vFx "$HOME/.local/bin" | paste -sd ':' -)
export PATH

npm run build
node --test --test-reporter=dot dist/test/*.test.js
