/**
 * Gabungkan akun placeholder ber-NIM TPB (hasil impor, belum pernah login) ke
 * akun NIM jurusan yang dipakai login, supaya jabatan organogram, keanggotaan,
 * dan akses oprec ikut pindah.
 *
 *   SKIP_ENV_VALIDATION=1 DATABASE_URL=... npm run akun:gabung-tpb
 *   ... npm run akun:gabung-tpb -- --pair 16325024:12025048 --pair ...
 *   ... npm run akun:gabung-tpb -- --apply
 *
 * Tanpa `--apply` semuanya dijalankan lalu di-rollback (dry-run), jadi laporan
 * jumlah baris yang dipindah sama persis dengan saat diterapkan.
 *
 * - Pasangan otomatis: tautan `nim_tpb`, atau nama + angkatan + fakultas yang
 *   sama dan unik di kedua sisi. Nama kembar dilaporkan, tidak digabung.
 * - `--pair TPB:JURUSAN`: pasangan yang diketahui admin. Bila akun NIM jurusan
 *   belum ada (belum pernah login), placeholder diganti identitasnya sehingga
 *   login pertamanya langsung tersambung.
 * - `--hanya-pair`: abaikan pasangan otomatis.
 */
import { eq } from 'drizzle-orm';
import {
  type MergeReport,
  findTpbCandidates,
  isTpbNim,
  mergeUsers,
  rebadgePlaceholder,
} from '~/server/akun/gabung-akun';
import { db } from '~/server/db';
import { mahasiswa, users } from '~/server/db/schema';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const onlyPairs = args.includes('--hanya-pair');
const manual = args.flatMap((arg, i) =>
  args[i - 1] === '--pair' ? [arg.split(':').map(Number)] : [],
) as [number, number][];

class Rollback extends Error {}

type Row = {
  aksi: 'gabung' | 'ganti identitas' | 'dilewati';
  dari: string;
  ke: string;
  alasan: string;
  dipindah: string;
};

const summary = (r: MergeReport) =>
  [
    ...Object.entries(r.moved).map(
      ([k, n]) => `${k.replace('anmategra_', '')}:${n}`,
    ),
    ...Object.entries(r.dropped).map(
      ([k, n]) => `${k.replace('anmategra_', '')}:-${n} kembar`,
    ),
  ].join(', ') || '-';

async function userByNim(nim: number) {
  const [row] = await db
    .select({ userId: mahasiswa.userId, name: users.name })
    .from(mahasiswa)
    .innerJoin(users, eq(users.id, mahasiswa.userId))
    .where(eq(mahasiswa.nim, nim));
  return row ?? null;
}

async function main() {
  for (const [tpb, major] of manual) {
    if (!Number.isInteger(tpb) || !Number.isInteger(major) || !isTpbNim(tpb)) {
      throw new Error(
        `--pair tidak sah: ${tpb}:${major} (format TPB:JURUSAN).`,
      );
    }
  }
  const auto = onlyPairs
    ? { pairs: [], ambiguous: [] }
    : await findTpbCandidates(db);
  const rows: Row[] = [];

  try {
    await db.transaction(async (tx) => {
      const done = new Set<string>();
      for (const p of auto.pairs) {
        const report = await mergeUsers(
          tx,
          p.placeholder.userId,
          p.target.userId,
        );
        done.add(p.placeholder.userId);
        rows.push({
          aksi: 'gabung',
          dari: `${p.placeholder.nim} ${p.placeholder.name ?? ''}`,
          ke: `${p.target.nim} ${p.target.name ?? ''}`,
          alasan:
            p.reason === 'nim_tpb'
              ? 'tautan nim_tpb'
              : 'nama+angkatan+fakultas',
          dipindah: summary(report),
        });
      }
      for (const [tpb, major] of manual) {
        const from = await userByNim(tpb);
        const label = `${tpb} ${from?.name ?? ''}`;
        if (!from || done.has(from.userId)) {
          rows.push({
            aksi: 'dilewati',
            dari: label,
            ke: String(major),
            alasan: from
              ? 'sudah digabung otomatis'
              : 'NIM TPB tidak ditemukan',
            dipindah: '-',
          });
          continue;
        }
        const into = await userByNim(major);
        if (into) {
          const report = await mergeUsers(tx, from.userId, into.userId);
          rows.push({
            aksi: 'gabung',
            dari: label,
            ke: `${major} ${into.name ?? ''}`,
            alasan: 'pasangan admin',
            dipindah: summary(report),
          });
        } else {
          await rebadgePlaceholder(tx, from.userId, major);
          rows.push({
            aksi: 'ganti identitas',
            dari: label,
            ke: `${major} (belum pernah login)`,
            alasan: 'pasangan admin',
            dipindah: 'email + NIM',
          });
        }
      }
      if (!apply) throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }

  console.table(rows);
  if (auto.ambiguous.length > 0) {
    console.log(
      `\n${auto.ambiguous.length} placeholder TPB punya nama kembar; tidak digabung. Pakai --pair bila pasangannya pasti:`,
    );
    console.table(auto.ambiguous.map((a) => ({ nim: a.nim, nama: a.name })));
  }
  console.log(
    apply
      ? `\nDiterapkan: ${rows.filter((r) => r.aksi !== 'dilewati').length} akun.`
      : '\nDry-run: tidak ada yang diubah. Tambahkan --apply untuk menerapkan.',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
