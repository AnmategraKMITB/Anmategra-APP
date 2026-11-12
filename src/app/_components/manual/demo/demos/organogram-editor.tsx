'use client';

// Library Import
import { ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { DEMO_STUDENTS, matchesStudent } from '../data';
import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Field,
  inputClass,
  Pill,
  TabBar,
  tdClass,
  thClass,
  useFlash,
} from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'pilih',
    title: 'Di panel **Struktur**, pilih **Acara**',
    hint: 'Bagan menyorot kotak yang sama, dan panel **Detail** menampilkan isinya.',
  },
  {
    id: 'tambah',
    title: 'Klik **Tambah Subdivisi di dalam Acara**',
    hint: 'Bagan menyusun ulang dirinya sendiri. Anda tidak perlu menggeser kotak.',
  },
  {
    id: 'nama',
    title: 'Di panel **Detail**, ganti nama subdivisi baru, misalnya "Rundown"',
  },
  {
    id: 'jabatan',
    title: 'Pada bagian **Jabatan**, klik **Tambah**, lalu beri nama jabatannya',
    hint: 'Atur juga **Rank** dan **Kuota**. Kuota inilah yang nanti dipakai oprec.',
  },
  {
    id: 'simpan',
    title: 'Klik **Simpan**',
    hint: 'Orang baru bisa ditempatkan setelah jabatannya tersimpan.',
  },
  {
    id: 'orang',
    title: 'Ketik nama pada **Cari nama atau NIM**, lalu pilih orangnya',
  },
  { id: 'tabel', title: 'Buka tab **Tabel** untuk melihat semua jabatan sekaligus' },
];

const LEVELS = ['Bidang', 'Divisi', 'Subdivisi', 'Bagian'];
const RANKS = ['Kepala', 'Wakil', 'Koordinator', 'Staf'];

type Unit = { id: string; name: string; parentId: string | null };
type Position = {
  id: string;
  unitId: string;
  title: string;
  rank: string;
  quota: number;
  people: string[];
  saved: boolean;
};

const UNITS: Unit[] = [
  { id: 'ops', name: 'Operasional', parentId: null },
  { id: 'acara', name: 'Acara', parentId: 'ops' },
  { id: 'logistik', name: 'Logistik', parentId: 'ops' },
  { id: 'kreatif', name: 'Kreatif', parentId: null },
  { id: 'publikasi', name: 'Publikasi', parentId: 'kreatif' },
];

const POSITIONS: Position[] = [
  { id: 'p1', unitId: 'ops', title: 'Kepala Bidang', rank: 'Kepala', quota: 1, people: ['s4'], saved: true },
  { id: 'p2', unitId: 'acara', title: 'Kepala Divisi', rank: 'Kepala', quota: 1, people: ['s6'], saved: true },
  { id: 'p3', unitId: 'acara', title: 'Staf', rank: 'Staf', quota: 2, people: ['s1'], saved: true },
  { id: 'p4', unitId: 'logistik', title: 'Staf', rank: 'Staf', quota: 2, people: ['s3'], saved: true },
  { id: 'p5', unitId: 'kreatif', title: 'Kepala Bidang', rank: 'Kepala', quota: 1, people: [], saved: true },
  { id: 'p6', unitId: 'publikasi', title: 'Staf', rank: 'Staf', quota: 2, people: ['s2'], saved: true },
];

const TABS = [
  ['bagan', 'Bagan'],
  ['tabel', 'Tabel'],
] as const;

const studentName = (id: string) =>
  DEMO_STUDENTS.find((student) => student.id === id)?.name ?? 'Tanpa nama';

function depthOf(units: Unit[], id: string): number {
  let depth = 0;
  let current = units.find((unit) => unit.id === id);
  while (current?.parentId) {
    depth += 1;
    current = units.find((unit) => unit.id === current?.parentId);
  }
  return depth;
}

const levelLabel = (depth: number) => LEVELS[depth] ?? 'Bagian';

