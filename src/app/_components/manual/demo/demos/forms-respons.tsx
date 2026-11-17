'use client';

// Library Import
import { ChevronLeft, ChevronRight, Copy, Download } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { cn } from '~/lib/utils';

import { DEMO_STUDENTS } from '../data';
import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Modal,
  Pill,
  Toggle,
  tdClass,
  thClass,
  useFlash,
} from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'tabel',
    title: 'Baca **Ringkasan**, lalu buka tab **Tabel**',
    hint: 'Ringkasan merangkum tiap pertanyaan sebagai grafik batang. Tabel menampilkan satu baris per pengisi.',
  },
  {
    id: 'detail',
    title: 'Klik satu baris untuk membaca jawaban lengkapnya',
    hint: 'Panel samping memuat semua jawaban pengisi, termasuk pertanyaan yang dijawab belakangan.',
  },
  {
    id: 'ekspor',
    title: 'Tutup panel, lalu klik **Ekspor CSV**',
  },
];

// Data form contoh: oprec Aku Masuk ITB 2027 dengan pertanyaan bergaya santai.
const FORM_TITLE = 'Survei Minat Panitia AMI 2027';
const FORM_OWNER = 'Kabinet KM ITB';
const TOTAL = 2641;
const PAGE_SIZE = 50;

const num = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

const when = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });

type AnswerSeed = {
  submittedAt: string;
  updatedAt: string;
  mbti: string;
  jaket: 'S' | 'M' | 'L' | 'XL';
  divisi: string;
  siap: number;
  motivasi: string;
  uji: boolean;
};

type RespRow = { id: string; name: string; nim: string } & AnswerSeed;

const SEEDS: AnswerSeed[] = [
  {
    submittedAt: '2026-11-10T09:12:00+07:00',
    updatedAt: '2026-11-10T09:12:00+07:00',
    mbti: 'INFJ',
    jaket: 'L',
    divisi: 'Event Organizer',
    siap: 5,
    motivasi:
      'Aku suka bikin acara dan udah pernah jadi koordinator Malam Keakraban angkatan.',
    uji: false,
  },
  {
    submittedAt: '2026-11-10T10:40:00+07:00',
    updatedAt: '2026-11-10T10:40:00+07:00',
    mbti: 'ENFP',
    jaket: 'M',
    divisi: 'Publikasi',
    siap: 4,
    motivasi:
      'Sering pegang desain feed himpunan, pengen bantu publikasi AMI 2027.',
    uji: false,
  },
  {
    submittedAt: '2026-11-10T13:05:00+07:00',
    updatedAt: '2026-11-10T13:05:00+07:00',
    mbti: 'ISTJ',
    jaket: 'XL',
    divisi: 'Logistik',
    siap: 4,
    motivasi: 'Tertarik belajar manajemen barang dan penataan venue.',
    uji: false,
  },
  {
    submittedAt: '2026-11-11T08:22:00+07:00',
    updatedAt: '2026-11-11T08:22:00+07:00',
    mbti: 'ENTP',
    jaket: 'M',
    divisi: 'Event Organizer',
    siap: 5,
    motivasi: 'Ketua pelaksana lomba fakultas, siap bantu konsep acara.',
    uji: false,
  },
  {
    submittedAt: '2026-11-11T19:47:00+07:00',
    updatedAt: '2026-11-11T19:47:00+07:00',
    mbti: 'INFP',
    jaket: 'L',
    divisi: 'Sponsorship',
    siap: 3,
    motivasi: 'Belum banyak pengalaman, tapi mau belajar cari sponsor.',
    uji: false,
  },
  {
    submittedAt: '2026-11-12T07:30:00+07:00',
    updatedAt: '2026-11-12T07:30:00+07:00',
    mbti: 'ENFP',
    jaket: 'S',
    divisi: 'Publikasi',
    siap: 4,
    motivasi: 'Iseng nyoba form buat ngecek tampilan di HP.',
    uji: true,
  },
  {
    submittedAt: '2026-11-12T09:14:00+07:00',
    updatedAt: '2026-11-12T10:02:00+07:00',
    mbti: 'ESTJ',
    jaket: 'XL',
    divisi: 'Logistik',
    siap: 4,
    motivasi: 'Terbiasa ngurus perlengkapan acara himpunan.',
    uji: false,
  },
  {
    submittedAt: '2026-11-12T11:55:00+07:00',
    updatedAt: '2026-11-12T11:55:00+07:00',
    mbti: 'ISFP',
    jaket: 'S',
    divisi: 'Sponsorship',
    siap: 5,
    motivasi: 'Pernah jadi humas dan suka negosiasi sama vendor.',
    uji: true,
  },
];

