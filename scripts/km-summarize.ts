/**
 * Build concise lembaga descriptions from official km.itb.ac.id profiles.
 *
 * Smoke test one page:
 *   npx tsx scripts/km-summarize.ts https://km.itb.ac.id/lembaga/hmp/hmif-itb
 *
 * Resume the full checkpointed CSV update:
 *   npm run db:summarize-lembaga
 */
import { parse } from 'csv-parse/sync';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.SUMMARY_BASE_URL?.replace(/\/$/, '');
const API_KEY = process.env.SUMMARY_API_KEY;
const MODEL = process.env.SUMMARY_MODEL;
if (!BASE_URL || !API_KEY || !MODEL) {
  throw new Error(
    'Set SUMMARY_BASE_URL, SUMMARY_API_KEY, and SUMMARY_MODEL in .env',
  );
}

const CSV_PATH = path.join(
  process.cwd(),
  'src',
  'server',
  'db',
  'seeding',
  'data',
  'lembaga-official.csv',
);
const CACHE_PATH = path.join(
  process.cwd(),
  'scripts',
  '.km-summarize-cache.json',
);
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';
const MAX_DESCRIPTION_LENGTH = 200;

type CsvRow = Record<string, string> & {
  email: string;
  name: string;
  description: string;
  type?: string;
  major?: string;
  field?: string;
  description_original?: string;
};

type ProfilePage = {
  url: string;
  title: string;
  content: string;
};

type Cache = {
  version: 1;
  pages: ProfilePage[];
  matches: Record<string, string>;
  matchedUrls: string[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCache(): Cache {
  if (!fs.existsSync(CACHE_PATH)) {
    return { version: 1, pages: [], matches: {}, matchedUrls: [] };
  }
  return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as Cache;
}

function saveCache(cache: Cache) {
  const temporaryPath = `${CACHE_PATH}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(cache, null, 2));
  fs.renameSync(temporaryPath, CACHE_PATH);
}

function serializeCsv(rows: CsvRow[], columns: string[]) {
  const escape = (value: string | undefined) => {
    const text = value ?? '';
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return (
    [
      columns.map(escape).join(','),
      ...rows.map((row) =>
        columns.map((column) => escape(row[column])).join(','),
      ),
    ].join('\n') + '\n'
  );
}

function saveRows(rows: CsvRow[]) {
  const columns = Object.keys(rows[0]!);
  if (!columns.includes('description_original'))
    columns.push('description_original');
  const temporaryPath = `${CSV_PATH}.tmp`;
  fs.writeFileSync(temporaryPath, serializeCsv(rows, columns));
  fs.renameSync(temporaryPath, CSV_PATH);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.text();
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&apos;|&#39;|&#x27;/gi, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function htmlToContent(html: string): string {
  const body = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
  const text = body
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n');
  const lines = decodeHtml(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const footer = lines.indexOf('Kabinet Keluarga Mahasiswa');
  return (footer >= 0 ? lines.slice(0, footer) : lines)
    .join('\n')
    .slice(0, 6_000);
}

async function scrapePage(url: string): Promise<ProfilePage> {
  const html = await fetchText(url);
  const rawTitle = /<title>([^<]+)/i.exec(html)?.[1] ?? '';
  const title = decodeHtml(rawTitle)
    .split('|')[0]!
    .trim()
    .replace(/( ITB)+$/, ' ITB');
  if (!title) throw new Error(`No title found for ${url}`);
  return { url, title, content: htmlToContent(html) };
}

function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : String(value);
}

function isRetryable(message: string) {
  return /fetch failed|timeout|timed out|HTTP (408|409|429|5\d\d)\b/i.test(
    message,
  );
}

async function chat(prompt: string): Promise<string> {
  let lastError = 'Unknown API error';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      const raw = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${raw}`);
      const data = JSON.parse(raw) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error('API returned an empty response');
      return content;
    } catch (error) {
      lastError = errorMessage(error);
      if (attempt === 3 || !isRetryable(lastError)) break;
      await sleep(1_000 * 2 ** (attempt - 1));
    }
  }
  throw new Error(lastError);
}

