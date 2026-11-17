import { and, asc, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { groupAnnouncement } from '~/lib/oprec/announcement';
import { resultsPublished } from '~/server/api/oprec-release';
import { protectedProcedure } from '~/server/api/trpc';
import {
  applicationChoice,
  mahasiswa,
  organizationUnit,
  placement,
  recruitment,
  recruitmentDivision,
  users,
} from '~/server/db/schema';

import { RecruitmentIdInputSchema } from '../../types/oprec.type';
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
            rows: z.array(RowSchema),
          }),
        ),
      }),
    ),
  }),
]);

export const announcementProcedures = {
  /**
   * Daftar penerima yang tayang untuk mahasiswa ber-login. Hanya Nama, NIM,
   * Prodi, Angkatan; tanpa kontak, jabatan, atau gelombang. Sebelum tayang,
   * tidak ada baris yang dikembalikan.
   */
  announcement: protectedProcedure
    .input(RecruitmentIdInputSchema)
    .output(AnnouncementOutputSchema)
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          name: recruitment.name,
          resultsReleasedAt: recruitment.resultsReleasedAt,
          resultsPublishAt: recruitment.resultsPublishAt,
          visible: recruitment.resultsVisibleToApplicants,
        })
        .from(recruitment)
        .where(eq(recruitment.id, input.recruitmentId));
      if (!row) notFound('Oprec tidak ditemukan.');
      if (!row.visible || !resultsPublished(row)) {
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
        })
        .from(recruitmentDivision)
        .innerJoin(
          organizationUnit,
          eq(organizationUnit.id, recruitmentDivision.unitId),
        )
        .leftJoin(parent, eq(parent.id, organizationUnit.parent_id))
        .where(eq(recruitmentDivision.recruitmentId, input.recruitmentId))
        .orderBy(asc(recruitmentDivision.sortOrder), asc(organizationUnit.name));

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
            eq(recruitmentDivision.recruitmentId, input.recruitmentId),
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
