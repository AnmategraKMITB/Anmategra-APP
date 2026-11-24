import { and, countDistinct, eq, inArray, isNotNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { oprecDivisionProcedure } from '~/server/api/trpc';
import { assessment, criterion } from '~/server/db/schema';

import { canEditDivision } from './division-scope';
import { loadPlacementDivisions } from './placement';

export const divisionSettingsProcedures = {
  /**
   * Ringkasan Pengaturan divisi: divisi dalam cakupan beserta kuota dan
   * jumlah pendaftar yang sudah dinilai (untuk peringatan saat kriteria
   * diubah di tengah penilaian), serta pengaturan oprec yang baca-saja.
   */
  divisionSettings: oprecDivisionProcedure
    .input(z.object({ recruitmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const divisions = (
        await loadPlacementDivisions(ctx.db, input.recruitmentId)
      ).filter((division) => canEditDivision(ctx.divisionScope, division.id));
      const ids = divisions.map((division) => division.id);
      const assessed =
        ids.length > 0
          ? await ctx.db
              .select({
                divisionId: criterion.divisionId,
                n: countDistinct(assessment.applicationId),
              })
              .from(assessment)
              .innerJoin(criterion, eq(criterion.id, assessment.criterionId))
              .where(
                and(
                  eq(criterion.recruitmentId, input.recruitmentId),
                  inArray(criterion.divisionId, ids),
                  or(
                    isNotNull(assessment.rating),
                    isNotNull(assessment.gateState),
                  ),
                ),
              )
              .groupBy(criterion.divisionId)
          : [];
      const assessedOf = new Map(
        assessed.map((row) => [row.divisionId, row.n]),
      );
      const rec = ctx.recruitment;
      return {
        name: rec.name,
        isAdmin: ctx.divisionScope.isAdmin,
        scoringMode: rec.scoringMode,
        statusMethod: rec.statusMethod,
        placementMethod: rec.placementMethod,
        placementState: rec.placementState,
        divisions: divisions.map((division) => ({
          id: division.id,
          label: division.label,
          groupLabel: division.groupLabel,
          quota: division.quota,
          assessedCount: assessedOf.get(division.id) ?? 0,
        })),
      };
    }),
};