export default function OrganogramEditorDemo() {
  return (
    <DemoFrame
      title="Editor organogram"
      location="Lembaga › Organogram › Festival Karya 2026"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [tab, setTab] = useState<'bagan' | 'tabel'>('bagan');
  const [units, setUnits] = useState(UNITS);
  const [positions, setPositions] = useState(POSITIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [counter, setCounter] = useState(1);
  const [query, setQuery] = useState<Record<string, string>>({});
  const { flash, node } = useFlash();

  const selected = units.find((unit) => unit.id === selectedId) ?? null;
  const selectedDepth = selected ? depthOf(units, selected.id) : 0;
  const childLabel = levelLabel(selectedDepth + 1);
  const peopleIn = (unitId: string) =>
    positions
      .filter((position) => position.unitId === unitId)
      .reduce((sum, position) => sum + position.people.length, 0);

  const select = (id: string) => {
    setSelectedId(id);
    if (id === 'acara') guide.complete('pilih');
  };

  const addChild = () => {
    if (!selected) return;
    const id = `u${counter}`;
    setCounter((value) => value + 1);
    setUnits((prev) => [
      ...prev,
      { id, name: `${childLabel} baru`, parentId: selected.id },
    ]);
    setSelectedId(id);
    setDirty(true);
    guide.complete('tambah');
  };

  const patchPosition = (id: string, patch: Partial<Position>) => {
    setPositions((prev) =>
      prev.map((position) =>
        position.id === id ? { ...position, ...patch } : position,
      ),
    );
    setDirty(true);
  };

  const removeUnit = (id: string) => {
    const doomed = new Set([id]);
    // Sub-bagian ikut terhapus, jadi kumpulkan seluruh keturunannya.
    let grew = true;
    while (grew) {
      grew = false;
      for (const unit of units) {
        if (unit.parentId && doomed.has(unit.parentId) && !doomed.has(unit.id)) {
          doomed.add(unit.id);
          grew = true;
        }
      }
    }
    setUnits((prev) => prev.filter((unit) => !doomed.has(unit.id)));
    setPositions((prev) =>
      prev.filter((position) => !doomed.has(position.unitId)),
    );
    setSelectedId(null);
    setDirty(true);
  };

  const save = () => {
    setPositions((prev) =>
      prev.map((position) => ({ ...position, saved: true })),
    );
    setDirty(false);
    guide.complete('simpan');
    flash('Perubahan tersimpan.');
  };

  const renderTree = (parentId: string | null, depth: number) =>
    units
      .filter((unit) => unit.parentId === parentId)
      .map((unit) => (
        <li key={unit.id}>
          <button
            type="button"
            aria-current={unit.id === selectedId}
            onClick={() => select(unit.id)}
            style={{ paddingLeft: depth * 12 + 6 }}
            className={cn(
              'flex w-full items-center gap-1 rounded-md py-1 pr-1.5 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
              unit.id === selectedId
                ? 'bg-primary-100 font-semibold text-primary-600'
                : 'hover:bg-neutral-200',
              unit.id === 'acara' && guide.spot('pilih'),
            )}
          >
            <ChevronRight className="size-3 shrink-0 rotate-90 text-neutral-600" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{unit.name}</span>
            <span className="text-[10px] text-neutral-700">
              {peopleIn(unit.id)}
            </span>
          </button>
          <ul>{renderTree(unit.id, depth + 1)}</ul>
        </li>
      ));

  const renderChart = (parentId: string | null, depth: number) => {
    const children = units.filter((unit) => unit.parentId === parentId);
    return children.map((unit, index) => {
      const grandchildren = units.filter((item) => item.parentId === unit.id);
      return (
        <div key={unit.id} className="relative flex flex-col items-center px-1.5">
          {parentId !== null ? (
            <>
              <span
                aria-hidden
                className="absolute top-0 h-px bg-neutral-500"
                style={{
                  left: index === 0 ? '50%' : 0,
                  right: index === children.length - 1 ? '50%' : 0,
                }}
              />
              <span aria-hidden className="h-3 w-px bg-neutral-500" />
            </>
          ) : null}
          <button
            type="button"
            onClick={() => select(unit.id)}
            className={cn(
              'w-24 rounded-md border bg-white px-1.5 py-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
              unit.id === selectedId
                ? 'border-primary-400 ring-2 ring-primary-300'
                : 'border-neutral-500 hover:border-primary-400',
            )}
          >
            <span className="block text-[9px] font-semibold uppercase tracking-wide text-secondary-800">
              {levelLabel(depth)}
            </span>
            <span className="block truncate text-xs font-semibold">
              {unit.name}
            </span>
            <span className="block text-[10px] text-neutral-700">
              {peopleIn(unit.id)} orang
            </span>
          </button>
          {grandchildren.length > 0 ? (
            <>
              <span aria-hidden className="h-3 w-px bg-neutral-500" />
              <div className="flex items-start">
                {renderChart(unit.id, depth + 1)}
              </div>
            </>
          ) : null}
        </div>
      );
    });
  };

  const unitPositions = positions.filter(
    (position) => position.unitId === selectedId,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <TabBar
            label="Tampilan"
            tabs={TABS}
            value={tab}
            onChange={(next) => {
              setTab(next);
              if (next === 'tabel') guide.complete('tabel');
            }}
            spot={(id) => (id === 'tabel' ? guide.spot('tabel') : '')}
          />
        </div>
        <span className="text-xs text-neutral-700">
          {dirty ? 'Ada perubahan belum disimpan' : 'Semua perubahan tersimpan'}
        </span>
        <Btn
          small
          disabled={!dirty}
          className={dirty ? guide.spot('simpan') : ''}
          onClick={save}
        >
          Simpan
        </Btn>
      </div>

      {tab === 'tabel' ? (
        <div className="mt-3">
          <div className="mb-2 flex flex-wrap gap-2">
            {['Salin untuk Sheets', 'Unduh Excel', 'Unduh CSV'].map((label) => (
              <Btn
                key={label}
                small
                tone="outline"
                onClick={() => flash(`${label}: berhasil (simulasi).`)}
              >
                {label}
              </Btn>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-neutral-400">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Bagian</th>
                  <th className={thClass}>Jabatan</th>
                  <th className={thClass}>Rank</th>
                  <th className={thClass}>Terisi</th>
                  <th className={thClass}>Orang</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => {
                  const unit = units.find((item) => item.id === position.unitId);
                  return (
                    <tr key={position.id}>
                      <td className={tdClass}>
                        <span className="text-[10px] uppercase text-secondary-800">
                          {levelLabel(depthOf(units, position.unitId))}
                        </span>{' '}
                        {unit?.name}
                      </td>
                      <td className={cn(tdClass, 'font-semibold')}>
                        {position.title || 'Tanpa nama'}
                      </td>
                      <td className={tdClass}>{position.rank}</td>
                      <td className={tdClass}>
                        {position.people.length}/{position.quota}
                      </td>
                      <td className={cn(tdClass, 'text-xs')}>
                        {position.people.map(studentName).join(', ') || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-3 md:grid-cols-[170px_1fr]">
            <div className="rounded-lg border border-neutral-400 p-2">
              <p className="mb-1 text-xs font-semibold text-neutral-700">
                Struktur
              </p>
              <ul aria-label="Struktur organogram">{renderTree(null, 0)}</ul>
              {selected ? (
                <Btn
                  small
                  tone="outline"
                  className={cn(
                    'mt-2 h-auto w-full whitespace-normal py-1.5 text-left',
                    selected.id === 'acara' && guide.spot('tambah'),
                  )}
                  onClick={addChild}
                >
                  <Plus aria-hidden />
                  Tambah {childLabel} di dalam {selected.name}
                </Btn>
              ) : null}
            </div>
            <div
              role="img"
              aria-label="Bagan organogram"
              className="overflow-x-auto rounded-lg border border-neutral-400 bg-neutral-100 p-3"
            >
              <div className="mx-auto flex w-max flex-col items-center">
                <div className="rounded-md border border-primary-400 bg-primary-400 px-3 py-1 text-xs font-semibold text-white">
                  Ketua Pelaksana
                </div>
                <span aria-hidden className="h-3 w-px bg-neutral-500" />
                <div className="flex items-start">{renderChart(null, 0).map((child, index, all) => (
                  <div key={index} className="relative">
                    <span
                      aria-hidden
                      className="absolute top-0 h-px bg-neutral-500"
                      style={{
                        left: index === 0 ? '50%' : 0,
                        right: index === all.length - 1 ? '50%' : 0,
                      }}
                    />
                    <span aria-hidden className="mx-auto block h-3 w-px bg-neutral-500" />
                    {child}
                  </div>
                ))}</div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-neutral-400 p-3">
            <p className="text-xs font-semibold text-neutral-700">Detail</p>
            {!selected ? (
              <p className="mt-1 text-neutral-700">
                Pilih bagian di Struktur atau bagan untuk melihat dan
                mengubahnya.
              </p>
            ) : (
              <div className="mt-2 space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Nama" className="min-w-40 flex-1">
                    {(id) => (
                      <input
                        id={id}
                        value={selected.name}
                        onChange={(event) => {
                          const name = event.target.value;
                          setUnits((prev) =>
                            prev.map((unit) =>
                              unit.id === selected.id ? { ...unit, name } : unit,
                            ),
                          );
                          setDirty(true);
                          if (
                            selected.id.startsWith('u') &&
                            name.trim() !== '' &&
                            !name.endsWith(' baru')
                          ) {
                            guide.complete('nama');
                          }
                        }}
                        className={cn(
                          inputClass,
                          selected.id.startsWith('u') && guide.spot('nama'),
                        )}
                      />
                    )}
                  </Field>
                  <Pill tone="teal">{levelLabel(selectedDepth)}</Pill>
                  <Btn
                    small
                    tone="dangerOutline"
                    onClick={() => removeUnit(selected.id)}
                  >
                    <Trash2 aria-hidden /> Hapus
                  </Btn>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-xs font-semibold text-neutral-800">
                      Jabatan
                    </p>
                    <Btn
                      small
                      tone="outline"
                      className={guide.spot('jabatan')}
                      onClick={() => {
                        const id = `n${counter}`;
                        setCounter((value) => value + 1);
                        setPositions((prev) => [
                          ...prev,
                          {
                            id,
                            unitId: selected.id,
                            title: '',
                            rank: 'Staf',
                            quota: 1,
                            people: [],
                            saved: false,
                          },
                        ]);
                        setDirty(true);
                      }}
                    >
                      <Plus aria-hidden /> Tambah
                    </Btn>
                  </div>
                  {unitPositions.length === 0 ? (
                    <p className="mt-1 text-xs text-neutral-700">
                      Belum ada jabatan.
                    </p>
                  ) : null}
                  <ul className="mt-2 space-y-2">
                    {unitPositions.map((position) => {
                      const q = query[position.id] ?? '';
                      const matches =
                        q.trim().length >= 2
                          ? DEMO_STUDENTS.filter(
                              (student) =>
                                matchesStudent(student, q) &&
                                !position.people.includes(student.id),
                            ).slice(0, 3)
                          : [];
                      return (
                        <li
                          key={position.id}
                          className="rounded-lg bg-neutral-100 p-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              aria-label="Nama jabatan"
                              placeholder="Nama jabatan"
                              value={position.title}
                              onChange={(event) => {
                                patchPosition(position.id, {
                                  title: event.target.value,
                                });
                                if (event.target.value.trim() !== '') {
                                  guide.complete('jabatan');
                                }
                              }}
                              className={cn(
                                inputClass,
                                'h-8 min-w-28 flex-1',
                                !position.saved &&
                                  position.title === '' &&
                                  guide.spot('jabatan'),
                              )}
                            />
                            <select
                              aria-label="Rank"
                              value={position.rank}
                              onChange={(event) =>
                                patchPosition(position.id, {
                                  rank: event.target.value,
                                })
                              }
                              className={cn(inputClass, 'h-8 w-28')}
                            >
                              {RANKS.map((rank) => (
                                <option key={rank}>{rank}</option>
                              ))}
                            </select>
                            <label className="flex items-center gap-1 text-xs text-neutral-700">
                              Kuota
                              <input
                                type="number"
                                min={1}
                                value={position.quota}
                                onChange={(event) =>
                                  patchPosition(position.id, {
                                    quota: Math.max(
                                      1,
                                      Number(event.target.value) || 1,
                                    ),
                                  })
                                }
                                className={cn(inputClass, 'h-8 w-14 px-2')}
                              />
                            </label>
                            <span className="text-xs text-neutral-700">
                              {position.people.length}/{position.quota}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {position.people.map((personId) => (
                              <span
                                key={personId}
                                className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-neutral-400"
                              >
                                {studentName(personId)}
                                <button
                                  type="button"
                                  aria-label={`Keluarkan ${studentName(personId)}`}
                                  onClick={() =>
                                    patchPosition(position.id, {
                                      people: position.people.filter(
                                        (item) => item !== personId,
                                      ),
                                    })
                                  }
                                  className="rounded-full hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            ))}
                            {position.saved ? (
                              <input
                                aria-label="Cari nama atau NIM"
                                placeholder="Cari nama atau NIM"
                                value={q}
                                onChange={(event) =>
                                  setQuery((prev) => ({
                                    ...prev,
                                    [position.id]: event.target.value,
                                  }))
                                }
                                className={cn(
                                  inputClass,
                                  'h-7 w-44 text-xs',
                                  selected.id.startsWith('u') &&
                                    guide.spot('orang'),
                                )}
                              />
                            ) : (
                              <span className="text-xs text-neutral-700">
                                Simpan dulu untuk menempatkan orang.
                              </span>
                            )}
                          </div>
                          {q.trim().length > 0 && q.trim().length < 2 ? (
                            <p className="mt-1 text-xs text-neutral-700">
                              Ketik minimal 2 huruf
                            </p>
                          ) : null}
                          {matches.length > 0 ? (
                            <ul className="mt-1 divide-y divide-neutral-300 rounded-md border border-neutral-400 bg-white">
                              {matches.map((student) => (
                                <li key={student.id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      patchPosition(position.id, {
                                        people: [...position.people, student.id],
                                      });
                                      setQuery((prev) => ({
                                        ...prev,
                                        [position.id]: '',
                                      }));
                                      guide.complete('orang');
                                    }}
                                    className="flex w-full justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                                  >
                                    <span className="font-semibold">
                                      {student.name}
                                    </span>
                                    <span className="text-neutral-700">
                                      {student.nim}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {position.people.length > position.quota ? (
                            <p className="mt-1 text-xs font-semibold text-danger-dark">
                              Melebihi kuota jabatan ini.
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {node}
    </div>
  );
}
