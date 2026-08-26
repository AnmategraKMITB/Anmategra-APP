/**
 * Generate docs/api/schema.dbml from the Drizzle schema.
 *
 * The DBML file is the source for dbdocs.io:
 *   npm run docs:db          # regenerate docs/api/schema.dbml
 *   npm run docs:db:publish  # push it to dbdocs (needs DBDOCS_TOKEN)
 *
 * Column/table notes come from `docs/api/schema-notes.json`, so prose written
 * by hand survives every regeneration.
 */
import { pgGenerate } from 'drizzle-dbml-generator';
import fs from 'node:fs';
import path from 'node:path';

import * as schema from '../src/server/db/schema';

const OUT = path.join(process.cwd(), 'docs/api/schema.dbml');
const NOTES = path.join(process.cwd(), 'docs/api/schema-notes.json');

type Notes = Record<
  string,
  { note?: string; columns?: Record<string, string> }
>;

function loadNotes(): Notes {
  if (!fs.existsSync(NOTES)) return {};
  return JSON.parse(fs.readFileSync(NOTES, 'utf8')) as Notes;
}

/**
 * drizzle-dbml-generator emits structure only. We splice the hand-written
 * notes back in afterwards rather than annotating the schema itself, so the
 * ORM definitions stay free of documentation noise.
 */
function annotateColumns(
  body: string,
  columns: Record<string, string>,
): string {
  return body
    .split('\n')
    .map((line) => {
      const match = /^ {2}(?:"([^"]+)"|(\w+)) /.exec(line);
      const column = match?.[1] ?? match?.[2];
      const note = column ? columns[column] : undefined;
      if (!note || line.includes('note:')) return line;
      return /\[.*\]\s*$/.test(line)
        ? line.replace(/\[(.*)\]\s*$/, `[$1, note: ${JSON.stringify(note)}]`)
        : `${line} [note: ${JSON.stringify(note)}]`;
    })
    .join('\n');
}

function applyNotes(dbml: string, notes: Notes): string {
  return dbml.replace(
    /^table (?:"([^"]+)"|(\S+)) \{\n([\s\S]*?)\n\}/gm,
    (
      block,
      quoted: string | undefined,
      bare: string | undefined,
      body: string,
    ) => {
      const table = quoted ?? bare ?? '';
      const entry = notes[table];
      if (!entry) return block;

      // Column notes must not leak into the trailing `indexes { ... }` block,
      // whose entries reuse the column names.
      const indexAt = body.search(/^ {2}indexes \{/m);
      const columnPart = indexAt === -1 ? body : body.slice(0, indexAt);
      const rest = indexAt === -1 ? '' : body.slice(indexAt);

      const annotated = entry.columns
        ? annotateColumns(columnPart, entry.columns) + rest
        : body;
      const tableNote = entry.note
        ? `\n  Note: ${JSON.stringify(entry.note)}`
        : '';

      return `table ${quoted ? `"${table}"` : table} {\n${annotated}${tableNote}\n}`;
    },
  );
}

pgGenerate({ schema, out: OUT, relational: true });

const notes = loadNotes();
if (Object.keys(notes).length > 0) {
  fs.writeFileSync(OUT, applyNotes(fs.readFileSync(OUT, 'utf8'), notes));
}

const tables = (fs.readFileSync(OUT, 'utf8').match(/^table /gm) ?? []).length;
console.log(`[dbml] ${tables} tables -> ${path.relative(process.cwd(), OUT)}`);
