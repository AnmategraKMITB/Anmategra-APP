/** Memilih pemisah: tab bila ada, lalu titik koma, lalu koma. */
function detectDelimiter(text: string): string {
  if (text.includes('\t')) return '\t';
  if (text.includes(';')) return ';';
  return ',';
}

const normalizeNewlines = (text: string): string =>
  text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const needsQuoting = (text: string): boolean => /[\t\n\r"]/.test(text);

/**
 * Membaca teks berdelimiter (tab/titik koma/koma) dengan dukungan kutip ganda.
 * `""` di dalam kutip berarti satu kutip, dan sel boleh memuat pemisah/baris.
 */
export function parseDelimited(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const source = normalizeNewlines(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let index = 0;

  while (index < source.length) {
    const char = source[index] ?? '';
    if (inQuotes) {
      if (char === '"') {
        if ((source[index + 1] ?? '') === '"') {
          cell += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      cell += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === delimiter) {
      row.push(cell);
      cell = '';
      index += 1;
      continue;
    }
    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      index += 1;
      continue;
    }
    cell += char;
    index += 1;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((line) => line.some((value) => value.trim() !== ''));
}

/** Menulis tabel sebagai TSV; sel yang memuat tab/baris/kutip diberi kutip. */
export function toTsv(rows: (string | number | null)[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = value === null ? '' : String(value);
          return needsQuoting(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join('\t'),
    )
    .join('\n');
}

/**
 * Memakai baris pertama sebagai header dan mencocokkannya dengan alias di
 * `map` (tanpa beda huruf besar/kecil dan spasi ujung).
 */
export function rowsToObjects(
  rows: string[][],
  map: Record<string, string[]>,
): { objects: Record<string, string>[]; missing: string[] } {
  const header = rows[0] ?? [];
  const normalize = (value: string) => value.trim().toLowerCase();
  const aliasToKey = new Map<string, string>();
  for (const [key, aliases] of Object.entries(map)) {
    for (const alias of aliases) {
      aliasToKey.set(normalize(alias), key);
    }
  }

  const columns = header.map(
    (value) => aliasToKey.get(normalize(value)) ?? null,
  );
  const found = new Set(columns.filter((key): key is string => key !== null));
  const missing = Object.keys(map).filter((key) => !found.has(key));

  const objects: Record<string, string>[] = [];
  for (const row of rows.slice(1)) {
    const object: Record<string, string> = {};
    let filled = false;
    columns.forEach((key, index) => {
      if (key === null) return;
      const value = (row[index] ?? '').trim();
      object[key] = value;
      if (value !== '') filled = true;
    });
    if (filled) objects.push(object);
  }

  return { objects, missing };
}
