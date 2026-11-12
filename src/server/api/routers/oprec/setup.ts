import { TRPCError } from '@trpc/server';
import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNull,
  notInArray,
  sql,
} from 'drizzle-orm';
import { waveOverlapMessage } from '~/lib/oprec/waves';
import { canManageLembaga } from '~/server/api/access';
import { oprecPeriodProcedure } from '~/server/api/trpc';
import {
  MAX_FIELDS_PER_FORM,
  MAX_SECTIONS_PER_FORM,
} from '~/server/api/types/form.constants';
import {
  accessGrant,
  criterion,
  events,
  form,
  formField,
  formSection,
  formSubmission,
  lembaga,
  mahasiswa,
  organizationPosition,
  organizationStructure,
  organizationUnit,
  placement,
  recruitment,
  recruitmentAssessor,
  recruitmentDivision,
  recruitmentEligibilityRule,
  recruitmentSetupDraft,
  recruitmentWave,
  users,
} from '~/server/db/schema';

import {
  CreateFromSetupInputSchema,
  SetupDraftGetInputSchema,
  SetupDraftSaveInputSchema,
  SetupOptionsInputSchema,
} from '../../types/oprec.type';
import { lockForm } from '../form/services';
import { logAction } from './log';
import {
  type Queryable,
  applySectionBinding,
  assertDivisionTarget,
  assertSourceUnit,
  conflict,
  notFound,
  pgCode,
} from './services';

/** Nama level bawaan bila organogram belum punya `level_labels` maupun label jenis. */
const FALLBACK_LEVEL_LABELS = ['Bidang', 'Divisi'];

/**
 * Nama level 1 dan 2 untuk layar setup: `level_labels` organogram, lalu label
 * jenis bagian pada kedalaman itu, lalu nama bawaan.
 */
function resolveLevelLabels(
  levelLabels: string[] | null,
  units: { level: number; typeLabel: string | null }[],
): string[] {
  return [0, 1].map((i) => {
    const fromStructure = levelLabels?.[i]?.trim();
    if (fromStructure) return fromStructure;
    const fromUnit = units.find(
      (u) => u.level === i + 1 && u.typeLabel?.trim(),
    )?.typeLabel;
    return fromUnit?.trim() ?? FALLBACK_LEVEL_LABELS[i]!;
  });
}

/** Periode lain yang boleh jadi sumber organogram: periode sendiri atau milik lembaga di bawahnya. */
async function listSources(db: Queryable, eventId: string) {
  const own = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { id: true, name: true, org_id: true },
  });
  if (!own) notFound('Periode tidak ditemukan.');
  const sources = [
    { periodId: own.id, name: own.name, lembagaName: null as string | null },
  ];
  if (!own.org_id) return { own, sources };

  const children = await db
    .select({ id: lembaga.id, name: lembaga.name })
    .from(lembaga)
    .where(eq(lembaga.parentId, own.org_id));
  if (children.length > 0) {
    const periods = await db
      .select({
        id: events.id,
        name: events.name,
        orgId: events.org_id,
        status: events.status,
      })
      .from(events)
      .innerJoin(
        organizationStructure,
        and(
          eq(organizationStructure.eventId, events.id),
          eq(organizationStructure.is_active, true),
        ),
      )
      .where(
        and(
          inArray(
            events.org_id,
            children.map((c) => c.id),
          ),
          notInArray(events.status, ['Ended']),
        ),
      );
    for (const p of periods) {
      sources.push({
        periodId: p.id,
        name: p.name,
        lembagaName: children.find((c) => c.id === p.orgId)?.name ?? null,
      });
    }
  }
  return { own, sources };
}

