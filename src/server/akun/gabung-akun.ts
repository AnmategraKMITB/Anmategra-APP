import { and, eq, getTableName, inArray, isNull, sql } from 'drizzle-orm';
import { fakultasOfNim } from '~/lib/itb/fakultas';
import { type Db, type Tx } from '~/server/api/routers/form/services';
import { accounts, mahasiswa, users } from '~/server/db/schema';
import { profileFromNim } from '~/server/mahasiswa-record';

const ITB_DOMAIN = 'mahasiswa.itb.ac.id';

/** NIM TPB: kode program studinya "Tahap Tahun Pertama …". */
export const isTpbNim = (nim: number) =>
  profileFromNim(nim).jurusan.startsWith('Tahap Tahun Pertama');

/** Nama dibandingkan tanpa beda huruf besar, spasi ganda, dan tanda baca. */
export const normalizeName = (name: string | null | undefined) =>
  (name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export class GabungAkunError extends Error {}

/** Kode galat Postgres; Drizzle membungkusnya di `cause`. */
const pgCode = (error: unknown) => {
  const e = error as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
};

export type MergeReport = {
  fromUserId: string;
  intoUserId: string;
  /** "tabel.kolom" → jumlah baris yang dipindah. */
  moved: Record<string, number>;
  /** "tabel.kolom" → baris kembar yang dibuang karena sudah ada di akun tujuan. */
  dropped: Record<string, number>;
};

/** Semua kolom FK yang menunjuk ke anmategra_user.id, dibaca dari katalog. */
async function userForeignKeys(tx: Tx) {
  const rows = await tx.execute<{ table: string; column: string }>(sql`
    SELECT cl.relname AS "table", a.attname AS "column"
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid = ${getTableName(users)}::regclass
    ORDER BY 1, 2
  `);
  return [...rows];
}

/**
 * Gabungkan akun placeholder `fromUserId` (belum pernah login) ke akun
 * `intoUserId` yang dipakai login: semua referensi dipindah, baris kembar
 * dibuang, NIM lama dicatat sebagai `nim_tpb`, lalu akun placeholder dihapus.
 * Harus dipanggil di dalam transaksi.
 */
export async function mergeUsers(
  tx: Tx,
  fromUserId: string,
  intoUserId: string,
): Promise<MergeReport> {
  if (fromUserId === intoUserId) {
    throw new GabungAkunError('Akun asal dan tujuan sama.');
  }
  const [from] = await tx
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, fromUserId))
    .for('update');
  const [into] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, intoUserId))
    .for('update');
  if (!from || !into) throw new GabungAkunError('Akun tidak ditemukan.');
  if (from.role !== 'mahasiswa') {
    throw new GabungAkunError('Hanya akun mahasiswa yang bisa digabung.');
  }
  const [fromLogin] = await tx
    .select({ id: accounts.userId })
    .from(accounts)
    .where(eq(accounts.userId, fromUserId))
    .limit(1);
  if (fromLogin) {
    throw new GabungAkunError(
      'Akun asal pernah login; hanya akun placeholder yang boleh digabung.',
    );
  }

  // Profil mahasiswa: satu per akun. Simpan NIM lama sebagai nim_tpb di tujuan.
  const [fromMhs] = await tx
    .select()
    .from(mahasiswa)
    .where(eq(mahasiswa.userId, fromUserId));
  const [intoMhs] = await tx
    .select()
    .from(mahasiswa)
    .where(eq(mahasiswa.userId, intoUserId));
  if (fromMhs && intoMhs) {
    if (intoMhs.nimTpb === null && fromMhs.nim !== intoMhs.nim) {
      await tx
        .update(mahasiswa)
        .set({ nimTpb: fromMhs.nim })
        .where(eq(mahasiswa.userId, intoUserId));
    }
    await tx.delete(mahasiswa).where(eq(mahasiswa.userId, fromUserId));
  }

  const report: MergeReport = {
    fromUserId,
    intoUserId,
    moved: {},
    dropped: {},
  };
  for (const { table, column } of await userForeignKeys(tx)) {
    if (table === 'anmategra_mahasiswa' && fromMhs && intoMhs) continue;
    const key = `${table}.${column}`;
    const t = sql.identifier(table);
    const c = sql.identifier(column);
    try {
      // Savepoint: bila bentrok unique, ulangi per baris.
      const moved = await tx.transaction(async (sp) =>
        sp.execute(
          sql`UPDATE ${t} SET ${c} = ${intoUserId} WHERE ${c} = ${fromUserId}`,
        ),
      );
      if (moved.count) report.moved[key] = moved.count;
    } catch (error) {
      if (pgCode(error) !== '23505') throw error;
      const rows = await tx.execute<{ ctid: string }>(
        sql`SELECT ctid::text AS ctid FROM ${t} WHERE ${c} = ${fromUserId}`,
      );
      for (const { ctid } of rows) {
        try {
          await tx.transaction(async (sp) =>
            sp.execute(
              sql`UPDATE ${t} SET ${c} = ${intoUserId} WHERE ctid = ${ctid}::tid`,
            ),
          );
          report.moved[key] = (report.moved[key] ?? 0) + 1;
        } catch (rowError) {
          if (pgCode(rowError) !== '23505') throw rowError;
          // Akun tujuan sudah punya baris yang sama (mis. keanggotaan ganda).
          await tx.execute(sql`DELETE FROM ${t} WHERE ctid = ${ctid}::tid`);
          report.dropped[key] = (report.dropped[key] ?? 0) + 1;
        }
      }
    }
  }

  await tx.delete(users).where(eq(users.id, fromUserId));
  return report;
}

