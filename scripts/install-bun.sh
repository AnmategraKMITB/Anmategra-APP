#!/bin/sh
# Memasang Bun versi yang dipakai repo ini ke $BUN_INSTALL/bin (bawaan ~/.bun/bin).
#
# Versinya canary yang dipatok persis: `bun lint` dan `bun test --isolate=modules`
# belum ada di rilis stabil. Biner diambil dari tarball npm @oven/bun-* (tidak
# berubah setelah terbit, beda dengan tag `canary` di GitHub) dan dicek sha512-nya.
# Dipakai juga oleh .github/actions/setup-bun di CI, jadi lokal dan CI sama.
set -eu

VERSION=1.4.5-canary.20261123.1

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)
    if ldd --version 2>&1 | grep -qi musl; then
      PKG=linux-x64-musl
      SHA=9f2e48cb2379d82fd16b24c62eb67091c77f46c8dc921b85bafbe4296d96e95cac51399e153a80aca9be3476ee77d492b645fd1a0322037621cf99482ed838fc
    else
      PKG=linux-x64
      SHA=ded17e0511f09f75ec6c1f2fa6d9c7202af4fe603789abf4d3fb1c8753a14fad3d734a775d8214353f0933113e3dd080417e625f35ed2b28e3a7e0c9cfb752b2
    fi
    ;;
  Linux-aarch64)
    PKG=linux-aarch64
    SHA=75dbfc5b50d0749df2b9d9a8cb3972ee227941599ac747a6d55a3e929e690b5c38f4462e82f42df83b3326e8c03d8020b3ac0ddbc9d9d8d7e7c846cd64d63c47
    ;;
  Darwin-arm64)
    PKG=darwin-aarch64
    SHA=c9226f2ed4ae3613429a5beba61f9b8d5c1a523fc21061ac0b5f77c78053f3e027364363be715ad6484477f1e19708b603535328fbfb437c700d297cfce1e336
    ;;
  *)
    echo "Platform $(uname -s)-$(uname -m) belum didukung skrip ini." >&2
    exit 1
    ;;
esac

DEST="${BUN_INSTALL:-$HOME/.bun}/bin"
REVISION=dac8e3b
if [ -x "$DEST/bun" ] && "$DEST/bun" --revision 2>/dev/null | grep -q "$REVISION"; then
  echo "Bun $VERSION sudah terpasang di $DEST."
  exit 0
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
url="https://registry.npmjs.org/@oven/bun-$PKG/-/bun-$PKG-$VERSION.tgz"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$url" -o "$tmp/bun.tgz"
else
  wget -qO "$tmp/bun.tgz" "$url"
fi

if command -v sha512sum >/dev/null 2>&1; then
  actual=$(sha512sum "$tmp/bun.tgz" | cut -d' ' -f1)
else
  actual=$(shasum -a 512 "$tmp/bun.tgz" | cut -d' ' -f1)
fi
if [ "$actual" != "$SHA" ]; then
  echo "sha512 tarball Bun tidak cocok (dapat $actual)." >&2
  exit 1
fi

tar -xzf "$tmp/bun.tgz" -C "$tmp"
mkdir -p "$DEST"
mv "$tmp/package/bin/bun" "$DEST/bun"
chmod +x "$DEST/bun"
ln -sf bun "$DEST/bunx"
echo "Bun $("$DEST/bun" --revision) terpasang di $DEST."
