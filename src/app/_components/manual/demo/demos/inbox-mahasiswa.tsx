'use client';

// Library Import
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Field,
  inputClass,
  Modal,
  Pill,
  type PillTone,
  ScreenTitle,
  tdClass,
  thClass,
} from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'edit',
    title: 'Pada pengajuan berstatus **REQUESTED**, klik **Edit**',
    hint: 'Hanya pengajuan yang masih menunggu keputusan yang bisa diubah.',
  },
  { id: 'simpan', title: 'Ubah **Divisi** atau **Posisi**, lalu klik **Simpan**' },
  { id: 'hapus', title: 'Klik **Delete** untuk menarik pengajuan itu' },
];

type Status = 'REQUESTED' | 'ACCEPTED' | 'DECLINED';
type Request = {
  id: number;
  target: string;
  division: string;
  position: string;
  status: Status;
};

const TONE: Record<Status, PillTone> = {
  REQUESTED: 'warning',
  ACCEPTED: 'success',
  DECLINED: 'danger',
};

const INITIAL: Request[] = [
  { id: 1, target: 'Festival Karya 2026', division: 'Acara', position: 'Staf', status: 'REQUESTED' },
  { id: 2, target: 'Malam Keakraban 2026', division: 'Logistik', position: 'Staf', status: 'ACCEPTED' },
  { id: 3, target: 'UKM Rupa', division: 'Pameran', position: 'Anggota', status: 'DECLINED' },
];

export default function InboxMahasiswaDemo() {
  return (
    <DemoFrame
      title="Memantau pengajuan asosiasi"
      location="Mahasiswa › Inbox"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [requests, setRequests] = useState(INITIAL);
  const [editing, setEditing] = useState<Request | null>(null);

  return (
    <div>
      <ScreenTitle title="Inbox" subtitle="Pengajuan asosiasi yang Anda kirim." />
      <div className="overflow-x-auto rounded-lg border border-neutral-400">
        <table className="w-full min-w-[500px] border-collapse">
          <thead>
            <tr>
              <th className={thClass}>Kegiatan atau lembaga</th>
              <th className={thClass}>Divisi</th>
              <th className={thClass}>Posisi</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td className={cn(tdClass, 'font-semibold')}>{request.target}</td>
                <td className={tdClass}>{request.division}</td>
                <td className={tdClass}>{request.position}</td>
                <td className={tdClass}>
                  <Pill tone={TONE[request.status]}>{request.status}</Pill>
                </td>
                <td className={tdClass}>
                  {request.status === 'REQUESTED' ? (
                    <div className="flex gap-1">
                      <Btn
                        small
                        tone="ghost"
                        className={guide.spot('edit')}
                        onClick={() => {
                          setEditing(request);
                          guide.complete('edit');
                        }}
                      >
                        <Pencil aria-hidden /> Edit
                      </Btn>
                      <Btn
                        small
                        tone="ghost"
                        className={guide.spot('hapus')}
                        onClick={() => {
                          setRequests((prev) =>
                            prev.filter((item) => item.id !== request.id),
                          );
                          guide.complete('hapus');
                        }}
                      >
                        <Trash2 aria-hidden /> Delete
                      </Btn>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-700">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <Modal
          title="Edit pengajuan"
          description={editing.target}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setEditing(null)}>
                Batal
              </Btn>
              <Btn
                className={guide.spot('simpan')}
                onClick={() => {
                  setRequests((prev) =>
                    prev.map((item) =>
                      item.id === editing.id ? editing : item,
                    ),
                  );
                  setEditing(null);
                  guide.complete('simpan');
                }}
              >
                Simpan
              </Btn>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Divisi">
              {(id) => (
                <input
                  id={id}
                  value={editing.division}
                  onChange={(event) =>
                    setEditing({ ...editing, division: event.target.value })
                  }
                  className={inputClass}
                />
              )}
            </Field>
            <Field label="Posisi">
              {(id) => (
                <input
                  id={id}
                  value={editing.position}
                  onChange={(event) =>
                    setEditing({ ...editing, position: event.target.value })
                  }
                  className={inputClass}
                />
              )}
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
