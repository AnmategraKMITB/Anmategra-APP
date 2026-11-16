'use client';

// Library Import
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Field,
  inputClass,
  Modal,
  ScreenTitle,
  tdClass,
  thClass,
  Toggle,
  useFlash,
} from '../ui';

const STEPS: DemoStep[] = [
  { id: 'profil', title: 'Klik **Tambah Profil Kegiatan**' },
  {
    id: 'simpan-profil',
    title: 'Isi nama profil dan pemetaannya, lalu klik **Simpan Perubahan**',
    hint: 'Profil penilaian menjadi kolom baru pada tabel nilai.',
  },
  { id: 'edit', title: 'Klik **Edit Nilai**' },
  {
    id: 'nilai',
    title: 'Isi nilai 0–100 pada kolom baru, lalu klik **Simpan Nilai**',
    hint: 'Coba isi 120: nilai di luar rentang ditolak.',
  },
  {
    id: 'publik',
    title: 'Nyalakan **Rapor Visible to Public**',
  },
];

const KM_PROFILES = [
  'Kepemimpinan',
  'Kerja sama',
  'Komunikasi',
  'Pemecahan masalah',
];
const PEOPLE = ['Laras Ayuningtyas', 'Citra Maharani', 'Nadia Kusumawardhani'];

type Profile = { name: string; mapped: string };
type Grades = Record<string, Record<string, string>>;

const INITIAL_PROFILES: Profile[] = [
  { name: 'Tanggung jawab', mapped: 'Kepemimpinan' },
];
const INITIAL_GRADES: Grades = {
  'Laras Ayuningtyas': { 'Tanggung jawab': '92' },
  'Citra Maharani': { 'Tanggung jawab': '85' },
  'Nadia Kusumawardhani': { 'Tanggung jawab': '88' },
};

const valid = (value: string) =>
  value === '' || (/^\d+$/.test(value) && Number(value) <= 100);

export default function RaporDemo() {
  return (
    <DemoFrame
      title="Rapor panitia"
      location="Lembaga › Kegiatan › Festival Karya 2026 › Rapor Komunal"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [profiles, setProfiles] = useState(INITIAL_PROFILES);
  const [grades, setGrades] = useState(INITIAL_GRADES);
  const [draft, setDraft] = useState<Grades | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [mapped, setMapped] = useState(KM_PROFILES[1]!);
  const [visible, setVisible] = useState(false);
  const { flash, node } = useFlash();

  const editing = draft !== null;
  const source = draft ?? grades;
  const invalid = editing
    ? Object.values(draft).some((row) =>
        Object.values(row).some((value) => !valid(value)),
      )
    : false;

  return (
    <div>
      <ScreenTitle
        title="Rapor Panitia"
        subtitle="Festival Karya 2026"
        actions={
          <>
            <Btn
              tone="outline"
              className={guide.spot('profil')}
              onClick={() => {
                setOpen(true);
                guide.complete('profil');
              }}
            >
              <Plus aria-hidden /> Tambah Profil Kegiatan
            </Btn>
            {editing ? (
              <Btn
                disabled={invalid}
                className={guide.spot('nilai')}
                onClick={() => {
                  setGrades(draft);
                  setDraft(null);
                  guide.complete('nilai');
                  flash('Nilai tersimpan.');
                }}
              >
                Simpan Nilai
              </Btn>
            ) : (
              <Btn
                className={guide.spot('edit')}
                onClick={() => {
                  setDraft(structuredClone(grades));
                  guide.complete('edit');
                }}
              >
                Edit Nilai
              </Btn>
            )}
          </>
        }
      />
      <Toggle
        label="Rapor Visible to Public"
        checked={visible}
        onChange={(next) => {
          setVisible(next);
          if (next) guide.complete('publik');
        }}
        className={guide.spot('publik')}
      />

      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-400">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr>
              <th className={thClass}>Nama</th>
              {profiles.map((profile) => (
                <th key={profile.name} className={thClass}>
                  {profile.name}
                  <span className="block font-normal text-neutral-700">
                    {profile.mapped}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PEOPLE.map((person) => (
              <tr key={person}>
                <td className={cn(tdClass, 'font-semibold')}>{person}</td>
                {profiles.map((profile) => {
                  const value = source[person]?.[profile.name] ?? '';
                  return (
                    <td key={profile.name} className={tdClass}>
                      {editing ? (
                        <input
                          aria-label={`${profile.name} ${person}`}
                          inputMode="numeric"
                          value={value}
                          aria-invalid={!valid(value)}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              [person]: {
                                ...prev?.[person],
                                [profile.name]: event.target.value,
                              },
                            }))
                          }
                          className={cn(
                            inputClass,
                            'h-8 w-20',
                            !valid(value) && 'border-tomato bg-danger-light',
                          )}
                        />
                      ) : (
                        value || '—'
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {invalid ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-danger-dark">
          Setiap nilai harus berada pada rentang 0–100.
        </p>
      ) : null}

      {open ? (
        <Modal
          title="Tambah Profil Kegiatan"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setOpen(false)}>
                Batal
              </Btn>
              <Btn
                disabled={name.trim() === ''}
                className={guide.spot('simpan-profil')}
                onClick={() => {
                  setProfiles((prev) => [
                    ...prev,
                    { name: name.trim(), mapped },
                  ]);
                  setName('');
                  setOpen(false);
                  guide.complete('simpan-profil');
                }}
              >
                Simpan Perubahan
              </Btn>
            </>
          }
        >
          <Field label="Profil">
            {(id) => (
              <input
                id={id}
                value={name}
                placeholder="Mis. Inisiatif"
                onChange={(event) => setName(event.target.value)}
                className={cn(inputClass, guide.spot('simpan-profil'))}
              />
            )}
          </Field>
          <Field label="Pemetaan dengan Profil KM ITB">
            {(id) => (
              <select
                id={id}
                value={mapped}
                onChange={(event) => setMapped(event.target.value)}
                className={inputClass}
              >
                {KM_PROFILES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            )}
          </Field>
        </Modal>
      ) : null}
      {node}
    </div>
  );
}
