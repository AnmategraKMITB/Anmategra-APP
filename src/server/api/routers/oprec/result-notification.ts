import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { recruitmentPublished } from '~/server/api/oprec-release';
import { protectedProcedure } from '~/server/api/trpc';
import { notifications, recruitment } from '~/server/db/schema';

import { type Database } from './services';

type Tx = Pick<Database, 'execute'>;

export const RESULT_NOTIFICATION_KIND = 'hasil_oprec';

/**
 * Pemberitahuan Inbox saat hasil dirilis, satu `INSERT ... SELECT` di dalam
 * transaksi rilis (gagal berarti rilis batal). Penerima: pendaftar dengan
 * pendaftaran terkirim, ditambah orang closerec. Pesan seragam tanpa status.
 * Hanya pada rilis pertama: bila oprec sudah pernah diberi pemberitahuan jenis
 * ini, rilis ulang (setelah tarik) tidak membuat apa pun. Unik per (pengguna, oprec, jenis).
 */
export async function notifyResultsReleased(
  tx: Tx,
  row: { id: string; name: string; formId: string },
) {
  const title = `Hasil oprec ${row.name} sudah diumumkan`;
  const content = `Hasil oprec ${row.name} sudah diumumkan. Buka hasil pribadimu atau lihat daftar lengkap penerima.`;
  const links = JSON.stringify([
    { label: 'Lihat hasil saya', href: `/forms/${row.formId}` },
    { label: 'Lihat daftar pengumuman', href: `/pengumuman/${row.id}` },
  ]);
  await tx.execute(sql`
    INSERT INTO ${notifications}
      (id, user_id, title, content, type, recruitment_id, kind, links)
    SELECT gen_random_uuid()::text, a.user_id, ${title}, ${content},
      'System', ${row.id}, ${RESULT_NOTIFICATION_KIND}, ${links}::jsonb
    FROM anmategra_application a
    WHERE a.recruitment_id = ${row.id}
      AND (a.submitted_at IS NOT NULL OR a.source = 'closerec')
      AND NOT EXISTS (
        SELECT 1 FROM ${notifications} n
        WHERE n.recruitment_id = ${row.id} AND n.kind = ${RESULT_NOTIFICATION_KIND})
    ON CONFLICT DO NOTHING`);
}

export const resultNotificationProcedures = {
  /** Pemberitahuan hasil milik sendiri; tersaring gerbang tayang. */
  myResultNotifications: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: notifications.id,
        title: notifications.title,
        content: notifications.content,
        read: notifications.read,
        links: notifications.links,
        createdAt: notifications.created_at,
      })
      .from(notifications)
      .innerJoin(recruitment, eq(recruitment.id, notifications.recruitmentId))
      .where(
        and(
          eq(notifications.user_id, ctx.session.user.id),
          eq(notifications.kind, RESULT_NOTIFICATION_KIND),
          recruitmentPublished,
        ),
      )
      .orderBy(desc(notifications.created_at));
    return rows.map((r) => ({ ...r, links: r.links ?? [] }));
  }),

  markResultNotificationRead: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.user_id, ctx.session.user.id),
          ),
        );
      return { success: true };
    }),
};
