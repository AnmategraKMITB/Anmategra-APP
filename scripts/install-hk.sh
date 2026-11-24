#!/bin/sh
# Memasang hk (hook git, lihat hk.pkl) versi yang dipatok ke node_modules/.bin,
# lalu memasang hook-nya. Dijalankan script `prepare` setiap `bun install`.
# Biner diambil dari rilis GitHub jdx/hk dan dicek sha256-nya.
set -eu

# CI tidak butuh hook; image Docker tidak punya .git.
if [ -n "${CI:-}" ] || ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

VERSION=2.13.0

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)
    if ldd --version 2>&1 | grep -qi musl; then
      TARGET=x86_64-unknown-linux-musl
      SHA=3d5ae62e2befe95fa6fc7ffd63a0876c3efe3409634fbd6561b8bb0be787eeae
    else
      TARGET=x86_64-unknown-linux-gnu
      SHA=8ff0b29c9925d73df9b14af7fc43ace86de03db73eafa3046750fce5c39e1955
    fi
    ;;
  Linux-aarch64)
    TARGET=aarch64-unknown-linux-gnu
    SHA=490196a4e638991c671f42941d72ade4d00b14750145f34fc64377b49fc070bb
    ;;
  Darwin-arm64)
    TARGET=aarch64-apple-darwin
    SHA=64efc441dc0858a175909fd6253ddd6c540da80e7d1bd2a2ad0ec9c0cdab3d97
    ;;
  *)
    echo "hk: platform $(uname -s)-$(uname -m) belum didukung skrip ini; hook tidak dipasang." >&2
    exit 0
    ;;
esac

BIN=node_modules/.bin/hk
if ! { [ -x "$BIN" ] && "$BIN" --version 2>/dev/null | grep -q "$VERSION"; }; then
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  url="https://github.com/jdx/hk/releases/download/v$VERSION/hk-$TARGET.tar.gz"
  curl -fsSL "$url" -o "$tmp/hk.tgz"
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$tmp/hk.tgz" | cut -d' ' -f1)
  else
    actual=$(shasum -a 256 "$tmp/hk.tgz" | cut -d' ' -f1)
  fi
  if [ "$actual" != "$SHA" ]; then
    echo "sha256 hk tidak cocok (dapat $actual)." >&2
    exit 1
  fi
  tar -xzf "$tmp/hk.tgz" -C "$tmp" hk
  mkdir -p node_modules/.bin
  mv "$tmp/hk" "$BIN"
  chmod +x "$BIN"
fi

# Husky lama memasang core.hooksPath ke .husky/_; hk memakai .git/hooks.
if git config --get core.hooksPath 2>/dev/null | grep -q husky; then
  git config --unset core.hooksPath || true
  git config --worktree --unset core.hooksPath 2>/dev/null || true
fi
"$BIN" install
