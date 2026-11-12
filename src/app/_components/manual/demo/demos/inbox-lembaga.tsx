'use client';

// Library Import
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Empty,
  inputClass,
  Pill,
  ScreenTitle,
  useFlash,
} from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'cari',
    title: 'Saring pengajuan dengan **Cari nama pemohon** atau filter **Divisi**',
  },
  {
    id: 'terima',
    title: 'Klik **ACCEPT** pada pengajuan yang datanya benar',
    hint: 'Pemohon langsung tercatat sebagai panitia dengan divisi dan posisi itu.',
  },
  { id: 'tolak', title: 'Klik **DECLINE** pada pengajuan yang tidak sesuai' },
];

type Request = {
  id: number;
  name: string;
  nim: string;
  division: string;
  position: string;
  decision?: 'ACCEPTED' | 'DECLINED';
};

const INITIAL: Request[] = [
  { id: 1, name: 'Dimas Wicaksono', nim: '13124073', division: 'Logistik', position: 'Staf' },
  { id: 2, name: 'Salsa Rahmadhani', nim: '17424021', division: 'Publikasi', position: 'Staf' },
  { id: 3, name: 'Fajar Nugraha', nim: '10523044', division: 'Acara', position: 'Kepala Divisi' },
];

export default function InboxLembagaDemo() {
  return (
    <DemoFrame
      title="Memproses pengajuan asosiasi"
      location="Lembaga › Inbox › Festival Karya 2026"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [requests, setRequests] = useState(INITIAL);
  const [query, setQuery] = useState('');
  const [division, setDivision] = useState('');
  const { flash, node } = useFlash();

  const rows = requests.filter(
    (request) =>
      request.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (division === '' || request.division === division),
  );

  const decide = (id: number, decision: 'ACCEPTED' | 'DECLINED') => {
    setRequests((prev) =>
      prev.map((request) =>
        request.id === id ? { ...request, decision } : request,
      ),
    );
    guide.complete(decision === 'ACCEPTED' ? 'terima' : 'tolak');
    flash(
      decision === 'ACCEPTED'
        ? 'Pengajuan diterima. Pemohon tercatat sebagai panitia.'
        : 'Pengajuan ditolak.',
    );
  };

  return (
    <div>
      <ScreenTitle
        title="Inbox"
        subtitle="Pengajuan asosiasi untuk Festival Karya 2026"
      />
      <div className={cn('flex flex-wrap gap-2 rounded-lg', guide.spot('cari'))}>
        <input
          aria-label="Cari nama pemohon"
          placeholder="Cari nama pemohon"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value.trim()) guide.complete('cari');
          }}
          className={cn(inputClass, 'min-w-40 flex-1')}
        />
        <select
          aria-label="Divisi"
          value={division}
          onChange={(event) => {
            setDivision(event.target.value);
            if (event.target.value) guide.complete('cari');
          }}
          className={cn(inputClass, 'w-40')}
        >
          <option value="">Semua divisi</option>
          <option>Acara</option>
          <option>Logistik</option>
          <option>Publikasi</option>
        </select>
      </div>

      <ul className="mt-3 space-y-2">
        {rows.map((request) => (
          <li
            key={request.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-400 p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{request.name}</p>
              <p className="text-xs text-neutral-700">
                {request.nim} · Divisi {request.division} · Posisi{' '}
                {request.position}
              </p>
            </div>
            {request.decision ? (
              <Pill tone={request.decision === 'ACCEPTED' ? 'success' : 'danger'}>
                {request.decision}
              </Pill>
            ) : (
              <div className="flex gap-2">
                <Btn
                  small
                  tone="teal"
                  className={guide.spot('terima')}
                  onClick={() => decide(request.id, 'ACCEPTED')}
                >
                  ACCEPT
                </Btn>
                <Btn
                  small
                  tone="dangerOutline"
                  className={guide.spot('tolak')}
                  onClick={() => decide(request.id, 'DECLINED')}
                >
                  DECLINE
                </Btn>
              </div>
            )}
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <Empty>Tidak ada pengajuan yang cocok.</Empty> : null}
      {node}
    </div>
  );
}