async function loadTree(db: Queryable, periodId: string) {
  const [structure] = await db
    .select()
    .from(organizationStructure)
    .where(
      and(
        eq(organizationStructure.eventId, periodId),
        eq(organizationStructure.is_active, true),
      ),
    );
  if (!structure) return null;
  const [units, positions] = await Promise.all([
    db
      .select({
        id: organizationUnit.id,
        parentId: organizationUnit.parent_id,
        name: organizationUnit.name,
        level: organizationUnit.level,
        typeLabel: organizationUnit.typeLabel,
        sortOrder: organizationUnit.sort_order,
      })
      .from(organizationUnit)
      .where(eq(organizationUnit.structure_id, structure.id))
      .orderBy(asc(organizationUnit.sort_order), asc(organizationUnit.name)),
    db
      .select({
        id: organizationPosition.id,
        unitId: organizationPosition.unitId,
        title: organizationPosition.title,
        rank: organizationPosition.rank,
        quota: organizationPosition.quota,
        sortOrder: organizationPosition.sort_order,
      })
      .from(organizationPosition)
      .innerJoin(
        organizationUnit,
        eq(organizationUnit.id, organizationPosition.unitId),
      )
      .where(
        and(
          eq(organizationUnit.structure_id, structure.id),
          eq(organizationPosition.hidden, false),
        ),
      )
      .orderBy(asc(organizationPosition.sort_order)),
  ]);
  return {
    structureId: structure.id,
    name: structure.name,
    levelLabels: resolveLevelLabels(structure.levelLabels, units),
    units,
    positions,
  };
}

type FieldSeed = {
  sectionId: string;
  type: 'long_text' | 'link' | 'text_block' | 'unit_choice' | 'checkbox';
  label: string;
  required: boolean;
};

