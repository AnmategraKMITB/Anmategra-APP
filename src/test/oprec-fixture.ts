/**
 * Fixture oprec untuk tes router: lembaga, periode, organogram (unit, jabatan
 * staf berkuota, Kadiv berpenghuni), lalu oprec dibuat lewat `createFromSetup`
 * seperti wizard. Terpisah dari `test-db.ts` karena memuat router.
 */
import { and, asc, eq } from 'drizzle-orm';
import { type z } from 'zod';
import { formRouter } from '~/server/api/routers/form';
import { oprecRouter } from '~/server/api/routers/oprec';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import { type CreateFromSetupInputSchema } from '~/server/api/types/oprec.type';
import * as schema from '~/server/db/schema';

import {
  type TestDb,
  createEvent,
  createLembaga,
  createMahasiswa,
  createUser,
} from './test-db';

const oprecTestRouter = createTRPCRouter({
  oprec: oprecRouter,
  form: formRouter,
});

export type Actor = {
  id: string;
  role: 'mahasiswa' | 'lembaga' | 'admin';
  lembagaId?: string;
};

export function callerFor(db: TestDb, actor: Actor | null) {
  const session = actor ? { user: { ...actor }, expires: '' } : null;
  return createCallerFactory(oprecTestRouter)({
    db,
    session,
    headers: new Headers(),
  } as never);
}

/** Kode galat tRPC dari sebuah pemanggilan, atau 'OK' bila berhasil. */
export async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return 'OK';
  } catch (error) {
    return (error as { code?: string }).code ?? 'ERROR';
  }
}

type SetupInput = z.input<typeof CreateFromSetupInputSchema>;

export type DivisionSpec = {
  name: string;
  /** Kuota jabatan staf; 0 = tanpa batas. */
  quota?: number;
  /** Buat Kadiv berpenghuni pada jabatan `head` unit ini. */
  withHead?: boolean;
};

export type FixtureDivision = {
  /** id `recruitment_division`. */
  id: string;
  unitId: string;
  positionId: string;
  kadiv: Actor | null;
};

export type OprecFixture = {
  eventId: string;
  lembagaId: string;
  owner: Actor;
  recruitmentId: string;
  formId: string;
  divisions: Record<string, FixtureDivision>;
  unitChoiceFieldId: string;
  willingFieldId: string | null;
};

