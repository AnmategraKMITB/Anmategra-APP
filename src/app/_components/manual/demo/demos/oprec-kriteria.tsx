'use client';

// Library Import
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { Btn, Empty, Field, inputClass, Modal, Pill } from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'slot',
    title: 'Pilih slot **Divisi Acara**',
    hint: 'Slot dibuat otomatis: satu untuk penilaian umum dan satu per divisi yang dibuka.',
  },
  { id: 'tambah', title: 'Klik **Tambah kriteria**' },
  {
    id: 'isi',
    title: 'Isi nama, pilih jenis **Skor**, dan beri bobot **40**',
    hint: 'Slot ini sudah punya satu kriteria berbobot 60, jadi 40 membuat totalnya 100%.',
  },
  {
    id: 'ikat',
    title: 'Centang minimal satu **Pertanyaan terkait**, lalu klik **Simpan**',
    hint: 'Penilai melihat jawaban pertanyaan ini saat memberi skor untuk kriterianya.',
  },
  {
    id: 'gugur',
    title: 'Di slot **Umum**, tambahkan kriteria berjenis **Gugur otomatis**',
    hint: 'Contoh: pendaftar yang menjawab "Tidak" pada kesediaan mengikuti seluruh rangkaian langsung gugur.',
  },
];

type Kind = 'skor' | 'gugur_otomatis' | 'gugur_manual';
const KIND_LABEL: Record<Kind, string> = {
  skor: 'Skor',
  gugur_otomatis: 'Gugur otomatis',
  gugur_manual: 'Gugur manual',
};

type Criterion = {
  id: number;
  name: string;
  kind: Kind;
  weight: number;
  questions: string[];
};

const SLOTS = [
  { id: 'umum', label: 'Umum' },
  { id: 'acara', label: 'Divisi Acara' },
  { id: 'publikasi', label: 'Divisi Publikasi' },
] as const;
type SlotId = (typeof SLOTS)[number]['id'];

const QUESTIONS: Record<SlotId, string[]> = {
  umum: [
    'Mengapa Anda ingin bergabung?',
    'Bersedia mengikuti seluruh rangkaian acara?',
    'Tautan CV',
  ],
  acara: [
    'Ceritakan pengalaman menyusun rundown',
    'Ide acara pembuka menurut Anda',
  ],
  publikasi: ['Tautan portofolio desain', 'Aplikasi desain yang dikuasai'],
};

const INITIAL: Record<SlotId, Criterion[]> = {
  umum: [
    { id: 1, name: 'Motivasi', kind: 'skor', weight: 60, questions: [QUESTIONS.umum[0]!] },
    { id: 2, name: 'Kelengkapan berkas', kind: 'skor', weight: 40, questions: [QUESTIONS.umum[2]!] },
  ],
  acara: [
    { id: 3, name: 'Pengalaman acara', kind: 'skor', weight: 60, questions: [QUESTIONS.acara[0]!] },
  ],
  publikasi: [],
};

type Draft = Omit<Criterion, 'id'> & { id: number | null };

