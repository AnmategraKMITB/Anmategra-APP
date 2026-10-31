import { TRPCError } from '@trpc/server';
import { eq, ilike, inArray } from 'drizzle-orm';
import { and, desc, or } from 'drizzle-orm';
import { z } from 'zod';
import { adminProcedure, createTRPCRouter } from '~/server/api/trpc';
import {
  AddVerifiedEmailInputSchema,
  AddVerifiedEmailOutputSchema,
  DeleteVerifiedEmailInputSchema,
  DeleteVerifiedEmailOutputSchema,
  GetAllReportsAdminInputSchema,
  GetAllReportsAdminOutputSchema,
  SetReportStatusInputSchema,
  SetReportStatusOutputSchema,
  UploadAlumniCsvInputSchema,
  UploadAlumniCsvOutputSchema,
} from '~/server/api/types/admin.type';
import {
  alumniPending,
  mahasiswa,
  users,
  verifiedUsers,
} from '~/server/db/schema';
import { support } from '~/server/db/schema';

export const adminRouter = createTRPCRouter({
  addVerifiedEmail: adminProcedure
    .input(AddVerifiedEmailInputSchema)
    .output(AddVerifiedEmailOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db
        .insert(verifiedUsers)
        .values({
          email: input.email,
        })
        .returning();
      return user;
    }),

  deleteVerifiedEmail: adminProcedure
    .input(DeleteVerifiedEmailInputSchema)
    .output(DeleteVerifiedEmailOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const verified_user = await ctx.db.query.verifiedUsers.findFirst({
        where: eq(verifiedUsers.email, input.email),
      });
      let userVer;
      if (verified_user) {
        userVer = await ctx.db
          .delete(verifiedUsers)
          .where(eq(verifiedUsers.email, input.email))
          .returning();
      }
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email),
      });
      if (user) {
        await ctx.db.delete(users).where(eq(users.email, input.email));
        return user;
      }
      return userVer;
    }),

  getAllReportsAdmin: adminProcedure
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

  setReportStatus: adminProcedure
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
  uploadAlumniCsv: adminProcedure
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

      return {
        success: true,
        updatedCount: registeredNims.size,
        pendingCount: pendingNims.length,
      };
    }),
});
