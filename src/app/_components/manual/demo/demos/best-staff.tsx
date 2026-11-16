'use client';

// Library Import
import { Award, Plus } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { Btn, Empty, Field, inputClass, Modal, ScreenTitle } from '../ui';

const STEPS: DemoStep[] = [
  { id: 'tambah', title: 'Klik **Tambah Best Staff**' },
  {
    id: 'periode',
    title: 'Isi tanggal mulai dan tanggal selesai periode',
  },
  {
    id: 'pilih',
    title: 'Pilih Best Staff untuk minimal satu divisi, lalu simpan',
    hint: 'Tidak semua divisi wajib memiliki pilihan.',
  },
];

const STAFF: Record<string, string[]> = {
  Acara: ['Raka Pradipta', 'Laras Ayuningtyas'],
  Publikasi: ['Nadia Kusumawardhani', 'Salsa Rahmadhani'],
  Logistik: ['Bima Arya Setiadi', 'Dimas Wicaksono'],
};

type Period = { start: string; end: string; winners: Record<string, string> };

export default function BestStaffDemo() {
  return (
    <DemoFrame
      title="Memilih Best Staff"
      location="Lembaga › Anggota › Pilih Best Staff"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [winners, setWinners] = useState<Record<string, string>>({});

  const datesOk = start !== '' && end !== '' && end >= start;
  const picked = Object.values(winners).filter(Boolean).length;

  return (
    <div>
      <ScreenTitle
        title="Histori Best Staff"
        actions={
          <Btn
            className={guide.spot('tambah')}
            onClick={() => {
              setOpen(true);
              guide.complete('tambah');
            }}
          >
            <Plus aria-hidden /> Tambah Best Staff
          </Btn>
        }
      />
      {periods.length === 0 ? (
        <Empty>Belum ada periode Best Staff.</Empty>
      ) : (
        <ul className="space-y-3">
          {periods.map((period, index) => (
            <li key={index} className="rounded-lg border border-neutral-400 p-3">
              <p className="text-xs font-semibold text-neutral-700">
                Periode {period.start} s.d. {period.end}
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                {Object.entries(period.winners)
                  .filter(([, person]) => person)
                  .map(([division, person]) => (
                    <li key={division} className="rounded-lg bg-warning-light p-2">
                      <p className="flex items-center gap-1 text-xs font-semibold text-neutral-700">
                        <Award className="size-3.5" aria-hidden /> {division}
                      </p>
                      <p className="font-semibold">{person}</p>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <Modal
          wide
          title="Tambah Best Staff"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setOpen(false)}>
                Batal
              </Btn>
              <Btn
                disabled={!datesOk || picked === 0}
                className={guide.spot('pilih')}
                onClick={() => {
                  setPeriods((prev) => [{ start, end, winners }, ...prev]);
                  setOpen(false);
                  setStart('');
                  setEnd('');
                  setWinners({});
                  guide.complete('periode');
                  guide.complete('pilih');
                }}
              >
                Simpan
              </Btn>
            </>
          }
        >
          <div className={cn('grid gap-3 rounded-lg sm:grid-cols-2', guide.spot('periode'))}>
            <Field label="Tanggal mulai">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label="Tanggal selesai">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={end}
                  onChange={(event) => {
                    setEnd(event.target.value);
                    if (start && event.target.value >= start) {
                      guide.complete('periode');
                    }
                  }}
                  className={inputClass}
                />
              )}
            </Field>
          </div>
          {start && end && end < start ? (
            <p role="alert" className="text-xs font-semibold text-danger-dark">
              Tanggal selesai harus setelah tanggal mulai.
            </p>
          ) : null}
          <div className={cn('space-y-2 rounded-lg', guide.spot('pilih'))}>
            {Object.entries(STAFF).map(([division, people]) => (
              <Field key={division} label={`Divisi ${division}`}>
                {(id) => (
                  <select
                    id={id}
                    value={winners[division] ?? ''}
                    onChange={(event) =>
                      setWinners((prev) => ({
                        ...prev,
                        [division]: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Tidak ada</option>
                    {people.map((person) => (
                      <option key={person}>{person}</option>
                    ))}
                  </select>
                )}
              </Field>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
