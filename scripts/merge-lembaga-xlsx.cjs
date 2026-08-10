#!/usr/bin/env node
/**
 * Stage 3 merge (phase 1 = REPORT ONLY, writes nothing into lembaga-official.csv).
 *
 * Reads "Database Lembaga KM ITB" xlsx (sheets HMPS ITB / UKM / BSO) and matches
 * rows against lembaga-official.csv:
 *   pass 1: shared abbreviation tokens (strict) — komisariat rows penalized
 *   pass 2: remaining rows via prodi<->major equality, token containment, Jaccard
 * Emits data/raw/merge-report.csv + summary (unmatched both directions, rumpun).
 *
 * Lembaga-level columns ONLY. Officer columns (NIM, personal email, WhatsApp,
 * Line) are never read, printed, or written — PII stays in the gitignored xlsx.
 *
 * Usage: node scripts/merge-lembaga-xlsx.cjs <path-to-xlsx>
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSV_PATH = path.join(ROOT, 'src/server/db/seeding/data/lembaga-official.csv');
const REPORT = path.join(ROOT, 'src/server/db/seeding/data/raw/merge-report.csv');

const cell = (v) => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object')
    return v.richText ? v.richText.map((r) => r.text).join('') : (v.text ?? String(v));
  const s = String(v).trim();
  return s === '' || s === '-' ? null : s;
};

const MONTHS_ID = {
  januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
  juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
};
const normalizeDate = (value) => {
  const raw = cell(value);
  if (!raw || /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i.exec(raw);
  if (!match) return null;
  const [, day, monthName, year] = match;
  const month = monthName ? MONTHS_ID[monthName.toLowerCase()] : null;
  return day && month && year ? `${year}-${month}-${day.padStart(2, '0')}` : null;
};

const STOP = new Set([
  'himpunan', 'mahasiswa', 'keluarga', 'ikatan', 'unit', 'perkumpulan',
  'persatuan', 'komisariat', 'region', 'eksekutif', 'dan', 'di', 'itb',
  'institut', 'teknologi', 'bandung', 'ganesha', 'kampus', 'cirebon',
]);

const norm = (s) =>
  (s ?? '')
    .toLowerCase()
    .replace(/institut teknologi bandung/g, ' ')
    .replace(/sepak bola/g, 'sepakbola')
    .replace(/[\u2018\u2019\u201c\u201d"']/g, ' ')
    .replace(/\bitb\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// extra words that are NOT distinctive abbreviations — kept out of abbr sets
// only (name matching still uses STOP), so 'teknik' can't tie-match unrelated rows
const ABBR_STOP = new Set([
  ...STOP, 'teknik', 'studi', 'kelompok', 'klub', 'club', 'society',
  'community', 'forum', 'corps', 'korps',
]);
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 1 && !STOP.has(t));
const abbrTokens = (s) =>
  norm(s).split(' ').filter((t) => t.length > 2 && !ABBR_STOP.has(t));
const parens = (s) => ((s ?? '').match(/\(([^)]+)\)/g) ?? []).map((x) => x.slice(1, -1));
const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / new Set([...A, ...B]).size;
};

function readSheet(ws, headerRow, nameKey) {
  const header = ws.getRow(headerRow).values.slice(1).map(cell);
  const idx = (k) => header.findIndex((h) => h && norm(h).startsWith(norm(k)));
  const cols = {
    name: idx(nameKey),
    singkatan: idx('Singkatan Nama Lembaga'),
    prodi: idx('Nama Lengkap Program Studi'),
    rumpun: idx('Fokus Rumpun'),
    lahir: idx('Tanggal Lahir'),
    email: idx('Email Aktif Lembaga'),
    medsos: idx('Media Sosial'),
    anggota: idx('Jumlah Anggota'),
    kampus: idx('Multikampus'),
  };
  const rows = [];
  for (let i = headerRow + 1; i <= ws.rowCount; i++) {
    const v = ws.getRow(i).values.slice(1);
    const get = (c) => (c >= 0 ? cell(v[c]) : null);
    const name = get(cols.name);
    const email = get(cols.email);
    if (!name && !email) continue;
    const anggota = get(cols.anggota);
    rows.push({
      sheet: ws.name, row: i,
      name: name ?? '',
      singkatan: get(cols.singkatan),
      prodi: (get(cols.prodi) ?? '').replace(/^\d+\.\s*/, '') || null,
      rumpun: get(cols.rumpun),
      lahir: normalizeDate(get(cols.lahir)),
      email,
      medsos: get(cols.medsos),
      anggota: anggota && /^\d+$/.test(String(anggota).trim()) ? anggota : null,
      kampus: get(cols.kampus),
    });
  }
  return rows;
}

