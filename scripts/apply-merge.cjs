#!/usr/bin/env node
/**
 * Stage 3 apply: merge-report.csv + xlsx -> updated lembaga-official.csv.
 *
 * - patches the 100 matched rows (email, founding_date, member_count,
 *   official prodi/rumpun)
 * - appends additions decided with the team: 16 new UKMs, 6 Cirebon
 *   komisariat (as separate Himpunan), 2 BSO (new enum value)
 * - email cells may contain several addresses -> picks one (prefers
 *   @km.itb.ac.id), flags the rest
 * - writes QA notes to docs/plans/stage3-merge-qa.md
 *
 * Usage: node scripts/apply-merge.cjs <path-to-xlsx>
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSV_PATH = path.join(ROOT, 'src/server/db/seeding/data/lembaga-official.csv');
const REPORT = path.join(ROOT, 'src/server/db/seeding/data/raw/merge-report.csv');
const QA = path.join(ROOT, 'docs/plans/stage3-merge-qa.md');

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
const norm = (s) =>
  (s ?? '').toLowerCase().replace(/institut teknologi bandung/g, ' ')
    .replace(/[\u2018\u2019\u201c\u201d"']/g, ' ').replace(/\bitb\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function readSheet(ws, headerRow, nameKey) {
  const header = ws.getRow(headerRow).values.slice(1).map(cell);
  const idx = (k) => header.findIndex((h) => h && norm(h).startsWith(norm(k)));
  const cols = {
    name: idx(nameKey),
    prodi: idx('Nama Lengkap Program Studi'),
    rumpun: idx('Fokus Rumpun'),
    lahir: idx('Tanggal Lahir'),
    email: idx('Email Aktif Lembaga'),
    anggota: idx('Jumlah Anggota'),
    kampus: idx('Multikampus'),
  };
  const rows = [];
  for (let i = headerRow + 1; i <= ws.rowCount; i++) {
    const v = ws.getRow(i).values.slice(1);
    const get = (c) => (c >= 0 ? cell(v[c]) : null);
    const name = get(cols.name), email = get(cols.email);
    if (!name && !email) continue;
    const anggota = get(cols.anggota);
    rows.push({
      sheet: ws.name, name: name ?? '',
      prodi: (get(cols.prodi) ?? '').replace(/^\d+\.\s*/, '') || null,
      rumpun: get(cols.rumpun), lahir: normalizeDate(get(cols.lahir)), email,
      anggota: anggota && /^\d+$/.test(String(anggota).trim()) ? anggota : null,
      kampus: get(cols.kampus),
    });
  }
  return rows;
}

const pickEmail = (raw) => {
  if (!raw) return { picked: '', all: [] };
  const all = String(raw).split(/[/,;\s]+/).map((t) => t.trim().toLowerCase())
    .filter((t) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t));
  if (all.length === 0) return { picked: '', all: [] };
  const km = all.find((e) => e.endsWith('@km.itb.ac.id'));
  return { picked: km ?? all[0] ?? '', all };
};

// pick + normalize + QA-flag in one place (used by patches AND additions)
const takeEmail = (label, raw, qa) => {
  const { picked, all } = pickEmail(raw);
  let p = picked;
  if (p.endsWith('@km.itb.c.id')) {
    const fixed = p.replace('@km.itb.c.id', '@km.itb.ac.id');
    qa.typos.push(`${label}: '${p}' auto-corrected to '${fixed}' (missing 'a' in sheet) — VERIFY`);
    p = fixed;
  }
  if (all.length > 1) qa.emailPicks.push(`${label}: picked ${p} (of ${all.join(', ')})`);
  return p;
};

function parseCsv(text) {
  // split on \r?\n: the baseline CSV is CRLF (python csv.writer default);
  // a naive split('\n') leaves \r in the last field, which csv-parse later
  // locks onto as the record delimiter — mixing CRLF and LF rows then breaks it
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
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
  return {
    header,
    rows: lines.slice(1).map((l) => Object.fromEntries(header.map((c, i) => [c, parseLine(l)[i] ?? '']))),
  };
}

