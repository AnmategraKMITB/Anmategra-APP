// Data contoh bersama untuk simulasi manual. Semua nama dan NIM fiktif.

export const DEMO_LEMBAGA = 'Himpunan Mahasiswa Contoh';
export const DEMO_EVENT = 'Festival Karya 2026';

export type DemoDivision = { id: string; name: string; quota: number };

/** Divisi kepanitiaan contoh beserta kuota stafnya. */
export const DEMO_DIVISIONS: DemoDivision[] = [
  { id: 'acara', name: 'Acara', quota: 2 },
  { id: 'publikasi', name: 'Publikasi', quota: 2 },
  { id: 'logistik', name: 'Logistik', quota: 2 },
  { id: 'danus', name: 'Dana Usaha', quota: 1 },
];

export type DemoStudent = {
  id: string;
  name: string;
  nim: string;
  prodi: string;
  angkatan: number;
};

export const DEMO_STUDENTS: DemoStudent[] = [
  { id: 's1', name: 'Raka Pradipta', nim: '13524011', prodi: 'Teknik Informatika', angkatan: 2024 },
  { id: 's2', name: 'Nadia Kusumawardhani', nim: '18224032', prodi: 'Sistem dan Teknologi Informasi', angkatan: 2024 },
  { id: 's3', name: 'Bima Arya Setiadi', nim: '13224057', prodi: 'Teknik Elektro', angkatan: 2024 },
  { id: 's4', name: 'Laras Ayuningtyas', nim: '15523018', prodi: 'Teknik Sipil', angkatan: 2023 },
  { id: 's5', name: 'Fajar Nugraha', nim: '10523044', prodi: 'Kimia', angkatan: 2023 },
  { id: 's6', name: 'Citra Maharani', nim: '19623009', prodi: 'Manajemen', angkatan: 2023 },
  { id: 's7', name: 'Dimas Wicaksono', nim: '13124073', prodi: 'Teknik Mesin', angkatan: 2024 },
  { id: 's8', name: 'Salsa Rahmadhani', nim: '17424021', prodi: 'Desain Komunikasi Visual', angkatan: 2024 },
];

export function divisionName(id: string): string {
  return DEMO_DIVISIONS.find((division) => division.id === id)?.name ?? id;
}

export function matchesStudent(student: DemoStudent, query: string): boolean {
  const q = query.trim().toLowerCase();
  return (
    q === '' ||
    student.name.toLowerCase().includes(q) ||
    student.nim.includes(q)
  );
}