export async function createOprecFixture(
  db: TestDb,
  opts: {
    divisions?: DivisionSpec[];
    minChoices?: number;
    maxChoices?: number;
    allowRedirect?: boolean;
    settings?: SetupInput['settings'];
    /** `scope` = nama divisi atau 'umum'. */
    criteria?: {
      scope: string;
      name: string;
      kind: 'skor' | 'gugur_manual';
      weight?: number;
    }[];
    /** Terbitkan form dan buka oprec (bawaan: true). */
    open?: boolean;
  } = {},
): Promise<OprecFixture> {
  const specs = opts.divisions ?? [
    { name: 'Acara', quota: 2, withHead: true },
    { name: 'Humas', quota: 2, withHead: true },
  ];

  const ownerUser = await createUser(db, { role: 'lembaga' });
  const lembaga = await createLembaga(db, ownerUser.id);
  const event = await createEvent(db, lembaga.id);
  const owner: Actor = {
    id: ownerUser.id,
    role: 'lembaga',
    lembagaId: lembaga.id,
  };

  const [structure] = await db
    .insert(schema.organizationStructure)
    .values({ eventId: event.id, name: 'Organogram Uji', is_active: true })
    .returning();

  const units = new Map<
    string,
    { unitId: string; positionId: string; kadiv: Actor | null }
  >();
  for (const [index, spec] of specs.entries()) {
    const [unit] = await db
      .insert(schema.organizationUnit)
      .values({
        structure_id: structure!.id,
        name: spec.name,
        level: 1,
        sort_order: index,
      })
      .returning();
    const [staff] = await db
      .insert(schema.organizationPosition)
      .values({
        unitId: unit!.id,
        title: 'Staf',
        rank: 'staff',
        kind: 'struktural',
        quota: spec.quota ?? 0,
      })
      .returning();
    let kadiv: Actor | null = null;
    if (spec.withHead ?? true) {
      const [head] = await db
        .insert(schema.organizationPosition)
        .values({
          unitId: unit!.id,
          title: `Kepala ${spec.name}`,
          rank: 'head',
          kind: 'struktural',
          quota: 1,
        })
        .returning();
      const user = await createUser(db, { role: 'mahasiswa' });
      await createMahasiswa(db, user.id);
      await db
        .insert(schema.placement)
        .values({ positionId: head!.id, userId: user.id, source: 'manual' });
      kadiv = { id: user.id, role: 'mahasiswa' };
    }
    units.set(spec.name, {
      unitId: unit!.id,
      positionId: staff!.id,
      kadiv,
    });
  }

  const unitIdOf = (name: string) => {
    if (name === 'umum') return 'umum';
    const unit = units.get(name);
    if (!unit) throw new Error(`Divisi "${name}" tidak ada di fixture.`);
    return unit.unitId;
  };

  const caller = callerFor(db, owner);
  const { recruitmentId, formId } = await caller.oprec.createFromSetup({
    eventId: event.id,
    name: 'Oprec Uji',
    form: { mode: 'template' },
    divisions: [...units.values()].map((u) => ({
      unitId: u.unitId,
      positionId: u.positionId,
    })),
    minChoices: opts.minChoices ?? 1,
    maxChoices: opts.maxChoices ?? Math.min(2, specs.length),
    allowRedirect: opts.allowRedirect ?? false,
    grouping: 'satu_bagian',
    attachments: [],
    settings: opts.settings ?? {},
    criteria: (opts.criteria ?? []).map((c) => ({
      ...c,
      scope: unitIdOf(c.scope),
    })),
  });

  const rows = await db
    .select({
      id: schema.recruitmentDivision.id,
      unitId: schema.recruitmentDivision.unitId,
    })
    .from(schema.recruitmentDivision)
    .where(eq(schema.recruitmentDivision.recruitmentId, recruitmentId));
  const divisions: Record<string, FixtureDivision> = {};
  for (const [name, unit] of units) {
    const row = rows.find((r) => r.unitId === unit.unitId)!;
    divisions[name] = { id: row.id, ...unit };
  }

  const fields = await db
    .select({ id: schema.formField.id, type: schema.formField.type })
    .from(schema.formField)
    .where(eq(schema.formField.formId, formId));
  const unitChoiceFieldId = fields.find((f) => f.type === 'unit_choice')!.id;
  const willingFieldId = fields.find((f) => f.type === 'checkbox')?.id ?? null;

  if (opts.open ?? true) {
    await caller.form.setStatus({ formId, status: 'Published' });
    await caller.oprec.setStatus({ recruitmentId, status: 'open' });
  }

  return {
    eventId: event.id,
    lembagaId: lembaga.id,
    owner,
    recruitmentId,
    formId,
    divisions,
    unitChoiceFieldId,
    willingFieldId,
  };
}

/** Mahasiswa baru yang mengirim form oprec dengan pilihan divisi berurutan. */
export async function applyToOprec(
  db: TestDb,
  fx: OprecFixture,
  choices: string[],
  opts: { willingToMove?: boolean } = {},
) {
  const user = await createUser(db, { role: 'mahasiswa' });
  await createMahasiswa(db, user.id);
  const actor: Actor = { id: user.id, role: 'mahasiswa' };
  const answers: { fieldId: string; value: string[] | boolean }[] = [
    {
      fieldId: fx.unitChoiceFieldId,
      value: choices.map((name) => fx.divisions[name]!.id),
    },
  ];
  if (opts.willingToMove && fx.willingFieldId) {
    answers.push({ fieldId: fx.willingFieldId, value: true });
  }
  await callerFor(db, actor).form.submit({ formId: fx.formId, answers });

  const [app] = await db
    .select({ id: schema.application.id })
    .from(schema.application)
    .where(
      and(
        eq(schema.application.recruitmentId, fx.recruitmentId),
        eq(schema.application.userId, user.id),
      ),
    );
  return { actor, userId: user.id, applicationId: app!.id };
}

/** Pilihan sebuah pendaftar, urut rank. */
export async function choicesOf(db: TestDb, applicationId: string) {
  return db
    .select({
      id: schema.applicationChoice.id,
      divisionId: schema.applicationChoice.divisionId,
      rank: schema.applicationChoice.rank,
      origin: schema.applicationChoice.origin,
    })
    .from(schema.applicationChoice)
    .where(eq(schema.applicationChoice.applicationId, applicationId))
    .orderBy(asc(schema.applicationChoice.rank));
}
