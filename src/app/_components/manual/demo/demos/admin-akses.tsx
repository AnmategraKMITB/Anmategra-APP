'use client';

// Library Import
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { DEMO_STUDENTS, matchesStudent } from '../data';
import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Empty,
  Field,
  inputClass,
  Pill,
  ScreenTitle,
  TabBar,
  tdClass,
  thClass,
} from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'penerima',
    title: 'Cari penerima akses berdasarkan nama, email, atau NIM, lalu pilih',
  },
  {
    id: 'fitur',
    title: 'Pilih kegiatan, lalu centang fitur **OPREC**',
    hint: 'Akses ini spesifik: penerima hanya bisa mengelola fitur itu pada kegiatan itu.',
  },
  { id: 'beri', title: 'Klik **Beri akses**' },
  {
    id: 'audit',
    title: 'Buka tab **Audit** untuk melihat catatannya',
  },
  { id: 'cabut', title: 'Kembali ke **Akses**, lalu cabut akses tadi' },
];

const FEATURES = ['OPREC', 'Formulir', 'Organogram', 'Kegiatan/kepengurusan'];
const EVENTS = ['Festival Karya 2026', 'Malam Keakraban 2026'];
const TABS = [
  ['akses', 'Akses'],
  ['audit', 'Audit'],
] as const;

type Grant = { id: number; person: string; event: string; features: string[] };
type AuditRow = { time: string; action: string; summary: string };