/**
 * Akun placeholder ber-NIM TPB yang belum pernah login diberi identitas NIM
 * jurusan (email, NIM, jurusan, angkatan). Login Microsoft pertama dengan NIM
 * itu lalu tersambung ke akun ini, beserta jabatan dan keanggotaannya.
 */
export async function rebadgePlaceholder(
  tx: Tx,
  fromUserId: string,
  majorNim: number,
) {
  const email = `${majorNim}@${ITB_DOMAIN}`;
  const [taken] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (taken) {
    throw new GabungAkunError(
      `Akun ${email} sudah ada; gabungkan, jangan ganti identitas.`,
    );
  }
  const [mhs] = await tx
    .select()
    .from(mahasiswa)
    .where(eq(mahasiswa.userId, fromUserId));
  if (!mhs)
    throw new GabungAkunError('Akun asal tidak punya profil mahasiswa.');
  const { jurusan, angkatan } = profileFromNim(majorNim);
  await tx.update(users).set({ email }).where(eq(users.id, fromUserId));
  await tx
    .update(mahasiswa)
    .set({ nim: majorNim, nimTpb: mhs.nim, jurusan, angkatan })
    .where(eq(mahasiswa.userId, fromUserId));
}

export type TpbCandidate = {
  placeholder: { userId: string; nim: number; name: string | null };
  target: { userId: string; nim: number; name: string | null };
  reason: 'nim_tpb' | 'nama';
};

/**
 * Pasangan placeholder TPB (belum pernah login) ↔ akun jurusan yang dipakai
 * login. Tautan eksplisit `nim_tpb` selalu dipakai; tebakan hanya bila nama,
 * angkatan, dan fakultas sama dan kandidatnya tepat satu di kedua sisi.
 */
export async function findTpbCandidates(db: Pick<Tx, 'select'>) {
  const loggedIn = db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.userId, mahasiswa.userId));
  const rows = await db
    .select({
      userId: mahasiswa.userId,
      nim: mahasiswa.nim,
      nimTpb: mahasiswa.nimTpb,
      angkatan: mahasiswa.angkatan,
      nama: mahasiswa.nama,
      name: users.name,
      login: sql<boolean>`EXISTS (${loggedIn})`,
    })
    .from(mahasiswa)
    .innerJoin(users, eq(users.id, mahasiswa.userId))
    .where(eq(users.role, 'mahasiswa'));

  const placeholders = rows.filter((r) => !r.login && isTpbNim(r.nim));
  const targets = rows.filter((r) => r.login && !isTpbNim(r.nim));
  const byNimTpb = new Map(
    targets.flatMap((t) => (t.nimTpb ? [[t.nimTpb, t] as const] : [])),
  );
  const keyOf = (r: (typeof rows)[number]) =>
    `${normalizeName(r.nama ?? r.name)}|${r.angkatan}|${fakultasOfNim(r.nim)}`;
  const count = (list: typeof rows) => {
    const m = new Map<string, number>();
    for (const r of list) m.set(keyOf(r), (m.get(keyOf(r)) ?? 0) + 1);
    return m;
  };
  const placeholderKeys = count(placeholders);
  const targetByKey = new Map(targets.map((t) => [keyOf(t), t]));
  const targetKeys = count(targets);

  const pairs: TpbCandidate[] = [];
  const ambiguous: TpbCandidate['placeholder'][] = [];
  for (const p of placeholders) {
    const out = (t: (typeof rows)[number], reason: TpbCandidate['reason']) =>
      pairs.push({
        placeholder: { userId: p.userId, nim: p.nim, name: p.nama ?? p.name },
        target: { userId: t.userId, nim: t.nim, name: t.nama ?? t.name },
        reason,
      });
    const explicit = byNimTpb.get(p.nim);
    if (explicit) {
      out(explicit, 'nim_tpb');
      continue;
    }
    const key = keyOf(p);
    if (!normalizeName(p.nama ?? p.name)) continue;
    const target = targetByKey.get(key);
    if (!target) continue;
    if (placeholderKeys.get(key) === 1 && targetKeys.get(key) === 1) {
      out(target, 'nama');
    } else {
      ambiguous.push({ userId: p.userId, nim: p.nim, name: p.nama ?? p.name });
    }
  }
  return { pairs, ambiguous };
}

