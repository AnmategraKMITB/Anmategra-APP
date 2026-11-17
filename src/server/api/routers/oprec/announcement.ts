import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { groupAnnouncement, parseInviteUrl } from '~/lib/oprec/announcement';
import {
  recruitmentPublished,
  resultsPublished,
} from '~/server/api/oprec-release';
import { oprecAssessProcedure, protectedProcedure } from '~/server/api/trpc';
import {
  applicationChoice,
  events,
  form,
  mahasiswa,
  organizationUnit,
  placement,
  recruitment,
  recruitmentDivision,
  users,
} from '~/server/db/schema';

import { canDecideDivision } from './assess-access';
import { logAction } from './log';
import { notFound } from './services';

const RowSchema = z.object({
  name: z.string(),
  nim: z.number(),
  prodi: z.string(),
  angkatan: z.number(),
});

const AnnouncementOutputSchema = z.discriminatedUnion('published', [
  z.object({
    published: z.literal(false),
    name: z.string(),
    /** Jadwal tayang bila hasil sudah dirilis tetapi belum waktunya. */
    publishAt: z.date().nullable(),
  }),
  z.object({
    published: z.literal(true),
    name: z.string(),
    sections: z.array(
      z.object({
        label: z.string().nullable(),
        divisions: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            inviteUrl: z.string().nullable(),
            rows: z.array(RowSchema),
          }),
        ),
      }),
    ),
  }),
]);

/** Id oprec atau slug formulirnya; slug formulir yang dibagikan ikut dipakai di URL pengumuman. */
const AnnouncementRefSchema = z.object({
  recruitmentId: z.string().min(1).max(255),
});