export default function OprecKriteriaDemo() {
  return (
    <DemoFrame
      title="Kriteria penilaian oprec"
      location="Lembaga › Forms › Pendaftaran Oprec Festival Karya 2026 › tab Penilaian"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [slot, setSlot] = useState<SlotId>('umum');
  const [criteria, setCriteria] = useState(INITIAL);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [nextId, setNextId] = useState(10);

  const list = criteria[slot];
  const total = list
    .filter((item) => item.kind === 'skor')
    .reduce((sum, item) => sum + item.weight, 0);
  const hasScore = list.some((item) => item.kind === 'skor');

  const openNew = () => {
    guide.complete('tambah');
    setDraft({ id: null, name: '', kind: 'skor', weight: 0, questions: [] });
  };

  const save = () => {
    if (!draft || draft.name.trim() === '') return;
    const saved: Criterion = {
      ...draft,
      id: draft.id ?? nextId,
      name: draft.name.trim(),
      weight: draft.kind === 'skor' ? draft.weight : 0,
    };
    if (draft.id === null) setNextId((value) => value + 1);
    setCriteria((prev) => ({
      ...prev,
      [slot]:
        draft.id === null
          ? [...prev[slot], saved]
          : prev[slot].map((item) => (item.id === draft.id ? saved : item)),
    }));
    if (saved.kind === 'skor') guide.complete('isi');
    if (saved.questions.length > 0) guide.complete('ikat');
    if (slot === 'umum' && saved.kind === 'gugur_otomatis') {
      guide.complete('gugur');
    }
    setDraft(null);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[180px_1fr]">
      <div>
        <p className="mb-2 text-xs font-semibold text-neutral-700">
          Slot penilaian
        </p>
        <ul className="space-y-1">
          {SLOTS.map((item) => {
            const sum = criteria[item.id]
              .filter((c) => c.kind === 'skor')
              .reduce((acc, c) => acc + c.weight, 0);
            const anyScore = criteria[item.id].some((c) => c.kind === 'skor');
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={slot === item.id}
                  onClick={() => {
                    setSlot(item.id);
                    if (item.id === 'acara') guide.complete('slot');
                  }}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    slot === item.id
                      ? 'border-primary-400 bg-primary-100'
                      : 'border-neutral-400 hover:border-primary-400',
                    item.id === 'acara' && guide.spot('slot'),
                    item.id === 'umum' && slot !== 'umum' && guide.spot('gugur'),
                  )}
                >
                  <span className="block font-semibold">{item.label}</span>
                  <span className="block text-xs text-neutral-700">
                    {criteria[item.id].length} kriteria
                    {anyScore && sum !== 100 ? ' · bobot belum 100%' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold">
            {SLOTS.find((item) => item.id === slot)?.label}
          </p>
          {hasScore ? (
            <Pill tone={total === 100 ? 'success' : 'warning'}>
              {total === 100
                ? 'Total bobot 100%'
                : `Total bobot belum 100% (${total}%)`}
            </Pill>
          ) : null}
          <Btn
            small
            className={cn(
              'ml-auto',
              guide.spot('tambah', 'isi', 'ikat'),
              slot === 'umum' && guide.spot('gugur'),
            )}
            onClick={openNew}
          >
            <Plus aria-hidden /> Tambah kriteria
          </Btn>
        </div>

        <div className="mt-3 space-y-2">
          {list.length === 0 ? (
            <Empty>Belum ada kriteria di sini.</Empty>
          ) : (
            list.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-400 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.name}</p>
                  <p className="flex items-center gap-1 text-xs text-neutral-700">
                    <Link2 className="size-3" aria-hidden />
                    {item.questions.length > 0
                      ? `${item.questions.length} pertanyaan`
                      : 'Belum terhubung'}
                  </p>
                </div>
                <Pill tone={item.kind === 'skor' ? 'info' : 'danger'}>
                  {KIND_LABEL[item.kind]}
                </Pill>
                {item.kind === 'skor' ? (
                  <span className="w-16 text-right text-xs font-semibold">
                    bobot {item.weight}%
                  </span>
                ) : null}
                <Btn
                  small
                  tone="ghost"
                  aria-label={`Ubah ${item.name}`}
                  onClick={() => setDraft({ ...item })}
                >
                  <Pencil aria-hidden />
                </Btn>
                <Btn
                  small
                  tone="ghost"
                  aria-label={`Hapus ${item.name}`}
                  onClick={() =>
                    setCriteria((prev) => ({
                      ...prev,
                      [slot]: prev[slot].filter((c) => c.id !== item.id),
                    }))
                  }
                >
                  <Trash2 aria-hidden />
                </Btn>
              </div>
            ))
          )}
        </div>
        <p className="mt-3 text-xs text-neutral-700">
          Perubahan kriteria menghitung ulang status semua pendaftar.
        </p>
      </div>

      {draft ? (
        <Modal
          title={draft.id === null ? 'Tambah kriteria' : 'Ubah kriteria'}
          onClose={() => setDraft(null)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setDraft(null)}>
                Batal
              </Btn>
              <Btn
                disabled={draft.name.trim() === ''}
                className={guide.spot('ikat', 'gugur')}
                onClick={save}
              >
                Simpan
              </Btn>
            </>
          }
        >
          <Field label="Nama">
            {(id) => (
              <input
                id={id}
                value={draft.name}
                placeholder="Mis. Motivasi bergabung"
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                className={cn(inputClass, guide.spot('isi'))}
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jenis">
              {(id) => (
                <select
                  id={id}
                  value={draft.kind}
                  onChange={(event) =>
                    setDraft({ ...draft, kind: event.target.value as Kind })
                  }
                  className={cn(inputClass, guide.spot('gugur'))}
                >
                  {Object.entries(KIND_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {draft.kind === 'skor' ? (
              <Field label="Bobot" hint="Persen 0-100. Total bobot satu slot sebaiknya 100%.">
                {(id) => (
                  <input
                    id={id}
                    type="number"
                    min={0}
                    max={100}
                    value={draft.weight}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        weight: Math.max(
                          0,
                          Math.min(100, Number(event.target.value) || 0),
                        ),
                      })
                    }
                    className={cn(inputClass, guide.spot('isi'))}
                  />
                )}
              </Field>
            ) : null}
          </div>
          <fieldset className={cn('rounded-lg', guide.spot('ikat'))}>
            <legend className="text-xs font-semibold text-neutral-800">
              Pertanyaan terkait
            </legend>
            <p className="text-xs text-neutral-700">
              Pilih pertanyaan yang dinilai oleh kriteria ini.
            </p>
            <div className="mt-1 space-y-1">
              {QUESTIONS[slot].map((question) => (
                <label key={question} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={draft.questions.includes(question)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        questions: event.target.checked
                          ? [...draft.questions, question]
                          : draft.questions.filter((q) => q !== question),
                      })
                    }
                    className="mt-0.5 size-4 accent-[#2B6282]"
                  />
                  <span>{question}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {draft.kind === 'gugur_otomatis' ? (
            <p className="rounded-lg bg-warning-light p-2 text-xs text-neutral-1000">
              Aturan gugur otomatis memakai pertanyaan terkait sebagai acuan,
              misalnya: jawaban <strong>adalah</strong> “Tidak” berarti
              gugur.
            </p>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
