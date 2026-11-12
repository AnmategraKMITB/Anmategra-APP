'use client';

// Library Import
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { DEMO_STUDENTS, type DemoStudent, matchesStudent } from '../data';
import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Empty,
  Field,
  inputClass,
  Modal,
  ScreenTitle,
  tdClass,
  thClass,
} from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'tambah',
    title: 'Klik **Tambah Anggota Baru**, lalu pilih **Tambah Manual**',
  },
  {
    id: 'cari',
    title: 'Cari mahasiswa berdasarkan nama atau NIM, lalu pilih hasilnya',
  },
  {
    id: 'simpan',
    title: 'Isi **Divisi** dan **Posisi**, lalu klik **Simpan Anggota**',
    hint: 'Anda boleh mengetik nilai baru jika pilihan yang ada belum sesuai.',
  },
  { id: 'filter', title: 'Saring daftar dengan filter **Bidang**' },
  {
    id: 'edit',
    title: 'Klik **Edit** pada satu anggota, ubah posisinya, lalu **Simpan Perubahan**',
  },
];

type Member = { student: DemoStudent; division: string; position: string };

const INITIAL: Member[] = [
  { student: DEMO_STUDENTS[3]!, division: 'Acara', position: 'Kepala Divisi' },
  { student: DEMO_STUDENTS[5]!, division: 'Dana Usaha', position: 'Staf' },
  { student: DEMO_STUDENTS[1]!, division: 'Publikasi', position: 'Staf' },
];

type Dialog =
  | { kind: 'pilih' }
  | { kind: 'manual'; student: DemoStudent | null }
  | { kind: 'edit'; studentId: string };