export default function AdminAksesDemo() {
  return (
    <DemoFrame
      title="Memberi akses pengelola"
      location="Admin › Akses"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [tab, setTab] = useState<'akses' | 'audit'>('akses');
  const [query, setQuery] = useState('');
  const [person, setPerson] = useState<string | null>(null);
  const [event, setEvent] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [counter, setCounter] = useState(1);

  const candidates =
    query.trim().length >= 2 && !person
      ? DEMO_STUDENTS.filter((student) => matchesStudent(student, query)).slice(0, 3)
      : [];

  const log = (action: string, summary: string) =>
    setAudit((prev) => [
      { time: `12 Nov 2026 14.0${prev.length}`, action, summary },
      ...prev,
    ]);

  return (
    <div>
      <ScreenTitle
        title={tab === 'akses' ? 'Akses' : 'Audit'}
        subtitle={
          tab === 'akses'
            ? 'Atur operator admin console dan pengelola lembaga/kegiatan secara spesifik.'
            : 'Jejak tindakan backoffice: akun, lembaga, grant, dan izin operator.'
        }
      />
      <TabBar
        label="Menu admin"
        tabs={TABS}
        value={tab}
        onChange={(next) => {
          setTab(next);
          if (next === 'audit' && audit.length > 0) guide.complete('audit');
        }}
        spot={(id) =>
          id === 'audit'
            ? guide.spot('audit')
            : tab === 'audit'
              ? guide.spot('cabut')
              : ''
        }
      />

      {tab === 'akses' ? (
        <div className="mt-3 space-y-4">
          <section className="rounded-lg border border-neutral-400 p-3">
            <p className="text-xs font-semibold text-neutral-700">
              Pengelola lembaga/kegiatan
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <Field label="Penerima">
                  {(id) =>
                    person ? (
                      <p className="flex items-center gap-2 rounded-md bg-primary-100 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate font-semibold">
                          {person}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPerson(null)}
                          className="text-xs font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                        >
                          Ganti
                        </button>
                      </p>
                    ) : (
                      <input
                        id={id}
                        value={query}
                        placeholder="Cari nama, email, atau NIM…"
                        onChange={(e) => setQuery(e.target.value)}
                        className={cn(inputClass, guide.spot('penerima'))}
                      />
                    )
                  }
                </Field>
                {candidates.length > 0 ? (
                  <ul className="mt-1 divide-y divide-neutral-300 rounded-lg border border-neutral-400">
                    {candidates.map((student) => (
                      <li key={student.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPerson(student.name);
                            setQuery('');
                            guide.complete('penerima');
                          }}
                          className="flex w-full justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                        >
                          <span className="font-semibold">{student.name}</span>
                          <span className="text-neutral-700">{student.nim}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <Field label="Kegiatan">
                {(id) => (
                  <select
                    id={id}
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                    className={cn(inputClass, !event && guide.spot('fitur'))}
                  >
                    <option value="">Cari kegiatan/kepengurusan…</option>
                    {EVENTS.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <fieldset className={cn('mt-3 rounded-lg', event && guide.spot('fitur'))}>
              <legend className="text-xs font-semibold text-neutral-800">
                Fitur
              </legend>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {FEATURES.map((feature) => (
                  <label key={feature} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={features.includes(feature)}
                      onChange={(e) => {
                        setFeatures((prev) =>
                          e.target.checked
                            ? [...prev, feature]
                            : prev.filter((item) => item !== feature),
                        );
                        if (e.target.checked && feature === 'OPREC' && event) {
                          guide.complete('fitur');
                        }
                      }}
                      className="size-4 accent-[#2B6282]"
                    />
                    {feature}
                  </label>
                ))}
              </div>
            </fieldset>
            <Btn
              className={cn('mt-3', guide.spot('beri'))}
              disabled={!person || !event || features.length === 0}
              onClick={() => {
                if (!person) return;
                setGrants((prev) => [
                  ...prev,
                  { id: counter, person, event, features },
                ]);
                setCounter((value) => value + 1);
                log('grant.create', `${person} · ${event} · ${features.join(', ')}`);
                setPerson(null);
                setEvent('');
                setFeatures([]);
                guide.complete('fitur');
                guide.complete('beri');
              }}
            >
              Beri akses
            </Btn>
          </section>

          <section>
            <p className="text-xs font-semibold text-neutral-700">Akses aktif</p>
            {grants.length === 0 ? (
              <div className="mt-2">
                <Empty>Belum ada akses aktif.</Empty>
              </div>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-400">
                <table className="w-full min-w-[460px] border-collapse">
                  <thead>
                    <tr>
                      <th className={thClass}>Penerima</th>
                      <th className={thClass}>Lingkup</th>
                      <th className={thClass}>Fitur</th>
                      <th className={thClass}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map((grant) => (
                      <tr key={grant.id}>
                        <td className={cn(tdClass, 'font-semibold')}>
                          {grant.person}
                        </td>
                        <td className={tdClass}>Kegiatan · {grant.event}</td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-1">
                            {grant.features.map((feature) => (
                              <Pill key={feature} tone="info">
                                {feature}
                              </Pill>
                            ))}
                          </div>
                        </td>
                        <td className={tdClass}>
                          <Btn
                            small
                            tone="dangerOutline"
                            className={guide.spot('cabut')}
                            onClick={() => {
                              setGrants((prev) =>
                                prev.filter((item) => item.id !== grant.id),
                              );
                              log('grant.revoke', `${grant.person} · ${grant.event}`);
                              guide.complete('cabut');
                            }}
                          >
                            Cabut
                          </Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="mt-3">
          {audit.length === 0 ? (
            <Empty>Belum ada audit.</Empty>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-400">
              <table className="w-full min-w-[460px] border-collapse">
                <thead>
                  <tr>
                    <th className={thClass}>Waktu</th>
                    <th className={thClass}>Aktor</th>
                    <th className={thClass}>Aksi</th>
                    <th className={thClass}>Ringkasan</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((row, index) => (
                    <tr key={index}>
                      <td className={cn(tdClass, 'whitespace-nowrap text-xs')}>
                        {row.time}
                      </td>
                      <td className={tdClass}>Admin</td>
                      <td className={tdClass}>
                        <code className="text-xs">{row.action}</code>
                      </td>
                      <td className={tdClass}>{row.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
