import Link from 'next/link';

const PILLARS = [
  {
    title: 'Profil lembaga dan kegiatan',
    body: 'Setiap himpunan, unit kegiatan mahasiswa, dan kepanitiaan KM ITB punya halaman profil publik yang memuat struktur, anggota, dan rekam jejaknya.',
  },
  {
    title: 'Pendaftaran dan formulir',
    body: 'Lembaga membuka pendaftaran anggota, kepanitiaan, dan open recruitment lewat formulir yang dapat diisi mahasiswa tanpa membuat akun baru.',
  },
  {
    title: 'Struktur organisasi dan penilaian',
    body: 'Pengurus menyusun bagan organisasi, menugaskan penilai, dan mencatat hasil seleksi dalam satu tempat.',
  },
];

export function TentangSection() {
  return (
    <section className="container mx-auto mt-8 px-4 sm:px-12">
      <div className="flex flex-col gap-4">
        <span className="text-xl font-semibold text-[#0B5C8A]">
          Tentang Anmategra
        </span>
        <div className="flex max-w-3xl flex-col gap-3 leading-relaxed text-slate-700">
          <p>
            Anmategra adalah platform pendataan kemahasiswaan untuk Keluarga
            Mahasiswa Institut Teknologi Bandung. Aplikasi ini dikelola
            Kementerian Anmategra di bawah Kemenkoan Pengembangan Sumber Daya
            Manusia (PSDM) Kabinet KM ITB, dan dipakai bersama oleh himpunan,
            unit kegiatan mahasiswa, serta kepanitiaan.
          </p>
          <p>
            Tujuannya sederhana: menyatukan data keorganisasian yang sebelumnya
            tersebar di banyak berkas, sehingga pengurus dapat mengelola
            keanggotaan dan kegiatan tanpa mendata ulang dari awal setiap periode.
          </p>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5"
            >
              <h3 className="font-semibold text-[#0B5C8A]">{pillar.title}</h3>
              <p className="text-sm leading-relaxed text-slate-700">
                {pillar.body}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Sebagian fitur hanya tersedia setelah masuk dengan akun kampus.
          Penjelasan mengenai data yang kami kelola ada di{' '}
          <Link
            href="/privasi"
            className="underline underline-offset-2 hover:opacity-80"
          >
            Kebijakan Privasi
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