/**
 * Dipanggil saat login Microsoft: bila profil akun ini punya `nim_tpb` dan ada
 * placeholder ber-NIM itu yang belum pernah login, gabungkan ke akun ini.
 * Hanya tautan eksplisit; tidak menebak dari nama.
 */
export async function adoptTpbPlaceholder(db: Db, userId: string) {
  return db.transaction(async (tx) => {
    const [own] = await tx
      .select({ nimTpb: mahasiswa.nimTpb })
      .from(mahasiswa)
      .where(eq(mahasiswa.userId, userId));
    if (!own?.nimTpb) return null;
    const holders = await tx
      .select({ userId: mahasiswa.userId })
      .from(mahasiswa)
      .leftJoin(accounts, eq(accounts.userId, mahasiswa.userId))
      .where(and(eq(mahasiswa.nim, own.nimTpb), isNull(accounts.userId)));
    const ids = holders.map((h) => h.userId).filter((id) => id !== userId);
    if (ids.length !== 1) return null;
    const [placeholder] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, ids), eq(users.role, 'mahasiswa')));
    if (!placeholder) return null;
    return mergeUsers(tx, placeholder.id, userId);
  });
}

const ALIAS = /^smtp:(\d{8})@mahasiswa\.itb\.ac\.id$/i;

/**
 * NIM TPB dari alias email akun Microsoft. ITB mengganti nama akun saat
 * penjurusan, dan email TPB lama tetap tersimpan di `proxyAddresses`
 * (mis. `smtp:19625221@mahasiswa.itb.ac.id` pada akun 18225020).
 */
export function tpbNimFromProxyAddresses(
  addresses: readonly string[] | null | undefined,
  ownNim: number,
): number | null {
  const nims = (addresses ?? []).flatMap((a) => {
    const m = ALIAS.exec(a.trim());
    const nim = m ? Number(m[1]) : NaN;
    return Number.isInteger(nim) && nim !== ownNim && isTpbNim(nim)
      ? [nim]
      : [];
  });
  return [...new Set(nims)].length === 1 ? nims[0]! : null;
}

/** Alias email akun yang sedang login, dari Microsoft Graph (`/me`). */
export async function fetchProxyAddresses(
  accessToken: string,
  timeoutMs = 3000,
): Promise<string[] | null> {
  const res = await fetch(
    'https://graph.microsoft.com/v1.0/me?$select=proxyAddresses',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { proxyAddresses?: unknown };
  return Array.isArray(body.proxyAddresses)
    ? body.proxyAddresses.filter((a): a is string => typeof a === 'string')
    : null;
}

/**
 * Saat login: catat NIM TPB dari alias Microsoft sebagai `nim_tpb` (bila belum
 * terisi), lalu gabungkan placeholder ber-NIM itu ke akun ini.
 */
export async function linkTpbFromMicrosoft(
  db: Db,
  userId: string,
  proxyAddresses: readonly string[] | null,
) {
  const [own] = await db
    .select({ nim: mahasiswa.nim, nimTpb: mahasiswa.nimTpb })
    .from(mahasiswa)
    .where(eq(mahasiswa.userId, userId));
  if (!own) return null;
  const tpb = tpbNimFromProxyAddresses(proxyAddresses, own.nim);
  if (tpb !== null && own.nimTpb === null) {
    await db
      .update(mahasiswa)
      .set({ nimTpb: tpb })
      .where(eq(mahasiswa.userId, userId));
  }
  return adoptTpbPlaceholder(db, userId);
}
