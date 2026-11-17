'use client';

// Library
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  FolderOpen,
  FolderX,
  History,
  Instagram,
  Keyboard,
  type LucideIcon,
  Maximize,
  Minimize,
  Network,
  ShieldCheck,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
// Components
import { ManualDemo } from '~/app/_components/manual/demo/registry';
import { cn } from '~/lib/utils';

// Ukuran kanvas tetap; skala dihitung dari viewport
const STAGE_W = 1600;
const STAGE_H = 900;
const OVERLAY_H = 56; // ruang overlay bawah di luar kanvas

const SLIDES_URL = 'anmategra.com/slides/sneakpeek';
const FORM_URL = 'anmategra.com/forms/rg';

// Pergantian slide cukup memudar; satu-satunya animasi yang "bercerita" ada di
// slide alur data, kotaknya muncul berurutan.
const KEYFRAMES = `
  @keyframes deck-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .deck-fade { animation: deck-fade 180ms ease-out both; }
  @keyframes deck-rise {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: none; }
  }
  .deck-rise { animation: deck-rise 480ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  @media (prefers-reduced-motion: reduce) {
    .deck-fade, .deck-rise { animation: none; }
  }
`;

/* ---------------------------------------------------------------- *
 * Kerangka slide
 * ---------------------------------------------------------------- */

function PartnerLogos({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <Image
        src="/images/logo/logo-kabinet.svg"
        alt="Logo Kabinet KM ITB 2026/2027 Bermakna"
        width={593}
        height={389}
        className="h-full w-auto"
      />
      <Image
        src="/images/logo/logo-psdm.svg"
        alt="Logo Kemenkoan PSDM KM ITB"
        width={478}
        height={428}
        className="h-full w-auto"
      />
    </div>
  );
}

/** Logo kabinet dan PSDM di kiri atas, logo Anmategra di kanan atas. */
function Header() {
  return (
    <header className="flex shrink-0 items-center justify-between">
      <PartnerLogos className="h-11" />
      <Image
        src="/images/logo/anmategra-logo.svg"
        alt="Anmategra"
        width={381}
        height={381}
        className="size-12"
      />
    </header>
  );
}

function Frame({
  children,
  header = true,
}: {
  children: ReactNode;
  header?: boolean;
}) {
  return (
    <div className="flex h-full w-full flex-col bg-white px-24 pb-16 pt-12 text-neutral-1000">
      {header ? <Header /> : null}
      <div className="mt-12 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function Title({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        'max-w-[1250px] text-balance text-[60px] font-semibold leading-[68px] tracking-[-1.5px] text-primary-400',
        className,
      )}
    >
      {children}
    </h2>
  );
}

function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 max-w-[1100px] text-[28px] leading-[40px] text-neutral-700">
      {children}
    </p>
  );
}

/** Kartu poin: ikon, judul, dan penjelasan. `solid` untuk kartu biru penuh. */
function Card({
  icon: Icon,
  title,
  children,
  solid = false,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  solid?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex gap-6 rounded-[24px] p-8',
        solid ? 'bg-primary-400' : 'bg-primary-100',
      )}
    >
      <span
        className={cn(
          'grid size-16 shrink-0 place-items-center rounded-[16px]',
          solid ? 'bg-white/15 text-white' : 'bg-primary-400 text-white',
        )}
      >
        <Icon className="size-8" strokeWidth={1.75} aria-hidden />
      </span>
      <div>
        <h3
          className={cn(
            'text-[30px] font-semibold leading-[38px] tracking-[-0.5px]',
            solid ? 'text-white' : 'text-primary-400',
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            'mt-2 text-[22px] leading-[33px]',
            solid ? 'text-primary-100' : 'text-primary-600',
          )}
        >
          {children}
        </p>
      </div>
    </div>
  );
}

/** Lambang Anmategra besar yang terpotong di tepi slide, gema dari sampul. */
function BigMark({
  side,
  size = 720,
  top = '50%',
}: {
  side: 'left' | 'right';
  size?: number;
  top?: string;
}) {
  return (
    <Image
      src="/images/logo/anmategra-logo.svg"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="pointer-events-none absolute -translate-y-1/2 select-none"
      style={{ width: size, height: size, top, [side]: -size * 0.36 }}
    />
  );
}

