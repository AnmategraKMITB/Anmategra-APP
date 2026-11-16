'use client';

// Library Import
import { ArrowLeft } from 'lucide-react';
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
  ScreenTitle,
  useFlash,
} from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'filter',
    title: 'Ubah **Status Kegiatan** menjadi **Open Recruitment**',
  },
  { id: 'buka', title: 'Pilih kartu **Festival Karya 2026**' },
  {
    id: 'ajukan',
    title: 'Klik **Ajukan Asosiasi**',
    hint: 'Dipakai bila Anda sudah menjadi panitia tetapi belum tercatat. Untuk mendaftar baru, gunakan **Daftar menjadi Panitia**.',
  },
  { id: 'kirim', title: 'Isi **Posisi** dan **Divisi**, lalu klik **KIRIM**' },
];

type Event = {
  id: string;
  name: string;
  host: string;
  status: 'Coming Soon' | 'On going' | 'Ended';
  oprec: boolean;
  participants: number;
};

const EVENTS: Event[] = [
  { id: 'fk', name: 'Festival Karya 2026', host: 'Himpunan Mahasiswa Contoh', status: 'Coming Soon', oprec: true, participants: 24 },
  { id: 'kd', name: 'Kelas Desain Dasar', host: 'UKM Rupa', status: 'On going', oprec: false, participants: 8 },
  { id: 'mk', name: 'Malam Keakraban 2026', host: 'Himpunan Mahasiswa Contoh', status: 'Ended', oprec: false, participants: 31 },
];

export default function KegiatanMahasiswaDemo() {
  return (
    <DemoFrame
      title="Menelusuri kegiatan dan mengajukan asosiasi"
      location="Mahasiswa › Kegiatan"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('Terbaru');
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [position, setPosition] = useState('');
  const [division, setDivision] = useState('');
  const [requested, setRequested] = useState<string[]>([]);
  const { flash, node } = useFlash();

  const rows = EVENTS.filter((event) =>
    filter === ''
      ? true
      : filter === 'Open Recruitment'
        ? event.oprec
        : event.status === filter,
  ).sort((a, b) =>
    sort === 'Peserta Terbanyak' ? b.participants - a.participants : 0,
  );
  const opened = EVENTS.find((event) => event.id === openId);

  if (opened) {
    const pending = requested.includes(opened.id);
    return (
      <div>
        <Btn small tone="ghost" onClick={() => setOpenId(null)}>
          <ArrowLeft aria-hidden /> Kembali ke daftar
        </Btn>
        <div className="mt-2 rounded-lg border border-neutral-400 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold">{opened.name}</p>
            <Pill tone="info">{opened.status}</Pill>
            {opened.oprec ? <Pill tone="teal">Open Recruitment</Pill> : null}
          </div>
          <p className="text-xs text-neutral-700">{opened.host}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {opened.oprec ? (
              <Btn
                onClick={() =>
                  flash('Di aplikasi, tombol ini membuka tautan pendaftaran.')
                }
              >
                Daftar menjadi Panitia
              </Btn>
            ) : null}
            {pending ? (
              <Btn
                tone="dangerOutline"
                onClick={() =>
                  setRequested((prev) =>
                    prev.filter((id) => id !== opened.id),
                  )
                }
              >
                Batalkan Pengajuan
              </Btn>
            ) : (
              <Btn
                tone="outline"
                className={guide.spot('ajukan')}
                onClick={() => {
                  setDialog(true);
                  guide.complete('ajukan');
                }}
              >
                Ajukan Asosiasi
              </Btn>
            )}
          </div>
          {pending ? (
            <p className="mt-3 text-xs text-neutral-700">
              Pengajuan menunggu keputusan lembaga. Pantau statusnya di Inbox.
            </p>
          ) : null}
        </div>

        {dialog ? (
          <Modal
            title="Ajukan Asosiasi"
            description={opened.name}
            onClose={() => setDialog(false)}
            footer={
              <>
                <Btn tone="ghost" onClick={() => setDialog(false)}>
                  Batal
                </Btn>
                <Btn
                  disabled={position.trim() === '' || division.trim() === ''}
                  className={guide.spot('kirim')}
                  onClick={() => {
                    setRequested((prev) => [...prev, opened.id]);
                    setDialog(false);
                    guide.complete('kirim');
                    flash('Pengajuan dikirim ke lembaga.');
                  }}
                >
                  KIRIM
                </Btn>
              </>
            }
          >
            <div className={cn('grid gap-3 rounded-lg sm:grid-cols-2', guide.spot('kirim'))}>
              <Field label="Posisi">
                {(id) => (
                  <input
                    id={id}
                    value={position}
                    placeholder="Mis. Staf"
                    onChange={(event) => setPosition(event.target.value)}
                    className={inputClass}
                  />
                )}
              </Field>
              <Field label="Divisi">
                {(id) => (
                  <input
                    id={id}
                    value={division}
                    placeholder="Mis. Acara"
                    onChange={(event) => setDivision(event.target.value)}
                    className={inputClass}
                  />
                )}
              </Field>
            </div>
          </Modal>
        ) : null}
        {node}
      </div>
    );
  }

  return (
    <div>
      <ScreenTitle title="Kegiatan" />
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Status Kegiatan"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            if (event.target.value === 'Open Recruitment') {
              guide.complete('filter');
            }
          }}
          className={cn(inputClass, 'w-48', guide.spot('filter'))}
        >
          <option value="">Semua status</option>
          <option>Coming Soon</option>
          <option>On going</option>
          <option>Ended</option>
          <option>Open Recruitment</option>
        </select>
        <select
          aria-label="Urutkan"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className={cn(inputClass, 'w-44')}
        >
          <option>Terbaru</option>
          <option>Terlama</option>
          <option>Peserta Terbanyak</option>
        </select>
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {rows.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => {
                setOpenId(event.id);
                if (event.id === 'fk') guide.complete('buka');
              }}
              className={cn(
                'w-full rounded-lg border border-neutral-400 p-3 text-left hover:border-primary-400 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                event.id === 'fk' && guide.spot('buka'),
              )}
            >
              <p className="font-semibold">{event.name}</p>
              <p className="text-xs text-neutral-700">{event.host}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Pill tone="info">{event.status}</Pill>
                {event.oprec ? <Pill tone="teal">Open Recruitment</Pill> : null}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <Empty>Tidak ada kegiatan yang cocok.</Empty> : null}
      {node}
    </div>
  );
}
