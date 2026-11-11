'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

/*
 * Panduan berlangkah untuk purwarupa oprec. Setiap langkah boleh berpindah halaman,
 * mengatur tampilan purwarupa lewat event window, dan menyorot satu elemen [data-tour].
 * Sorotannya tidak menghalangi klik, jadi pengguna tetap bisa mencoba sambil membaca.
 */

const BASE = '/prototype/oprec';
const FORMS = `${BASE}/forms`;
const OPREC = `${BASE}/manajemen`;
const STORE_KEY = 'anmategra-proto-oprec-wizard';
const FEEDBACK = 'anmategra@km.itb.ac.id';

type Mode = 'open' | 'paused' | 'dismissed';
type Saved = { step: number; mode: Mode };

type Step = {
  page: string;
  title: string;
  body: string;
  target?: string;
  /* Root purwarupa yang harus sudah dimuat sebelum event dikirim. */
  root?: string;
  event?: {
    name: 'forms-proto' | 'oprec-proto';
    detail: Record<string, unknown>;
  };
};

const STEPS: Step[] = [
  {
    page: BASE,
    title: 'Halo! Ini purwarupa oprec Anmategra 👋',
    body: 'Isinya data fiktif, jadi bebas diklik-klik. Panduan ini sekitar 3 menit. Kalau mau eksplor sendiri dulu, tekan "Tutup dulu" dan lanjutkan kapan saja.',
  },
  {
    page: BASE,
    target: 'home-cards',
    title: 'Ada dua bagian',
    body: 'Forms untuk bikin formulir pendaftaran. Manajemen Oprec untuk mengolah pendaftarnya: cek syarat, nilai, sampai penempatan. Kita mulai dari Forms ya.',
  },
  {
    page: FORMS,
    root: '.af-root',
    event: {
      name: 'forms-proto',
      detail: { view: 'editor', formId: 'f_oskm', tab: 'konten' },
    },
    title: 'Nggak perlu 80 section lagi',
    body: 'Ini form oprec OSKM dengan tiga pilihan divisi. Pertanyaan tiap divisi cukup ditulis sekali, lalu diberi kondisi "muncul kalau pilihan 1, 2, atau 3 adalah divisi ini". Coba scroll dan lihat label kondisinya di tiap kartu.',
  },
  {
    page: FORMS,
    root: '.af-root',
    target: 'forms-editor-tabs',
    event: {
      name: 'forms-proto',
      detail: { view: 'editor', formId: 'f_oskm', tab: 'alur' },
    },
    title: 'Cek alurnya sekilas',
    body: 'Tab Alur menggambar percabangan form, jadi gampang dicek apakah ada pertanyaan divisi yang salah syarat sebelum form dirilis.',
  },
  {
    page: FORMS,
    root: '.af-root',
    target: 'forms-editor-tabs',
    event: {
      name: 'forms-proto',
      detail: { view: 'editor', formId: 'f_oskm', tab: 'pratinjau' },
    },
    title: 'Coba isi sebagai pendaftar',
    body: 'Di Pratinjau kamu bisa mengisi form seperti maba. Pilih beberapa divisi dan lihat pertanyaannya menyesuaikan. Jawaban uji ikut tercatat di respons.',
  },
  {
    page: FORMS,
    root: '.af-root',
    target: 'forms-sheet',
    event: {
      name: 'forms-proto',
      detail: { view: 'responses', formId: 'f_oskm', mode: 'sheets' },
    },
    title: 'Respons ala spreadsheet',
    body: 'Mode Sheets menampilkan jawaban menyamping seperti di Google Sheets. Pakai "Saring per cabang" untuk melihat pendaftar satu divisi saja, lengkap dengan kolom pertanyaan divisinya. Nggak perlu dipecah manual ke banyak sheet.',
  },
  {
    page: OPREC,
    root: '.om',
    target: 'dasbor-kpi',
    event: {
      name: 'oprec-proto',
      detail: { role: 'r_raka', tab: 'dasbor', dash: {} },
    },
    title: 'Sekarang Manajemen Oprec',
    body: 'Dasbor pilihan menampilkan semua pendaftar sekaligus. Syarat umum (twibbon yang dicek manual dan nilai asesmen pra-lembaga) langsung kelihatan, jadi bisa disortir sebelum penilaian.',
  },
  {
    page: OPREC,
    root: '.om',
    target: 'dasbor-matrix',
    event: { name: 'oprec-proto', detail: { tab: 'dasbor' } },
    title: 'Peminat per divisi',
    body: 'Matriks ini menghitung peminat tiap divisi di pilihan 1, 2, dan 3, dibandingkan dengan kuotanya. Klik salah satu angka untuk langsung melihat orang-orangnya di daftar bawah.',
  },
  {
    page: OPREC,
    root: '.om',
    target: 'dasbor-controls',
    event: {
      name: 'oprec-proto',
      detail: { tab: 'dasbor', dash: { group: 'fak' } },
    },
    title: 'Filter, urutkan, kelompokkan',
    body: 'Daftarnya bisa difilter per fakultas, periode, divisi, syarat, dan status, lalu dikelompokkan per fakultas, pilihan 1/2/3, periode, atau angkatan. Sekarang sedang dikelompokkan per fakultas. Hasilnya bisa diekspor ke CSV.',
  },
  {
    page: OPREC,
    root: '.om',
    target: 'sheets-grid',
    event: {
      name: 'oprec-proto',
      detail: { tab: 'nilai', nilaiMode: 'sheets', unit: 'mentor' },
    },
    title: 'Penilaian ala sheet pendivisian',
    body: 'Mirip template pendivisian: tiap divisi punya blok Pilihan 1, 2, dan 3 berdampingan, jawabannya memanjang ke kanan. Kolom Status (LOLOS / GA LOLOS) bisa diisi langsung setelah berkasnya dinilai.',
  },
  {
    page: OPREC,
    root: '.om',
    target: 'role',
    event: {
      name: 'oprec-proto',
      detail: { tab: 'nilai', nilaiMode: 'sheets' },
    },
    title: 'Siapa menilai apa',
    body: 'Ganti "Lihat sebagai" untuk mencoba sudut pandang lain. Kepanitiaan seperti AMI atau Wispril bisa dinilai Kabid/Kadiv langsung; yang besar seperti OSKM bisa dibantu staf HR pusat sebagai penilai umum. Keputusan akhir tetap di Kabid/Kadiv, termasuk hak veto.',
  },
  {
    page: OPREC,
    root: '.om',
    target: 'tab-penempatan',
    event: {
      name: 'oprec-proto',
      detail: { role: 'r_raka', tab: 'penempatan' },
    },
    title: 'Tempatkan tanpa menunggu semua pilihan',
    body: 'Begitu pilihan 1 sebuah divisi selesai diputuskan, tawarannya sudah bisa dikirim. Pilihan 2 dan 3 menyusul. Pendaftar yang menerima tawaran otomatis dilepas dari pilihan lainnya, jadi nggak ada data dobel.',
  },
  {
    page: OPREC,
    root: '.om',
    target: 'demo',
    title: 'Udah, silakan eksplor!',
    body: `Strip gelap di atas berisi kontrol purwarupa: ganti peran, aturan visibilitas, dan simulasi jawaban pendaftar. Ada yang kurang pas atau kurang lengkap? Kabari kami di ${FEEDBACK} ya.`,
  },
];

