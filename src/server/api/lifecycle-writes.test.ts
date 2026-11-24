import fs from 'node:fs';
import path from 'node:path';
import {
  type Node,
  type SourceFile,
  isCallExpression,
  isIdentifier,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isSpreadAssignment,
} from 'typescript/unstable/ast';
import { API } from 'typescript/unstable/async';
import { describe, expect, it } from 'vitest';

/**
 * Penjaga siklus hidup: kolom status yang dideklarasikan di `src/lib/lifecycle`
 * hanya boleh ditulis lewat `transition()` (`src/server/api/lifecycle.ts`).
 * Tes ini mencari setiap `.update(<tabel>).set({ <kolom>: ... })` langsung di
 * `src/server/api`. Penulisan baru di luar daftar EXCEPTIONS membuat tes gagal;
 * pengecualian yang sudah tidak ada juga membuatnya gagal, supaya daftar ini
 * tidak basi.
 */
const WATCHED: Record<string, string[]> = {
  form: ['status'],
  recruitment: ['status', 'placementState'],
  transferRequest: ['status'],
  support: ['status'],
};

/** `file|tabel.kolom` -> jumlah penulisan langsung yang disengaja, dan alasannya. */
const EXCEPTIONS: Record<string, { count: number; reason: string }> = {
  'src/server/api/routers/oprec/placement.ts|transferRequest.status': {
    count: 5,
    reason:
      'Tiga pembatalan massal (moveAcceptance, keluar dari masa banding, batalkan_semua) ' +
      "menulis banyak baris WHERE status = 'diminta'. Dua penulisan 'disetujui' " +
      '(transferResolve, setujui_semua) terjadi setelah moveAcceptance menutup ' +
      'permintaannya; perpindahannya sudah diperiksa assertMove di bawah kunci baris.',
  },
  'src/server/api/routers/oprec/services.ts|form.status': {
    count: 3,
    reason:
      'syncFormToOprec menyamakan form terikat dengan status oprec (bukan satu ' +
      'perpindahan), dengan pesannya sendiri; dipanggil di bawah kunci oprec dan form.',
  },
  'src/server/api/routers/user.ts|support.status': {
    count: 1,
    reason:
      'submitReport: pelapor mengirim drafnya sendiri (Draft -> Reported). Pemilik dan ' +
      'status Draft ada di WHERE; tidak cocok = NOT_FOUND, bukan CONFLICT.',
  },
};

const ROOT = path.join(process.cwd(), 'src/server/api');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
      ? [full]
      : [];
  });
}

type Write = { key: string; line: number };

/**
 * TypeScript 7 tidak punya parser di paket JS-nya; AST diambil dari proses
 * tsgo lewat API async (API sync memakai internal stream Node dan tidak jalan
 * di Bun). Program-nya dari tsconfig virtual yang hanya berisi `files`, tanpa
 * resolusi impor dan lib, jadi tsgo cukup mem-parse berkas itu saja.
 */
async function parse(files: string[]): Promise<SourceFile[]> {
  const config = path.join(ROOT, 'lifecycle-writes.tsconfig.json');
  const api = new API({
    cwd: process.cwd(),
    fs: {
      fileExists: (name) => (name === config ? true : undefined),
      readFile: (name) =>
        name === config
          ? JSON.stringify({
              compilerOptions: { noResolve: true, noLib: true, types: [] },
              files,
            })
          : undefined,
    },
  });
  try {
    const snapshot = await api.updateSnapshot({ openProjects: [config] });
    const [project] = snapshot.getProjects();
    if (!project) throw new Error(`${config} tidak termuat`);
    return await Promise.all(
      files.map(async (file) => {
        const source = await project.program.getSourceFile(file);
        if (!source) throw new Error(`${file} tidak ter-parse`);
        return source;
      }),
    );
  } finally {
    await api.close();
  }
}

function directWrites(source: SourceFile): Write[] {
  const rel = path.relative(process.cwd(), source.fileName);
  const found: Write[] = [];
  const visit = (node: Node): undefined => {
    if (
      isCallExpression(node) &&
      isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'set' &&
      node.arguments[0] &&
      isObjectLiteralExpression(node.arguments[0])
    ) {
      const update = node.expression.expression;
      if (
        isCallExpression(update) &&
        isPropertyAccessExpression(update.expression) &&
        update.expression.name.text === 'update' &&
        update.arguments[0] &&
        isIdentifier(update.arguments[0])
      ) {
        const table = update.arguments[0].text;
        for (const prop of node.arguments[0].properties) {
          if (isSpreadAssignment(prop)) continue;
          const name = isIdentifier(prop.name) ? prop.name.text : null;
          if (name && WATCHED[table]?.includes(name)) {
            found.push({
              key: `${rel}|${table}.${name}`,
              line:
                source.getLineAndCharacterOfPosition(prop.getStart(source))
                  .line + 1,
            });
          }
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(source);
  return found;
}

describe('penulisan kolom status', () => {
  it('hanya lewat transition(), kecuali yang tercatat beserta alasannya', async () => {
    const sources = await parse(sourceFiles(ROOT));
    expect(sources.length).toBeGreaterThan(0);
    const writes = sources.flatMap(directWrites);
    const counts: Record<string, number> = {};
    for (const w of writes) counts[w.key] = (counts[w.key] ?? 0) + 1;

    const unexpected = writes
      .filter((w) => (counts[w.key] ?? 0) > (EXCEPTIONS[w.key]?.count ?? 0))
      .map(
        (w) =>
          `${w.key.split('|')[0]}:${w.line} menulis ${w.key.split('|')[1]}`,
      );
    expect(
      unexpected,
      'Tulis status lewat transition() dari src/server/api/lifecycle.ts, atau catat di EXCEPTIONS beserta alasannya.',
    ).toEqual([]);

    const expected = Object.fromEntries(
      Object.entries(EXCEPTIONS).map(([key, { count }]) => [key, count]),
    );
    expect(
      counts,
      'EXCEPTIONS tidak cocok dengan kode; perbarui daftarnya.',
    ).toEqual(expected);
  });
});
