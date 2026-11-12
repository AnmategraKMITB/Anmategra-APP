'use client';

// Library Import
import dynamic from 'next/dynamic';
import { type ComponentType } from 'react';

function Loading() {
  return (
    <div className="my-8 rounded-xl border border-neutral-400 bg-neutral-100 px-4 py-10 text-center text-sm text-neutral-700">
      Memuat simulasi…
    </div>
  );
}

const load = (loader: () => Promise<{ default: ComponentType }>) =>
  dynamic(loader, { ssr: false, loading: Loading });

// Nama di sini dipakai di markdown manual sebagai `::demo[nama]`. Tiap
// simulasi dimuat terpisah supaya halaman tanpa demo tidak ikut menanggungnya.
const DEMOS: Record<string, ComponentType> = {
  'oprec-setup': load(() => import('./demos/oprec-setup')),
  'oprec-kriteria': load(() => import('./demos/oprec-kriteria')),
  'oprec-pendaftar': load(() => import('./demos/oprec-pendaftar')),
  'oprec-nilai': load(() => import('./demos/oprec-nilai')),
  'oprec-penempatan': load(() => import('./demos/oprec-penempatan')),
  'oprec-hasil': load(() => import('./demos/oprec-hasil')),
  'oprec-daftar': load(() => import('./demos/oprec-daftar')),
  'forms-builder': load(() => import('./demos/forms-builder')),
  'forms-kondisi': load(() => import('./demos/forms-kondisi')),
  'forms-terbit': load(() => import('./demos/forms-terbit')),
  'forms-respons': load(() => import('./demos/forms-respons')),
  'forms-isi': load(() => import('./demos/forms-isi')),
  'organogram-editor': load(() => import('./demos/organogram-editor')),
  'organogram-pengaturan': load(() => import('./demos/organogram-pengaturan')),
  'masuk': load(() => import('./demos/masuk')),
  'navigasi': load(() => import('./demos/navigasi')),
  'laporan': load(() => import('./demos/laporan')),
  'kegiatan': load(() => import('./demos/kegiatan')),
  'anggota': load(() => import('./demos/anggota')),
  'profil-lembaga': load(() => import('./demos/profil-lembaga')),
  'rapor': load(() => import('./demos/rapor')),
  'best-staff': load(() => import('./demos/best-staff')),
  'inbox-lembaga': load(() => import('./demos/inbox-lembaga')),
  'profil-mahasiswa': load(() => import('./demos/profil-mahasiswa')),
  'kegiatan-mahasiswa': load(() => import('./demos/kegiatan-mahasiswa')),
  'inbox-mahasiswa': load(() => import('./demos/inbox-mahasiswa')),
  'rapor-mahasiswa': load(() => import('./demos/rapor-mahasiswa')),
  'admin-akses': load(() => import('./demos/admin-akses')),
};

export const DEMO_IDS = Object.keys(DEMOS);

export function ManualDemo({ id }: { id: string }) {
  const Demo = DEMOS[id];
  // Nama yang salah ketik tidak boleh merusak halaman; cukup dilewati.
  if (!Demo) return null;
  return <Demo />;
}
