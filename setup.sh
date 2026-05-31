#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIN_NODE_MAJOR=20
SKIP_NODE_INSTALL="${D3CODE_SKIP_NODE_INSTALL:-0}"
SKIP_NPM_LINK="${D3CODE_SKIP_NPM_LINK:-0}"
NODE_DIST_BASE="${D3CODE_NODE_DIST_BASE:-https://nodejs.org/dist/latest-v20.x}"

info() { printf '\033[1;34m%s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*" >&2; }
fail() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

node_major() {
  node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0'
}

have_node_20() {
  need_cmd node && [ "$(node_major)" -ge "$MIN_NODE_MAJOR" ] && need_cmd npm
}

install_node_rhel() {
  if ! need_cmd dnf && ! need_cmd yum; then
    return 1
  fi
  local pkg_cmd="dnf"
  need_cmd dnf || pkg_cmd="yum"

  info "Installing Node.js 20 and npm with ${pkg_cmd}..."
  if [ "$(id -u)" -eq 0 ]; then
    if [ "$pkg_cmd" = "dnf" ]; then
      dnf module reset nodejs -y || true
      dnf module enable nodejs:20 -y || true
    fi
    "$pkg_cmd" install -y nodejs npm
  elif need_cmd sudo; then
    if [ "$pkg_cmd" = "dnf" ]; then
      sudo dnf module reset nodejs -y || true
      sudo dnf module enable nodejs:20 -y || true
    fi
    sudo "$pkg_cmd" install -y nodejs npm
  else
    return 1
  fi
}

install_node_debian() {
  if ! need_cmd apt-get; then
    return 1
  fi
  info "Installing Node.js and npm with apt-get..."
  if [ "$(id -u)" -eq 0 ]; then
    apt-get update
    apt-get install -y nodejs npm
  elif need_cmd sudo; then
    sudo apt-get update
    sudo apt-get install -y nodejs npm
  else
    return 1
  fi
}

install_node_macos() {
  if ! need_cmd brew; then
    return 1
  fi
  info "Installing Node.js with Homebrew..."
  brew install node
}

fetch_url() {
  local url="$1"
  local out="${2:-}"
  if need_cmd curl; then
    if [ -n "$out" ]; then
      curl -fsSL "$url" -o "$out"
    else
      curl -fsSL "$url"
    fi
    return
  fi
  if need_cmd wget; then
    if [ -n "$out" ]; then
      wget -qO "$out" "$url"
    else
      wget -qO- "$url"
    fi
    return
  fi
  return 1
}

install_node_tarball() {
  if ! need_cmd tar; then
    return 1
  fi
  local machine node_arch
  machine="$(uname -m)"
  case "$machine" in
    x86_64|amd64) node_arch="x64" ;;
    aarch64|arm64) node_arch="arm64" ;;
    *) return 1 ;;
  esac

  local tmp_dir shasums archive install_root node_dir archive_path
  tmp_dir="$(mktemp -d)"
  install_root="$ROOT_DIR/.local/node"
  trap 'rm -rf "$tmp_dir"' RETURN

  info "Installing Node.js 20 from official Node.js binary archive..."
  shasums="$(fetch_url "$NODE_DIST_BASE/SHASUMS256.txt")" || return 1
  archive="$(printf '%s\n' "$shasums" | awk '{print $2}' | grep "linux-${node_arch}\.tar\.xz$" | head -n 1)"
  if [ -z "$archive" ]; then
    return 1
  fi
  archive_path="$tmp_dir/$archive"
  fetch_url "$NODE_DIST_BASE/$archive" "$archive_path" || return 1

  mkdir -p "$(dirname "$install_root")"
  rm -rf "$install_root"
  mkdir -p "$install_root"
  tar -xJf "$archive_path" -C "$install_root" --strip-components=1
  export PATH="$install_root/bin:$PATH"

  node_dir="$install_root/bin/node"
  [ -x "$node_dir" ]
}

ensure_node() {
  if have_node_20; then
    ok "Node.js $(node --version) and npm $(npm --version) found."
    return
  fi

  if [ "$SKIP_NODE_INSTALL" = "1" ]; then
    fail "Node.js 20+ and npm are required. Install them, then rerun setup.sh."
  fi

  install_node_rhel || install_node_debian || install_node_macos || install_node_tarball || true

  if ! have_node_20; then
    fail "Node.js 20+ and npm are still missing. Install Node.js 20+ manually, then rerun setup.sh."
  fi
  ok "Node.js $(node --version) and npm $(npm --version) ready."
}

detect_d3() {
  if need_cmd d3; then
    ok "Rocket D3 detected at $(command -v d3)."
    info "D3 version:"
    d3 -V 2>&1 || warn "d3 -V failed; D3 may still require environment/session setup."
    return
  fi
  warn "Rocket D3 was not found in PATH."
  warn "D3 Code can still run, but live local profiles need a server where the d3 command is available."
}

main() {
  info "D3 Code setup"
  cd "$ROOT_DIR"

  ensure_node

  info "Installing npm dependencies..."
  npm install

  info "Building D3 Code..."
  npm run build

  if [ "$SKIP_NPM_LINK" != "1" ]; then
    info "Linking d3code command..."
    npm link
  else
    warn "Skipping npm link because D3CODE_SKIP_NPM_LINK=1."
  fi

  detect_d3

  ok "D3 Code setup complete."
  printf '\nNext steps:\n'
  printf '  d3code setup\n'
  printf '  d3code profile-add-local --name prod --account DM --entry "d3" --prompt ":" --session persistent\n'
  printf '  d3code\n'
}

main "$@"