export default function AnggotaDemo() {
  return (
    <DemoFrame
      title="Mengelola anggota"
      location="Lembaga › Anggota"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [members, setMembers] = useState(INITIAL);
  const [filter, setFilter] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [query, setQuery] = useState('');
  const [division, setDivision] = useState('');
  const [position, setPosition] = useState('');

  const divisions = [...new Set(members.map((member) => member.division))];
  const rows = members.filter(
    (member) => filter === '' || member.division === filter,
  );
  const candidates =
    query.trim().length >= 2
      ? DEMO_STUDENTS.filter(
          (student) =>
            matchesStudent(student, query) &&
            !members.some((member) => member.student.id === student.id),
        ).slice(0, 4)
      : [];
  const ready = division.trim() !== '' && position.trim() !== '';

  const divisionPosition = (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Divisi">
        {(id) => (
          <>
            <input
              id={id}
              list={`${id}-list`}
              value={division}
              onChange={(event) => setDivision(event.target.value)}
              className={inputClass}
            />
            <datalist id={`${id}-list`}>
              {divisions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <Field label="Posisi">
        {(id) => (
          <input
            id={id}
            value={position}
            onChange={(event) => setPosition(event.target.value)}
            className={inputClass}
          />
        )}
      </Field>
    </div>
  );

  return (
    <div>
      <ScreenTitle
        title="Anggota"
        actions={
          <>
            <Btn tone="outline">Rapor Komunal</Btn>
            <Btn tone="outline">Pilih Best Staff</Btn>
            <Btn
              className={guide.spot('tambah')}
              onClick={() => setDialog({ kind: 'pilih' })}
            >
              <Plus aria-hidden /> Tambah Anggota Baru
            </Btn>
          </>
        }
      />
      <select
        aria-label="Bidang"
        value={filter}
        onChange={(event) => {
          setFilter(event.target.value);
          if (event.target.value) guide.complete('filter');
        }}
        className={cn(inputClass, 'w-44', guide.spot('filter'))}
      >
        <option value="">Semua bidang</option>
        {divisions.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>

      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-400">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr>
              <th className={thClass}>Nama</th>
              <th className={thClass}>NIM</th>
              <th className={thClass}>Divisi</th>
              <th className={thClass}>Posisi</th>
              <th className={thClass}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((member, index) => (
              <tr key={member.student.id}>
                <td className={cn(tdClass, 'font-semibold')}>
                  {member.student.name}
                </td>
                <td className={tdClass}>{member.student.nim}</td>
                <td className={tdClass}>{member.division}</td>
                <td className={tdClass}>{member.position}</td>
                <td className={tdClass}>
                  <div className="flex gap-1">
                    <Btn
                      small
                      tone="ghost"
                      className={index === 0 ? guide.spot('edit') : ''}
                      onClick={() => {
                        setDivision(member.division);
                        setPosition(member.position);
                        setDialog({ kind: 'edit', studentId: member.student.id });
                      }}
                    >
                      <Pencil aria-hidden /> Edit
                    </Btn>
                    <Btn
                      small
                      tone="ghost"
                      aria-label={`Hapus ${member.student.name}`}
                      onClick={() =>
                        setMembers((prev) =>
                          prev.filter(
                            (item) => item.student.id !== member.student.id,
                          ),
                        )
                      }
                    >
                      <Trash2 aria-hidden />
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="p-3">
            <Empty>Tidak ada anggota pada bidang ini.</Empty>
          </div>
        ) : null}
      </div>

      {dialog?.kind === 'pilih' ? (
        <Modal title="Tambah Anggota Baru" onClose={() => setDialog(null)}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Btn
              tone="outline"
              className={guide.spot('tambah')}
              onClick={() => {
                setQuery('');
                setDivision('');
                setPosition('');
                setDialog({ kind: 'manual', student: null });
                guide.complete('tambah');
              }}
            >
              Tambah Manual
            </Btn>
            <Btn tone="outline" disabled title="Tidak tersedia di simulasi">
              Unggah Excel
            </Btn>
          </div>
        </Modal>
      ) : null}

      {dialog?.kind === 'manual' ? (
        <Modal
          wide
          title="Tambah Manual"
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setDialog(null)}>
                Batal
              </Btn>
              <Btn
                disabled={!dialog.student || !ready}
                className={guide.spot('simpan')}
                onClick={() => {
                  if (!dialog.student) return;
                  setMembers((prev) => [
                    ...prev,
                    {
                      student: dialog.student!,
                      division: division.trim(),
                      position: position.trim(),
                    },
                  ]);
                  setDialog(null);
                  guide.complete('simpan');
                }}
              >
                Simpan Anggota
              </Btn>
            </>
          }
        >
          {dialog.student ? (
            <p className="rounded-lg bg-primary-100 px-3 py-2">
              <strong>{dialog.student.name}</strong> · {dialog.student.nim}
            </p>
          ) : (
            <>
              <Field label="Cari mahasiswa" hint="Ketik minimal 2 huruf nama atau NIM.">
                {(id) => (
                  <input
                    id={id}
                    value={query}
                    placeholder="Mis. Raka atau 135"
                    onChange={(event) => setQuery(event.target.value)}
                    className={cn(inputClass, guide.spot('cari'))}
                  />
                )}
              </Field>
              {candidates.length > 0 ? (
                <ul className="divide-y divide-neutral-300 rounded-lg border border-neutral-400">
                  {candidates.map((student) => (
                    <li key={student.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setDialog({ kind: 'manual', student });
                          guide.complete('cari');
                        }}
                        className="flex w-full justify-between gap-2 px-3 py-2 text-left hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                      >
                        <span className="font-semibold">{student.name}</span>
                        <span className="text-xs text-neutral-700">
                          {student.nim}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
          {dialog.student ? divisionPosition : null}
        </Modal>
      ) : null}

      {dialog?.kind === 'edit' ? (
        <Modal
          wide
          title="Edit anggota"
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setDialog(null)}>
                Batal
              </Btn>
              <Btn
                disabled={!ready}
                className={guide.spot('edit')}
                onClick={() => {
                  setMembers((prev) =>
                    prev.map((member) =>
                      member.student.id === dialog.studentId
                        ? {
                            ...member,
                            division: division.trim(),
                            position: position.trim(),
                          }
                        : member,
                    ),
                  );
                  setDialog(null);
                  guide.complete('edit');
                }}
              >
                Simpan Perubahan
              </Btn>
            </>
          }
        >
          {divisionPosition}
        </Modal>
      ) : null}
    </div>
  );
}
