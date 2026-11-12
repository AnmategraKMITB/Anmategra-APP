'use client';

import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

import { TimelineArt, TreeArt } from './illustrations';
import { allTargetUnits, defaultPositionId } from './helpers';
import { type SetupTree } from './model';
import { type StepProps } from './steps-types';
import { Labeled, Note, OptionCards, StepFrame, fieldClass } from './ui';

export function StepNama({ s, update, c }: StepProps) {
  return (
    <StepFrame
      title="Oprec ini untuk periode yang mana?"
      hint="Oprec dimiliki satu periode. Pemilihan periode dilakukan sebelum wizard dibuka; beri nama supaya mudah dikenali."
    >
      <div className="grid max-w-md gap-4">
        <div className="rounded-xl bg-neutral-200 px-4 py-3 text-sm">
          <span className="text-neutral-700">Periode: </span>
          <span className="font-semibold text-neutral-1000">{c.eventName}</span>
        </div>
        <Labeled label="Nama oprec">
          {(id) => (
            <input
              id={id}
              className={fieldClass}
              value={s.name}
              maxLength={255}
              onChange={(e) => update({ name: e.target.value })}
            />
          )}
        </Labeled>
      </div>
    </StepFrame>
  );
}

export function StepSumber({ s, update, c, sources }: StepProps) {
  const own = c.eventId;
  const toggle = (periodId: string) =>
    update({
      sourcePeriodIds: s.sourcePeriodIds.includes(periodId)
        ? s.sourcePeriodIds.filter((p) => p !== periodId)
        : [...s.sourcePeriodIds, periodId],
      // Tujuan dari sumber yang dilepas ikut dibuang.
      divisions: Object.fromEntries(
        Object.entries(s.divisions).filter(
          ([, d]) =>
            d.sourcePeriodId !== periodId ||
            !s.sourcePeriodIds.includes(periodId),
        ),
      ),
    });
  return (
    <StepFrame
      title="Pendaftar bisa memilih dari badan mana saja?"
      hint="Bila oprec ini juga membuka tujuan di badan lain, pilih organogram badan itu. Penempatan masuk ke organogram badan yang bersangkutan."
      illustration={<TreeArt />}
    >
      <ul className="grid gap-3">
        {sources.map((src) => {
          const checked = s.sourcePeriodIds.includes(src.periodId);
          const isOwn = src.periodId === own;
          return (
            <li key={src.periodId}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-[20px] border bg-neutral-50 p-4',
                  checked
                    ? 'border-primary-400 bg-primary-100'
                    : 'border-neutral-400',
                  isOwn && 'cursor-default',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-primary-400"
                  checked={checked}
                  disabled={isOwn}
                  onChange={() => toggle(src.periodId)}
                />
                <span>
                  <span className="block font-semibold text-neutral-1000">
                    {src.lembagaName ?? 'Badan ini'}
                  </span>
                  <span className="block text-sm text-neutral-700">
                    {src.name}
                    {isOwn ? ' · selalu ikut' : ''}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </StepFrame>
  );
}

type Node = SetupTree['units'][number] & { children: Node[] };

function buildForest(tree: SetupTree): Node[] {
  const byId = new Map<string, Node>(
    tree.units.map((u) => [u.id, { ...u, children: [] }]),
  );
  const roots: Node[] = [];
  for (const n of byId.values()) {
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    (parent ? parent.children : roots).push(n);
  }
  return roots;
}

const defaultPosition = defaultPositionId;

function UnitRow({
  node,
  depth,
  tree,
  periodId,
  p,
  blocked,
}: {
  node: Node;
  depth: number;
  tree: SetupTree;
  periodId: string;
  p: StepProps;
  blocked: Set<string>;
}) {
  const positions = tree.positions.filter((x) => x.unitId === node.id);
  const picked = p.s.divisions[node.id];
  const selectable = positions.length > 0;
  const disabled = !picked && blocked.has(node.id);
  const quota = positions.find(
    (x) => x.id === (picked?.positionId ?? positions[0]?.id),
  )?.quota;

  const toggle = () => {
    const next = { ...p.s.divisions };
    if (picked) delete next[node.id];
    else
      next[node.id] = {
        positionId: defaultPosition(positions)!,
        sourcePeriodId: periodId,
      };
    p.update({ divisions: next });
  };

  return (
    <li>
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg py-1.5 pr-2',
          picked && 'bg-primary-100',
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {selectable ? (
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="size-4 shrink-0 accent-primary-400"
              checked={!!picked}
              disabled={disabled}
              onChange={toggle}
            />
            <span
              className={cn(
                'truncate text-sm',
                disabled ? 'text-neutral-500' : 'font-medium text-neutral-1000',
              )}
            >
              {node.name}
            </span>
          </label>
        ) : (
          <span className="flex-1 text-sm font-semibold text-neutral-700">
            {node.name}
            {node.children.length === 0 ? (
              <span className="ml-2 text-xs font-normal">
                Belum punya jabatan di organogram, jadi tidak bisa dipilih.
              </span>
            ) : (
              <span className="ml-2 text-xs font-normal">
                Tidak punya jabatan sendiri; pilih unit di bawahnya.
              </span>
            )}
          </span>
        )}
        {picked && positions.length > 1 ? (
          <select
            aria-label={`Jabatan tujuan di ${node.name}`}
            className={cn(fieldClass, 'h-8 w-44')}
            value={picked.positionId}
            onChange={(e) =>
              p.update({
                divisions: {
                  ...p.s.divisions,
                  [node.id]: { ...picked, positionId: e.target.value },
                },
              })
            }
          >
            {positions.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        ) : null}
        {selectable ? (
          <span className="text-xs text-neutral-700">
            {quota ? `kuota ${quota}` : 'tanpa batas kuota'}
          </span>
        ) : null}
      </div>
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <UnitRow
              key={child.id}
              node={child}
              depth={depth + 1}
              tree={tree}
              periodId={periodId}
              p={p}
              blocked={blocked}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function StepTujuan(p: StepProps) {
  const { s, update, c, trees } = p;
  const [l1, l2] = c.labels;
  const forests = useMemo(
    () =>
      trees.map((t) => ({ ...t, forest: t.tree ? buildForest(t.tree) : [] })),
    [trees],
  );

  // Induk dan turunan tidak boleh terbuka bersamaan: blok semua leluhur dan turunan dari yang terpilih.
  const blocked = useMemo(() => {
    const out = new Set<string>();
    for (const t of trees) {
      if (!t.tree) continue;
      const parent = new Map(t.tree.units.map((u) => [u.id, u.parentId]));
      const children = new Map<string, string[]>();
      for (const u of t.tree.units) {
        if (u.parentId)
          children.set(u.parentId, [...(children.get(u.parentId) ?? []), u.id]);
      }
      for (const id of Object.keys(s.divisions)) {
        let cur = parent.get(id);
        while (cur) {
          out.add(cur);
          cur = parent.get(cur);
        }
        const stack = [...(children.get(id) ?? [])];
        while (stack.length > 0) {
          const next = stack.pop()!;
          out.add(next);
          stack.push(...(children.get(next) ?? []));
        }
      }
    }
    return out;
  }, [trees, s.divisions]);

  const selectLevel2 = () => {
    const next: typeof s.divisions = {};
    for (const t of trees) {
      if (!t.tree) continue;
      const target = allTargetUnits(t.tree.units, t.tree.positions);
      for (const u of target.units) {
        const pos = defaultPosition(
          t.tree.positions.filter((x) => x.unitId === u.id),
        );
        if (pos) next[u.id] = { positionId: pos, sourcePeriodId: t.periodId };
      }
    }
    update({ divisions: next });
  };

  const none = trees.every((t) => !t.tree);
  return (
    <StepFrame
      title={`${l1} atau ${l2} mana yang dibuka?`}
      hint={`Centang tujuan yang menerima staf. Kuota diambil dari kuota jabatan di organogram. ${l1} dan ${l2} di dalamnya tidak bisa dibuka bersamaan.`}
      illustration={<TreeArt />}
    >
      {none ? (
        <Note tone="warn">
          Periode ini belum punya organogram, jadi belum ada tujuan yang bisa
          dipilih.{' '}
          <Link
            href={`/lembaga/kegiatan/${c.eventId}/organogram`}
            className="font-semibold text-primary-400 underline underline-offset-2"
          >
            Susun organogram dulu
          </Link>
          .
        </Note>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="dark_blue_outline"
              size="sm"
              onClick={selectLevel2}
            >
              Semua {l2.toLowerCase()}
            </Button>
            <Button
              type="button"
              variant="dark_blue_outline"
              size="sm"
              onClick={() => update({ divisions: {} })}
            >
              Kosongkan
            </Button>
            <span className="text-sm text-neutral-700">
              {c.divisionCount} dipilih
            </span>
          </div>
          <div className="grid gap-4">
            {forests.map((t) => (
              <section
                key={t.periodId}
                className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-3"
              >
                {forests.length > 1 ? (
                  <h3 className="px-2 pb-2 text-sm font-semibold text-neutral-1000">
                    {t.name}
                  </h3>
                ) : null}
                {t.tree ? (
                  <ul>
                    {t.forest.map((n) => (
                      <UnitRow
                        key={n.id}
                        node={n}
                        depth={0}
                        tree={t.tree!}
                        periodId={t.periodId}
                        p={p}
                        blocked={blocked}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="px-2 py-3 text-sm text-neutral-700">
                    Belum ada organogram aktif.
                  </p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </StepFrame>
  );
}

export function StepGelombang({ s, update }: StepProps) {
  const setWave = (i: number, patch: Partial<(typeof s.waves)[number]>) =>
    update({
      waves: s.waves.map((w, j) => (j === i ? { ...w, ...patch } : w)),
    });
  return (
    <StepFrame
      title="Pendaftaran dibagi gelombang?"
      hint="Gelombang mengelompokkan tabel pendaftar dan penempatan, dan cara termudah memperpanjang oprec: tambahkan gelombang baru."
      illustration={<TimelineArt />}
    >
      <OptionCards
        label="Pembagian gelombang"
        value={s.useWaves ? 'ya' : 'tidak'}
        onChange={(v) =>
          update({
            useWaves: v === 'ya',
            waves:
              v === 'ya' && s.waves.length === 0
                ? [{ label: '1', startsAt: '', endsAt: '' }]
                : s.waves,
          })
        }
        options={[
          {
            value: 'tidak',
            label: 'Tidak',
            description:
              'Satu masa pendaftaran, mengikuti pembukaan dan penutupan oprec.',
          },
          {
            value: 'ya',
            label: 'Ya, atur tanggal tiap gelombang',
            description:
              'Formulir hanya bisa dikirim di dalam salah satu gelombang.',
          },
        ]}
      />
      {s.useWaves ? (
        <div className="mt-6 grid gap-3">
          {s.waves.map((w, i) => (
            <div
              key={i}
              className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end"
            >
              <Labeled label="Nama">
                {(id) => (
                  <input
                    id={id}
                    className={fieldClass}
                    value={w.label}
                    placeholder="mis. 3.1"
                    onChange={(e) => setWave(i, { label: e.target.value })}
                  />
                )}
              </Labeled>
              <Labeled label="Mulai">
                {(id) => (
                  <input
                    id={id}
                    type="datetime-local"
                    className={fieldClass}
                    value={w.startsAt}
                    onChange={(e) => setWave(i, { startsAt: e.target.value })}
                  />
                )}
              </Labeled>
              <Labeled label="Berakhir">
                {(id) => (
                  <input
                    id={id}
                    type="datetime-local"
                    className={fieldClass}
                    value={w.endsAt}
                    onChange={(e) => setWave(i, { endsAt: e.target.value })}
                  />
                )}
              </Labeled>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Hapus gelombang ${w.label || i + 1}`}
                onClick={() =>
                  update({ waves: s.waves.filter((_, j) => j !== i) })
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="dark_blue_outline"
              size="sm"
              onClick={() =>
                update({
                  waves: [
                    ...s.waves,
                    {
                      label: String(s.waves.length + 1),
                      startsAt: '',
                      endsAt: '',
                    },
                  ],
                })
              }
            >
              <Plus /> Tambah gelombang
            </Button>
          </div>
        </div>
      ) : null}
    </StepFrame>
  );
}