const ROWS: RespRow[] = DEMO_STUDENTS.flatMap((student, index) => {
  const seed = SEEDS[index];
  if (!seed) return [];
  return [
    { id: student.id, name: student.name, nim: student.nim, ...seed },
  ];
});

const MBTI_COUNTS = [
  { label: 'INFJ', count: 512 },
  { label: 'ENFP', count: 476 },
  { label: 'ISTJ', count: 388 },
  { label: 'ENTP', count: 341 },
  { label: 'INFP', count: 298 },
  { label: 'Lainnya', count: 626 },
];

const JAKET_COUNTS = [
  { label: 'S', count: 402 },
  { label: 'M', count: 1210 },
  { label: 'L', count: 812 },
  { label: 'XL', count: 217 },
];

const SIAP_DIST = [
  { value: 1, count: 58 },
  { value: 2, count: 112 },
  { value: 3, count: 341 },
  { value: 4, count: 1288 },
  { value: 5, count: 842 },
];

const PANDUAN = { yes: 1980, no: 661 };

const MOTIVASI = [
  'Aku pengen ngerasain jadi panitia acara besar dan bantu banyak orang.',
  'Udah pernah jadi staf publikasi, mau lanjut di divisi yang sama.',
  'Katanya AMI 2027 bakal rame, jadi penasaran pengen ikut kepanitiaan.',
];

const TABS = [
  ['ringkasan', 'Ringkasan'],
  ['tabel', 'Tabel'],
] as const;

type TabId = (typeof TABS)[number][0];

