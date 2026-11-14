import {
  type AnyColumn,
  type SQL,
  and,
  desc,
  eq,
  getTableName,
  or,
  sql,
} from 'drizzle-orm';
import { type db } from '~/server/db';
import { form, lembaga, recruitment } from '~/server/db/schema';

type Database = typeof db;

/**
 * Bagi lembaga berjenis Kepanitiaan, satu periode kepengurusan adalah satu
 * penyelenggaraan acaranya, jadi periode itu juga tampil sebagai kegiatan:
 * di profil lembaga, profil anggota, beranda, dan menu Kelola. `kind` di
 * database tetap `kepengurusan` supaya organogram dan oprec tidak berubah.
 */
export function isListedAsKegiatan(
  kind: string,
  lembagaType: string | null | undefined,
): boolean {
  return (
    kind === 'kegiatan' ||
    (kind === 'kepengurusan' && lembagaType === 'Kepanitiaan')
  );
}

/**
 * Padanan SQL `isListedAsKegiatan`; juga bisa dipakai di callback `where` query
 * relasional. Kolom di subquery sengaja ditulis tanpa nama tabel: query
 * relasional mengganti setiap kolom Drizzle dengan alias tabel utamanya.
 */
export function listedAsKegiatan(period: {
  kind: AnyColumn;
  org_id: AnyColumn;
}): SQL {
  return or(
    eq(period.kind, 'kegiatan'),
    and(
      eq(period.kind, 'kepengurusan'),
      sql`${period.org_id} IN (SELECT "id" FROM ${sql.identifier(getTableName(lembaga))} WHERE "type" = 'Kepanitiaan')`,
    ),
  )!;
}

/**
 * Tautan pendaftaran untuk tombol "Daftar" di profil kegiatan: formulir oprec
 * yang sedang dibuka (oprec `open`, formulir `Published` dan belum lewat batas),
 * lalu `oprec_link` manual. Jalan masuk cadangan bila tautan formulir yang
 * dibagikan gagal mengantar pendaftar ke formulirnya.
 */
export async function registrationLink(
  database: Database,
  period: { id: string; oprec_link: string | null },
): Promise<string | null> {
  const [open] = await database
    .select({ id: form.id, slug: form.slug })
    .from(recruitment)
    .innerJoin(form, eq(form.id, recruitment.formId))
    .where(
      and(
        eq(recruitment.periodId, period.id),
        eq(recruitment.status, 'open'),
        eq(form.status, 'Published'),
        sql`(${form.closesAt} IS NULL OR ${form.closesAt} > now())`,
      ),
    )
    .orderBy(desc(recruitment.created_at))
    .limit(1);
  if (open) return `/forms/${open.slug ?? open.id}`;
  return period.oprec_link;
}