export const setupProcedures = {
  /** Bahan layar setup: organogram sumber, periode sumber lain, dan form yang belum terikat. */
  setupOptions: oprecPeriodProcedure
    .input(SetupOptionsInputSchema)
    .query(async ({ ctx, input }) => {
      const { own, sources } = await listSources(ctx.db, input.eventId);
      const sourcePeriodId = input.sourcePeriodId ?? own.id;
      if (!sources.some((s) => s.periodId === sourcePeriodId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Organogram itu bukan milik periode ini atau lembaga di bawahnya.',
        });
      }
      const tree = await loadTree(ctx.db, sourcePeriodId);

      const forms = await ctx.db
        .select({ id: form.id, title: form.title, status: form.status })
        .from(form)
        .where(eq(form.eventId, input.eventId))
        .orderBy(asc(form.title));
      const bound = new Set(
        (
          await ctx.db
            .select({ formId: recruitment.formId })
            .from(recruitment)
            .where(eq(recruitment.periodId, input.eventId))
        ).map((r) => r.formId),
      );
      const usable: ((typeof forms)[number] & { hasUnitChoice: boolean })[] =
        [];
      for (const f of forms) {
        if (bound.has(f.id)) continue;
        const [subs] = await ctx.db
          .select({ n: count() })
          .from(formSubmission)
          .where(eq(formSubmission.formId, f.id));
        if ((subs?.n ?? 0) > 0) continue;
        const [uc] = await ctx.db
          .select({ n: count() })
          .from(formField)
          .where(
            and(
              eq(formField.formId, f.id),
              eq(formField.type, 'unit_choice'),
              isNull(formField.archivedAt),
            ),
          );
        usable.push({ ...f, hasUnitChoice: (uc?.n ?? 0) > 0 });
      }
      return { sources, sourcePeriodId, tree, forms: usable };
    }),

  /** Draf wizard milik pengguna ini pada periode ini, atau null. */
  setupDraftGet: oprecPeriodProcedure
    .input(SetupDraftGetInputSchema)
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          state: recruitmentSetupDraft.state,
          step: recruitmentSetupDraft.step,
          phase: recruitmentSetupDraft.phase,
          updatedAt: recruitmentSetupDraft.updated_at,
        })
        .from(recruitmentSetupDraft)
        .where(
          and(
            eq(recruitmentSetupDraft.periodId, input.eventId),
            eq(recruitmentSetupDraft.userId, ctx.session.user.id),
          ),
        );
      return row ?? null;
    }),

  /** Simpan draf (upsert per periode + pengguna) tiap pindah langkah. */
  setupDraftSave: oprecPeriodProcedure
    .input(SetupDraftSaveInputSchema)
    .mutation(async ({ ctx, input }) => {
      const values = {
        state: input.state,
        step: input.step,
        phase: input.phase,
      };
      await ctx.db
        .insert(recruitmentSetupDraft)
        .values({
          periodId: input.eventId,
          userId: ctx.session.user.id,
          ...values,
        })
        .onConflictDoUpdate({
          target: [
            recruitmentSetupDraft.periodId,
            recruitmentSetupDraft.userId,
          ],
          set: { ...values, updated_at: new Date() },
        });
      return { ok: true as const };
    }),

  setupDraftDiscard: oprecPeriodProcedure
    .input(SetupDraftGetInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(recruitmentSetupDraft)
        .where(
          and(
            eq(recruitmentSetupDraft.periodId, input.eventId),
            eq(recruitmentSetupDraft.userId, ctx.session.user.id),
          ),
        );
      return { ok: true as const };
    }),

  /**
   * Menerapkan hasil wizard dalam satu transaksi: membuat oprec, tujuan,
   * gelombang, syarat, dan (bila diminta) formulir dari templat. Oprec
   * dibuat berstatus draf; membukanya tetap langkah terpisah.
   */
  createFromSetup: oprecPeriodProcedure
    .input(CreateFromSetupInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.minChoices > input.maxChoices) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Batas pilihan minimum tidak boleh melebihi maksimum.',
        });
      }
      if (input.maxChoices > input.divisions.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Jumlah pilihan melebihi jumlah tujuan yang dibuka.',
        });
      }
      const unitIds = input.divisions.map((d) => d.unitId);
      if (new Set(unitIds).size !== unitIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Satu tujuan tidak boleh dipilih dua kali.',
        });
      }
      const perDivisi =
        input.form.mode === 'template' && input.grouping === 'per_divisi';
      if (perDivisi && input.divisions.length > MAX_SECTIONS_PER_FORM) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Formulir maksimal punya ${MAX_SECTIONS_PER_FORM} bagian. Pilih "satu bagian" atau kurangi tujuan.`,
        });
      }
      for (const d of input.divisions) {
        await assertDivisionTarget(
          ctx.db,
          { id: '', periodId: input.eventId },
          d.unitId,
          d.positionId,
        );
      }
      // S13/S14: penilai umum berasal dari satu bagian organogram. Bagian itu
      // disimpan hanya bila ada penilai umum.
      const needsGeneral =
        input.settings.assessorMode === 'umum' ||
        input.settings.assessorMode === 'keduanya';
      const generalUnitId = needsGeneral
        ? (input.generalAssessorUnitId ?? null)
        : null;
      if (needsGeneral) {
        if (!generalUnitId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Pilih bagian penilai umum.',
          });
        }
        await assertSourceUnit(ctx.db, input.eventId, generalUnitId);
      }
      const overlap = waveOverlapMessage(input.waves);
      if (overlap)
        throw new TRPCError({ code: 'BAD_REQUEST', message: overlap });
      // S15: tanpa syarat gugur, kriteria gugur tidak boleh ada.
      if (
        input.settings.hasGugur === false &&
        input.criteria.some((c) => c.kind === 'gugur_manual')
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Syarat gugur dimatikan, tetapi ada kriteria jenis gugur. Hapus kriteria itu atau aktifkan syarat gugur.',
        });
      }

      // S17: pengelola divalidasi seluruhnya sebelum ada yang ditulis.
      const managers = await resolveManagers(
        ctx,
        input.eventId,
        input.managers,
      );

      try {
        return await ctx.db.transaction(async (tx) => {
          await grantOprecAccess(tx, {
            periodId: input.eventId,
            grantedBy: ctx.session.user.id,
            userIds: managers.map((m) => m.userId),
          });

          // Formulir: dari templat atau yang sudah ada.
          let formId: string;
          if (input.form.mode === 'existing') {
            const [row] = await tx
              .select({ id: form.id, eventId: form.eventId })
              .from(form)
              .where(eq(form.id, input.form.formId))
              .for('update');
            if (!row) notFound('Formulir tidak ditemukan.');
            if (row.eventId !== input.eventId) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Formulir harus milik periode yang sama dengan oprec.',
              });
            }
            const [subs] = await tx
              .select({ n: count() })
              .from(formSubmission)
              .where(eq(formSubmission.formId, row.id));
            if ((subs?.n ?? 0) > 0) {
              conflict(
                'Formulir ini sudah menerima jawaban, sehingga tidak bisa dipakai untuk oprec.',
              );
            }
            formId = row.id;
          } else {
            const [row] = await tx
              .insert(form)
              .values({
                eventId: input.eventId,
                title: input.form.title ?? `Pendaftaran ${input.name}`,
                createdBy: ctx.session.user.id,
              })
              .returning({ id: form.id });
            formId = row!.id;
          }
          // Formulir oprec: satu respons per akun, tanpa edit, tanpa kuota respons.
          await tx
            .update(form)
            .set({
              allowMultipleSubmissions: false,
              allowEditAfterSubmit: false,
              maxResponses: null,
            })
            .where(eq(form.id, formId));
          await lockForm(tx, formId);

          const [rec] = await tx
            .insert(recruitment)
            .values({
              ...input.settings,
              generalAssessorUnitId: generalUnitId,
              periodId: input.eventId,
              formId,
              name: input.name,
              minChoices: input.minChoices,
              maxChoices: input.maxChoices,
              allowRedirect: input.allowRedirect,
              eligibilityMatch: input.eligibility.match,
              setupAnswers: input.answers,
              setupCompletedAt: new Date(),
            })
            .returning({ id: recruitment.id });
          const recruitmentId = rec!.id;

          const divisionRows = await tx
            .insert(recruitmentDivision)
            .values(
              input.divisions.map((d, i) => ({
                recruitmentId,
                unitId: d.unitId,
                positionId: d.positionId,
                sortOrder: i,
              })),
            )
            .returning({
              id: recruitmentDivision.id,
              unitId: recruitmentDivision.unitId,
            });
          const divisionByUnit = new Map(
            divisionRows.map((d) => [d.unitId, d.id]),
          );

          if (generalUnitId) {
            // Penilai umum: pemegang jabatan di bagian itu saat oprec dibuat.
            const holders = await tx
              .selectDistinct({ userId: placement.userId })
              .from(placement)
              .innerJoin(
                organizationPosition,
                eq(organizationPosition.id, placement.positionId),
              )
              .where(eq(organizationPosition.unitId, generalUnitId));
            if (holders.length > 0) {
              const assessorRows = await tx
                .insert(recruitmentAssessor)
                .values(
                  holders.map((h) => ({
                    recruitmentId,
                    userId: h.userId,
                    divisionId: null,
                  })),
                )
                .returning({
                  id: recruitmentAssessor.id,
                  userId: recruitmentAssessor.userId,
                });
              for (const row of assessorRows) {
                await logAction(tx, {
                  recruitmentId,
                  actorId: ctx.session.user.id,
                  action: 'penilai_ditambah',
                  entityType: 'recruitment_assessor',
                  entityId: row.id,
                  detail: {
                    userId: row.userId,
                    divisionId: null,
                    unitId: generalUnitId,
                    via: 'wizard',
                  },
                });
              }
            }
          }

          if (input.criteria.length > 0) {
            const perSlot = new Map<string, number>();
            await tx.insert(criterion).values(
              input.criteria.map((c) => {
                const divisionId =
                  c.scope === 'umum' ? null : divisionByUnit.get(c.scope);
                if (divisionId === undefined) {
                  throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Kriteria menyebut tujuan yang tidak dibuka.',
                  });
                }
                const order = perSlot.get(c.scope) ?? 0;
                perSlot.set(c.scope, order + 1);
                return {
                  recruitmentId,
                  divisionId,
                  name: c.name,
                  kind: c.kind,
                  weight: c.kind === 'skor' ? (c.weight ?? null) : null,
                  sortOrder: order,
                };
              }),
            );
          }

          if (input.waves.length > 0) {
            await tx.insert(recruitmentWave).values(
              input.waves.map((w, i) => ({
                recruitmentId,
                label: w.label,
                startsAt: w.startsAt,
                endsAt: w.endsAt,
                sortOrder: i,
              })),
            );
          }
          if (input.eligibility.rules.length > 0) {
            await tx.insert(recruitmentEligibilityRule).values(
              input.eligibility.rules.map((r) => ({
                recruitmentId,
                attribute: r.attribute,
                op: r.op,
                value: r.value,
              })),
            );
          }

          if (input.form.mode === 'template') {
            await seedTemplate(tx, {
              formId,
              recruitmentId,
              input,
              divisionByUnit,
              unitNames: await unitNames(tx, unitIds),
            });
          }

          await tx
            .delete(recruitmentSetupDraft)
            .where(
              and(
                eq(recruitmentSetupDraft.periodId, input.eventId),
                eq(recruitmentSetupDraft.userId, ctx.session.user.id),
              ),
            );

          return {
            recruitmentId,
            formId,
            managers: managers.map(({ identifier, userId, name, email }) => ({
              identifier,
              userId,
              name,
              email,
            })),
          };
        });
      } catch (error) {
        if (pgCode(error) === '23505') {
          conflict('Formulir ini sudah dipakai oleh oprec lain.');
        }
        throw error;
      }
    }),
};

type ResolvedManager = {
  identifier: string;
  userId: string;
  name: string | null;
  email: string;
};

/**
 * Akun pengelola dari email atau NIM. Hanya Owner/Admin Lembaga yang boleh
 * memberi akses (sama dengan `grantEventAdmin`); akun yang tak dikenal
 * menggagalkan seluruh permintaan dengan menyebut identifiernya.
 */
async function resolveManagers(
  ctx: {
    db: Queryable;
    session: { user: { id: string; role: string; lembagaId?: string | null } };
  },
  eventId: string,
  identifiers: string[],
): Promise<ResolvedManager[]> {
  if (identifiers.length === 0) return [];
  const event = await ctx.db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { org_id: true },
  });
  const allowed =
    event?.org_id != null &&
    (await canManageLembaga(
      ctx.db as Parameters<typeof canManageLembaga>[0],
      ctx.session.user.id,
      ctx.session.user.role,
      ctx.session.user.lembagaId,
      event.org_id,
    ));
  if (!allowed) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message:
        'Hanya Owner atau Admin lembaga yang boleh memberi akses pengelola oprec.',
    });
  }

  const resolved: ResolvedManager[] = [];
  const missing: string[] = [];
  const seenUsers = new Set<string>();
  for (const identifier of identifiers) {
    const user = await findAccount(ctx.db, identifier);
    if (!user) {
      missing.push(identifier);
      continue;
    }
    if (seenUsers.has(user.id)) continue;
    seenUsers.add(user.id);
    resolved.push({
      identifier,
      userId: user.id,
      name: user.name,
      email: user.email,
    });
  }
  if (missing.length > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Akun belum terdaftar di sistem: ${missing.join(', ')}. Oprec tidak dibuat.`,
    });
  }
  return resolved;
}

