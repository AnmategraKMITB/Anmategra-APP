import { TRPCError } from '@trpc/server';
import { eq, ilike, inArray } from 'drizzle-orm';
import { and, desc, or } from 'drizzle-orm';
import { z } from 'zod';
import { adminPermissionProcedure, createTRPCRouter } from '~/server/api/trpc';
import {
  GetAllReportsAdminInputSchema,
  GetAllReportsAdminOutputSchema,
  SetReportStatusInputSchema,
  SetReportStatusOutputSchema,
  UploadAlumniCsvInputSchema,
  UploadAlumniCsvOutputSchema,
} from '~/server/api/types/admin.type';
import { adminAudit, alumniPending, mahasiswa } from '~/server/db/schema';
import { support } from '~/server/db/schema';

export const adminRouter = createTRPCRouter({
  getAllReportsAdmin: adminPermissionProcedure('reports.read')
    .input(GetAllReportsAdminInputSchema)
    .output(GetAllReportsAdminOutputSchema)
    .query(async ({ ctx, input }) => {
      try {
        const reports = await ctx.db
          .select()
          .from(support)
          .where(
            and(
              inArray(support.status, ['In Progress', 'Resolved', 'Reported']), // Only include non-draft reports
              input.status ? eq(support.status, input.status) : undefined,
              input.search
                ? or(
                    ilike(support.subject, `%${input.search}%`),
                    ilike(support.description, `%${input.search}%`),
                  )
                : undefined,
            ),
          )
          .orderBy(desc(support.created_at));
        return {
          reports: reports.map((report) => ({
            id: report.id,
            subject: report.subject,
            urgent: report.urgent,
            description: report.description,
            status: report.status,
            attachment: report.attachment ?? undefined,
            created_at: report.created_at.toISOString(),
            updated_at: report.updated_at.toISOString(),
          })),
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal fetch laporan',
        });
      }
    }),

  setReportStatus: adminPermissionProcedure('reports.write')
    .input(SetReportStatusInputSchema)
    .output(SetReportStatusOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const existingReport = await ctx.db.query.support.findFirst({
        where: eq(support.id, input.id),
      });

      if (!existingReport) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Laporan tidak ditemukan',
        });
      }

      if (existingReport.status === input.status) {
        return {
          success: true,
          message: 'Status laporan sudah diatur ke nilai yang diinginkan',
        };
      }

      const statusOrder = {
        Draft: 0,
        Reported: 1,
        'In Progress': 2,
        Resolved: 3,
      } as const;

      const currentOrder = statusOrder[existingReport.status];
      const newOrder = statusOrder[input.status];

      // Prevent going backward
      if (newOrder < currentOrder) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Tidak dapat mengubah status laporan mundur dari ${existingReport.status} ke ${input.status}`,
        });
      }
      await ctx.db
        .update(support)
        .set({ status: input.status })
        .where(eq(support.id, input.id));
      return { success: true, message: 'Status laporan berhasil diperbarui' };
    }),

  // H-03: upload CSV wisuda. NIM yang match akun terdaftar langsung jadi
  // alumni; NIM yang belum terdaftar disimpan sebagai pending dan otomatis
  // diterapkan saat mahasiswa itu sign-in pertama kali (lihat auth.ts).
  uploadAlumniCsv: adminPermissionProcedure('alumni.write')
    .input(UploadAlumniCsvInputSchema)
    .output(UploadAlumniCsvOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const existingMahasiswa = await ctx.db.query.mahasiswa.findMany({
        where: inArray(mahasiswa.nim, input.nims),
        columns: { nim: true },
      });
      const registeredNims = new Set(existingMahasiswa.map((m) => m.nim));
      const pendingNims = input.nims.filter((nim) => !registeredNims.has(nim));

      if (registeredNims.size > 0) {
        await ctx.db
          .update(mahasiswa)
          .set({ status: 'alumni' })
          .where(inArray(mahasiswa.nim, Array.from(registeredNims)));
      }

      for (const nim of pendingNims) {
        await ctx.db
          .insert(alumniPending)
          .values({
            nim,
            wisudaBatch: input.wisudaBatch,
            uploadedBy: ctx.session.user.id,
          })
          .onConflictDoUpdate({
            target: alumniPending.nim,
            set: {
              wisudaBatch: input.wisudaBatch,
              uploadedBy: ctx.session.user.id,
            },
          });
      }

      await ctx.db.insert(adminAudit).values({
        actorId: ctx.session.user.id,
        action: 'alumni_import',
        entityType: 'mahasiswa',
        entityId: null,
        summary: `Impor alumni${input.wisudaBatch ? ` ${input.wisudaBatch}` : ''}: ${registeredNims.size} diperbarui, ${pendingNims.length} menunggu`,
        metadata: {
          total: input.nims.length,
          updated: registeredNims.size,
          pending: pendingNims.length,
          wisudaBatch: input.wisudaBatch ?? null,
        },
      });

      return {
        success: true,
        updatedCount: registeredNims.size,
        pendingCount: pendingNims.length,
      };
    }),
});
