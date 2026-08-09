#!/usr/bin/env python3
"""
One-shot acquisition of the official ITB lembaga registry.

Source: https://kemahasiswaan.itb.ac.id/students-organization
(Direktorat Kemahasiswaan ITB — three server-rendered HTML tables:
HIMPUNAN / UKM / KM. No auth, no JS.)

Output: src/server/db/seeding/data/raw/lembaga-<YYYY-MM-DD>.json

Stdlib-only by design — this is a throwaway capture script, not a
maintained scraper. The JSON artifact is the durable deliverable;
Stage 2 (enrichment) re-runs against it without refetching.

Usage:
    python3 scripts/fetch-lembaga.py                  # live fetch
    python3 scripts/fetch-lembaga.py --html page.html # parse a saved page
"""

import argparse
import datetime
import html
import json
import os
import re
import sys
import urllib.request

SOURCE_URL = "https://kemahasiswaan.itb.ac.id/students-organization"
OUT_DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "src",
    "server",
    "db",
    "seeding",
    "data",
    "raw",
)

# table id -> tab/type annotation
TABLE_TABS = {
    "table_id": "himpunan",
    "table_id_ukm": "ukm",
    "table_id_km": "km",
}


def strip_tags(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def fetch(url: str) -> str:
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 (anmategra-registry-capture)"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def parse_tables(page: str) -> list:
    lembaga = []
    for m in re.finditer(r'<table\s+id="([^"]+)"[^>]*>(.*?)</table>', page, re.S):
        table_id, body = m.group(1), m.group(2)
        tab = TABLE_TABS.get(table_id)
        if tab is None:
            continue  # unknown table — ignore
        for tr in re.findall(r"<tr>(.*?)</tr>", body, re.S):
            tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
            if len(tds) < 7:
                continue  # header or malformed row
            lembaga.append(
                {
                    "no": strip_tags(tds[0]),
                    "tab": tab,
                    "nama": strip_tags(tds[2]),
                    "singkatan": strip_tags(tds[3]),
                    "visi": strip_tags(tds[4]),
                    "misi": strip_tags(tds[5]),
                    "status": strip_tags(tds[6]),
                }
            )
    return lembaga


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--html",
        metavar="FILE",
        help="parse a saved HTML page instead of fetching live",
    )
    args = ap.parse_args()

    if args.html:
        print(f"Reading saved page: {args.html}")
        page = open(args.html, encoding="utf-8").read()
    else:
        print(f"Fetching: {SOURCE_URL}")
        page = fetch(SOURCE_URL)

    lembaga = parse_tables(page)
    counts = {}
    for row in lembaga:
        counts[row["tab"]] = counts.get(row["tab"], 0) + 1

    print(f"Parsed {len(lembaga)} rows: {counts}")
    if not lembaga:
        print("ERROR: no rows parsed — page structure changed?", file=sys.stderr)
        return 1

    out_path = os.path.join(
        os.path.abspath(OUT_DIR),
        f"lembaga-{datetime.date.today().isoformat()}.json",
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    artifact = {
        "source": SOURCE_URL,
        "fetched_at": datetime.datetime.now().astimezone().isoformat(),
        "note": "logo column omitted (all rows use the ITB placeholder image)",
        "counts": counts,
        "lembaga": lembaga,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(artifact, f, ensure_ascii=False, indent=2)
    print(f"Wrote: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