export default function FormsResponsDemo() {
  return (
    <DemoFrame
      title="Melihat respons form"
      location="Lembaga › Forms › Survei Minat Panitia AMI 2027 › Respons"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [tab, setTab] = useState<TabId>('ringkasan');
  const [openId, setOpenId] = useState<string | null>(null);
  const [hideTest, setHideTest] = useState(false);
  const { flash, node } = useFlash();

  const rows = hideTest ? ROWS.filter((row) => !row.uji) : ROWS;
  const pages = Math.max(1, Math.ceil(TOTAL / PAGE_SIZE));
  const opened = openId ? ROWS.find((row) => row.id === openId) : undefined;

  const chooseTab = (next: TabId) => {
    setTab(next);
    if (next === 'tabel') guide.complete('tabel');
  };

  const openRow = (row: RespRow) => {
    setOpenId(row.id);
    guide.complete('detail');
  };

  return (
    <div>
      <div className="h-[560px] overflow-y-auto pr-1">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => flash('Kembali ke form (simulasi).')}
              className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              ← Kembali ke form
            </button>
            <h2 className="mt-2 break-words text-2xl font-semibold text-neutral-1000 sm:text-[32px]">
              Respons: {FORM_TITLE}
            </h2>
            <p className="mt-1 text-sm text-neutral-700">
              {FORM_OWNER} · {num.format(TOTAL)} respons
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn
              tone="outline"
              onClick={() => flash('CSV disalin ke papan klip (simulasi).')}
            >
              <Copy aria-hidden /> Salin CSV
            </Btn>
            <Btn
              className={guide.spot('ekspor')}
              onClick={() => {
                guide.complete('ekspor');
                flash('respons.csv diunduh (simulasi).');
              }}
            >
              <Download aria-hidden /> Ekspor CSV
            </Btn>
          </div>
        </header>

        <div
          role="tablist"
          aria-label="Tampilan respons"
          className="mt-6 flex gap-1 border-b border-neutral-400"
        >
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => chooseTab(id)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                tab === id
                  ? 'border-primary-400 text-primary-400'
                  : 'border-transparent text-neutral-700 hover:text-neutral-1000',
                id === 'tabel' && guide.spot('tabel'),
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'ringkasan' ? (
            <Summary />
          ) : (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-neutral-700">
                  Menampilkan {rows.length} baris contoh dari{' '}
                  {num.format(TOTAL)} respons.
                </p>
                <Toggle
                  checked={hideTest}
                  onChange={setHideTest}
                  label="Sembunyikan respons uji"
                  className="text-xs text-neutral-800"
                />
              </div>

              <div className="overflow-x-auto rounded-[24px] border border-neutral-400 bg-neutral-50">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={thClass}>Waktu kirim</th>
                      <th className={thClass}>Diubah pada</th>
                      <th className={thClass}>Nama</th>
                      <th className={thClass}>NIM</th>
                      <th className={thClass}>MBTI kamu apaasichh??</th>
                      <th className={thClass}>Ukuran jaket?</th>
                      <th className={thClass}>Divisi yang diminati</th>
                      <th className={thClass}>Kesiapan komitmen</th>
                      <th className={thClass}>Motivasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr
                        key={row.id}
                        tabIndex={0}
                        onClick={() => openRow(row)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') openRow(row);
                        }}
                        className={cn(
                          'cursor-pointer hover:bg-primary-100 focus-visible:bg-primary-100 focus-visible:outline-none',
                          index === 0 && guide.spot('detail'),
                        )}
                      >
                        <td className={cn(tdClass, 'whitespace-nowrap')}>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openRow(row);
                            }}
                            className="text-left font-medium text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                          >
                            {when(row.submittedAt)}
                          </button>
                        </td>
                        <td className={cn(tdClass, 'whitespace-nowrap')}>
                          {when(row.updatedAt)}
                        </td>
                        <td className={tdClass}>
                          <span className="break-words">{row.name}</span>
                          {row.uji ? (
                            <Pill tone="warning" className="ml-2">
                              uji
                            </Pill>
                          ) : null}
                        </td>
                        <td className={tdClass}>{row.nim}</td>
                        <td className={tdClass}>{row.mbti}</td>
                        <td className={tdClass}>{row.jaket}</td>
                        <td className={tdClass}>{row.divisi}</td>
                        <td className={cn(tdClass, 'tabular-nums')}>
                          {row.siap} dari 5
                        </td>
                        <td className={cn(tdClass, 'max-w-64 align-top text-xs text-neutral-700')}>
                          {row.motivasi}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-700">
                <span>
                  {num.format(TOTAL)} respons · halaman 1 dari {pages}
                </span>
                <div className="flex gap-2">
                  <Btn small tone="outline" disabled>
                    <ChevronLeft aria-hidden /> Sebelumnya
                  </Btn>
                  <Btn
                    small
                    tone="outline"
                    onClick={() =>
                      flash(
                        'Simulasi hanya memuat 8 baris contoh dari 2.641 respons.',
                      )
                    }
                  >
                    Berikutnya <ChevronRight aria-hidden />
                  </Btn>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {opened ? (
        <Modal
          wide
          title={opened.name}
          description={`NIM ${opened.nim} · Dikirim ${when(opened.submittedAt)}${
            opened.updatedAt !== opened.submittedAt
              ? ` · diubah ${when(opened.updatedAt)}`
              : ''
          }`}
          onClose={() => setOpenId(null)}
          footer={
            <Btn tone="outline" onClick={() => setOpenId(null)}>
              Tutup
            </Btn>
          }
        >
          {opened.uji ? (
            <p className="rounded-xl bg-warning-light px-3 py-2 text-xs font-semibold text-neutral-1000 ring-1 ring-inset ring-saffron">
              Baris ini ditandai sebagai respons uji.
            </p>
          ) : null}
          <dl className="grid gap-3">
            {[
              { label: 'MBTI kamu apaasichh??', value: opened.mbti },
              { label: 'Ukuran jaket?', value: opened.jaket },
              { label: 'Divisi yang diminati', value: opened.divisi },
              {
                label: 'Seberapa siap kamu commit?',
                value: `${opened.siap} dari 5`,
              },
              { label: 'Ceritakan motivasimu', value: opened.motivasi },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-neutral-100 px-3 py-2"
              >
                <dt className="text-sm text-neutral-700">{item.label}</dt>
                <dd className="mt-0.5 whitespace-pre-line break-words text-neutral-1000">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </Modal>
      ) : null}
      {node}
    </div>
  );
}