function loadCsv() {
  const text = fs.readFileSync(CSV_PATH, 'utf-8');
  const [head = '', ...lines] = text.trim().split('\n');
  const cols = head.split(',');
  const parseLine = (line) => {
    const out = [];
    let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') { q = !q; continue; }
      if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  };
  return lines.map((l) => Object.fromEntries(cols.map((c, i) => [c, parseLine(l)[i] ?? ''])));
}

(async () => {
  const xlsx = process.argv[2];
  if (!xlsx) { console.error('usage: node merge-lembaga-xlsx.cjs <xlsx>'); process.exit(1); }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsx);

  const theirs = [
    ...readSheet(wb.getWorksheet('HMPS ITB'), 2, 'Nama Lengkap Lembaga'),
    ...readSheet(wb.getWorksheet('UKM'), 2, 'Nama Unit'),
    ...readSheet(wb.getWorksheet('BSO'), 2, 'Nama BSO'),
  ];
  const mine = loadCsv();

  // abbr = deliberate abbreviations only: parenthesized bits + singkatan column.
  // Full-name tokens are NEVER abbr (they'd share 'teknik' etc. and tie-match).
  const myKeys = mine.map((r) => ({
    r,
    abbr: new Set(parens(r.description).flatMap(abbrTokens)),
    nameT: tokens(r.name),
    major: norm(r.major),
  }));
  const theirKeys = theirs.map((t) => {
    const nameT = tokens(t.name);
    const abbr = new Set([
      ...abbrTokens(t.singkatan ?? ''),
      ...parens(t.name).flatMap(abbrTokens),
      // genuinely short official names ("TEC ITB", "RAKATA ITB") ARE the
      // abbreviation — but strip generic words so they can't tie-match
      ...(nameT.length <= 3 ? nameT.filter((x) => !ABBR_STOP.has(x) && x.length > 2) : []),
    ]);
    return { t, abbr, nameT, prodi: norm(t.prodi) };
  });

  const scorePair = (mk, tk) => {
    const penalty = tk.t.kampus && norm(tk.t.kampus) !== 'ganesha' ? -90 : 0;
    const shared = [...mk.abbr].filter((a) => tk.abbr.has(a));
    if (shared.length > 0 && mk.abbr.size > 0 && tk.abbr.size > 0)
      return { score: 100 + shared.length + penalty, m: `abbr:${shared.join('/')}` };
    if (mk.major && tk.prodi && mk.major === tk.prodi)
      return { score: 50 + penalty, m: `prodi:${tk.prodi}` };
    const j = jaccard(mk.nameT, tk.nameT);
    const subset =
      (mk.nameT.length >= 3 && mk.nameT.every((x) => tk.nameT.includes(x))) ||
      (tk.nameT.length >= 3 && tk.nameT.every((x) => mk.nameT.includes(x)));
    if (subset) return { score: 0.9 + penalty, m: 'name:subset' };
    if (j >= 0.5) return { score: j + penalty, m: `name:j=${j.toFixed(2)}` };
    return null;
  };

  // pass 1: abbr matches only (strict, no greedy name steals)
  const matched = new Set();
  const result = new Map(); // myKey -> {tk, m}
  for (const mk of myKeys) {
    let best = null;
    for (const tk of theirKeys) {
      if (matched.has(tk)) continue;
      const s = scorePair(mk, tk);
      if (s && s.score >= 100 && (!best || s.score > best.score)) best = { tk, ...s };
    }
    if (best) { matched.add(best.tk); result.set(mk, best); }
  }
  // pass 2: everything else
  for (const mk of myKeys) {
    if (result.has(mk)) continue;
    let best = null;
    for (const tk of theirKeys) {
      if (matched.has(tk)) continue;
      const s = scorePair(mk, tk);
      if (s && s.score > 0 && (!best || s.score > best.score)) best = { tk, ...s };
    }
    if (best) { matched.add(best.tk); result.set(mk, best); }
  }

  const report = [];
  for (const mk of myKeys) {
    const hit = result.get(mk);
    const t = hit?.tk.t;
    report.push({
      my_name: mk.r.name, my_type: mk.r.type,
      method: hit ? hit.m : 'NO MATCH',
      sheet: t?.sheet ?? '', xlsx_row: t?.row ?? '',
      their_name: t?.name ?? '', email: t?.email ?? '',
      founding_date: t?.lahir ?? '', member_count: t?.anggota ?? '',
      prodi: t?.prodi ?? '', rumpun: t?.rumpun ?? '',
      kampus: t?.kampus ?? '', has_medsos: t?.medsos ? 'yes' : '',
    });
  }
  const unmatchedTheirs = theirKeys.filter((tk) => !matched.has(tk)).map((tk) => tk.t);

  const firstReport = report[0];
  if (!firstReport) {
    throw new Error(`No baseline rows found in ${CSV_PATH}`);
  }
  const header = Object.keys(firstReport);
  const esc = (v) => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
  fs.writeFileSync(REPORT,
    [header.join(','), ...report.map((r) => header.map((h) => esc(r[h])).join(','))].join('\n') + '\n',
    'utf-8');

  const ok = report.filter((r) => r.method !== 'NO MATCH');
  const byMethod = {};
  for (const r of ok) { const k = r.method.split(':')[0]; byMethod[k] = (byMethod[k] ?? 0) + 1; }
  const emails = ok.filter((r) => r.email);
  const kmEmails = emails.filter((r) => r.email.endsWith('@km.itb.ac.id'));
  const dates = ok.filter((r) => r.founding_date);
  const rumpun = {};
  for (const t of theirs) if (t.sheet === 'UKM' && t.rumpun) rumpun[t.rumpun] = (rumpun[t.rumpun] ?? 0) + 1;

  console.log(`mine: ${mine.length}  theirs: ${theirs.length}`);
  console.log(`matched: ${ok.length}  unmatched mine: ${mine.length - ok.length}  unmatched theirs: ${unmatchedTheirs.length}`);
  console.log(`by method: ${JSON.stringify(byMethod)}`);
  console.log(`emails: ${emails.length} (${kmEmails.length} @km.itb.ac.id, ${emails.length - kmEmails.length} other)  founding dates: ${dates.length}`);
  console.log(`\nFokus Rumpun: ${JSON.stringify(rumpun)}`);
  console.log(`\n--- UNMATCHED MINE ---`);
  for (const r of report.filter((r) => r.method === 'NO MATCH')) console.log(`  [${r.my_type}] ${r.my_name}`);
  console.log(`\n--- UNMATCHED THEIRS (${unmatchedTheirs.length}) ---`);
  for (const t of unmatchedTheirs) console.log(`  [${t.sheet}${t.kampus ? '/' + t.kampus : ''}] ${t.name} <${t.email ?? '-'}>`);
  console.log(`\nreport: ${REPORT}`);
})().catch((e) => { console.error(e); process.exit(1); });