// Additions: [sheet, name-substring, type, csv-name, description, major, needsReview]
const ADDITIONS = [
  // --- new UKMs (per team decision: add all, flagged) ---
  ['UKM', 'Amateur Radio Club', 'UKM', 'Amateur Radio Club ITB',
    'Amateur Radio Club ITB adalah organisasi mahasiswa yang berfokus pada pengembangan web, jaringan komputer, dan teknologi informasi.', '', ''],
  ['UKM', 'Pramuka ITB', 'UKM', 'Pramuka ITB',
    'Pramuka ITB adalah unit kegiatan mahasiswa ITB di bidang kepanduan dan kegiatan alam terbuka.', '', ''],
  ['UKM', 'Solve-It', 'UKM', 'Solve-It ITB',
    'Solve-It ITB adalah unit kegiatan mahasiswa yang menjadi wadah kajian dan pemecahan masalah berbasis studi kasus.', '', 'verify: tujuan disimpulkan dari nama'],
  ['UKM', 'shARE ITB', 'UKM', 'shARE ITB',
    'ShARE ITB adalah klub konsultasi mahasiswa yang mengembangkan kepemimpinan melalui pembelajaran, pendampingan, dan proyek konsultasi.', '', ''],
  ['UKM', 'Ganesha Caffeine Society', 'UKM', 'Ganesha Caffeine Society ITB',
    'Ganesha Caffeine Society ITB adalah komunitas mahasiswa ITB yang mewadahi minat dan kegiatan seputar kopi.', '', 'confirmed by team'],
  ['UKM', 'ITB Fellowship Club', 'UKM', 'ITB Fellowship Club',
    'ITB Fellowship Club adalah inisiatif pengembangan karier yang mempersiapkan mahasiswa ITB melalui mentoring, pelatihan, dan kegiatan kesiapan profesional.', '', 'LinkedIn-verified career preparation focus'],
  ['UKM', 'Majalah Ganesha', 'UKM', 'Majalah Ganesha ITB',
    'Majalah Ganesha (Kelompok Studi Sejarah, Ekonomi, dan Politik) adalah unit kegiatan mahasiswa ITB di bidang jurnalistik dan kajian sosial-politik.', '', ''],
  ['UKM', 'Boulevard ITB', 'UKM', 'Boulevard ITB',
    'Boulevard ITB adalah unit kegiatan mahasiswa ITB.', '', 'verify: fokus kegiatan tidak diketahui'],
  ['UKM', 'Biliar', 'UKM', 'Unit Olahraga Biliar ITB',
    'Unit Olahraga Biliar ITB (URBA ITB) adalah unit kegiatan mahasiswa yang mewadahi minat dan prestasi olahraga biliar.', '', ''],
  ['UKM', 'Boxing', 'UKM', 'ITB Boxing Club',
    'ITB Boxing Club adalah unit kegiatan mahasiswa yang mewadahi minat dan prestasi olahraga tinju di ITB.', '', ''],
  ['UKM', 'Golf', 'UKM', 'Unit Ganesha Golf ITB',
    'Unit Ganesha Golf ITB adalah unit kegiatan mahasiswa yang mewadahi minat dan prestasi olahraga golf.', '', ''],
  ['UKM', 'Perisai Diri', 'UKM', 'Perisai Diri ITB',
    'Perisai Diri ITB adalah unit kegiatan mahasiswa yang mengembangkan bela diri pencak silat Perisai Diri.', '', ''],
  ['UKM', 'Ganesha Boardgame', 'UKM', 'Ganesha Boardgame United Tabletop ITB',
    'Ganesha Boardgame United Tabletop ITB (GABUT ITB) adalah komunitas mahasiswa penggemar permainan papan dan tabletop di ITB.', '', ''],
  ['UKM', 'Apres!', 'UKM', 'Apres! ITB',
    'Apres! ITB adalah unit kegiatan mahasiswa yang bergerak di bidang apresiasi seni dan budaya.', '', 'verify: fokus disimpulkan dari nama'],
  ['UKM', 'Lingkung Seni Sunda', 'UKM', 'Lingkung Seni Sunda ITB',
    'Lingkung Seni Sunda ITB (LSS ITB) adalah unit kegiatan mahasiswa yang melestarikan dan mengembangkan seni tradisional Sunda.', '', ''],
  ['UKM', 'Keluarga Mahasiswa Jambi', 'UKM', 'Keluarga Mahasiswa Jambi ITB',
    'Keluarga Mahasiswa Jambi ITB adalah wadah mahasiswa asal Jambi yang menyelenggarakan Ganesha Fun Day untuk mengenalkan pendidikan tinggi kepada pelajar Jambi.', '', 'LinkedIn-verified Ganesha Fun Day outreach'],
  // --- komisariat (per team decision: include as separate lembaga) ---
  ['HMPS ITB', 'Komisariat Himpunan Mahasiswa Oseanografi', 'Himpunan', "Komisariat Himpunan Mahasiswa Oseanografi 'TRITON' ITB Cirebon",
    "Komisariat Himpunan Mahasiswa Oseanografi 'TRITON' ITB Kampus Cirebon adalah perwakilan HMO TRITON ITB bagi mahasiswa Oseanografi di ITB Kampus Cirebon.", 'Oseanografi', ''],
  ['HMPS ITB', 'Komisariat TERIKAT', 'Himpunan', 'Komisariat TERIKAT ITB Cirebon',
    'Komisariat TERIKAT ITB Kampus Cirebon adalah perwakilan TERIKAT ITB bagi mahasiswa Kriya di ITB Kampus Cirebon.', 'Kriya', ''],
  ['HMPS ITB', 'Komisariat Himpunan Mahasiswa Teknik Perminyakan', 'Himpunan', 'Komisariat Himpunan Mahasiswa Teknik Perminyakan ITB Cirebon',
    'Komisariat Himpunan Mahasiswa Teknik Perminyakan "PATRA" ITB Kampus Cirebon adalah perwakilan HMTM PATRA ITB bagi mahasiswa Teknik Perminyakan di ITB Kampus Cirebon.', 'Teknik Perminyakan', ''],
  ['HMPS ITB', 'Komisariat Himpunan Mahasiswa Tambang', 'Himpunan', 'Komisariat Himpunan Mahasiswa Tambang ITB Cirebon',
    'Komisariat Himpunan Mahasiswa Tambang ITB Kampus Cirebon adalah perwakilan HMT-ITB bagi mahasiswa Teknik Pertambangan di ITB Kampus Cirebon.', 'Teknik Pertambangan', ''],
  ['HMPS ITB', 'Pangripta Loka Komisariat', 'Himpunan', 'Komisariat Himpunan Mahasiswa Perencanaan Wilayah dan Kota ITB Cirebon',
    'Komisariat Himpunan Mahasiswa Perencanaan Wilayah dan Kota "Pangripta Loka" ITB Kampus Cirebon adalah perwakilan HMP PL ITB bagi mahasiswa PWK di ITB Kampus Cirebon.', 'Perencanaan Wilayah dan Kota', ''],
  ['HMPS ITB', 'Region Eksekutif', 'Himpunan', 'Region Eksekutif Keluarga Mahasiswa Teknik Industri ITB Cirebon',
    'Region Eksekutif Keluarga Mahasiswa Teknik Industri ITB Cirebon (REMTI) adalah perwakilan MTI ITB bagi mahasiswa Teknik Industri di ITB Kampus Cirebon.', 'Teknik Industri', ''],
  // --- BSO (per team decision: new enum value) ---
  ['BSO', 'Skhole', 'BSO', 'Skhole ITB Mengajar',
    'Skhole—ITB Mengajar adalah badan semi-otonom mahasiswa ITB yang bergerak di bidang pendidikan melalui kegiatan pengabdian mengajar.', '', ''],
  ['BSO', 'Persekutuan Mahasiswa Kristen ITB Cirebon', 'BSO', 'Persekutuan Mahasiswa Kristen ITB Cirebon',
    'Persekutuan Mahasiswa Kristen ITB Cirebon (PMK Cirebon) adalah badan semi-otonom yang menjadi wadah persekutuan dan pembinaan iman bagi mahasiswa Kristen ITB Kampus Cirebon.', '', ''],
];