async function findAccount(db: Queryable, identifier: string) {
  const value = identifier.trim();
  const [row] = /^\d+$/.test(value)
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(mahasiswa)
        .innerJoin(users, eq(users.id, mahasiswa.userId))
        .where(eq(mahasiswa.nim, Number(value)))
    : await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(sql`lower(${users.email}) = ${value.toLowerCase()}`);
  return row ?? null;
}

/**
 * Memberi fitur `oprec` pada periode. Fitur yang sudah dimiliki digabung
 * (keputusan #355), kecuali hibah lama yang sudah dicabut: yang itu dimulai
 * ulang dari `['oprec']`.
 */
async function grantOprecAccess(
  tx: Parameters<typeof lockForm>[0],
  args: { periodId: string; grantedBy: string; userIds: string[] },
) {
  for (const userId of args.userIds) {
    const [existing] = await tx
      .select({
        id: accessGrant.id,
        features: accessGrant.features,
        status: accessGrant.status,
      })
      .from(accessGrant)
      .where(
        and(
          eq(accessGrant.periodId, args.periodId),
          eq(accessGrant.userId, userId),
        ),
      )
      .for('update');
    if (existing) {
      const kept = existing.status === 'active' ? existing.features : [];
      await tx
        .update(accessGrant)
        .set({
          status: 'active',
          features: [...new Set([...kept, 'oprec'])],
          grantedBy: args.grantedBy,
          revokedAt: null,
          revokedBy: null,
        })
        .where(eq(accessGrant.id, existing.id));
    } else {
      await tx.insert(accessGrant).values({
        periodId: args.periodId,
        userId,
        features: ['oprec'],
        grantedBy: args.grantedBy,
      });
    }
  }
}

