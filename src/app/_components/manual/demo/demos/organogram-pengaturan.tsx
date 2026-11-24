'use client';

// Library Import
import {
  ChevronDown,
  ChevronUp,
  Download,
  Minus,
  Plus,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { cn } from '~/lib/utils';

import { DemoFrame, type DemoGuide, type DemoStep } from '../demo-frame';
import { Btn, Modal, Toggle, inputClass, useFlash } from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'skema',
    title: 'Pada **Skema siap pakai**, klik **Himpunan**',
    hint: 'Nama level berlaku per kedalaman. Tiap bagian tetap bisa menimpanya di panel Detail.',
  },
  {
    id: 'level',
    title: 'Ubah nama salah satu level agar sesuai istilah lembaga Anda',
  },
  {
    id: 'rank',
    title: 'Klik **Tambah rank**, lalu beri nama **Sekretaris**',
    hint: 'Rank baru masuk tepat di atas rank paling junior.',
  },
  {
    id: 'urut',
    title: 'Naikkan rank itu sampai tepat di bawah **Wakil**',
    hint: 'Urutan rank menentukan senioritas jabatan di dalam satu bagian.',
  },
  {
    id: 'kunci',
    title: 'Nyalakan **Kunci edit**',
    hint: 'Anggota yang ditempatkan tidak bisa mengubah organogram saat dikunci. Pemilik dan admin tidak terpengaruh.',
  },
  {
    id: 'ekspor',
    title: 'Klik **Ekspor**, lalu pilih format **SVG**',
    hint: 'Gambar diekspor dengan latar putih, tanpa foto dan tombol.',
  },
];

type Mode = 'bagan' | 'tabel' | 'pengaturan';

const MODES: { id: Mode; label: string }[] = [
  { id: 'bagan', label: 'Bagan' },
  { id: 'tabel', label: 'Tabel' },
  { id: 'pengaturan', label: 'Pengaturan' },
];

/** Skema nama level siap pakai (dari prototipe); bisa diubah sesudahnya. */
const LEVEL_PRESETS: { name: string; labels: string[] }[] = [
  { name: 'Kepanitiaan ITB', labels: ['Bidang', 'Divisi', 'Subdivisi'] },
  { name: 'Himpunan', labels: ['Departemen', 'Divisi', 'Unit Kerja'] },
  {
    name: 'Kabinet KM',
    labels: ['Kemenkoan', 'Kementerian', 'Kedirjenan', 'Biro'],
  },
];

/** Rank yang sering dibutuhkan; disisipkan di atas rank paling junior. */
const RANK_SUGGESTIONS = ['Sekretaris', 'Bendahara'];

const MAX_DEPTH = 4;
const MAX_RANK_LABEL = 32;
/** Kedalaman pohon contoh: Bidang › Divisi. */
const TREE_DEPTH = 2;

type Rank = { id: string; label: string; used: number };

const DEFAULT_RANKS: Rank[] = [
  { id: 'kepala', label: 'Kepala', used: 1 },
  { id: 'wakil', label: 'Wakil', used: 3 },
  { id: 'koordinator', label: 'Koordinator', used: 9 },
  { id: 'staf', label: 'Staf', used: 21 },
];

const CHIP_CLASS =
  'h-8 rounded-full border border-secondary-400 bg-white px-3 text-sm font-semibold text-secondary-800 transition-colors duration-150 hover:bg-secondary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white';

const PREVIEW_TREE = [
  {
    name: 'Operasional',
    person: 'Raka P.',
    children: ['Logistik', 'Akomtrans'],
  },
  { name: 'Kreatif', person: 'Nadia K.', children: ['Grafis', 'Publikasi'] },
  {
    name: 'ITB Day',
    person: 'Bima A.',
    children: ['Event Organizer', 'Exhibition'],
  },
];