const LAST = STEPS.length - 1;

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Saved>;
      const step =
        typeof s.step === 'number' ? Math.min(Math.max(s.step, 0), LAST) : 0;
      const mode =
        s.mode === 'paused' || s.mode === 'dismissed' ? s.mode : 'open';
      return { step, mode };
    }
  } catch {
    // localStorage bisa ditolak (mode privat); panduan tetap jalan tanpa disimpan.
  }
  return { step: 0, mode: 'open' };
}

/* Status panduan disimpan di localStorage; server selalu merender tanpa panduan. */
let cache: Saved | undefined;
const listeners = new Set<() => void>();
const read = () => (cache ??= load());
function write(fn: (s: Saved) => Saved) {
  cache = fn(read());
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(cache));
  } catch {
    // abaikan; lihat load()
  }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

function useTargetRect(selector: string | undefined, active: boolean) {
  /* Rect disimpan bersama selector-nya supaya sorotan langkah lama tidak terbawa. */
  const [hit, setHit] = useState<{ sel: string; rect: DOMRect } | null>(null);
  useLayoutEffect(() => {
    if (!selector || !active) return undefined;
    let scrolled = false;
    const tick = () => {
      const el = document.querySelector(`[data-tour="${selector}"]`);
      if (el) {
        if (!scrolled) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          scrolled = true;
        }
        const r = el.getBoundingClientRect();
        setHit((prev) =>
          prev?.sel === selector &&
          prev.rect.top === r.top &&
          prev.rect.left === r.left &&
          prev.rect.width === r.width &&
          prev.rect.height === r.height
            ? prev
            : { sel: selector, rect: r },
        );
      } else {
        setHit(null);
      }
    };
    /* Interval, bukan requestAnimationFrame: tetap jalan di tab latar dan cukup halus
       untuk mengikuti elemen yang bergeser karena scroll, resize, atau data dimuat. */
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 100);
    window.addEventListener('scroll', tick, true);
    window.addEventListener('resize', tick);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      window.removeEventListener('scroll', tick, true);
      window.removeEventListener('resize', tick);
    };
  }, [selector, active]);
  return active && hit && hit.sel === selector ? hit.rect : null;
}

