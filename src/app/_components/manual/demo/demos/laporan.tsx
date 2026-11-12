'use client';

// Library Import
import { Plus } from 'lucide-react';
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
} from '../ui';

const STEPS: DemoStep[] = [
  { id: 'buat', title: 'Klik **Buat laporan**' },
  {
    id: 'isi',
    title: 'Isi **Judul Laporan**, **Deskripsi**, dan pilih **Prioritas Urgensi**',
    hint: 'Tulis langkah untuk mengulang masalahnya dan di halaman mana itu terjadi.',
  },
  { id: 'draft', title: 'Klik **Buat draft laporan**' },
  {
    id: 'kirim',
    title: 'Pada kartu berstatus **Draft**, klik **Kirim**',
    hint: 'Selama masih draft, laporan belum sampai ke admin.',
  },
];

type Status = 'Draft' | 'Reported' | 'In Progress' | 'Resolved';
type Report = {
  id: number;
  title: string;
  description: string;
  urgency: 'Low' | 'Medium' | 'High';
  status: Status;
};

const TONE: Record<Status, PillTone> = {
  Draft: 'neutral',
  Reported: 'info',
  'In Progress': 'warning',
  Resolved: 'success',
};

const INITIAL: Report[] = [
  {
    id: 1,
    title: 'Foto profil tidak tersimpan',
    description: 'Setelah klik Simpan, foto kembali ke foto lama.',
    urgency: 'Low',
    status: 'Resolved',
  },
];

export default function LaporanDemo() {
  return (
    <DemoFrame
      title="Melaporkan masalah ke admin"
      location="Sidebar › Laporan"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [reports, setReports] = useState(INITIAL);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<Report['urgency']>('Medium');

  const ready = title.trim() !== '' && description.trim() !== '';

  return (
    <div>
      <ScreenTitle
        title="Laporan"
        subtitle="Masalah teknis yang Anda sampaikan kepada admin."
        actions={
          <Btn
            className={guide.spot('buat')}
            onClick={() => {
              setOpen(true);
              guide.complete('buat');
            }}
          >
            <Plus aria-hidden /> Buat laporan
          </Btn>
        }
      />
      {reports.length === 0 ? <Empty>Belum ada laporan.</Empty> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {reports.map((report) => (
          <li key={report.id} className="rounded-lg border border-neutral-400 p-3">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 font-semibold">{report.title}</p>
              <Pill tone={TONE[report.status]}>{report.status}</Pill>
            </div>
            <p className="mt-1 text-xs text-neutral-700">{report.description}</p>
            <p className="mt-2 text-xs">Urgensi: {report.urgency}</p>
            {report.status === 'Draft' ? (
              <div className="mt-2 flex gap-2">
                <Btn
                  small
                  className={guide.spot('kirim')}
                  onClick={() => {
                    setReports((prev) =>
                      prev.map((item) =>
                        item.id === report.id
                          ? { ...item, status: 'Reported' }
                          : item,
                      ),
                    );
                    guide.complete('kirim');
                  }}
                >
                  Kirim
                </Btn>
                <Btn
                  small
                  tone="dangerOutline"
                  onClick={() =>
                    setReports((prev) =>
                      prev.filter((item) => item.id !== report.id),
                    )
                  }
                >
                  Delete
                </Btn>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {open ? (
        <Modal
          title="Buat laporan"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setOpen(false)}>
                Batal
              </Btn>
              <Btn
                disabled={!ready}
                className={guide.spot('draft')}
                onClick={() => {
                  setReports((prev) => [
                    {
                      id: Date.now(),
                      title: title.trim(),
                      description: description.trim(),
                      urgency,
                      status: 'Draft',
                    },
                    ...prev,
                  ]);
                  setOpen(false);
                  setTitle('');
                  setDescription('');
                  guide.complete('isi');
                  guide.complete('draft');
                }}
              >
                Buat draft laporan
              </Btn>
            </>
          }
        >
          <div className={cn('space-y-3 rounded-lg', guide.spot('isi'))}>
            <Field label="Judul Laporan">
              {(id) => (
                <input
                  id={id}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label="Deskripsi">
              {(id) => (
                <textarea
                  id={id}
                  rows={3}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    if (title.trim() && event.target.value.trim()) {
                      guide.complete('isi');
                    }
                  }}
                  className={cn(inputClass, 'h-auto py-2')}
                />
              )}
            </Field>
            <Field label="Prioritas Urgensi">
              {(id) => (
                <select
                  id={id}
                  value={urgency}
                  onChange={(event) =>
                    setUrgency(event.target.value as Report['urgency'])
                  }
                  className={inputClass}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              )}
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