export const announcementProcedures = {
  /**
   * Isi atau kosongkan tautan grup LINE/WhatsApp sebuah divisi. Hanya admin
   * oprec atau pengurus yang memegang keputusan divisi itu. Tautan tidak
   * diperiksa domain maupun keaktifannya; hanya harus URL http/https.
   */
  setDivisionInviteUrl: oprecAssessProcedure
    .input(
      z.object({
        recruitmentId: z.string().min(1).max(255),
        divisionId: z.string().min(1).max(255),
        url: z.string().trim().max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!canDecideDivision(ctx.assess, input.divisionId)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Kamu tidak memegang penilaian untuk divisi itu.',
        });
      }
      const url = input.url === '' ? null : parseInviteUrl(input.url);
      if (input.url !== '' && url === null) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Tautan tidak sah. Tempel alamat lengkap yang diawali https://.',
        });
      }
      const updated = await ctx.db
        .update(recruitmentDivision)
        .set({ groupInviteUrl: url })
        .where(
          and(
            eq(recruitmentDivision.id, input.divisionId),
            eq(recruitmentDivision.recruitmentId, ctx.recruitment.id),
          ),
        )
        .returning({ id: recruitmentDivision.id });
      if (updated.length === 0) notFound('Divisi tidak ditemukan.');
      await logAction(ctx.db, {
        recruitmentId: ctx.recruitment.id,
        actorId: ctx.session.user.id,
        action: 'tautan_grup_diubah',
        entityType: 'recruitment_division',
        entityId: input.divisionId,
        detail: { set: url !== null },
      });
      return { success: true, url };
    }),

  /** Pengumuman oprec yang sudah tayang milik satu lembaga, terbaru dulu. */
  lembagaAnnouncements: protectedProcedure
    .input(
      z.object({
        lembagaId: z.string().min(1).max(255),
        /** Batasi ke satu kegiatan/periode (profil kegiatan). */
        periodId: z.string().min(1).max(255).optional(),
      }),
    )
    .output(
      z.array(
        z.object({
          id: z.string(),
          /** Segmen URL `/pengumuman/<ref>`: slug formulir bila ada, selain itu id. */
          ref: z.string(),
          name: z.string(),
          publishedAt: z.date(),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: recruitment.id,
          name: recruitment.name,
          slug: form.slug,
          releasedAt: recruitment.resultsReleasedAt,
          publishAt: recruitment.resultsPublishAt,
        })
        .from(recruitment)
        .innerJoin(form, eq(form.id, recruitment.formId))
        .innerJoin(events, eq(events.id, recruitment.periodId))
        .where(
          and(
            eq(events.org_id, input.lembagaId),
            input.periodId ? eq(events.id, input.periodId) : undefined,
            recruitmentPublished,
          ),
        )
        .orderBy(desc(recruitment.resultsReleasedAt));
      return rows.map((r) => ({
        id: r.id,
        ref: r.slug ?? r.id,
        name: r.name,
        publishedAt: (r.publishAt ?? r.releasedAt)!,
      }));
    }),

  /**
   * Daftar penerima yang tayang untuk mahasiswa ber-login. Hanya Nama, NIM,
   * Prodi, Angkatan; tanpa kontak, jabatan, atau gelombang. Sebelum tayang,
   * tidak ada baris yang dikembalikan.
   */
  announcement: protectedProcedure
    .input(AnnouncementRefSchema)
    .output(AnnouncementOutputSchema)
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          id: recruitment.id,
          name: recruitment.name,
          resultsReleasedAt: recruitment.resultsReleasedAt,
          resultsPublishAt: recruitment.resultsPublishAt,
        })
        .from(recruitment)
        .innerJoin(form, eq(form.id, recruitment.formId))
        .where(
          or(
            eq(recruitment.id, input.recruitmentId),
            eq(form.slug, input.recruitmentId),
          ),
        )
        // Id yang cocok menang atas slug yang kebetulan sama.
        .orderBy(sql`(${recruitment.id} = ${input.recruitmentId}) DESC`)
        .limit(1);
      if (!row) notFound('Oprec tidak ditemukan.');
      if (!resultsPublished(row)) {
        return {
          published: false as const,
          name: row.name,
          publishAt:
            row.resultsReleasedAt !== null ? row.resultsPublishAt : null,
        };
      }

      const parent = alias(organizationUnit, 'parent_unit');
      const divisions = await ctx.db
        .select({
          id: recruitmentDivision.id,
          label: organizationUnit.name,
          groupLabel: parent.name,
          inviteUrl: recruitmentDivision.groupInviteUrl,
        })
        .from(recruitmentDivision)
        .innerJoin(
          organizationUnit,
          eq(organizationUnit.id, recruitmentDivision.unitId),
        )
        .leftJoin(parent, eq(parent.id, organizationUnit.parent_id))
        .where(eq(recruitmentDivision.recruitmentId, row.id))
        .orderBy(
          asc(recruitmentDivision.sortOrder),
          asc(organizationUnit.name),
        );

      const rows = await ctx.db
        .select({
          divisionId: applicationChoice.divisionId,
          name: mahasiswa.nama,
          accountName: users.name,
          nim: mahasiswa.nim,
          prodi: mahasiswa.jurusan,
          angkatan: mahasiswa.angkatan,
        })
        .from(placement)
        .innerJoin(
          applicationChoice,
          eq(applicationChoice.id, placement.applicationChoiceId),
        )
        .innerJoin(
          recruitmentDivision,
          eq(recruitmentDivision.id, applicationChoice.divisionId),
        )
        .innerJoin(users, eq(users.id, placement.userId))
        .innerJoin(mahasiswa, eq(mahasiswa.userId, users.id))
        .where(
          and(
            eq(recruitmentDivision.recruitmentId, row.id),
            isNull(users.hiddenAt),
          ),
        )
        .groupBy(
          applicationChoice.divisionId,
          users.id,
          mahasiswa.nama,
          users.name,
          mahasiswa.nim,
          mahasiswa.jurusan,
          mahasiswa.angkatan,
        );

      return {
        published: true as const,
        name: row.name,
        sections: groupAnnouncement(
          divisions,
          rows.map(({ accountName, name, ...rest }) => ({
            ...rest,
            name: name ?? accountName ?? '-',
          })),
        ),
      };
    }),
};
