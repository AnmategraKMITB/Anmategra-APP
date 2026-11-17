'use client';

// PROTOTYPE (tiket #487), BUANG SESUDAH KEPUTUSAN. Data tiruan, tanpa DB.
// Pertanyaan: bagaimana tabel pengumuman nyaman dibaca pada 375 px?
// Tiga varian pada rute yang sama, dipilih lewat ?variant=A|B|C (atau tombol ← →).

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

type Row = { nama: string; nim: string; prodi: string; angkatan: number };
type Divisi = { id: string; nama: string; rows: Row[] };
type Bidang = { id: string; nama: string; divisi: Divisi[] };

const P = ['Teknik Informatika', 'Sistem dan Teknologi Informasi', 'Teknik Elektro', 'Matematika', 'Teknik Telekomunikasi'];
const N = ['Aulia Rahmawati Putri', 'Bagas Prasetyo', 'Citra Dewi Lestari', 'Dimas Aditya Nugroho', 'Eka Wulandari', 'Farhan Maulana Akbar', 'Gita Permatasari', 'Hafidz Al Ghifari', 'Intan Nurhaliza', 'Jonathan Christian Sutanto', 'Kirana Ayu Anggraeni', 'Laksmana Bintang Pradana'];
const mk = (seed: number, n: number): Row[] =>
  Array.from({ length: n }, (_, i) => {
    const k = seed + i;
    return { nama: N[k % N.length]!, nim: String(13224000 + ((k * 37) % 900)), prodi: P[k % P.length]!, angkatan: 2022 + (k % 3) };
  });

const DATA: Bidang[] = [
  { id: 'kaderisasi', nama: 'Bidang Kaderisasi', divisi: [
    { id: 'kemahasiswaan', nama: 'Divisi Kemahasiswaan', rows: mk(0, 9) },
    { id: 'pengembangan', nama: 'Divisi Pengembangan Diri', rows: mk(3, 7) },
  ] },
  { id: 'teknologi', nama: 'Bidang Teknologi', divisi: [
    { id: 'frontend', nama: 'Divisi Frontend', rows: mk(5, 8) },
    { id: 'backend', nama: 'Divisi Backend', rows: mk(8, 6) },
  ] },
];

const match = (r: Row, q: string) => !q || r.nama.toLowerCase().includes(q.toLowerCase()) || r.nim.includes(q);
const filtered = (q: string) =>
  DATA.map((b) => ({ ...b, divisi: b.divisi.map((d) => ({ ...d, rows: d.rows.filter((r) => match(r, q)) })) }));

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const allDivisi = DATA.flatMap((b) => b.divisi);

function Search({ q, setQ, className = '' }: { q: string; setQ: (v: string) => void; className?: string }) {
  return (
    <input
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="Cari nama atau NIM"
      className={`w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm ${className}`}
    />
  );
}