function SlidesNote({ className }: { className?: string }) {
  return (
    <p className={cn('text-[20px] leading-[28px] text-neutral-700', className)}>
      Salindia ini juga tersedia di{' '}
      <span className="font-semibold text-primary-400">{SLIDES_URL}</span>
    </p>
  );
}

/* ---------------------------------------------------------------- *
 * Slide demo
 * ---------------------------------------------------------------- */

function DemoSlide({
  kasus,
  step,
  body,
  auto,
  demoId,
}: {
  kasus: string;
  step: string;
  body: string;
  auto: string[];
  demoId: string;
}) {
  return (
    <Frame>
      <div className="flex min-h-0 flex-1 gap-12">
        <div className="flex w-[380px] shrink-0 flex-col">
          <h2 className="text-balance text-[46px] font-semibold leading-[52px] tracking-[-1px] text-primary-400">
            {step}
          </h2>
          <p className="mt-3 text-[19px] font-medium leading-[27px] text-secondary-700">
            {kasus}
          </p>
          <p className="mt-6 text-[22px] leading-[33px] text-neutral-700">
            {body}
          </p>
          <div className="mt-auto">
            <p className="text-[19px] font-semibold text-neutral-1000">
              Yang jalan otomatis
            </p>
            <ul className="mt-3 space-y-2.5">
              {auto.map((item) => (
                <li
                  key={item}
                  className="flex gap-2.5 text-[19px] leading-[27px] text-neutral-700"
                >
                  <Check
                    className="mt-1 size-5 shrink-0 text-secondary-600"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            data-demo
            className="min-h-0 flex-1 overflow-auto rounded-[24px] border border-neutral-200 bg-neutral-100 p-4"
          >
            <ManualDemo id={demoId} />
          </div>
          <p className="mt-3 shrink-0 text-[16px] text-neutral-700">
            Ini simulasi pakai data contoh, bisa langsung dicoba.
          </p>
        </div>
      </div>
    </Frame>
  );
}

/** Kode QR ke form requirement gathering (https://anmategra.com/forms/rg). */
function FormQr() {
  return (
    <div className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-[0_2px_8px_rgba(20,40,40,0.06),0_12px_32px_rgba(20,40,40,0.08)]">
      <Image
        src="/images/slides/qr-forms-rg.svg"
        alt={`Kode QR ke ${FORM_URL}`}
        width={1155}
        height={1155}
        className="size-[340px]"
        unoptimized
      />
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Isi
 * ---------------------------------------------------------------- */

const NEEDS: { icon: LucideIcon; name: string; tools: string[] }[] = [
  {
    icon: UserPlus,
    name: 'Oprec',
    tools: ['Google Form', 'Spreadsheet rekap'],
  },
  { icon: ClipboardList, name: 'Pendataan dan survei', tools: ['Google Form'] },
  { icon: Network, name: 'Organogram', tools: ['Canva', 'PowerPoint'] },
  { icon: Users, name: 'Data anggota dan panitia', tools: ['Spreadsheet'] },
  { icon: FolderOpen, name: 'Kegiatan dan arsip', tools: ['Google Drive'] },
];

const FLOW = [
  { name: 'Organogram', caption: 'Divisi dan kuota staf disusun sekali' },
  { name: 'Oprec', caption: 'Divisi yang dibuka diambil dari organogram' },
  { name: 'Forms', caption: 'Nama dan NIM keisi dari akun ITB' },
  { name: 'Penilaian', caption: 'Rubrik dan penilainya lembaga yang atur' },
  { name: 'Penempatan', caption: 'Satu orang ga bisa keterima di dua divisi' },
  { name: 'Organogram dan profil', caption: 'Yang keterima langsung tercatat' },
  { name: 'Rapor dan Best Staff', caption: 'Penilaian di akhir kepengurusan' },
  {
    name: 'Arsip dan publikasi',
    caption: 'Profil lembaga dan kegiatan kebuka buat publik',
  },
];

const CASES = [
  'Kepanitiaan butuh 40 staf dari ratusan pendaftar',
  'Himpunan perlu data 150 orang sebelum Jumat',
  'Akhir kepengurusan: ngasih nilai dan apresiasi',
];

const KASUS_1 = 'Kasus 1: kepanitiaan butuh 40 staf';
const KASUS_2 = 'Kasus 2: data 150 orang sebelum Jumat';
const KASUS_3 = 'Kasus 3: akhir kepengurusan';

function FlowNode({
  index,
  name,
  caption,
}: {
  index: number;
  name: string;
  caption: string;
}) {
  return (
    <div
      className="deck-rise flex-1 rounded-[20px] border border-neutral-400 bg-white px-6 py-5"
      style={{ animationDelay: `${index * 140}ms` }}
    >
      <span className="text-[17px] font-semibold tabular-nums text-secondary-600">
        {index + 1}
      </span>
      <p className="mt-1 text-[25px] font-semibold leading-[31px] tracking-[-0.25px] text-primary-400">
        {name}
      </p>
      <p className="mt-2 text-[18px] leading-[26px] text-neutral-700">
        {caption}
      </p>
    </div>
  );
}

function FlowArrow({ direction }: { direction: 'left' | 'right' }) {
  const Icon = direction === 'right' ? ArrowRight : ArrowLeft;
  return (
    <div
      className="flex w-8 shrink-0 items-center justify-center text-secondary-600"
      aria-hidden
    >
      <Icon className="size-6" />
    </div>
  );
}

type Slide = {
  id: string;
  title: string;
  render: () => ReactNode;
};

const SLIDES: Slide[] = [
  {
    id: 'sampul',
    title: 'Anmategra: Pendataan Kemahasiswaan Terintegrasi',
    render: () => (
      <div className="relative h-full w-full overflow-hidden bg-white">
        <BigMark side="left" size={760} />
        <div className="absolute left-[640px] top-1/2 -translate-y-1/2">
          <Image
            src="/images/logo/anmategra-wordmark.svg"
            alt="Anmategra"
            width={760}
            height={221}
            className="h-auto w-[760px]"
            priority
          />
          <div className="mt-4 h-[3px] w-[800px] bg-neutral-1000" aria-hidden />
          <p className="mt-6 text-[44px] font-light leading-[52px] tracking-[-0.5px] text-primary-400">
            Pendataan Kemahasiswaan Terintegrasi
          </p>
          <SlidesNote className="mt-14" />
        </div>
        <div className="absolute bottom-14 right-24 flex items-center gap-5">
          <PartnerLogos className="h-14" />
          <p className="text-[16px] leading-[22px] text-primary-600">
            Kemenkoan Pengembangan Sumber Daya Manusia
            <br />
            Kabinet KM ITB 2026/2027 &ldquo;Bermakna&rdquo;
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'filosofi',
    title: 'Dari hulu ke hilir',
    render: () => (
      <Frame>
        <div className="flex flex-1 flex-col justify-center">
          <p className="max-w-[1250px] text-balance text-[68px] font-medium leading-[80px] tracking-[-1.5px] text-neutral-1000">
            Memfasilitasi dan mengintegrasikan kebutuhan data kemahasiswaan{' '}
            <span className="text-secondary-600">dari hulu ke hilir.</span>
          </p>
          <p className="mt-10 text-[28px] leading-[40px] text-neutral-700">
            Ini tujuan Anmategra dari awal, dan sampai sekarang masih sama.
          </p>
        </div>
      </Frame>
    ),
  },
  {
    id: 'kebutuhan',
    title: 'Lembaga butuh banyak data',
    render: () => (
      <Frame>
        <Title>Lembaga butuh banyak data</Title>
        <Lead>Tiap kebutuhan biasanya punya alatnya sendiri-sendiri.</Lead>
        <div className="flex flex-1 items-center pb-8">
          <div className="grid w-full grid-cols-5 gap-5">
            {NEEDS.map(({ icon: Icon, name, tools }) => (
              <div
                key={name}
                className="flex min-h-[380px] flex-col rounded-[24px] bg-primary-100 p-7"
              >
                <span className="grid size-16 place-items-center rounded-[16px] bg-primary-400 text-white">
                  <Icon className="size-8" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-6 text-balance text-[28px] font-semibold leading-[34px] tracking-[-0.5px] text-primary-400">
                  {name}
                </h3>
                <div className="mt-auto pt-8">
                  <p className="text-[18px] font-medium text-primary-600">
                    Biasanya pakai
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tools.map((tool) => (
                      <span
                        key={tool}
                        className="rounded-full bg-white px-3 py-1 text-[18px] text-primary-500"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Frame>
    ),
  },
  {
    id: 'repotnya',
    title: 'Sebenarnya semua itu udah bisa dikerjain sendiri',
    render: () => (
      <Frame>
        <Title>Sebenarnya semua itu udah bisa dikerjain sendiri</Title>
        <Lead>
          Yang repot itu mindahin datanya dari satu alat ke alat lain.
        </Lead>
        <div className="mt-10 grid grid-cols-2 gap-5">
          <Card icon={Keyboard} title="NIM diketik ulang terus">
            Tiap bikin form baru, data yang sama diminta lagi. Salah ketik
            dikit, rekapnya berantakan.
          </Card>
          <Card icon={Copy} title="Rekap oprec disalin manual">
            Dari spreadsheet ke daftar panitia, terus ke organogram. Satu-satu.
          </Card>
          <Card icon={History} title="Organogram cepet basi">
            Satu orang pindah divisi, slide organogramnya harus didesain ulang.
          </Card>
          <Card icon={FolderX} title="Arsip ilang pas serah terima">
            Drive-nya punya akun pribadi pengurus lama. Kepengurusan baru mulai
            dari nol lagi.
          </Card>
        </div>
      </Frame>
    ),
  },
  {
    id: 'alur',
    title: 'Di Anmategra, datanya nyambung',
    render: () => (
      <Frame>
        <Title>Di Anmategra, datanya nyambung</Title>
        <Lead>
          Data yang diisi di awal kepakai lagi sampai akhir kepengurusan, tanpa
          salin-tempel.
        </Lead>
        <div className="mt-12 flex flex-col">
          <div className="flex items-stretch gap-2">
            {FLOW.slice(0, 4).map((node, i) => (
              <Fragment key={node.name}>
                <FlowNode index={i} {...node} />
                {i < 3 ? <FlowArrow direction="right" /> : null}
              </Fragment>
            ))}
          </div>
          <div
            className="flex h-12 items-center justify-end pr-[calc(12.5%-28px)] text-secondary-600"
            aria-hidden
          >
            <ArrowDown className="size-6" />
          </div>
          <div className="flex flex-row-reverse items-stretch gap-2">
            {FLOW.slice(4).map((node, i) => (
              <Fragment key={node.name}>
                <FlowNode index={i + 4} {...node} />
                {i < 3 ? <FlowArrow direction="left" /> : null}
              </Fragment>
            ))}
          </div>
        </div>
      </Frame>
    ),
  },
  {
    id: 'kenapa',
    title: 'Kenapa pakai Anmategra?',
    render: () => (
      <Frame>
        <Title>Kenapa pakai Anmategra?</Title>
        <div className="mt-10 grid grid-cols-2 gap-5">
          <Card solid icon={BadgeCheck} title="Datanya valid dari awal">
            Login pakai akun ITB, jadi nama, NIM, sama jurusan langsung keisi.
            Data angkatan 2025 dan 2026 juga udah masuk.
          </Card>
          <Card solid icon={Archive} title="Ga ilang pas ganti kepengurusan">
            Data disimpan atas nama lembaga, bukan akun pribadi. Pengurus baru
            tinggal lanjutin.
          </Card>
          <Card
            solid
            icon={Zap}
            title="Banyak kerjaan manual yang jalan sendiri"
          >
            Kuota kepantau, form ketutup sendiri pas tenggat, bagan nyusun
            sendiri, rekap tinggal ekspor.
          </Card>
          <Card solid icon={ShieldCheck} title="Aksesnya bisa diatur">
            Cuma lembaga yang bisa ubah data keaktifan anggotanya. Akses dibagi
            per peran: pengelola, penilai, anggota.
          </Card>
        </div>
        <p className="mt-auto text-[26px] leading-[36px] text-primary-600">
          Ga harus pindah semua sekaligus.{' '}
          <span className="font-semibold text-secondary-700">
            Mulai aja dari satu oprec atau satu form dulu.
          </span>
        </p>
      </Frame>
    ),
  },
  {
    id: 'sneak-peek',
    title: 'Sneak peek',
    render: () => (
      <div className="relative h-full w-full overflow-hidden bg-white">
        <BigMark side="right" size={680} top="62%" />
        <div className="flex h-full flex-col px-24 pb-16 pt-12">
          <Header />
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="text-[120px] font-semibold leading-[120px] tracking-[-3px] text-primary-400">
              Sneak peek
            </h2>
            <p className="mt-6 text-[30px] leading-[42px] text-neutral-700">
              Tiga kasus yang sering kejadian di lembaga.
            </p>
            <ol className="mt-12 max-w-[900px] space-y-6">
              {CASES.map((item, i) => (
                <li
                  key={item}
                  className="flex items-baseline gap-6 border-t border-neutral-400 pt-6"
                >
                  <span className="w-28 shrink-0 text-[22px] font-semibold text-secondary-700">
                    Kasus {i + 1}
                  </span>
                  <span className="text-[32px] font-medium leading-[40px] text-neutral-1000">
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'kasus-1-organogram',
    title: 'Susun organogram',
    render: () => (
      <DemoSlide
        kasus={KASUS_1}
        step="1. Susun organogram"
        body="Divisi sama kuota staf cukup disusun sekali. Bagannya nyusun sendiri, bisa diekspor ke PNG buat proposal. Bagian juga bisa diseret ke bagian lain."
        auto={['Bagan nyusun sendiri', 'Kuota langsung jadi acuan oprec']}
        demoId="organogram-editor"
      />
    ),
  },
  {
    id: 'kasus-1-buka-oprec',
    title: 'Buka oprec',
    render: () => (
      <DemoSlide
        kasus={KASUS_1}
        step="2. Buka oprec"
        body="Pilih preset, centang divisi yang dibuka, beres. Pendaftar ngisi pakai akun ITB-nya sendiri."
        auto={[
          'Divisi dan kuota diambil dari organogram',
          'Nama dan NIM pendaftar keisi sendiri',
        ]}
        demoId="oprec-setup"
      />
    ),
  },
  {
    id: 'kasus-1-nilai',
    title: 'Nilai berkas',
    render: () => (
      <DemoSlide
        kasus={KASUS_1}
        step="3. Nilai berkas"
        body="Tiap penilai cuma lihat berkas yang ditugasin ke dia, pakai rubrik yang lembaga bikin sendiri."
        auto={['Skor akhir dihitung dari bobot', 'Status lolos dihitung ulang']}
        demoId="oprec-nilai"
      />
    ),
  },
  {
    id: 'kasus-1-penempatan',
    title: 'Tempatkan',
    render: () => (
      <DemoSlide
        kasus={KASUS_1}
        step="4. Tempatkan"
        body="Putusin per divisi sambil mantau kuota. Satu orang ga bisa keterima di dua divisi."
        auto={[
          'Keputusan bisa diisi dari hasil penilaian',
          'Ada peringatan kalau kuota udah penuh',
        ]}
        demoId="oprec-penempatan"
      />
    ),
  },
  {
    id: 'kasus-1-hasil',
    title: 'Rilis hasil',
    render: () => (
      <DemoSlide
        kasus={KASUS_1}
        step="5. Rilis hasil"
        body="Umumin hasil cukup satu tombol. Yang keterima langsung masuk organogram dan profilnya."
        auto={[
          'Masuk organogram kepanitiaan',
          'Tercatat di riwayat kepanitiaan mahasiswa',
        ]}
        demoId="oprec-hasil"
      />
    ),
  },
  {
    id: 'kasus-2-form',
    title: 'Susun form',
    render: () => (
      <DemoSlide
        kasus={KASUS_2}
        step="1. Susun form"
        body="Pertanyaan disusun dari blok: teks, pilihan, skala, tanggal, unggah berkas, dan lain-lain. Urutannya tinggal diseret."
        auto={[
          'Nama dan NIM tercatat dari akun ITB',
          'Bisa dibatasi satu respons per akun',
        ]}
        demoId="forms-builder"
      />
    ),
  },
  {
    id: 'kasus-2-kondisi',
    title: 'Pertanyaan bersyarat',
    render: () => (
      <DemoSlide
        kasus={KASUS_2}
        step="2. Pertanyaan bersyarat"
        body="Pertanyaan bisa muncul sesuai jawaban sebelumnya: pilihan tertentu, angka di atas atau di bawah batas, atau gabungan beberapa syarat. Layar penutupnya juga bisa beda tiap jalur."
        auto={[
          'Pertanyaan yang disembunyiin ga ngehalangin kirim',
          'Syarat yang acuannya ga valid langsung ditandai',
        ]}
        demoId="forms-kondisi"
      />
    ),
  },
  {
    id: 'kasus-2-respons',
    title: 'Rekap respons',
    render: () => (
      <DemoSlide
        kasus={KASUS_2}
        step="3. Rekap respons"
        body="Rekap per pertanyaan dan tabel lengkap, tinggal ekspor ke CSV."
        auto={[
          'Form ketutup sendiri pas tenggat',
          'Respons uji dipisah dari respons asli',
        ]}
        demoId="forms-respons"
      />
    ),
  },
  {
    id: 'kasus-3-rapor',
    title: 'Rapor dan Best Staff',
    render: () => (
      <DemoSlide
        kasus={KASUS_3}
        step="Rapor dan Best Staff"
        body="Kasih nilai kinerja anggota dan pilih Best Staff tiap divisi. Semuanya kecatat di profil mahasiswa sebagai rekam jejak."
        auto={[
          'Riwayat kepanitiaan di profil mahasiswa',
          'Arsip buat kepengurusan berikutnya',
        ]}
        demoId="rapor"
      />
    ),
  },
  {
    id: 'progres',
    title: 'Progres sejauh ini',
    render: () => (
      <Frame>
        <Title>Progres sejauh ini</Title>
        <div className="mt-12 flex flex-1 gap-16">
          <div className="flex w-[640px] shrink-0 flex-col justify-center">
            <p className="text-[168px] font-semibold leading-[160px] tracking-[-6px] text-primary-400">
              2.700+
            </p>
            <p className="mt-6 text-[34px] font-semibold leading-[42px] tracking-[-0.5px] text-neutral-1000">
              pengguna di oprec Aku Masuk ITB 2027
            </p>
            <p className="mt-3 text-[24px] leading-[34px] text-neutral-700">
              AMI jalanin open recruitment-nya pakai Anmategra.
            </p>
          </div>
          <ul className="flex flex-1 flex-col justify-center gap-10 border-l border-neutral-400 pl-16">
            {[
              ['Forms, Oprec, dan Organogram', 'Udah bisa dipakai lembaga.'],
              [
                'Data angkatan 2025 dan 2026',
                'Udah terintegrasi, mahasiswa baru langsung terdata.',
              ],
              [
                'Dukungan Ditmawa ITB',
                'Anmategra didukung Direktorat Kemahasiswaan ITB.',
              ],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-4">
                <Check
                  className="mt-1.5 size-7 shrink-0 text-secondary-600"
                  aria-hidden
                />
                <div>
                  <p className="text-[30px] font-semibold leading-[38px] tracking-[-0.5px] text-neutral-1000">
                    {title}
                  </p>
                  <p className="mt-1 text-[22px] leading-[32px] text-neutral-700">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Frame>
    ),
  },
  {
    id: 'selanjutnya',
    title: 'Yang lagi disiapin',
    render: () => (
      <Frame>
        <Title>Yang lagi disiapin</Title>
        <ol className="relative mt-12 flex flex-1 flex-col justify-between pb-4">
          {/* Satu garis utuh dari titik pertama sampai titik terakhir */}
          <span
            aria-hidden
            className="absolute bottom-9 left-[11px] top-5 w-0.5 bg-neutral-400"
          />
          {(
            [
              ['Pindah ke anmategra.itb.ac.id', null, false],
              [
                'Fitur keuangan',
                'RAB, reimburse, sampai open PO lewat Forms, biar transparansinya kejaga.',
                true,
              ],
              ['Sosialisasi dan workshop resmi', null, false],
              ['Publikasi di Instagram', null, false],
            ] as const
          ).map(([title, body, needsInput]) => (
            <li key={title} className="relative pl-14">
              <span
                aria-hidden
                className="absolute left-0 top-2 size-6 rounded-full border-4 border-secondary-500 bg-white"
              />
              <div className="flex flex-wrap items-center gap-4">
                <h3 className="text-[34px] font-semibold leading-[40px] tracking-[-0.5px] text-neutral-1000">
                  {title}
                </h3>
                {needsInput ? (
                  <span className="rounded-full bg-saffron px-4 py-1 text-[18px] font-semibold text-neutral-1000">
                    Butuh masukan dari lembaga
                  </span>
                ) : null}
              </div>
              {body ? (
                <p className="mt-2 text-[24px] leading-[34px] text-neutral-700">
                  {body}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </Frame>
    ),
  },
  {
    id: 'follow',
    title: 'Jangan lupa follow Anmategra',
    render: () => (
      <Frame>
        <Title>Jangan lupa follow Anmategra, ya!</Title>
        <div className="flex flex-1 items-center">
          <div className="grid w-full grid-cols-2 divide-x divide-neutral-400">
            <div className="flex flex-col items-center">
              <Instagram
                className="size-[150px] text-primary-400"
                strokeWidth={1.4}
                aria-hidden
              />
              <p className="mt-8 text-[22px] font-medium text-neutral-700">
                Instagram
              </p>
              <p className="mt-1 text-[60px] font-semibold leading-[68px] tracking-[-1.5px] text-neutral-1000">
                @anmategra.itb
              </p>
            </div>
            <div className="flex flex-col items-center">
              {/* Logo X digambar inline supaya tidak perlu paket tambahan */}
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-[150px] p-3 text-primary-400"
                aria-hidden
              >
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
              </svg>
              <p className="mt-8 text-[22px] font-medium text-neutral-700">
                X (Twitter)
              </p>
              <p className="mt-1 text-[60px] font-semibold leading-[68px] tracking-[-1.5px] text-neutral-1000">
                @anmategra_itb
              </p>
            </div>
          </div>
        </div>
      </Frame>
    ),
  },
  {
    id: 'pertanyaan',
    title: 'Ada pertanyaan?',
    render: () => (
      <Frame>
        <div className="flex flex-1 items-center gap-20">
          <div className="flex-1">
            <h2 className="text-[104px] font-semibold leading-[108px] tracking-[-3px] text-primary-400">
              Ada pertanyaan?
            </h2>
            <p className="mt-8 max-w-[780px] text-[28px] leading-[40px] text-neutral-700">
              Kami mau tau kebutuhan lembaga kalian. Isi form ini ya, biar fitur
              berikutnya dibangun dari kebutuhan yang aktual.
            </p>
            <p className="mt-6 text-[34px] font-semibold text-secondary-700">
              {FORM_URL}
            </p>
          </div>
          <FormQr />
        </div>
        <SlidesNote />
      </Frame>
    ),
  },
];

/* ---------------------------------------------------------------- *
 * Overlay
 * ---------------------------------------------------------------- */

function OverlayButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex size-8 items-center justify-center rounded-[8px] text-white/80 transition-colors',
        'hover:bg-white/10 hover:text-white',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- *
 * Deck
 * ---------------------------------------------------------------- */

export function SneakPeekDeck() {
  // Slide awal dibaca dari hash (#3 → indeks 2)
  const [index, setIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const parsed = Number(window.location.hash.replace('#', ''));
    if (!Number.isInteger(parsed)) return 0;
    const zero = parsed - 1;
    return zero >= 0 && zero < SLIDES.length ? zero : 0;
  });

  // Skala kanvas mengikuti viewport
  const [scale, setScale] = useState<number>(() => {
    if (typeof window === 'undefined') return 0.5;
    return Math.min(
      window.innerWidth / STAGE_W,
      (window.innerHeight - OVERLAY_H) / STAGE_H,
    );
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const total = SLIDES.length;

  const goTo = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(SLIDES.length - 1, next)));
  }, []);

  const next = useCallback(() => {
    setIndex((current) => Math.min(SLIDES.length - 1, current + 1));
  }, []);

  const prev = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }, []);

  // Hitung ulang skala saat jendela berubah
  useEffect(() => {
    const onResize = () => {
      setScale(
        Math.min(
          window.innerWidth / STAGE_W,
          (window.innerHeight - OVERLAY_H) / STAGE_H,
        ),
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Simpan nomor slide di hash URL
  useEffect(() => {
    window.history.replaceState(null, '', `#${index + 1}`);
  }, [index]);

  // Ikuti hash yang diubah manual, mis. lompat ke #12 dari bilah alamat
  useEffect(() => {
    const onHashChange = () => {
      const parsed = Number(window.location.hash.replace('#', ''));
      if (Number.isInteger(parsed)) goTo(parsed - 1);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [goTo]);

  // Pantau status fullscreen
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Navigasi keyboard
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          tag === 'button' ||
          target.isContentEditable
        ) {
          return;
        }
        // Biarkan demo interaktif memakai tombol panahnya sendiri
        if (target.closest('[data-demo]')) return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          event.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          prev();
          break;
        case 'Home':
          event.preventDefault();
          goTo(0);
          break;
        case 'End':
          event.preventDefault();
          goTo(SLIDES.length - 1);
          break;
        default:
          if (event.key.toLowerCase() === 'f') {
            event.preventDefault();
            toggleFullscreen();
          }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goTo, next, prev, toggleFullscreen]);

  const slide = SLIDES[index];

  return (
    <div className="fixed inset-0 flex flex-col bg-primary-1000 font-sans">
      <style>{KEYFRAMES}</style>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div
          className="relative overflow-hidden"
          style={{
            width: STAGE_W,
            height: STAGE_H,
            transform: `scale(${scale})`,
          }}
          // Klik di 15% tepi kiri/kanan untuk pindah slide (kecuali di dalam demo)
          onClick={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest('[data-demo]')) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - rect.left;
            if (x < rect.width * 0.15) {
              prev();
            } else if (x > rect.width * 0.85) {
              next();
            }
          }}
        >
          {slide ? (
            <div
              key={slide.id}
              className="deck-fade h-full w-full motion-reduce:animate-none"
            >
              <section
                aria-roledescription="slide"
                aria-label={`${index + 1} dari ${total}: ${slide.title}`}
                className="h-full w-full"
              >
                {slide.render()}
              </section>
            </div>
          ) : null}
        </div>
      </div>

      {/* Pengumuman untuk pembaca layar */}
      <div aria-live="polite" className="sr-only">
        {slide ? `Slide ${index + 1} dari ${total}: ${slide.title}` : ''}
      </div>

      {/* Overlay bawah, di luar kanvas */}
      <div className="group relative flex h-14 shrink-0 items-center justify-center gap-3 opacity-30 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100 motion-reduce:transition-none">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-white/10">
          <div
            className="h-full bg-secondary-400 transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>

        <OverlayButton
          label="Slide sebelumnya"
          onClick={prev}
          disabled={index === 0}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </OverlayButton>

        <span className="text-[12px] font-semibold tabular-nums tracking-[1px] text-white/80">
          {index + 1} / {total}
        </span>

        <OverlayButton
          label="Slide berikutnya"
          onClick={next}
          disabled={index === total - 1}
        >
          <ChevronRight className="size-4" aria-hidden />
        </OverlayButton>

        <div className="mx-2 h-4 w-px bg-white/15" aria-hidden />

        <OverlayButton
          label={isFullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? (
            <Minimize className="size-4" aria-hidden />
          ) : (
            <Maximize className="size-4" aria-hidden />
          )}
        </OverlayButton>
      </div>
    </div>
  );
}
