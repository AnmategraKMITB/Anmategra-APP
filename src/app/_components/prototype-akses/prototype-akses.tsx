'use client';

// PROTOTYPE (throwaway) — wayfinder tiket #318. Hapus setelah varian dipilih.
// Pertanyaan: bentuk panel "Akses & Admin" untuk Owner (lembaga & kegiatan).
// Tiga varian struktural, dipilih lewat ?variant=A|B|C. Data stub, tanpa tRPC.
import { ChevronLeft, ChevronRight, Lock, Trash2, UserPlus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const FEATURES = ['admin', 'oprec', 'forms', 'events', 'organization'] as const;
type Feature = (typeof FEATURES)[number];
type Row = {
  userId: string;
  name: string;
  nim: number;
  email: string;
  features: Feature[];
  scope: 'lembaga' | 'warisan' | 'kegiatan';
  from?: string; // nama induk / kegiatan
  propagate?: boolean;
};

const SEED: Row[] = [
  { userId: '1', name: 'Budi Santoso', nim: 13522001, email: 'budi@std.stei.itb.ac.id', features: ['admin'], scope: 'lembaga', propagate: true },
  { userId: '2', name: 'Citra Lestari', nim: 13522045, email: 'citra@std.stei.itb.ac.id', features: ['oprec', 'forms'], scope: 'lembaga', propagate: false },
  { userId: '3', name: 'Dewi Anggraini', nim: 13521100, email: 'dewi@std.stei.itb.ac.id', features: ['admin'], scope: 'warisan', from: 'KM-ITB' },
  { userId: '4', name: 'Eko Prasetyo', nim: 13523077, email: 'eko@std.stei.itb.ac.id', features: ['events'], scope: 'kegiatan', from: 'OSKM 2026' },
];

const LABEL: Record<Feature, string> = {
  admin: 'Semua kemampuan',
  oprec: 'Oprec',
  forms: 'Formulir',
  events: 'Kegiatan',
  organization: 'Organisasi',
};

function useStub() {
  const [rows, setRows] = useState<Row[]>(SEED);
  const [err, setErr] = useState<string | null>(null);
  const add = (id: string, features: Feature[], propagate: boolean, scope: Row['scope']) => {
    const q = id.trim();
    if (!q) return setErr('Isi NIM atau email persis.');
    if (rows.some((r) => r.email === q || String(r.nim) === q))
      return setErr('Akun ini sudah punya akses.');
    if (q !== 'tes@std.stei.itb.ac.id' && q !== '13522999')
      return setErr('Akun tidak ditemukan. (Coba 13522999)');
    setErr(null);
    setRows((r) => [
      ...r,
      { userId: String(Date.now()), name: 'Fajar Nugroho', nim: 13522999, email: 'tes@std.stei.itb.ac.id', features: features.length ? features : ['admin'], scope, propagate },
    ]);
  };
  const revoke = (userId: string) => setRows((r) => r.filter((x) => x.userId !== userId));
  return { rows, err, add, revoke };
}

const chip = (on: boolean) =>
  `rounded-full border px-2.5 py-0.5 text-xs ${on ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 text-slate-600'}`;

function FeatureChips({ value, onChange }: { value: Feature[]; onChange: (v: Feature[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FEATURES.map((f) => (
        <button key={f} type="button" className={chip(value.includes(f))}
          onClick={() => onChange(value.includes(f) ? value.filter((x) => x !== f) : [...value, f])}>
          {LABEL[f]}
        </button>
      ))}
    </div>
  );
}

function AddForm({ s, scope, compact }: { s: ReturnType<typeof useStub>; scope: Row['scope']; compact?: boolean }) {
  const [id, setId] = useState('');
  const [f, setF] = useState<Feature[]>(['admin']);
  const [p, setP] = useState(false);
  return (
    <div className={`flex ${compact ? 'flex-row flex-wrap items-center' : 'flex-col'} gap-3`}>
      <input className="rounded border px-3 py-2 text-sm" placeholder="NIM atau email persis" value={id} onChange={(e) => setId(e.target.value)} />
      <FeatureChips value={f} onChange={setF} />
      {scope === 'lembaga' && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={p} onChange={(e) => setP(e.target.checked)} />
          Berlaku juga di sub-lembaga
        </label>
      )}
      <button type="button" className="inline-flex items-center gap-1 rounded bg-slate-800 px-3 py-2 text-sm text-white"
        onClick={() => { s.add(id, f, p, scope); setId(''); }}>
        <UserPlus size={14} /> Tambah
      </button>
      {s.err && <p className="text-xs text-red-600">{s.err}</p>}
    </div>
  );
}

const who = (r: Row) => (
  <div>
    <div className="font-medium text-slate-800">{r.name}</div>
    <div className="text-xs text-slate-500">{r.nim} · {r.email}</div>
  </div>
);

// ───────── A: tab + tabel + dialog cabut ─────────
function VariantA() {
  const s = useStub();
  const [tab, setTab] = useState<'lembaga' | 'kegiatan'>('lembaga');
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Row | null>(null);
  const rows = s.rows.filter((r) => (tab === 'lembaga' ? r.scope !== 'kegiatan' : r.scope === 'kegiatan'));
  return (
    <section className="w-full rounded-lg border bg-white">
      <div className="flex border-b">
        {(['lembaga', 'kegiatan'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm ${tab === t ? 'border-b-2 border-slate-800 font-semibold' : 'text-slate-500'}`}>
            {t === 'lembaga' ? 'Admin Lembaga' : 'Admin Kepanitiaan'}
          </button>
        ))}
        <button className="ml-auto m-2 rounded bg-slate-800 px-3 text-sm text-white" onClick={() => setOpen(!open)}>+ Tambah admin</button>
      </div>
      {open && <div className="border-b bg-slate-50 p-4"><AddForm s={s} scope={tab} compact /></div>}
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500"><tr><th className="p-3">Penerima</th><th>Fitur</th><th>Asal</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className="border-t">
              <td className="p-3">{who(r)}</td>
              <td>{r.features.map((f) => LABEL[f]).join(', ')}</td>
              <td className="text-xs text-slate-500">
                {r.scope === 'warisan' ? <span className="inline-flex items-center gap-1"><Lock size={12} />Diwarisi dari {r.from}</span> : r.scope === 'kegiatan' ? r.from : r.propagate ? 'Termasuk sub-lembaga' : 'Lembaga ini'}
              </td>
              <td className="pr-3 text-right">
                {r.scope !== 'warisan' && <button onClick={() => setTarget(r)} className="text-red-600"><Trash2 size={16} /></button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {target && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-lg bg-white p-5">
            <h3 className="font-semibold">Cabut akses {target.name}?</h3>
            <p className="mt-2 text-sm text-slate-600">{target.name} langsung kehilangan akses {target.features.map((f) => LABEL[f]).join(', ')}.{target.propagate && ' Akses di semua sub-lembaga ikut hilang.'}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setTarget(null)} className="rounded border px-3 py-1.5 text-sm">Batal</button>
              <button onClick={() => { s.revoke(target.userId); setTarget(null); }} className="rounded bg-red-600 px-3 py-1.5 text-sm text-white">Cabut</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ───────── B: satu kolom, form inline di atas, baris kartu, cabut inline 2 langkah ─────────
function VariantB() {
  const s = useStub();
  const [armed, setArmed] = useState<string | null>(null);
  return (
    <section className="w-full space-y-4">
      <div className="rounded-lg border bg-slate-50 p-4">
        <h3 className="mb-3 text-sm font-semibold">Beri akses ke akun terdaftar</h3>
        <AddForm s={s} scope="lembaga" compact />
        <p className="mt-2 text-xs text-slate-500">Untuk Admin Kepanitiaan, buka halaman kegiatan terkait; panel yang sama muncul di sana.</p>
      </div>
      <ul className="space-y-2">
        {s.rows.map((r) => (
          <li key={r.userId} className="flex items-center justify-between rounded-lg border bg-white p-3">
            {who(r)}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">{r.scope === 'warisan' ? `🔒 dari ${r.from}` : r.scope === 'kegiatan' ? `Kegiatan: ${r.from}` : r.propagate ? 'Lembaga + sub' : 'Lembaga'}</span>
              {r.features.map((f) => <span key={f} className={chip(true)}>{LABEL[f]}</span>)}
              {r.scope !== 'warisan' && (armed === r.userId ? (
                <span className="flex gap-1 text-xs">
                  <button className="rounded bg-red-600 px-2 py-1 text-white" onClick={() => { s.revoke(r.userId); setArmed(null); }}>Yakin cabut</button>
                  <button className="px-2" onClick={() => setArmed(null)}>Batal</button>
                </span>
              ) : <button className="text-xs text-red-600" onClick={() => setArmed(r.userId)}>Cabut</button>)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ───────── C: dua kolom, daftar terkelompok + form sticky di kanan ─────────
function VariantC() {
  const s = useStub();
  const [scope, setScope] = useState<Row['scope']>('lembaga');
  const groups: [string, Row[]][] = [
    ['Admin Lembaga', s.rows.filter((r) => r.scope === 'lembaga')],
    ['Diwarisi dari induk (hanya baca)', s.rows.filter((r) => r.scope === 'warisan')],
    ['Admin Kepanitiaan', s.rows.filter((r) => r.scope === 'kegiatan')],
  ];
  return (
    <section className="grid w-full gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        {groups.map(([title, rs]) => (
          <div key={title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title} ({rs.length})</h3>
            <div className="divide-y rounded-lg border bg-white">
              {rs.length === 0 && <p className="p-3 text-sm text-slate-400">Belum ada.</p>}
              {rs.map((r) => (
                <div key={r.userId} className="flex items-center justify-between p-3">
                  {who(r)}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {r.features.map((f) => LABEL[f]).join(' · ')}
                    {r.scope !== 'warisan' && (
                      <button className="text-red-600" onClick={() => confirm(`Cabut akses ${r.name}?`) && s.revoke(r.userId)}>Cabut</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <aside className="h-fit rounded-lg border bg-slate-50 p-4 md:sticky md:top-4">
        <h3 className="mb-3 font-semibold">Tambah admin</h3>
        <select className="mb-3 w-full rounded border p-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value as Row['scope'])}>
          <option value="lembaga">Admin Lembaga (khusus Owner)</option>
          <option value="kegiatan">Admin Kepanitiaan</option>
        </select>
        <AddForm s={s} scope={scope} />
      </aside>
    </section>
  );
}

function Switcher({ keys, current }: { keys: string[]; current: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const go = (d: number) => {
    const next = keys[(keys.indexOf(current) + d + keys.length) % keys.length]!;
    const q = new URLSearchParams(sp.toString());
    q.set('variant', next);
    router.replace(`${path}?${q.toString()}`);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea,select,[contenteditable]')) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  const names: Record<string, string> = { A: 'Tab + tabel + dialog', B: 'Satu kolom + inline', C: 'Dua kolom terkelompok' };
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-sm text-white shadow-lg">
      <button onClick={() => go(-1)}><ChevronLeft size={18} /></button>
      <span>{current} ({names[current]})</span>
      <button onClick={() => go(1)}><ChevronRight size={18} /></button>
    </div>
  );
}

export default function PrototypeAkses() {
  const sp = useSearchParams();
  if (process.env.NODE_ENV === 'production') return null;
  const v = sp.get('variant') ?? 'A';
  return (
    <div className="w-full max-w-7xl py-6">
      <h2 className="mb-3 text-lg font-semibold text-slate-700">Akses &amp; Admin <span className="text-xs font-normal text-amber-600">PROTOTYPE</span></h2>
      {v === 'A' && <VariantA />}
      {v === 'B' && <VariantB />}
      {v === 'C' && <VariantC />}
      <Switcher keys={['A', 'B', 'C']} current={v} />
    </div>
  );
}