// ---------- A: tabel gulir mendatar, kolom Nama tetap; chip divisi gulir; cari menempel di atas
function VariantA() {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState(DATA[0]!.id);
  const all = filtered(q);
  const data = all.filter((b) => b.id === tab);
  const cur = data[0];
  return (
    <div>
      <div className="sticky top-0 z-20 space-y-2 border-b bg-white p-3">
        <Search q={q} setQ={setQ} />
        <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
          {all.map((b) => (
            <button key={b.id} onClick={() => setTab(b.id)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${b.id === tab ? 'bg-white shadow' : 'text-neutral-600'}`}>
              {b.nama.replace('Bidang ', '')} ({b.divisi.reduce((n, d) => n + d.rows.length, 0)})
            </button>
          ))}
        </div>
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
          {cur?.divisi.map((d) => (
            <button key={d.id} onClick={() => jump('a-' + d.id)} className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs">
              {d.nama.replace('Divisi ', '')}
            </button>
          ))}
        </div>
      </div>
      {data.map((b) => (
        <section key={b.id} className="mt-4">
          <h2 className="px-3 text-lg font-semibold">{b.nama}</h2>
          {b.divisi.map((d) => (
            <div key={d.id} id={'a-' + d.id} className="mt-3 scroll-mt-28">
              <h3 className="px-3 text-sm font-medium text-neutral-600">{d.nama} ({d.rows.length})</h3>
              <div className="mt-1 overflow-x-auto border-y">
                <table className="min-w-[560px] w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="bg-neutral-100 text-left text-xs">
                      <th className="sticky left-0 z-10 w-36 bg-neutral-100 px-3 py-2 shadow-[2px_0_0_0_#e5e5e5]">Nama</th>
                      <th className="px-3 py-2">NIM</th><th className="px-3 py-2">Prodi</th><th className="px-3 py-2">Angkatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="sticky left-0 w-36 border-t bg-white px-3 py-2 font-medium shadow-[2px_0_0_0_#e5e5e5]">{r.nama}</td>
                        <td className="whitespace-nowrap border-t px-3 py-2">{r.nim}</td>
                        <td className="whitespace-nowrap border-t px-3 py-2">{r.prodi}</td>
                        <td className="border-t px-3 py-2">{r.angkatan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

// ---------- B: kartu per baris; pencarian di bawah (jangkauan ibu jari); loncat divisi lewat <select>
function VariantB() {
  const [q, setQ] = useState('');
  const data = filtered(q);
  return (
    <div className="pb-24">
      <div className="p-3">
        <select onChange={(e) => e.target.value && jump('b-' + e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 text-sm" defaultValue="">
          <option value="">Loncat ke divisi…</option>
          {allDivisi.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
        </select>
      </div>
      {data.map((b) => (
        <section key={b.id}>
          <h2 className="bg-primary-600 px-3 py-2 text-lg font-semibold text-white">{b.nama}</h2>
          {b.divisi.map((d) => (
            <div key={d.id} id={'b-' + d.id} className="px-3 py-3">
              <h3 className="mb-2 text-sm font-semibold">{d.nama} <span className="font-normal text-neutral-500">· {d.rows.length}</span></h3>
              <ul className="space-y-2">
                {d.rows.map((r, i) => (
                  <li key={i} className="rounded-xl border bg-white p-3">
                    <p className="font-medium">{r.nama}</p>
                    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-xs text-neutral-600">
                      <dt>NIM</dt><dd>{r.nim}</dd>
                      <dt>Prodi</dt><dd>{r.prodi}</dd>
                      <dt>Angkatan</dt><dd>{r.angkatan}</dd>
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
      <div className="fixed inset-x-0 bottom-14 z-20 border-t bg-white p-3"><Search q={q} setQ={setQ} /></div>
    </div>
  );
}

// ---------- C: daftar ringkas (nama + NIM), ketuk untuk memperluas; divisi dapat dilipat; daftar isi = ringkasan jumlah
function VariantC() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const data = filtered(q);
  return (
    <div>
      <div className="p-3"><Search q={q} setQ={setQ} /></div>
      <div className="mx-3 mb-3 rounded-xl border bg-neutral-50 p-2 text-xs">
        {data.flatMap((b) => b.divisi).map((d) => (
          <button key={d.id} onClick={() => { setShut((s) => ({ ...s, [d.id]: false })); setTimeout(() => jump('c-' + d.id), 50); }} className="flex w-full justify-between px-2 py-1.5">
            <span>{d.nama}</span><span className="text-neutral-500">{d.rows.length}</span>
          </button>
        ))}
      </div>
      {data.map((b) => (
        <section key={b.id} className="px-3">
          <h2 className="mt-3 text-lg font-semibold">{b.nama}</h2>
          {b.divisi.map((d) => (
            <div key={d.id} id={'c-' + d.id} className="mt-2 rounded-xl border">
              <button onClick={() => setShut((s) => ({ ...s, [d.id]: !s[d.id] }))} className="flex w-full items-center justify-between bg-neutral-100 px-3 py-2 text-left text-sm font-medium">
                {d.nama} ({d.rows.length}) <span>{shut[d.id] ? '▸' : '▾'}</span>
              </button>
              {!shut[d.id] && (
                <ul className="divide-y">
                  {d.rows.map((r, i) => {
                    const k = d.id + i;
                    return (
                      <li key={k}>
                        <button onClick={() => setOpen((o) => ({ ...o, [k]: !o[k] }))} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm">
                          <span className="font-medium">{r.nama}</span><span className="text-xs text-neutral-500">{r.nim}</span>
                        </button>
                        {open[k] && <p className="bg-neutral-50 px-3 pb-2 text-xs text-neutral-600">{r.prodi} · angkatan {r.angkatan}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

// ---------- penukar varian
const VARIANTS = [
  { k: 'A', n: 'Tabel gulir, Nama tetap', C: VariantA },
  { k: 'B', n: 'Kartu per baris', C: VariantB },
  { k: 'C', n: 'Daftar ringkas, dapat diperluas', C: VariantC },
];

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const idx = Math.max(0, VARIANTS.findIndex((v) => v.k === sp.get('variant')));
  const go = useMemo(() => (d: number) => router.replace(`?variant=${VARIANTS[(idx + d + VARIANTS.length) % VARIANTS.length]!.k}`), [idx, router]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea,select,[contenteditable]')) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [go]);
  const V = VARIANTS[idx]!;
  return (
    <main className="mx-auto min-h-screen max-w-[480px] bg-white text-neutral-900">
      <header className="border-b p-3">
        <h1 className="text-xl font-semibold">Pengumuman Oprec (prototipe)</h1>
        <p className="text-xs text-neutral-500">Data tiruan. Kolom: Nama, NIM, Prodi, Angkatan.</p>
      </header>
      <V.C key={V.k} />
      <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-sm text-white shadow-lg">
        <button onClick={() => go(-1)}>←</button>
        <span>{V.k} ({V.n})</span>
        <button onClick={() => go(1)}>→</button>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}
