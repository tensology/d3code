#!/usr/bin/env bash
set -euo pipefail

cd /var/www/d3code
if [[ $(git branch --show-current) != main || -n $(git status --porcelain --untracked-files=no) ]]; then
  echo "D3Code deploy requires a clean main checkout." >&2
  exit 1
fi

git fetch --quiet origin main
git merge --ff-only refs/remotes/origin/main
git submodule update --init -- reference/rocket-mvbasic
revision=$(git rev-parse HEAD)
state_dir=/var/lib/d3code
marker="$state_dir/deployed-revision"
if [[ -f "$marker" && $(<"$marker") == "$revision" ]]; then
  exit 0
fi

npm run build:app
systemctl restart d3code@51.service
systemctl is-active --quiet d3code@51.service

status=""
for attempt in {1..25}; do
  status=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 2 http://127.0.0.1:3737/api/status) || true
  if [[ "$status" == 401 ]]; then break; fi
  sleep 1
done
if [[ "$status" != 401 ]]; then
  echo "D3Code did not return its authenticated service status after restart (HTTP $status)." >&2
  exit 1
fi

temporary=$(mktemp "$state_dir/.deployed-revision.XXXXXX")
trap 'rm -f "$temporary"' EXIT
printf '%s\n' "$revision" > "$temporary"
mv "$temporary" "$marker"
echo "D3Code deployed $revision"