(async () => {
  const xlsx = process.argv[2];
  if (!xlsx) { console.error('usage: node apply-merge.cjs <xlsx>'); process.exit(1); }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsx);
  const theirs = [
    ...readSheet(wb.getWorksheet('HMPS ITB'), 2, 'Nama Lengkap Lembaga'),
    ...readSheet(wb.getWorksheet('UKM'), 2, 'Nama Unit'),
    ...readSheet(wb.getWorksheet('BSO'), 2, 'Nama BSO'),
  ];
  const findRow = (sheet, sub) =>
    theirs.find((t) => t.sheet === sheet && norm(t.name).includes(norm(sub)));

  const { header, rows } = parseCsv(fs.readFileSync(CSV_PATH, 'utf-8'));
  const report = parseCsv(fs.readFileSync(REPORT, 'utf-8')).rows
    .filter((r) => r.method !== 'NO MATCH');
  const patchByName = new Map(report.map((r) => [r.my_name, r]));

  /** @type {{emailPicks: string[], typos: string[], gaps: string[], additions: string[], notes: string[]}} */
  const qa = { emailPicks: [], typos: [], gaps: [], additions: [], notes: [] };

  // 1) patch existing rows
  let patched = 0;
  for (const row of rows) {
    const p = patchByName.get(row.name);
    if (!p) {
      if (!row.email) qa.gaps.push(`[${row.type}] ${row.name} — no match on sheet; email still missing (IG fallback)`);
      continue;
    }
    row.email = takeEmail(row.name, p.email, qa);
    if (p.founding_date) row.founding_date = p.founding_date;
    if (p.member_count) row.member_count = p.member_count;
    if (row.type === 'UKM' && p.rumpun) row.field = p.rumpun;
    if (row.type === 'Himpunan' && p.prodi) row.major = p.prodi;
    patched++;
  }

  // 2) additions
  let added = 0;
  for (const [sheet, sub, type, name, desc, major, review] of ADDITIONS) {
    const src = findRow(sheet, sub);
    if (!src) { qa.notes.push(`ADDITION SOURCE NOT FOUND: [${sheet}] ${sub}`); continue; }
    const picked = takeEmail(name, src.email, qa);
    if (!picked) qa.gaps.push(`[${type}] ${name} — no email on sheet`);
    if (review) qa.additions.push(`${name}: ${review}`);
    qa.additions.push(`${name}: added from sheet (${type})`);
    rows.push({
      email: picked,
      name,
      description: desc,
      founding_date: src.lahir ?? '',
      ending_date: '',
      type,
      major: type === 'Himpunan' ? major : '',
      field: type === 'UKM' ? (src.rumpun ?? '') : '',
      member_count: src.anggota ?? '',
    });
    added++;
  }

  // dupe noise from sheet (matched twin already patched)
  qa.notes.push('KMH ITB duplicate row on sheet ignored (identical twin of matched row).');

  // 3) write CSV
  const esc = (v) => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
  fs.writeFileSync(CSV_PATH,
    [header.join(','), ...rows.map((r) => header.map((h) => esc(r[h] ?? '')).join(','))].join('\n') + '\n',
    'utf-8');

  // 4) QA doc
  const withEmail = rows.filter((r) => r.email).length;
  const md = `# Stage 3 Merge QA — xlsx → lembaga-official.csv

Source: Database Lembaga KM ITB Periode 2026/2027 (gitignored xlsx).
Result: **${rows.length} rows** (${patched} patched, ${added} added), ${withEmail} with email, ${rows.length - withEmail} without.

## Rows still missing email (seed skips these until filled — IG fallback per backup plan)
${qa.gaps.map((g) => '- ' + g).join('\n') || '- (none)'}

## Email typos found in the source sheet (verify before production seed)
${qa.typos.map((t) => '- ' + t).join('\n') || '- (none)'}

## Multi-address cells (picked one; preferred @km.itb.ac.id)
${qa.emailPicks.map((e) => '- ' + e).join('\n') || '- (none)'}

## Additions (all flagged for team review)
${qa.additions.map((a) => '- ' + a).join('\n')}

## Notes
${qa.notes.map((n) => '- ' + n).join('\n')}
`;
  fs.writeFileSync(QA, md, 'utf-8');

  console.log(`patched: ${patched}  added: ${added}  total rows: ${rows.length}  with email: ${withEmail}`);
  console.log(`QA: ${QA}`);
})().catch((e) => { console.error(e); process.exit(1); });