async function unitNames(db: Queryable, unitIds: string[]) {
  const rows = await db
    .select({ id: organizationUnit.id, name: organizationUnit.name })
    .from(organizationUnit)
    .where(inArray(organizationUnit.id, unitIds));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/**
 * Isi templat formulir oprec: penjelasan, lampiran wajib (tautan), blok Pilihan,
 * kotak "bersedia dipindahkan", lalu satu bagian per tujuan yang hanya muncul
 * bagi yang memilihnya.
 */
async function seedTemplate(
  tx: Parameters<typeof lockForm>[0],
  args: {
    formId: string;
    recruitmentId: string;
    input: typeof CreateFromSetupInputSchema._output;
    divisionByUnit: Map<string, string>;
    unitNames: Map<string, string>;
  },
) {
  const { formId, recruitmentId, input } = args;
  const perDivisi = input.grouping === 'per_divisi';
  const fieldCount =
    1 +
    input.attachments.length +
    1 +
    (input.allowRedirect ? 1 : 0) +
    (perDivisi ? input.divisions.length : 0);
  if (fieldCount > MAX_FIELDS_PER_FORM) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Formulir maksimal punya ${MAX_FIELDS_PER_FORM} pertanyaan.`,
    });
  }

  const [defaultSection] = await tx
    .insert(formSection)
    .values({ formId, title: 'Pendaftaran', sortOrder: 0 })
    .returning({ id: formSection.id });

  const insertField = async (seed: FieldSeed, sortOrder: number) => {
    const [row] = await tx
      .insert(formField)
      .values({
        formId,
        sectionId: seed.sectionId,
        type: seed.type,
        label: seed.label,
        required: seed.required,
        config: {},
        sortOrder,
      })
      .returning({ id: formField.id });
    return row!.id;
  };

  let order = 0;
  await insertField(
    {
      sectionId: defaultSection!.id,
      type: 'text_block',
      label: 'Pilih tujuan penempatan sesuai minatmu. Urutan pilihan dihitung.',
      required: false,
    },
    order++,
  );
  for (const label of input.attachments) {
    await insertField(
      {
        sectionId: defaultSection!.id,
        type: 'link',
        label: `Tautan ${label}`,
        required: true,
      },
      order++,
    );
  }
  const choiceId = await insertField(
    {
      sectionId: defaultSection!.id,
      type: 'unit_choice',
      label: 'Pilihan tujuan',
      required: true,
    },
    order++,
  );
  if (input.allowRedirect) {
    const willingId = await insertField(
      {
        sectionId: defaultSection!.id,
        type: 'checkbox',
        label: 'Saya bersedia ditempatkan di tujuan lain bila diperlukan',
        required: false,
      },
      order++,
    );
    await tx
      .update(formField)
      .set({ config: { willingFieldId: willingId } })
      .where(eq(formField.id, choiceId));
  }

  if (!perDivisi) return;
  for (const [index, d] of input.divisions.entries()) {
    const name = args.unitNames.get(d.unitId) ?? 'Tujuan';
    const [section] = await tx
      .insert(formSection)
      .values({ formId, title: name, sortOrder: index + 1 })
      .returning({ id: formSection.id });
    await insertField(
      {
        sectionId: section!.id,
        type: 'long_text',
        label: `Mengapa kamu tertarik ke ${name}?`,
        required: true,
      },
      0,
    );
    await applySectionBinding(tx, {
      recruitmentId,
      formId,
      formSectionId: section!.id,
      divisionIds: [args.divisionByUnit.get(d.unitId)!],
    });
  }
}