function Bar({
  label,
  count,
  percent,
}: {
  label: string;
  count: number;
  percent: number;
}) {
  return (
    <li className="grid gap-1">
      <div className="flex justify-between gap-3 text-sm">
        <span className="min-w-0 break-words text-neutral-1000">{label}</span>
        <span className="shrink-0 tabular-nums text-neutral-700">
          {num.format(count)} · {num.format(percent)}%
        </span>
      </div>
      <div
        role="img"
        aria-label={`${label}: ${num.format(percent)} persen`}
        className="h-2 overflow-hidden rounded-full bg-neutral-200"
      >
        <div
          className="h-full rounded-full bg-primary-400"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-100 px-3 py-2">
      <dt className="text-xs text-neutral-700">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-neutral-1000">
        {value}
      </dd>
    </div>
  );
}

function SummaryCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="rounded-[24px] border border-neutral-400 bg-neutral-50 p-5">
      <h3 className="font-semibold text-neutral-1000">{title}</h3>
      <div className="mt-3">{children}</div>
    </li>
  );
}

function Summary() {
  const siapAverage = 4.21;
  return (
    <ol className="grid gap-4">
      <SummaryCard title="MBTI kamu apaasichh??">
        <ul className="grid gap-3">
          {MBTI_COUNTS.map((option) => (
            <Bar
              key={option.label}
              label={option.label}
              count={option.count}
              percent={(option.count / TOTAL) * 100}
            />
          ))}
        </ul>
      </SummaryCard>

      <SummaryCard title="Ukuran jaket?">
        <ul className="grid gap-3">
          {JAKET_COUNTS.map((option) => (
            <Bar
              key={option.label}
              label={option.label}
              count={option.count}
              percent={(option.count / TOTAL) * 100}
            />
          ))}
        </ul>
      </SummaryCard>

      <SummaryCard title="Seberapa siap kamu commit?">
        <div className="grid gap-3">
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Jawaban" value={num.format(TOTAL)} />
            <Stat label="Rata-rata" value={num.format(siapAverage)} />
          </dl>
          <ul className="grid gap-3">
            {SIAP_DIST.map((item) => (
              <Bar
                key={item.value}
                label={String(item.value)}
                count={item.count}
                percent={(item.count / TOTAL) * 100}
              />
            ))}
          </ul>
        </div>
      </SummaryCard>

      <SummaryCard title="Sudah baca buku panduan?">
        <ul className="grid gap-3">
          <Bar
            label="Ya"
            count={PANDUAN.yes}
            percent={(PANDUAN.yes / TOTAL) * 100}
          />
          <Bar
            label="Tidak"
            count={PANDUAN.no}
            percent={(PANDUAN.no / TOTAL) * 100}
          />
        </ul>
      </SummaryCard>

      <SummaryCard title="Ceritakan motivasimu">
        <ul className="grid gap-2">
          {MOTIVASI.map((text) => (
            <li
              key={text}
              className="whitespace-pre-line break-words rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-1000"
            >
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-neutral-700">
          Menampilkan {MOTIVASI.length} dari {num.format(2398)} jawaban terbaru.
          Lihat semuanya di tab Tabel atau ekspor CSV.
        </p>
      </SummaryCard>
    </ol>
  );
}