export default function Wizard() {
  const router = useRouter();
  const pathname = usePathname();
  const state = useSyncExternalStore(subscribe, read, () => null);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = state ? STEPS[state.step] : undefined;
  const open = state?.mode === 'open';
  const here = !!step && pathname === step.page;

  /* Setelah halaman langkah terbuka, tunggu purwarupanya termuat lalu atur tampilannya. */
  useEffect(() => {
    if (!open || !step || !here || !step.event) return undefined;
    const { name, detail } = step.event;
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (!step.root || document.querySelector(step.root)) {
        window.dispatchEvent(new CustomEvent(name, { detail }));
        clearInterval(id);
      } else if (tries > 50) {
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [open, step, here]);

  const go = useCallback(
    (i: number) => {
      const next = STEPS[i];
      if (!next) return;
      write(() => ({ step: i, mode: 'open' }));
      if (pathname !== next.page) router.push(next.page);
    },
    [pathname, router],
  );

  const pause = useCallback(() => write((s) => ({ ...s, mode: 'paused' })), []);
  const dismiss = useCallback(
    () => write((s) => ({ ...s, mode: 'dismissed' })),
    [],
  );
  const finish = useCallback(
    () => write(() => ({ step: 0, mode: 'dismissed' })),
    [],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') pause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pause]);

  /* Pindahkan fokus ke kartu saat langkah berganti supaya pembaca layar ikut membacanya. */
  useEffect(() => {
    if (open) cardRef.current?.focus({ preventScroll: true });
  }, [open, state?.step]);

  const rect = useTargetRect(step?.target, open && here);

  if (!state || !step) return null;

  if (state.mode !== 'open') {
    const resumable = state.mode === 'paused' && state.step > 0;
    return (
      <div className="wz-dock">
        <style>{CSS}</style>
        <button
          type="button"
          className={state.mode === 'paused' ? 'wz-pill' : 'wz-help'}
          onClick={() => go(resumable ? state.step : 0)}
          aria-label={state.mode === 'paused' ? undefined : 'Buka panduan'}
          title={state.mode === 'paused' ? undefined : 'Buka panduan'}
        >
          {state.mode === 'paused' ? (
            <>
              <span aria-hidden="true">▶</span>
              {resumable
                ? `Lanjutkan panduan (${state.step + 1}/${STEPS.length})`
                : 'Mulai panduan'}
            </>
          ) : (
            '?'
          )}
        </button>
      </div>
    );
  }

  const pad = 6;
  return (
    <>
      <style>{CSS}</style>
      {rect && (
        <div
          className="wz-spot"
          aria-hidden="true"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
          }}
        />
      )}
      <div
        ref={cardRef}
        className="wz-card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="wz-title"
        aria-describedby="wz-body"
        tabIndex={-1}
      >
        <div className="wz-top">
          <span className="wz-count">
            Panduan · {state.step + 1}/{STEPS.length}
          </span>
          <button
            type="button"
            className="wz-x"
            onClick={pause}
            aria-label="Tutup dulu (Esc)"
            title="Tutup dulu (Esc)"
          >
            ×
          </button>
        </div>
        <div className="wz-bar" aria-hidden="true">
          <i style={{ width: `${((state.step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <h2 id="wz-title">{step.title}</h2>
        <p id="wz-body">{step.body}</p>
        {!here && (
          <p className="wz-away">
            Langkah ini ada di halaman lain.{' '}
            <button type="button" onClick={() => go(state.step)}>
              Bawa aku ke sana
            </button>
          </p>
        )}
        {state.step === LAST && (
          <a
            className="wz-mail"
            href={`mailto:${FEEDBACK}?subject=${encodeURIComponent('Masukan purwarupa oprec')}`}
          >
            Kirim masukan lewat email
          </a>
        )}
        <div className="wz-actions">
          {state.step > 0 && (
            <button
              type="button"
              className="wz-btn ghost"
              onClick={() => go(state.step - 1)}
            >
              Kembali
            </button>
          )}
          <span className="wz-sp" />
          {state.step < LAST ? (
            <button
              type="button"
              className="wz-btn"
              onClick={() => go(state.step + 1)}
            >
              {state.step === 0 ? 'Mulai' : 'Lanjut'}
            </button>
          ) : (
            <button type="button" className="wz-btn" onClick={finish}>
              Selesai
            </button>
          )}
        </div>
        <div className="wz-foot">
          <button type="button" onClick={pause}>
            Tutup dulu
          </button>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={dismiss}>
            Jangan tampilkan lagi
          </button>
        </div>
      </div>
    </>
  );
}

const CSS = `
.wz-card{position:fixed;right:20px;bottom:20px;z-index:1000;width:min(380px,calc(100vw - 32px));background:#0F222D;color:#E6EDF1;border-radius:16px;padding:16px 18px 12px;box-shadow:0 18px 48px rgba(15,34,45,.35);font-family:var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.55;animation:wz-in .25s cubic-bezier(.16,1,.3,1)}
.wz-card:focus{outline:none}
.wz-card h2{margin:10px 0 6px;font-size:17px;font-weight:600;color:#fff;line-height:1.3}
.wz-card p{margin:0}
.wz-top{display:flex;align-items:center;justify-content:space-between}
.wz-count{font-size:12px;font-weight:600;color:#F5CB69;letter-spacing:.02em}
.wz-x{border:0;background:none;color:#AEBBC4;font-size:22px;line-height:1;width:28px;height:28px;border-radius:8px;cursor:pointer}
.wz-x:hover{background:#1B3442;color:#fff}
.wz-bar{height:3px;background:#24404F;border-radius:99px;margin-top:8px;overflow:hidden}
.wz-bar i{display:block;height:100%;background:#00B7B7;border-radius:99px;transition:width .3s}
.wz-away{margin-top:10px!important;font-size:13px;color:#F5CB69}
.wz-away button,.wz-foot button{border:0;background:none;padding:0;color:inherit;font:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.wz-mail{display:inline-block;margin-top:10px;color:#7FDCDC;font-weight:600;text-underline-offset:3px}
.wz-actions{display:flex;align-items:center;gap:8px;margin-top:14px}
.wz-sp{flex:1}
.wz-btn{height:36px;padding:0 16px;border-radius:10px;border:0;background:#00B7B7;color:#0F222D;font-weight:600;font-size:14px;cursor:pointer}
.wz-btn:hover{background:#00A5A5}
.wz-btn.ghost{background:transparent;color:#E6EDF1;border:1px solid #4A6A7B}
.wz-btn.ghost:hover{background:#1B3442}
.wz-foot{display:flex;gap:8px;justify-content:center;margin-top:10px;font-size:12px;color:#8FA2AE}
.wz-foot button:hover{color:#fff}
.wz-card :focus-visible,.wz-dock :focus-visible{outline:2px solid #F5CB69;outline-offset:2px}
.wz-spot{position:fixed;z-index:999;pointer-events:none;border-radius:12px;box-shadow:0 0 0 3px #00B7B7,0 0 0 9999px rgba(15,34,45,.35);transition:top .2s,left .2s,width .2s,height .2s}
.wz-dock{position:fixed;right:20px;bottom:20px;z-index:1000;font-family:var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif}
.wz-pill{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 18px;border-radius:999px;border:0;background:#0F222D;color:#fff;font-weight:600;font-size:14px;box-shadow:0 10px 28px rgba(15,34,45,.3);cursor:pointer}
.wz-pill span{color:#00B7B7;font-size:11px}
.wz-pill:hover{background:#1B3442}
.wz-help{width:40px;height:40px;border-radius:50%;border:0;background:#0F222D;color:#fff;font-weight:700;font-size:17px;box-shadow:0 8px 20px rgba(15,34,45,.28);cursor:pointer;opacity:.8}
.wz-help:hover{opacity:1}
@keyframes wz-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (max-width:640px){.wz-card{right:16px;left:16px;bottom:16px;width:auto}}
@media (prefers-reduced-motion:reduce){.wz-card,.wz-spot,.wz-bar i{animation:none;transition:none}}
`;