function cleanSummary(value: string) {
  return value
    .replace(/^```(?:text)?\s*|\s*```$/g, '')
    .replace(/^["“]|["”]$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampSummary(value: string) {
  if (value.length <= MAX_DESCRIPTION_LENGTH) return value;
  const prefix = value.slice(0, MAX_DESCRIPTION_LENGTH - 1);
  const boundary = Math.max(prefix.lastIndexOf(','), prefix.lastIndexOf(' '));
  return `${prefix.slice(0, boundary > 120 ? boundary : prefix.length).replace(/[ ,;:]+$/, '')}.`;
}

async function summarize(row: CsvRow, page: ProfilePage): Promise<string> {
  const prompt =
    `Tulis deskripsi profil resmi untuk lembaga kemahasiswaan ITB bernama "${row.name}"` +
    `${row.major ? ` (bidang/program studi terkait: ${row.major})` : ''}. ` +
    `Berdasarkan isi halaman resmi di bawah, tulis SATU kalimat Bahasa Indonesia baku dengan panjang maksimal 180 karakter. ` +
    `Jelaskan jenis lembaga dan peran utamanya. Gunakan nama dan bidang yang diberikan; jangan menebak dari singkatan. ` +
    `Balas hanya dengan kalimat deskripsi tanpa tanda kutip.\n\nISI HALAMAN:\n${page.content}`;
  let summary = cleanSummary(await chat(prompt));
  if (summary.length > MAX_DESCRIPTION_LENGTH) {
    summary = cleanSummary(
      await chat(
        `Pendekkan kalimat berikut menjadi satu kalimat Bahasa Indonesia baku maksimal 180 karakter. ` +
          `Pertahankan nama lembaga dan makna utama. Balas hanya kalimatnya.\n\n${summary}`,
      ),
    );
  }
  return clampSummary(summary);
}

function parseJsonObject(value: string): Record<string, string | null> {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start < 0 || end <= start)
    throw new Error(`Matching response was not JSON: ${value}`);
  return JSON.parse(value.slice(start, end + 1)) as Record<
    string,
    string | null
  >;
}

async function scrapeAll(cache: Cache) {
  if (cache.pages.length) {
    console.log(`Using ${cache.pages.length} cached profile pages.`);
    return;
  }
  const sitemap = await fetchText('https://km.itb.ac.id/sitemap.xml');
  const urls = [
    ...new Set(
      [
        ...sitemap.matchAll(
          /<loc>(https:\/\/km\.itb\.ac\.id\/lembaga\/[^<]+)<\/loc>/g,
        ),
      ]
        .map((match) => match[1]!.replace(/\/$/, ''))
        .filter((url) => url.split('/').length >= 6),
    ),
  ];
  console.log(`Scraping ${urls.length} profile pages...`);
  for (const url of urls) {
    try {
      const page = await scrapePage(url);
      cache.pages.push(page);
      saveCache(cache);
      console.log(`  scraped: ${page.title}`);
    } catch (error) {
      console.warn(`  skipped ${url}: ${errorMessage(error)}`);
    }
  }
}

const FIELD_PATHS: Record<string, string> = {
  Agama: 'rumpun-agama',
  Pendidikan: 'rumpun-pendidikan',
  Kajian: 'rumpun-kajian',
  Media: 'rumpun-media',
  'Olahraga dan Kesehatan': 'rumpun-olahraga-dan-kesehatan',
  Seni: 'rumpun-seni-budaya',
  Budaya: 'rumpun-seni-budaya',
  'Budaya - Paguyuban': 'rumpun-seni-budaya',
};

function isCompatibleMatch(row: CsvRow, page: ProfilePage) {
  const pathType = page.url.includes('/lembaga/hmp/')
    ? 'Himpunan'
    : page.url.includes('/lembaga/ukm/')
      ? 'UKM'
      : page.url.includes('/lembaga/bso/')
        ? 'BSO'
        : undefined;
  if (row.type && pathType && row.type !== pathType) return false;
  const expectedFieldPath = row.field ? FIELD_PATHS[row.field] : undefined;
  return !expectedFieldPath || page.url.includes(`/${expectedFieldPath}/`);
}

async function matchAll(rows: CsvRow[], cache: Cache) {
  const rowsByEmail = new Map(
    rows
      .filter((row) => row.email)
      .map((row) => [row.email.toLowerCase(), row]),
  );
  const pagesByUrl = new Map(cache.pages.map((page) => [page.url, page]));

  // Discard stale or category-incompatible cached matches before resuming.
  for (const [email, url] of Object.entries(cache.matches)) {
    const row = rowsByEmail.get(email);
    const page = pagesByUrl.get(url);
    if (!row || !page || !isCompatibleMatch(row, page)) {
      delete cache.matches[email];
      cache.matchedUrls = cache.matchedUrls.filter(
        (matchedUrl) => matchedUrl !== url,
      );
    }
  }
  saveCache(cache);

  const knownEmails = new Set(rowsByEmail.keys());
  const processed = new Set(cache.matchedUrls);
  const pending = cache.pages.filter((page) => !processed.has(page.url));
  if (!pending.length) {
    console.log(`Using ${Object.keys(cache.matches).length} cached matches.`);
    return;
  }

  const names = rows
    .filter((row) => row.email)
    .map(
      (row) =>
        `${row.name} [type=${row.type || '-'}, field=${row.field || '-'}, major=${row.major || '-'}] <${row.email}>`,
    )
    .join('\n');
  console.log(`Matching ${pending.length} profile pages...`);
  for (let start = 0; start < pending.length; start += 20) {
    const batch = pending.slice(start, start + 20);
    const listing = batch
      .map((page, index) => `${index}. ${page.title} [${page.url}]`)
      .join('\n');
    const reply = parseJsonObject(
      await chat(
        `Cocokkan setiap judul halaman ke lembaga resmi yang sama berdasarkan nama atau singkatan.\n\n` +
          `LEMBAGA RESMI:\n${names}\n\nHALAMAN:\n${listing}\n\n` +
          `Balas hanya JSON yang memetakan nomor halaman ke email resmi, atau null. ` +
          `Contoh: {"0":"hmif-de@std.stei.itb.ac.id","1":null}`,
      ),
    );
    for (const [index, email] of Object.entries(reply)) {
      const page = batch[Number(index)];
      const normalizedEmail = email?.toLowerCase();
      const row = normalizedEmail
        ? rowsByEmail.get(normalizedEmail)
        : undefined;
      if (
        page &&
        row &&
        normalizedEmail &&
        knownEmails.has(normalizedEmail) &&
        isCompatibleMatch(row, page)
      ) {
        cache.matches[normalizedEmail] = page.url;
      }
    }
    cache.matchedUrls.push(...batch.map((page) => page.url));
    saveCache(cache);
    console.log(`  matched batch ${start + 1}-${start + batch.length}`);
  }
}

async function runAll() {
  const rows = parse(fs.readFileSync(CSV_PATH, 'utf-8'), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
  const cache = loadCache();
  await scrapeAll(cache);
  await matchAll(rows, cache);

  const pagesByUrl = new Map(cache.pages.map((page) => [page.url, page]));
  const pending = rows.filter((row) => {
    const matched = cache.matches[row.email.toLowerCase()];
    const completed =
      Boolean(row.description_original) &&
      row.description.length <= MAX_DESCRIPTION_LENGTH;
    return matched && !completed;
  });
  console.log(`${pending.length} matched descriptions remaining.`);

  let written = 0;
  for (const row of pending) {
    const page = pagesByUrl.get(cache.matches[row.email.toLowerCase()]!);
    if (!page) continue;
    try {
      const summary = await summarize(row, page);
      if (row.description && !row.description_original) {
        row.description_original = row.description;
      }
      row.description = summary;
      saveRows(rows);
      written++;
      console.log(`  ${summary.length} chars — ${row.name}`);
    } catch (error) {
      console.warn(`  failed ${row.name}: ${errorMessage(error)}`);
      if (
        /quota|insufficient|payment|required|credit/i.test(errorMessage(error))
      )
        break;
    }
  }

  const completed = rows.filter(
    (row) =>
      row.description_original &&
      row.description.length <= MAX_DESCRIPTION_LENGTH,
  ).length;
  console.log(
    `Done: ${written} written this run; ${completed} generated descriptions total.`,
  );
}

async function main() {
  const argument = process.argv[2];
  if (!argument)
    throw new Error('Usage: tsx scripts/km-summarize.ts <url> | --all');
  if (argument === '--all') {
    await runAll();
    return;
  }
  const page = await scrapePage(argument);
  const summary = await summarize(
    { email: '', name: page.title, description: '' },
    page,
  );
  console.log(`${summary.length} chars\n${summary}`);
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exit(1);
});
