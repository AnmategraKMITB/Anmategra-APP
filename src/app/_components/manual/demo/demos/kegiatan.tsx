'use client';

// Library Import
import { Pin, Plus } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Empty,
  Field,
  inputClass,
  Modal,
  Pill,
  type PillTone,
  ScreenTitle,
  tdClass,
  thClass,
  Toggle,
} from '../ui';

const STEPS: DemoStep[] = [
  { id: 'tambah', title: 'Klik **Tambah Kegiatan Baru**' },
  {
    id: 'isi',
    title: 'Isi **Nama Kegiatan**, **Tanggal Mulai**, dan **Status Kegiatan**',
  },
  { id: 'simpan', title: 'Klik **SIMPAN**' },
  {
    id: 'pin',
    title: 'Klik ikon pin pada salah satu baris',
    hint: 'Kegiatan yang disematkan tampil sebagai Highlighted Event di profil lembaga.',
  },
  { id: 'filter', title: 'Ubah filter **Status** menjadi **Coming Soon**' },
];

type Status = 'Coming Soon' | 'On going' | 'Ended';
const STATUS_LABEL: Record<Status, string> = {
  'Coming Soon': 'Segera Dimulai',
  'On going': 'Sedang Berlangsung',
  Ended: 'Selesai',
};
const TONE: Record<Status, PillTone> = {
  'Coming Soon': 'info',
  'On going': 'success',
  Ended: 'neutral',
};

type Event = {
  id: number;
  name: string;
  date: string;
  status: Status;
  committee: number;
  pinned: boolean;
};

const INITIAL: Event[] = [
  { id: 1, name: 'Festival Karya 2026', date: '2026-12-05', status: 'Coming Soon', committee: 24, pinned: false },
  { id: 2, name: 'Kelas Desain Dasar', date: '2026-10-20', status: 'On going', committee: 8, pinned: false },
  { id: 3, name: 'Malam Keakraban 2026', date: '2026-08-30', status: 'Ended', committee: 31, pinned: false },
];

export default function KegiatanDemo() {
  return (
    <DemoFrame
      title="Mengelola kegiatan lembaga"
      location="Lembaga › Kegiatan"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [events, setEvents] = useState(INITIAL);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Status | ''>('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<Status>('Coming Soon');
  const [publicRapor, setPublicRapor] = useState(false);

  const rows = events.filter(
    (event) =>
      event.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (filter === '' || event.status === filter),
  );
  const ready = name.trim() !== '' && date !== '';

  return (
    <div>
      <ScreenTitle
        title="Kegiatan"
        actions={
          <Btn
            className={guide.spot('tambah')}
            onClick={() => {
              setOpen(true);
              guide.complete('tambah');
            }}
          >
            <Plus aria-hidden /> Tambah Kegiatan Baru
          </Btn>
        }
      />
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Cari kegiatan"
          placeholder="Cari kegiatan"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={cn(inputClass, 'min-w-40 flex-1')}
        />
        <select
          aria-label="Status"
          value={filter}
          onChange={(event) => {
            const value = event.target.value as Status | '';
            setFilter(value);
            if (value === 'Coming Soon') guide.complete('filter');
          }}
          className={cn(inputClass, 'w-40', guide.spot('filter'))}
        >
          <option value="">Semua status</option>
          <option>Coming Soon</option>
          <option>On going</option>
          <option>Ended</option>
        </select>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-400">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr>
              <th className={thClass}>Judul</th>
              <th className={thClass}>Tanggal</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Panitia</th>
              <th className={thClass}>Rapor</th>
              <th className={thClass}>
                <span className="sr-only">Sematkan</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((event, index) => (
              <tr key={event.id}>
                <td className={cn(tdClass, 'font-semibold')}>{event.name}</td>
                <td className={cn(tdClass, 'whitespace-nowrap text-xs')}>
                  {event.date}
                </td>
                <td className={tdClass}>
                  <Pill tone={TONE[event.status]}>{event.status}</Pill>
                </td>
                <td className={tdClass}>
                  <Btn small tone="outline">
                    Panitia ({event.committee})
                  </Btn>
                </td>
                <td className={tdClass}>
                  <Btn small tone="ghost">
                    Lihat
                  </Btn>
                </td>
                <td className={tdClass}>
                  <Btn
                    small
                    tone={event.pinned ? 'teal' : 'ghost'}
                    aria-pressed={event.pinned}
                    aria-label={`Sematkan ${event.name}`}
                    className={index === 0 ? guide.spot('pin') : ''}
                    onClick={() => {
                      // Hanya satu kegiatan yang bisa disematkan.
                      setEvents((prev) =>
                        prev.map((item) => ({
                          ...item,
                          pinned: item.id === event.id ? !item.pinned : false,
                        })),
                      );
                      guide.complete('pin');
                    }}
                  >
                    <Pin aria-hidden />
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="p-3">
            <Empty>Aktivitas tidak ditemukan</Empty>
          </div>
        ) : null}
      </div>

      {open ? (
        <Modal
          wide
          title="Tambah Kegiatan"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setOpen(false)}>
                Batal
              </Btn>
              <Btn
                disabled={!ready}
                className={guide.spot('simpan')}
                onClick={() => {
                  setEvents((prev) => [
                    {
                      id: Date.now(),
                      name: name.trim(),
                      date,
                      status,
                      committee: 0,
                      pinned: false,
                    },
                    ...prev,
                  ]);
                  setOpen(false);
                  setName('');
                  setDate('');
                  guide.complete('isi');
                  guide.complete('simpan');
                }}
              >
                SIMPAN
              </Btn>
            </>
          }
        >
          <div className={cn('space-y-3 rounded-lg', guide.spot('isi'))}>
            <Field label="Nama Kegiatan">
              {(id) => (
                <input
                  id={id}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tanggal Mulai">
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      if (name.trim() && event.target.value) {
                        guide.complete('isi');
                      }
                    }}
                    className={inputClass}
                  />
                )}
              </Field>
              <Field label="Status Kegiatan">
                {(id) => (
                  <select
                    id={id}
                    value={status}
                    onChange={(event) => setStatus(event.target.value as Status)}
                    className={inputClass}
                  >
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </div>
          <Field label="Link Pendaftaran" hint="Opsional. Dipakai tombol Daftar menjadi Panitia.">
            {(id) => <input id={id} type="url" placeholder="https://" className={inputClass} />}
          </Field>
          <Toggle
            label="Rapor Terlihat Publik"
            checked={publicRapor}
            onChange={setPublicRapor}
          />
        </Modal>
      ) : null}
    </div>
  );
}
