import Image from 'next/image';
import Link from 'next/link';
import AnmategraLogo from 'public/images/logo/anmategra-logo.svg';

const SECTIONS = [
  {
    href: '/prototype/oprec/forms',
    title: 'Forms',
    desc: 'Bikin formulir pendaftaran dengan pilihan divisi dan pertanyaan yang menyesuaikan, lalu lihat responsnya ala sheets.',
  },
  {
    href: '/prototype/oprec/manajemen',
    title: 'Manajemen Oprec',
    desc: 'Olah pendaftar dari cek syarat, penilaian per divisi, sampai penempatan dan tawaran.',
  },
];

export default function PrototypeOprecHome() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-10 px-4 py-16 bg-neutral-100">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image
          src={AnmategraLogo}
          alt="Logo Anmategra"
          className="h-12 w-auto"
        />
        <p className="text-sm font-medium text-neutral-700">
          Purwarupa · data contoh fiktif
        </p>
      </div>
      <div
        className="grid w-full max-w-3xl gap-4 sm:grid-cols-2"
        data-tour="home-cards"
      >
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:border-primary-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400"
          >
            <span className="text-2xl font-semibold text-neutral-1000">
              {s.title}
              <span
                aria-hidden="true"
                className="ml-2 inline-block text-primary-400 transition group-hover:translate-x-1"
              >
                →
              </span>
            </span>
            <span className="text-neutral-700">{s.desc}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