export default function OrganogramPengaturanDemo() {
  return (
    <DemoFrame
      title="Pengaturan organogram"
      location="Lembaga › Organogram › Aku Masuk ITB 2027 › tab Pengaturan"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const { flash, node: flashNode } = useFlash();
  const [mode, setMode] = useState<Mode>('pengaturan');
  const [name, setName] = useState('Organogram Aku Masuk ITB 2027');
  const [labels, setLabels] = useState<string[] | null>([
    'Bidang',
    'Divisi',
    'Subdivisi',
  ]);
  const [ranks, setRanks] = useState<Rank[]>(DEFAULT_RANKS);
  const [locked, setLocked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // Kondisi terakhir yang tersimpan; tombol Batal mengembalikannya.
  const saved = useRef({
    name,
    labels,
    ranks: ranks.map((rank) => ({ ...rank })),
  });
  const rankSeq = useRef(0);

  const levelLabels = labels ?? [];
  const levelCount = Math.max(TREE_DEPTH, levelLabels.length);
  const canAddLevel = levelCount < MAX_DEPTH;
  const canRemoveLevel = levelCount > TREE_DEPTH && levelCount > 1;
  const levelLabel = (index: number): string =>
    levelLabels[index - 1]?.trim() ? levelLabels[index - 1]!.trim() : 'Bagian';
  const unitsAt = (depth: number): number =>
    depth === 1 ? 3 : depth === 2 ? 6 : 0;

  const writeLabels = (count: number): string[] => {
    const next: string[] = [];
    for (let index = 0; index < count; index += 1) {
      next.push(levelLabels[index] ?? '');
    }
    return next;
  };

  const commitLabels = (next: string[] | null) => {
    setLabels(next);
    setDirty(true);
  };

  const setLevelLabel = (index: number, value: string) => {
    const next = writeLabels(levelCount);
    next[index] = value;
    commitLabels(next);
    guide.complete('level');
  };

  const addLevel = () => {
    const next = writeLabels(levelCount);
    next.push('');
    commitLabels(next);
  };

  const removeLastLevel = () => {
    commitLabels(writeLabels(levelCount - 1));
  };

  // --- Rank ---
  /** Langkah selesai bila ada rank Sekretaris tepat di bawah Wakil. */
  const checkRanks = (next: Rank[]) => {
    const wakil = next.findIndex((rank) => rank.label === 'Wakil');
    const sekretaris = next.findIndex(
      (rank) => rank.label.trim().toLowerCase() === 'sekretaris',
    );
    if (sekretaris !== -1) guide.complete('rank');
    if (wakil !== -1 && sekretaris === wakil + 1) guide.complete('urut');
  };

  const writeRanks = (next: Rank[]) => {
    setRanks(next);
    setDirty(true);
    checkRanks(next);
  };

  const editableRanks = (): Rank[] => ranks.map((rank) => ({ ...rank }));

  const renameRank = (index: number, label: string) => {
    const next = editableRanks();
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, label };
    writeRanks(next);
  };

  const moveRank = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ranks.length) return;
    const next = editableRanks();
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    writeRanks(next);
  };

  const removeRank = (index: number) => {
    const next = editableRanks();
    next.splice(index, 1);
    writeRanks(next);
  };

  /** Rank baru masuk tepat di atas rank paling junior (biasanya di atas Staf). */
  const addRank = (label: string) => {
    const next = editableRanks();
    const id = `baru-${rankSeq.current}`;
    rankSeq.current += 1;
    next.splice(Math.max(0, next.length - 1), 0, { id, label, used: 0 });
    writeRanks(next);
  };

  const hasLabel = (label: string): boolean =>
    ranks.some(
      (rank) => rank.label.trim().toLowerCase() === label.toLowerCase(),
    );
  const suggestions = RANK_SUGGESTIONS.filter((label) => !hasLabel(label));
  const canAddRank = ranks.length < 12;
  const isDefaultRanks =
    ranks.length === DEFAULT_RANKS.length &&
    ranks.every((rank, index) => rank.id === DEFAULT_RANKS[index]?.id);

  // --- Simpan / batal ---
  const saveDraft = () => {
    saved.current = {
      name,
      labels: labels === null ? null : [...labels],
      ranks: ranks.map((rank) => ({ ...rank })),
    };
    setDirty(false);
    flash('Perubahan tersimpan.');
  };

  const revertDraft = () => {
    setName(saved.current.name);
    setLabels(saved.current.labels);
    setRanks(saved.current.ranks.map((rank) => ({ ...rank })));
    setDirty(false);
  };

  const settings = (
    <>
      <section className="border-b border-neutral-400 pb-5">
        <h2 className="text-lg font-semibold text-neutral-1000">
          Nama organogram
        </h2>
        <div className="mt-3 space-y-1">
          <label
            htmlFor="organogram-name"
            className="block text-xs font-semibold text-neutral-800"
          >
            Nama
          </label>
          <input
            id="organogram-name"
            value={name}
            placeholder="Nama organogram"
            onChange={(event) => {
              setName(event.target.value);
              setDirty(true);
            }}
            className={cn(inputClass, 'rounded-[8px]')}
          />
        </div>
      </section>

      <section className="border-b border-neutral-400 py-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-1000">
            Nama level
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <Btn
              small
              tone="teal"
              disabled={!canAddLevel}
              title={
                canAddLevel
                  ? undefined
                  : `Kedalaman maksimum ${MAX_DEPTH} tingkat.`
              }
              onClick={addLevel}
            >
              <Plus aria-hidden /> Tambah level
            </Btn>
            <Btn
              small
              tone="outline"
              className="w-7 px-0"
              aria-label="Hapus level terakhir"
              title="Hapus level terakhir"
              disabled={!canRemoveLevel}
              onClick={removeLastLevel}
            >
              <Minus aria-hidden />
            </Btn>
          </div>
        </div>
        <p className="mt-1 text-sm text-neutral-700">
          Nama level berlaku per kedalaman. Bagian baru memakai namanya dari
          sini, dan tiap bagian tetap bisa menimpanya di panel Detail.
        </p>

        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Skema nama level siap pakai"
        >
          <span className="text-sm text-neutral-700">Skema siap pakai:</span>
          {LEVEL_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={cn(
                CHIP_CLASS,
                preset.name === 'Himpunan' && guide.spot('skema'),
              )}
              title={preset.labels.join(' › ')}
              onClick={() => {
                commitLabels([...preset.labels]);
                if (preset.name === 'Himpunan') guide.complete('skema');
              }}
            >
              {preset.name}
            </button>
          ))}
          <button
            type="button"
            className={CHIP_CLASS}
            disabled={labels === null}
            onClick={() => commitLabels(null)}
          >
            Kosongkan
          </button>
        </div>

        <div className={cn('mt-3 space-y-3', guide.spot('level'))}>
          {Array.from({ length: levelCount }, (_, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor={`level-${index}`}
                  className="text-xs font-semibold text-neutral-800"
                >
                  Level {index + 1}
                </label>
                <span className="text-sm tabular-nums text-neutral-700">
                  {unitsAt(index + 1)} bagian
                </span>
              </div>
              <input
                id={`level-${index}`}
                value={levelLabels[index] ?? ''}
                placeholder={levelLabel(index + 1)}
                onChange={(event) => setLevelLabel(index, event.target.value)}
                className={cn(inputClass, 'rounded-[8px]')}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-neutral-700">
          Kolom yang dikosongkan memakai sebutan bawaan, yaitu Bagian.
        </p>
      </section>

      <section className="border-b border-neutral-400 py-5">
        <h2 className="text-lg font-semibold text-neutral-1000">
          Rank jabatan
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          Rank menyatakan senioritas di dalam bagian, dari yang paling senior
          (atas) ke yang paling junior (bawah). Rank yang masih dipakai jabatan
          tidak bisa dihapus.
        </p>

        <ol className="mt-3 space-y-2">
          {ranks.map((rank, index) => {
            const removeBlocked = rank.used > 0 || ranks.length <= 1;
            const isNew = rank.id.startsWith('baru-');
            return (
              <li key={rank.id} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="w-5 shrink-0 text-right text-sm tabular-nums text-neutral-700"
                >
                  {index + 1}
                </span>
                <input
                  value={rank.label}
                  maxLength={MAX_RANK_LABEL}
                  aria-label={`Nama rank urutan ${index + 1}`}
                  onChange={(event) => renameRank(index, event.target.value)}
                  className={cn(inputClass, 'min-w-0 flex-1 rounded-[8px]')}
                />
                <span className="w-16 shrink-0 text-xs tabular-nums text-neutral-700 sm:w-20 sm:text-sm">
                  {rank.used} jabatan
                </span>
                <IconBtn
                  label={`Naikkan ${rank.label}`}
                  title="Lebih senior"
                  disabled={index === 0}
                  className={isNew ? guide.spot('urut') : undefined}
                  onClick={() => moveRank(index, -1)}
                >
                  <ChevronUp className="size-4" aria-hidden />
                </IconBtn>
                <IconBtn
                  label={`Turunkan ${rank.label}`}
                  title="Lebih junior"
                  disabled={index === ranks.length - 1}
                  onClick={() => moveRank(index, 1)}
                >
                  <ChevronDown className="size-4" aria-hidden />
                </IconBtn>
                <IconBtn
                  label={`Hapus rank ${rank.label}`}
                  title={
                    rank.used > 0
                      ? 'Masih dipakai jabatan'
                      : ranks.length <= 1
                        ? 'Minimal satu rank'
                        : 'Hapus rank'
                  }
                  disabled={removeBlocked}
                  onClick={() => removeRank(index)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconBtn>
              </li>
            );
          })}
        </ol>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn
            small
            tone="teal"
            disabled={!canAddRank}
            className={guide.spot('rank')}
            onClick={() => addRank('Rank baru')}
          >
            <Plus aria-hidden /> Tambah rank
          </Btn>
          {suggestions.map((label) => (
            <button
              key={label}
              type="button"
              className={CHIP_CLASS}
              disabled={!canAddRank}
              onClick={() => addRank(label)}
            >
              + {label}
            </button>
          ))}
          <button
            type="button"
            className={CHIP_CLASS}
            disabled={isDefaultRanks}
            title="Kembali ke empat rank bawaan"
            onClick={() =>
              writeRanks(DEFAULT_RANKS.map((rank) => ({ ...rank })))
            }
          >
            Kembalikan rank bawaan
          </button>
        </div>
      </section>

      <section className="py-5">
        <h2 className="text-lg font-semibold text-neutral-1000">Kunci edit</h2>
        <div className="mt-3 space-y-1">
          <Toggle
            checked={locked}
            label={locked ? 'Terkunci' : 'Tidak terkunci'}
            className={guide.spot('kunci')}
            onChange={(next) => {
              setLocked(next);
              if (next) guide.complete('kunci');
            }}
          />
          <p className="text-sm text-neutral-700">
            Anggota yang ditempatkan tidak bisa mengubah organogram saat
            dikunci. Pemilik dan admin tidak terpengaruh.
          </p>
        </div>
      </section>
    </>
  );

  return (
    <div className="relative flex h-[560px] flex-col overflow-hidden rounded-xl border border-neutral-400 bg-neutral-100">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-400 bg-white px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex items-center">
            <IconBtn label="Urungkan" disabled>
              <Undo2 className="size-4" aria-hidden />
            </IconBtn>
            <IconBtn label="Ulangi" disabled>
              <Redo2 className="size-4" aria-hidden />
            </IconBtn>
          </div>
          {locked ? (
            <span className="shrink-0 rounded-full bg-warning-light px-2 py-0.5 text-xs font-semibold text-neutral-1000">
              Terkunci
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-live="polite"
            className={cn(
              'inline-block min-w-[10rem] text-right text-sm',
              dirty ? 'font-semibold text-neutral-1000' : 'text-neutral-700',
            )}
          >
            {dirty
              ? 'Ada perubahan belum disimpan'
              : 'Semua perubahan tersimpan'}
          </span>
          <Btn small tone="outline" disabled={!dirty} onClick={revertDraft}>
            Batal
          </Btn>
          <Btn small tone="teal" disabled={!dirty} onClick={saveDraft}>
            Simpan
          </Btn>
          <ModeTabs value={mode} onChange={setMode} />
          <Btn small tone="outline">
            Impor
          </Btn>
          <Btn
            small
            tone="outline"
            className={guide.spot('ekspor')}
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4" aria-hidden /> Ekspor
          </Btn>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-5">
        <div className="mx-auto max-w-2xl">
          {mode === 'pengaturan' ? (
            settings
          ) : (
            <div className="grid min-h-[240px] place-items-center text-center">
              <div className="max-w-sm">
                <p className="text-sm text-neutral-700">
                  Tab {mode === 'bagan' ? 'Bagan' : 'Tabel'} tidak disimulasikan
                  di jendela ini.
                </p>
                <Btn
                  small
                  tone="outline"
                  className="mt-3"
                  onClick={() => setMode('pengaturan')}
                >
                  Kembali ke Pengaturan
                </Btn>
              </div>
            </div>
          )}
        </div>
      </main>

      {exportOpen ? (
        <ExportDialog
          name={name}
          levelCount={levelCount}
          levelLabel={levelLabel}
          guide={guide}
          onClose={() => setExportOpen(false)}
          onDownload={() => {
            setExportOpen(false);
            flash('Gambar diunduh');
          }}
        />
      ) : null}

      {flashNode}
    </div>
  );
}

function ModeTabs({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (next: Mode) => void;
}) {
  return (
    <div role="group" aria-label="Tampilan" className="flex items-center gap-1">
      {MODES.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'h-8 rounded-full border px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1',
              active
                ? 'border-secondary-800 bg-secondary-800 text-white'
                : 'border-secondary-400 bg-white text-secondary-800 hover:bg-secondary-100',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function IconBtn({
  label,
  title,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Btn
      small
      tone="ghost"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className={cn('w-7 px-0', className)}
    >
      {children}
    </Btn>
  );
}

function ExportDialog({
  name,
  levelCount,
  levelLabel,
  guide,
  onClose,
  onDownload,
}: {
  name: string;
  levelCount: number;
  levelLabel: (index: number) => string;
  guide: DemoGuide;
  onClose: () => void;
  onDownload: () => void;
}) {
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const [depth, setDepth] = useState(levelCount);
  const [showPositions, setShowPositions] = useState(true);
  const [showPeople, setShowPeople] = useState(true);
  const [expandGroups, setExpandGroups] = useState(false);
  const [showTitle, setShowTitle] = useState(true);
  const [scale, setScale] = useState(2);

  const clamped = Math.min(depth, levelCount);
  const nodeCount = 3 + (clamped >= 2 ? 6 : 0);
  const width = 900;
  const height = clamped >= 2 ? 620 : 380;

  return (
    <Modal
      title="Ekspor bagan"
      description="Gambar untuk publikasi atau dokumentasi. Tampilannya berbeda dari layar: latar putih, tanpa foto dan tombol."
      onClose={onClose}
      wide
      footer={
        <>
          <Btn tone="outline" onClick={onClose}>
            Batal
          </Btn>
          <Btn tone="teal" onClick={onDownload}>
            Unduh
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <Segmented
            label="Format"
            value={format}
            options={[
              { value: 'png', label: 'PNG' },
              { value: 'svg', label: 'SVG' },
            ]}
            onChange={(next) => {
              setFormat(next);
              if (next === 'svg') guide.complete('ekspor');
            }}
          />

          <div className="space-y-2">
            <label
              htmlFor="export-depth"
              className="text-sm font-medium text-neutral-1000"
            >
              Sampai kedalaman
            </label>
            <select
              id="export-depth"
              value={clamped}
              onChange={(event) => setDepth(Number(event.target.value))}
              className="h-9 w-full rounded-[8px] border border-neutral-400 bg-white px-3 text-sm text-neutral-1000"
            >
              {Array.from({ length: levelCount }, (_, index) => index + 1).map(
                (level) => (
                  <option key={level} value={level}>
                    {level === levelCount
                      ? 'Seluruh struktur'
                      : `Sampai ${levelLabel(level)} (tingkat ${level})`}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-1000">Isi bagan</p>
            <CheckRow
              id="export-positions"
              label="Tampilkan jabatan"
              checked={showPositions}
              onChange={setShowPositions}
            />
            <CheckRow
              id="export-people"
              label="Tampilkan nama orang"
              hint="Nama orang menempel pada jabatan."
              checked={showPositions && showPeople}
              disabled={!showPositions}
              onChange={setShowPeople}
            />
            <CheckRow
              id="export-groups"
              label="Buka daftar kelompok jabatan"
              checked={showPositions && expandGroups}
              disabled={!showPositions}
              onChange={setExpandGroups}
            />
            <CheckRow
              id="export-title"
              label="Sertakan judul"
              checked={showTitle}
              onChange={setShowTitle}
            />
          </div>

          {format === 'png' ? (
            <Segmented
              label="Ketajaman"
              value={scale}
              options={[1, 2, 3].map((value) => ({
                value,
                label: `${value}×`,
              }))}
              onChange={setScale}
            />
          ) : null}
        </div>

        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-neutral-1000">Pratinjau</p>
          <div className="max-h-[45vh] overflow-auto rounded-[8px] border border-neutral-400 bg-white p-3">
            {showTitle ? (
              <p className="mb-2 truncate text-center text-[11px] font-semibold text-neutral-1000">
                {name || 'Tanpa nama'}
              </p>
            ) : null}
            <div className="flex items-start justify-center gap-2">
              {PREVIEW_TREE.map((node) => (
                <div key={node.name} className="min-w-0 flex-1 space-y-1">
                  <div className="rounded-[6px] border border-secondary-400 bg-secondary-50 px-1.5 py-1 text-center">
                    <p className="truncate text-[10px] font-semibold text-secondary-800">
                      {node.name}
                    </p>
                    {showPositions ? (
                      <p className="truncate text-[9px] text-neutral-700">
                        Kepala
                      </p>
                    ) : null}
                    {showPositions && showPeople ? (
                      <p className="truncate text-[9px] font-medium text-neutral-1000">
                        {node.person}
                      </p>
                    ) : null}
                    {showPositions && expandGroups ? (
                      <p className="truncate text-[9px] text-neutral-700">
                        +{node.children.length} jabatan
                      </p>
                    ) : null}
                  </div>
                  {clamped >= 2 ? (
                    <ul className="space-y-1 border-t border-dashed border-neutral-400 pt-1">
                      {node.children.map((child) => (
                        <li
                          key={child}
                          className="rounded-[6px] border border-neutral-400 px-1.5 py-0.5 text-center"
                        >
                          <p className="truncate text-[10px] font-semibold text-neutral-1000">
                            {child}
                          </p>
                          {showPositions && showPeople ? (
                            <p className="truncate text-[9px] text-neutral-700">
                              2 orang
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm tabular-nums text-neutral-700">
            {nodeCount} bagian, {width} × {height} px
          </p>
        </div>
      </div>
    </Modal>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-neutral-1000">{label}</p>
      <div className="flex gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <Btn
              key={String(option.value)}
              small
              tone={active ? 'teal' : 'outline'}
              aria-pressed={active}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </Btn>
          );
        })}
      </div>
    </div>
  );
}

function CheckRow({
  id,
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 shrink-0 rounded border-neutral-400 accent-secondary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        />
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-normal text-neutral-1000',
            disabled && 'text-neutral-700',
          )}
        >
          {label}
        </label>
      </div>
      {hint ? <p className="pl-6 text-xs text-neutral-700">{hint}</p> : null}
    </div>
  );
}
