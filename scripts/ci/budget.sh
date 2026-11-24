#!/bin/sh
# Batas waktu per job. Job yang lebih lambat dari anggarannya gagal, supaya CI
# tidak pelan-pelan melambat tanpa ada yang sadar.
#
#   budget.sh check <detik>   langkah terakhir: gagal bila melewati anggaran
#
# Langkah pertama job menulis waktu mulai ke $RUNNER_TEMP/job-start (sebaris,
# tanpa checkout). Waktu "Set up job" sebelumnya (~1-2 detik) tidak terhitung.
set -eu

file="${RUNNER_TEMP:-/tmp}/job-start"
case "$1" in
  check)
    elapsed=$(($(date +%s) - $(cat "$file")))
    echo "Job berjalan ${elapsed}s (anggaran $2s)."
    if [ "$elapsed" -gt "$2" ]; then
      echo "::error title=Melewati anggaran waktu::Job ini ${elapsed}s, anggarannya $2s. Cari langkah yang melambat di log, jangan naikkan anggarannya."
      exit 1
    fi
    ;;
esac
