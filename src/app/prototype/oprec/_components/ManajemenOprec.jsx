// @ts-nocheck -- purwarupa satu-file dalam JS biasa, tidak ikut type-check.
'use client';

/* =====================================================================
   Manajemen Oprec — purwarupa v3
   Satu komponen React, tanpa library eksternal. Gaya mengikuti Anmategra-APP
   (Geist, navy #2B6282 untuk aksi utama, palet neutral & status dari tailwind.config).

   Sumber kebenaran tetap spesifikasi-oprec-anmategra.md. Model data di sini
   sengaja tetap generik (status per pilihan + keputusan terpisah), tetapi UI
   menampilkannya sebagai satu status yang mudah dibaca.

   Bagian: data contoh · logika skor & status · komponen dasar · Pendaftar ·
   Nilai · Penempatan · Ringkasan · Pengaturan · kerangka aplikasi · CSS
   ===================================================================== */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// @ts-nocheck -- purwarupa satu-file dalam JS biasa, tidak ikut type-check.

// @ts-nocheck -- purwarupa satu-file dalam JS biasa, tidak ikut type-check.

// @ts-nocheck -- purwarupa satu-file dalam JS biasa, tidak ikut type-check.

// @ts-nocheck -- purwarupa satu-file dalam JS biasa, tidak ikut type-check.

// @ts-nocheck -- purwarupa satu-file dalam JS biasa, tidak ikut type-check.

// @ts-nocheck -- purwarupa satu-file dalam JS biasa, tidak ikut type-check.

/* ---------- util ---------- */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = mulberry32(20261022);
const pick = (a) => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pct = (p) => (p == null ? '—' : String(Math.round(p * 100)));
const fmt1 = (x) => x.toFixed(1).replace('.', ',');
const initials = (n) =>
  n
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
const firstName = (n) => n.split(' ')[0];

/* =====================================================================
   DATA CONTOH
   ===================================================================== */
const EVENT_NAME = 'OSKM ITB 2027';
const CLOSES = '20 November 2026';
const UNITS = [
  { id: 'b-mentor', name: 'Bidang Mentor', parent: null },
  {
    id: 'mentor',
    name: 'Divisi Mentor',
    short: 'Mentor',
    parent: 'b-mentor',
    open: true,
    quota: 24,
  },
  { id: 'b-medkam', name: 'Bidang Medik & Keamanan', parent: null },
  {
    id: 'medik',
    name: 'Divisi Medik',
    short: 'Medik',
    parent: 'b-medkam',
    open: true,
    quota: 8,
  },
  {
    id: 'keamanan',
    name: 'Divisi Keamanan',
    short: 'Keamanan',
    parent: 'b-medkam',
    open: true,
    quota: 8,
  },
  { id: 'b-acara', name: 'Bidang Acara', parent: null },
  {
    id: 'seremonial',
    name: 'Divisi Seremonial',
    short: 'Seremonial',
    parent: 'b-acara',
    open: true,
    quota: 6,
  },
  {
    id: 'eo',
    name: 'Divisi Event Organizer',
    short: 'Event Organizer',
    parent: 'b-acara',
    open: true,
    quota: 10,
  },
  { id: 'b-ops', name: 'Bidang Operasional', parent: null },
  {
    id: 'logistik',
    name: 'Divisi Logistik',
    short: 'Logistik',
    parent: 'b-ops',
    open: true,
    quota: 8,
  },
  {
    id: 'akomtrans',
    name: 'Divisi Akomodasi & Transportasi',
    short: 'Akomtrans',
    parent: 'b-ops',
    open: true,
    quota: 6,
  },
  { id: 'b-media', name: 'Bidang Media', parent: null },
  {
    id: 'publikasi',
    name: 'Divisi Publikasi',
    short: 'Publikasi',
    parent: 'b-media',
    open: true,
    quota: 6,
  },
  {
    id: 'dokumentasi',
    name: 'Divisi Dokumentasi',
    short: 'Dokumentasi',
    parent: 'b-media',
    open: true,
    quota: 6,
  },
  { id: 'b-dana', name: 'Bidang Dana', parent: null },
  {
    id: 'bu',
    name: 'Divisi Business Unit',
    short: 'Business Unit',
    parent: 'b-dana',
    open: true,
    quota: 6,
  },
  {
    id: 'bendahara',
    name: 'Divisi Bendahara',
    short: 'Bendahara',
    parent: 'b-dana',
    open: false,
    quota: 2,
  },
  {
    id: 'sekjen',
    name: 'Kesekjenan',
    short: 'Kesekjenan',
    parent: null,
    open: true,
    quota: 4,
  },
];
const U = Object.fromEntries(UNITS.map((u) => [u.id, u]));
const OPEN = UNITS.filter((u) => u.open);
const unitGroups = (units = OPEN) =>
  UNITS.filter((u) => !u.parent)
    .map((bidang) => ({
      bidang,
      units: units.filter((u) => u.parent === bidang.id),
    }))
    .filter((group) => group.units.length);

/* Penilai tidak terikat jabatan: bisa Kadiv/Kabid, atau seluruhnya tim HR (misalnya untuk KAT).
   scope = "all" atau id satu divisi; general = ikut mengisi penilaian umum (HR Pusat). */
const SEED_REVIEWERS = [
  { id: 'r_raka', name: 'Raka', admin: true, scope: 'all', general: true },
  { id: 'r_nadia', name: 'Nadia', admin: false, scope: 'none', general: true },
  ...Object.entries({
    mentor: 'Bima',
    medik: 'Sekar',
    keamanan: 'Dimas',
    seremonial: 'Laras',
    eo: 'Yoga',
    logistik: 'Citra',
    akomtrans: 'Fajar',
    publikasi: 'Salsa',
    dokumentasi: 'Gilang',
    bu: 'Putri',
    sekjen: 'Hana',
  }).map(([u, name]) => ({
    id: 'k_' + u,
    name,
    admin: false,
    scope: u,
    general: false,
  })),
];
const scopeLabel = (scope) =>
  scope === 'all'
    ? 'semua divisi'
    : scope === 'none'
      ? 'umum'
      : (U[scope]?.name ?? 'divisi dihapus');
const roleLabel = (r) =>
  r.admin
    ? `${r.name} · Admin oprec`
    : `${r.name} · Penilai ${scopeLabel(r.scope)}`;
const reviewerName = (st, rid) =>
  st.reviewers.find((r) => r.id === rid)?.name ?? 'Penilai dihapus';
function roleOf(st, id) {
  const r = st.reviewers.find((x) => x.id === id) ?? st.reviewers[0];
  return {
    ...r,
    units:
      r.admin || r.scope === 'all'
        ? OPEN.map((u) => u.id)
        : r.scope === 'none'
          ? []
          : [r.scope],
  };
}
let __uid = 0;
const uid = (p) =>
  `${p}_${(++__uid).toString(36)}${Date.now().toString(36).slice(-4)}`;

/* Rubrik bisa diubah di Pengaturan, jadi disimpan di state (st.rubrics).
   kind = cara menilai (scale | boolean | enum | text)
   scoring = pengaruhnya ke skor (weighted | points | gate | none)
   src = jawaban formulir yang disorot saat kriteria ini dinilai */
const PORTO_OPTS = [
  { id: '0', label: 'Tidak ada', points: 0 },
  { id: '1', label: 'Ada', points: 2 },
  { id: '2', label: 'Kuat', points: 4 },
];
const SEED_RUBRICS = {
  umum: [
    {
      id: 'mot',
      label: 'Motivasi',
      kind: 'scale',
      min: 1,
      max: 5,
      scoring: 'weighted',
      weight: 2,
      src: 'mot',
    },
    {
      id: 'kom',
      label: 'Sanggup ikut seluruh rangkaian',
      kind: 'boolean',
      scoring: 'gate',
      points: 2,
      src: 'waktu',
    },
    {
      id: 'exp',
      label: 'Pengalaman kepanitiaan',
      kind: 'enum',
      scoring: 'points',
      src: 'exp',
      options: [
        { id: '0', label: 'Belum pernah', points: 0 },
        { id: '1', label: '1–2 kali', points: 2 },
        { id: '2', label: '3 kali atau lebih', points: 4 },
      ],
    },
    { id: 'cat', label: 'Catatan untuk tim', kind: 'text', scoring: 'none' },
  ],
  divisi: [
    {
      id: 'rel',
      label: 'Kecocokan jawaban dengan divisi',
      kind: 'scale',
      min: 1,
      max: 5,
      scoring: 'weighted',
      weight: 3,
      src: 'unit',
    },
    { id: 'ucat', label: 'Catatan untuk tim', kind: 'text', scoring: 'none' },
  ],
  extra: {
    publikasi: [
      {
        id: 'porto',
        label: 'Kualitas portofolio',
        kind: 'enum',
        scoring: 'points',
        src: 'unit',
        options: PORTO_OPTS,
      },
    ],
    dokumentasi: [
      {
        id: 'porto',
        label: 'Kualitas portofolio',
        kind: 'enum',
        scoring: 'points',
        src: 'unit',
        options: PORTO_OPTS,
      },
    ],
  },
};
const SOURCES = [
  { id: '', label: 'Tidak ada' },
  { id: 'mot', label: 'Motivasi mendaftar' },
  { id: 'exp', label: 'Pengalaman kepanitiaan' },
  { id: 'waktu', label: 'Ketersediaan waktu' },
  { id: 'unit', label: 'Pertanyaan khusus divisi' },
];
/* Rubrik divisi = kriteria untuk semua divisi + kriteria khusus divisi itu; catatan selalu di akhir. */
function rubricFor(st, kind, unit) {
  if (kind === 'A') return { criteria: st.rubrics.umum };
  const all = [...st.rubrics.divisi, ...(st.rubrics.extra[unit] || [])];
  return {
    criteria: [
      ...all.filter((c) => c.kind !== 'text'),
      ...all.filter((c) => c.kind === 'text'),
    ],
  };
}
const critMax = (c) => {
  if (c.scoring === 'weighted') return c.weight * c.max;
  if (c.scoring === 'points')
    return c.kind === 'boolean'
      ? c.points
      : Math.max(0, ...c.options.map((o) => o.points));
  return 0;
};
const critPts = (c, v) => {
  if (v == null || v === '') return 0;
  if (c.scoring === 'weighted') return c.weight * v;
  if (c.scoring === 'points')
    return c.kind === 'boolean'
      ? v
        ? c.points
        : 0
      : (c.options.find((o) => o.id === v)?.points ?? 0);
  return 0;
};
const rbMax = (rb) => rb.criteria.reduce((s, c) => s + critMax(c), 0);

const FIRST = [
  'Adit',
  'Alya',
  'Bagas',
  'Bunga',
  'Cahya',
  'Daffa',
  'Dewi',
  'Elang',
  'Farah',
  'Galih',
  'Hana',
  'Ilham',
  'Intan',
  'Jasmine',
  'Kevin',
  'Kirana',
  'Luthfi',
  'Maudy',
  'Naufal',
  'Nisa',
  'Oki',
  'Puspa',
  'Rafi',
  'Rania',
  'Satria',
  'Shafa',
  'Tegar',
  'Tiara',
  'Umar',
  'Vania',
  'Wira',
  'Yasmin',
  'Zidan',
  'Aurel',
  'Bintang',
  'Dinda',
  'Fikri',
  'Gita',
  'Hafiz',
  'Keisha',
];
const LAST = [
  'Pratama',
  'Wijaya',
  'Saputra',
  'Lestari',
  'Nugroho',
  'Hidayat',
  'Siregar',
  'Putri',
  'Santoso',
  'Rahman',
  'Kusuma',
  'Halim',
  'Gunawan',
  'Sitompul',
  'Wibowo',
  'Anggraini',
  'Prasetyo',
  'Simanjuntak',
  'Hakim',
  'Utami',
];
/* [kode prodi, nama prodi, fakultas]: nama mengikuti kode-program-studi.json. */
const PRODI = [
  ['135', 'Teknik Informatika', 'STEI'],
  ['182', 'Sistem dan Teknologi Informasi', 'STEI'],
  ['132', 'Teknik Elektro', 'STEI'],
  ['131', 'Teknik Mesin', 'FTMD'],
  ['136', 'Teknik Dirgantara', 'FTMD'],
  ['152', 'Arsitektur', 'SAPPK'],
  ['154', 'Perencanaan Wilayah dan Kota', 'SAPPK'],
  ['170', 'Seni Rupa', 'FSRD'],
  ['174', 'Desain Komunikasi Visual', 'FSRD'],
  ['175', 'Desain Produk', 'FSRD'],
  ['190', 'Manajemen', 'SBM'],
  ['192', 'Kewirausahaan', 'SBM'],
  ['101', 'Matematika', 'FMIPA'],
  ['105', 'Kimia', 'FMIPA'],
  ['150', 'Teknik Sipil', 'FTSL'],
  ['153', 'Teknik Lingkungan', 'FTSL'],
  ['134', 'Teknik Industri', 'FTI'],
  ['130', 'Teknik Kimia', 'FTI'],
  ['107', 'Sains dan Teknologi Farmasi', 'SF'],
  ['120', 'Teknik Geologi', 'FITB'],
  ['121', 'Teknik Pertambangan', 'FTTM'],
  ['106', 'Biologi', 'SITH'],
];
const FAKULTAS = [...new Set(PRODI.map((p) => p[2]))].sort();
const MOT = [
  'Waktu OSKM dulu aku ngerasa disambut banget, sekarang gantian aku yang mau nyambut maba.',
  'Mau belajar ngurus acara sebesar OSKM bareng temen-temen lintas jurusan.',
  'Pengen nyari ruang buat ngelatih kepemimpinan sebelum ambil peran di himpunan.',
  'Aku pengen kontribusi ke kampus di luar akademik, sekalian nambah relasi.',
  'Diajak temen satu unit, terus konsep tahun ini cocok sama minatku.',
  'Mau ngerasain kerja tim yang tenggatnya nyata dan dampaknya langsung kerasa ke maba.',
];
const EVENTS = [
  'OSKM ITB 2026',
  'Wisuda Juli 2026',
  'Pemilu Raya KM 2025',
  'Aku Masuk ITB 2026',
  'Pekan Seni 2025',
  'Dies Natalis Himpunan 2026',
];
const PAST = [
  'Mentor',
  'Staf Medik',
  'Staf Keamanan',
  'Staf Logistik',
  'Staf Publikasi',
  'Staf Dokumentasi',
  'Staf Event Organizer',
];
const NOTES = [
  'Jawaban motivasinya masih umum.',
  'Pernah jadi danlap, pertimbangkan Logistik.',
  'Sibuk di minggu UTS.',
  'Direkomendasikan Kadiv tahun lalu.',
  'Twibbon sempat bermasalah, sudah diperbaiki.',
];
/* Pertanyaan khusus divisi: beberapa per divisi, seperti di formulir oprec. qs[k] berpasangan dengan a[k]. */
const UQ = {
  mentor: {
    qs: [
      'Menurut kamu, apa itu mentor dan apa itu Sekolah Mentor?',
      'Apa motivasi kamu ingin menjadi mentor?',
      'Bagaimana kamu akan membagi waktu antara tanggung jawab sebagai mentor dengan kesibukan akademik/organisasi lainnya?',
    ],
    a: [
      [
        'Mentor itu kakak pendamping yang nemenin maba adaptasi; Sekolah Mentor tempat kami disiapin dulu.',
        'Mentor itu teman pertama maba di kampus. Sekolah Mentor bekal biar pendampingannya nggak asal.',
        'Pendamping kelompok selama OSKM; Sekolah Mentor pelatihannya sebelum hari H.',
      ],
      [
        'Dulu mentorku ngebantu banget, aku mau nerusin itu.',
        'Aku suka ngobrol dan dengerin cerita orang, kayaknya cocok.',
        'Mau belajar jadi pendamping yang sabar.',
      ],
      [
        'Pakai kalender bersama dan prioritas mingguan.',
        'Kurangi kegiatan unit selama masa OSKM.',
        'Kerjain tugas kuliah di awal minggu biar akhir pekan bisa fokus.',
      ],
    ],
  },
  medik: {
    qs: [
      'Apasih alasan kamu mau masuk Medik?',
      'Siap ngobatin maba-maba?',
      'Tuliskan 1 pantun terbaikmu!',
    ],
    a: [
      [
        'Aku anak SF, pengen praktekin ilmu P3K beneran.',
        'Pernah jadi tim medis acara jurusan, seru dan kepake banget.',
        'Mau belajar sigap waktu ada keadaan darurat.',
      ],
      [
        'Siap banget!',
        'Siap, udah ikut pelatihan P3K kemarin.',
        'Siap, asal jangan disuruh nyuntik hehe.',
      ],
      [
        'Jalan-jalan ke Kota Bandung, jangan lupa minum air ya nanti linglung.',
        'Beli cilok di depan gerbang, kalau pusing langsung ke posko tenang.',
        'Ada maba lari-lari, lecet dikit Medik siap di sini.',
      ],
    ],
  },
  keamanan: {
    qs: [
      'Kenapa kamu tertarik di Keamanan?',
      'Ceritakan pengalamanmu menjaga ketertiban di acara ramai.',
    ],
    a: [
      [
        'Suka mastiin semuanya berjalan aman dan teratur.',
        'Pengen belajar koordinasi lapangan.',
        'Pernah liat chaos di acara besar, mau bantu cegah itu.',
      ],
      [
        'Jadi koordinator antrean di acara himpunan.',
        'Belum pernah, tapi aku tenang di situasi ramai.',
        'Pernah bantu jaga parkir dan akses masuk Wisuda.',
      ],
    ],
  },
  seremonial: {
    qs: [
      'Rancang satu sesi pembuka OSKM dalam tiga kalimat.',
      'Pengalamanmu di acara formal atau upacara?',
    ],
    a: [
      [
        'Dibuka dengan penampilan unit seni, lalu sambutan singkat, ditutup video perjalanan panitia.',
        'Maba diajak hitung mundur bareng, lalu teaterikal pendek tentang tema tahun ini.',
        'Sesi dibuka dengan paduan suara, lalu pengumuman alur acara.',
      ],
      [
        'Pernah jadi MC wisuda himpunan.',
        'Petugas upacara waktu SMA.',
        'Belum pernah, tapi aku teliti soal rundown.',
      ],
    ],
  },
  eo: {
    qs: [
      'Kalau rundown molor 30 menit, apa yang kamu lakukan?',
      'Ceritakan acara yang pernah kamu urus dari awal sampai akhir.',
    ],
    a: [
      [
        'Koordinasi sama MC buat motong sesi yang paling fleksibel, terus info ke semua divisi.',
        'Cek dulu penyebabnya, siapin opsi geser sesi, lalu minta keputusan PJ.',
        'Pakai buffer yang udah disiapin dari awal.',
      ],
      [
        'Malam keakraban himpunan, 120 peserta.',
        'Lomba antarjurusan tingkat fakultas.',
        'Belum pernah, paling bantu-bantu acara unit.',
      ],
    ],
  },
  logistik: {
    qs: [
      'Ceritakan pengalamanmu mengurus peminjaman barang atau tempat.',
      'Gimana caramu memastikan barang yang dipinjam kembali utuh?',
    ],
    a: [
      [
        'Pernah ngurus peminjaman aula dan sound system lewat sarpras.',
        'Belum pernah, tapi terbiasa bikin daftar periksa barang.',
        'Pernah jadi danlap acara himpunan.',
      ],
      [
        'Daftar barang + foto sebelum dan sesudah.',
        'Satu PJ per barang dan cek saat pengembalian.',
        'Pakai spreadsheet stok yang diupdate tiap hari.',
      ],
    ],
  },
  akomtrans: {
    qs: [
      'Gimana kamu ngatur transportasi untuk ratusan peserta?',
      'Punya SIM atau pengalaman koordinasi kendaraan?',
    ],
    a: [
      [
        'Bagi per gelombang dan per titik kumpul, tiap bus ada PJ.',
        'Data peserta dikelompokkan per rute, konfirmasi H-1.',
        'Pakai jadwal keberangkatan bertahap biar nggak numpuk.',
      ],
      [
        'SIM A, biasa nyetir ke luar kota.',
        'Pernah koordinasi bus study tour.',
        'Belum, tapi siap belajar.',
      ],
    ],
  },
  publikasi: {
    qs: [
      'Bagaimana kamu menjaga konsistensi unggahan selama masa promosi?',
      'Lampirkan tautan portofolio dan jelaskan satu karya terbaikmu.',
    ],
    a: [
      [
        'Bikin kalender konten mingguan dan templat biar desain cepat.',
        'Bagi tugas copywriting dan desain dari awal, siapin stok konten dua minggu.',
        'Pantau insight lalu sesuaikan jam unggah.',
      ],
      [
        'Behance: identitas visual acara jurusan.',
        'Drive berisi poster dan feed Instagram unit.',
        'Belum rapi, tapi ada beberapa poster acara himpunan.',
      ],
    ],
  },
  dokumentasi: {
    qs: [
      'Peralatan dokumentasi apa yang kamu miliki atau kuasai?',
      'Lampirkan contoh foto atau video terbaikmu.',
    ],
    a: [
      [
        'Kamera mirrorless dan lensa 35 mm, terbiasa Lightroom.',
        'Cuma HP, tapi biasa nyunting video pendek.',
        'Bisa pakai kamera unit dan gimbal.',
      ],
      [
        'Video aftermovie acara himpunan.',
        'Foto panggung Pekan Seni.',
        'Belum ada yang dipublikasikan.',
      ],
    ],
  },
  bu: {
    qs: [
      'Kenapa nih tertarik banget buat join Divisi Business Unit? Coba ceritain dong motivasi terbesar kamu!',
      'Coba berikan strategi marketing atau ide konten promosi paling unik buat merchandise OSKM.',
      'Menurut kamu, seberapa aktif dan fast respond sih kamu?',
    ],
    a: [
      [
        'Udah jualan online dari SMA, pengen nyobain skala lebih besar.',
        'Pengen belajar ngatur stok dan cashflow beneran.',
        'Suka ketemu orang baru dan nawarin sesuatu.',
      ],
      [
        'Pre-order merch edisi terbatas dengan countdown di story.',
        'Kolaborasi sama UKM seni buat desain merch.',
        'Bundling merch dengan foto booth di hari H.',
      ],
      [
        'Bales chat maksimal sejam.',
        'Cukup aktif, notif grup selalu nyala.',
        'Fast respond kalau di luar jam kuliah.',
      ],
    ],
  },
  sekjen: {
    qs: [
      'Bagaimana kamu mengarsipkan dokumen agar mudah dicari?',
      'Pengalamanmu menulis notulensi rapat?',
    ],
    a: [
      [
        'Struktur folder per bidang dan nama berkas diawali tanggal.',
        'Indeks dokumen di spreadsheet dengan tautan.',
        'Templat surat dan penomoran yang konsisten.',
      ],
      [
        'Notulis rapat himpunan setahun.',
        'Pernah, pakai format poin keputusan dan PJ.',
        'Belum pernah, tapi aku rapi.',
      ],
    ],
  },
};
const GENERAL_Q = {
  mot: 'Apa motivasimu mendaftar OSKM?',
  exp: 'Pengalaman kepanitiaan sebelumnya',
  waktu:
    'Apakah kamu sanggup ikut seluruh rangkaian persiapan (rapat mingguan dan latihan)?',
};
const POP = {
  mentor: 10,
  eo: 7,
  publikasi: 6,
  dokumentasi: 5,
  seremonial: 4,
  medik: 3,
  keamanan: 3,
  logistik: 3,
  akomtrans: 2,
  bu: 3,
  sekjen: 1,
};
function wpick(ex) {
  const e = Object.keys(POP).filter((k) => !ex.includes(k));
  let r = R() * e.reduce((s, k) => s + POP[k], 0);
  for (const k of e) {
    r -= POP[k];
    if (r < 0) return k;
  }
  return e[e.length - 1];
}
function expText(l) {
  if (l === '0') return 'Belum pernah ikut kepanitiaan di ITB.';
  const n = l === '1' ? 1 + Math.floor(R() * 2) : 3;
  return (
    Array.from({ length: n }, () => `${pick(PAST)}, ${pick(EVENTS)}`).join(
      '; ',
    ) + '.'
  );
}

/* Periode pendaftaran, seperti data yang dibagi per hari di sheets. */
const PERIODS = [
  {
    id: '3.1',
    label: 'Periode 3.1',
    from: Date.UTC(2026, 10, 10, 1),
    days: 3,
    w: 0.45,
  },
  {
    id: '3.2',
    label: 'Periode 3.2',
    from: Date.UTC(2026, 10, 13, 1),
    days: 4,
    w: 0.35,
  },
  {
    id: '3.3',
    label: 'Periode 3.3',
    from: Date.UTC(2026, 10, 17, 1),
    days: 4,
    w: 0.2,
  },
];
/* Syarat umum sebelum penilaian: twibbon (dicek manual) dan nilai asesmen pra-lembaga (otomatis). */
const ASESMEN_MIN = 60;
const TWIBBON = {
  aman: 'Aman',
  bermasalah: 'Bermasalah',
  belum: 'Belum dicek',
};
const TWIBBON_NOTES = [
  'Caption belum lengkap',
  'Akun masih privat',
  'Belum tag akun OSKM',
];
const syaratOf = (app) =>
  app.twibbon === 'belum'
    ? 'belum'
    : app.twibbon === 'aman' && app.asesmen >= ASESMEN_MIN
      ? 'aman'
      : 'bermasalah';
const SYARAT = {
  aman: 'Syarat aman',
  bermasalah: 'Syarat bermasalah',
  belum: 'Belum dicek',
};
const fmtWaktu = (iso) => {
  const d = new Date(iso);
  const BLN = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];
  return `${d.getUTCDate()} ${BLN[d.getUTCMonth()]}, ${String((d.getUTCHours() + 7) % 24).padStart(2, '0')}.${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

const APPS = [];
const CHOICES = [];
for (let i = 0; i < 260; i++) {
  const pr = pick(PRODI),
    ang = R() < 0.5 ? 25 : R() < 0.7 ? 24 : 23,
    ab = (R() + R() + R()) / 3;
  const exp =
    ang <= 24
      ? R() < 0.6
        ? R() < 0.4
          ? '2'
          : '1'
        : '0'
      : R() < 0.35
        ? '1'
        : '0';
  const pr0 = R(),
    per =
      pr0 < PERIODS[0].w
        ? PERIODS[0]
        : pr0 < PERIODS[0].w + PERIODS[1].w
          ? PERIODS[1]
          : PERIODS[2];
  const tw = R(),
    twibbon = tw < 0.82 ? 'aman' : tw < 0.9 ? 'bermasalah' : 'belum';
  const app = {
    id: 'a' + i,
    code: 'P-' + (1001 + i),
    name: `${pick(FIRST)} ${pick(LAST)}`,
    nim: pr[0] + ang + String(100 + Math.floor(R() * 800)),
    prodi: pr[1],
    fak: pr[2],
    ang: 2000 + ang,
    a: ab,
    exp,
    choices: [],
    periode: per.id,
    at: new Date(per.from + R() * per.days * 864e5).toISOString(),
    twibbon,
    twibbonNote: twibbon === 'bermasalah' ? pick(TWIBBON_NOTES) : '',
    asesmen: clamp(Math.round(42 + ab * 52 + (R() - 0.5) * 18), 30, 100),
    pindah: R() < 0.7,
    ans: {
      mot: pick(MOT),
      exp: expText(exp),
      waktu:
        R() < 0.9 ? 'Ya, sanggup ikut semuanya.' : 'Hanya bisa di akhir pekan.',
      unit: {},
    },
  };
  const n = R() < 0.18 ? 1 : R() < 0.45 ? 2 : 3,
    chosen = [];
  for (let r = 1; r <= n; r++) {
    const u = wpick(chosen);
    chosen.push(u);
    const c = {
      id: `${app.id}-${u}`,
      app,
      unit: u,
      rank: r,
      fit: clamp(ab + (R() - 0.5) * 0.5, 0, 1),
    };
    app.ans.unit[u] = UQ[u].qs.map((_, k) => pick(UQ[u].a[k]));
    app.choices.push(c);
    CHOICES.push(c);
  }
  APPS.push(app);
}
const CH = Object.fromEntries(CHOICES.map((c) => [c.id, c]));
const DIRECT = [
  {
    name: 'Alya Pramesti',
    nim: '17424018',
    unit: 'publikasi',
    note: 'Desainer identitas visual tahun lalu',
  },
  {
    name: 'Daniel Tanoto',
    nim: '13524061',
    unit: 'dokumentasi',
    note: 'Videografer OSKM tahun lalu',
  },
  {
    name: 'Rizky Hutapea',
    nim: '19024077',
    unit: 'bendahara',
    note: 'Ditunjuk ketua',
  },
  {
    name: 'Salma Nurhaliza',
    nim: '19024102',
    unit: 'bendahara',
    note: 'Ditunjuk ketua',
  },
];
const directCount = (u) => DIRECT.filter((d) => d.unit === u).length;

/* =====================================================================
   SKOR & STATUS
   st.status[choiceId]  = hasil seleksi: passed | failed (kosong = belum diputuskan)
   st.dec[choiceId]     = keputusan akhir: offer | reserve | reject | released
   ===================================================================== */
/* Sebuah penilaian baru dihitung jika semua kriteria non-catatan sudah terisi dengan nilai yang
   valid untuk rubrik saat ini. Jadi menambah atau mengubah kriteria membuat penilaian lama
   "belum lengkap" sampai penilai melengkapinya, persis seperti di sistem sungguhan. */
function valueOk(c, v) {
  if (c.kind === 'text') return true;
  if (c.kind === 'scale')
    return typeof v === 'number' && v >= c.min && v <= c.max;
  if (c.kind === 'boolean') return v === true || v === false;
  return c.options.some((o) => o.id === v);
}
/* Skema penilaian:
   multi  = setiap bagian berkas boleh dinilai beberapa penilai; skor = rata-rata semuanya.
   single = admin oprec menugaskan tepat satu penilai per bagian (st.assign[tg]); hanya nilainya yang dipakai.
   Bagian berkas: "A:<pendaftar>" = penilaian umum, "C:<pilihan>" = penilaian divisi. */
function scoreOf(st, tg, unit) {
  const m = st.assess[tg];
  if (!m) return null;
  const rb = rubricFor(st, tg[0], unit),
    max = rbMax(rb);
  const rids =
    st.scheme === 'single'
      ? Object.keys(m).filter((rid) => rid === st.assign[tg])
      : Object.keys(m);
  const per = rids
    .filter((rid) => rb.criteria.every((c) => valueOk(c, m[rid][c.id])))
    .map((rid) => {
      const v = m[rid];
      const p = rb.criteria.reduce((s, c) => s + critPts(c, v[c.id]), 0);
      return {
        rid,
        pts: p,
        pct: max ? p / max : 0,
        gate: rb.criteria.some(
          (c) => c.scoring === 'gate' && v[c.id] === false,
        ),
      };
    });
  if (!per.length) return null;
  const pts = per.reduce((s, p) => s + p.pts, 0) / per.length;
  return {
    pts,
    max,
    pct: max ? pts / max : 0,
    gate: per.some((p) => p.gate),
    per,
  };
}
function berkasOf(st, c) {
  const tgA = 'A:' + c.app.id,
    tgC = 'C:' + c.id;
  const g = scoreOf(st, tgA, c.unit),
    u = scoreOf(st, tgC, c.unit);
  if (!g || !u)
    return {
      pct: null,
      partial: !!(g || u || st.assess[tgA] || st.assess[tgC]),
      gate: !!(g?.gate || u?.gate),
    };
  const max = g.max + u.max;
  return {
    pct: max ? (g.pts + u.pts) / max : 0,
    partial: false,
    gate: g.gate || u.gate,
  };
}
/* Keputusan menyimpan nilai saat diputuskan. Jika nilai berubah sesudahnya (nilai diedit,
   penilai lain menambah nilai, atau kriteria diubah), keputusan ditandai perlu ditinjau ulang. */
function driftOf(st, c) {
  const snap = st.snap[c.id];
  if (!snap || phaseOf(st, c) === 'released') return null;
  const b = berkasOf(st, c);
  if (b.pct == null)
    return {
      from: snap.pct,
      to: null,
      reason: 'Penilaiannya belum lengkap lagi sejak diputuskan',
    };
  if (Math.abs(b.pct - snap.pct) >= 0.005 || b.gate !== snap.gate) {
    return {
      from: snap.pct,
      to: b.pct,
      reason:
        b.gate !== snap.gate
          ? 'Status syarat wajib berubah sejak diputuskan'
          : 'Nilai berubah sejak diputuskan',
    };
  }
  return null;
}
const takeSnap = (st, c) => {
  const b = berkasOf(st, c);
  st.snap[c.id] = { pct: b.pct, gate: b.gate };
};
const isLocked = (st, c) => st.dec[c.id] === 'released';

function phaseOf(st, c) {
  const dec = st.dec[c.id];
  if (dec === 'released') return 'released';
  const s = st.status[c.id];
  if (s === 'failed') return 'failed';
  if (s === 'passed') return dec || 'passed';
  if (st.scheme === 'boolean') return 'scored';
  return berkasOf(st, c).pct != null ? 'scored' : 'unscored';
}
const PHASE = {
  unscored: {
    label: 'Belum dinilai',
    tone: 'neutral',
    hint: 'Nilai pendaftar ini terlebih dahulu.',
  },
  scored: {
    label: 'Sudah dinilai',
    tone: 'navy',
    hint: 'Nilai lengkap. Tentukan lolos atau tidak.',
  },
  failed: { label: 'Tidak lolos', tone: 'red' },
  passed: {
    label: 'Lolos',
    tone: 'teal',
    hint: 'Tentukan: ditempatkan, cadangan, atau tidak diterima.',
  },
  offer: { label: 'Ditempatkan', tone: 'navy-solid' },
  reserve: { label: 'Cadangan', tone: 'amber' },
  reject: { label: 'Tidak diterima', tone: 'red' },
  released: { label: 'Ditempatkan di divisi lain', tone: 'muted' },
};
const PHASE_ORDER = [
  'unscored',
  'scored',
  'failed',
  'passed',
  'offer',
  'reserve',
  'reject',
  'released',
];
const QUEUES = [
  { id: 'all', label: 'Semua' },
  { id: 'todo', label: 'Belum dinilai' },
  { id: 'lolos', label: 'Belum diloloskan' },
  { id: 'tempat', label: 'Belum ditempatkan' },
  { id: 'done', label: 'Sudah ditempatkan' },
];
const DONE_PHASES = ['failed', 'offer', 'reserve', 'reject', 'released'];

/* Aksi yang boleh dilakukan pada sebuah pilihan pendaftar. */
function canApply(st, c, act) {
  if (isLocked(st, c)) return false;
  const s = st.status[c.id],
    d = st.dec[c.id];
  const scored = berkasOf(st, c).pct != null;
  switch (act) {
    /* Lolos/tidak lolos berkas hanya bisa diputuskan setelah penilaiannya lengkap. */
    case 'pass':
      return (st.scheme === 'boolean' || scored) && s !== 'passed';
    case 'fail':
      return (st.scheme === 'boolean' || scored) && s !== 'failed';
    case 'reset':
      return s === 'passed' || s === 'failed';
    case 'offer':
    case 'reserve':
    case 'reject':
      return (
        s === 'passed' &&
        d !== act &&
        c.rank === placementPeriod(st, c.unit) &&
        !hasPlacement(st, c.app)
      );
    case 'undecide':
      return s === 'passed' && !!d;
    case 'ack':
      return !!driftOf(st, c) && scored;
    default:
      return false;
  }
}
function applyAct(st, c, act) {
  if (act === 'pass') st.status[c.id] = 'passed';
  else if (act === 'fail') {
    st.status[c.id] = 'failed';
    delete st.dec[c.id];
  } else if (act === 'reset') {
    delete st.status[c.id];
    delete st.dec[c.id];
    delete st.snap[c.id];
    return;
  } else if (act === 'undecide') delete st.dec[c.id];
  else if (act === 'offer') {
    st.dec[c.id] = act;
    c.app.choices.forEach((other) => {
      if (other !== c) st.dec[other.id] = 'released';
    });
  } else if (act !== 'ack') st.dec[c.id] = act;
  takeSnap(st, c);
}
const ACT_LABEL = {
  pass: 'Loloskan',
  fail: 'Gugurkan',
  reset: 'Kembalikan ke penilaian',
  offer: 'Tempatkan',
  reserve: 'Jadikan cadangan',
  reject: 'Tidak diterima',
  undecide: 'Batalkan hasil',
  ack: 'Pertahankan hasil',
};
const ACT_DONE = {
  pass: 'diloloskan',
  fail: 'digugurkan',
  reset: 'dikembalikan ke penilaian',
  offer: 'ditempatkan',
  reserve: 'dijadikan cadangan',
  reject: 'ditandai tidak diterima',
  undecide: 'dibatalkan hasilnya',
  ack: 'hasilnya dipertahankan',
};

/* ---------- visibilitas ---------- */
const tgA = (c) => 'A:' + c.app.id;
const tgC = (c) => 'C:' + c.id;
/* Siapa yang memenuhi syarat menilai sebuah bagian: penilaian umum untuk penilai umum,
   penilaian divisi untuk penilai yang cakupannya mencakup divisi itu. Dipakai juga sebagai
   daftar pilihan saat admin menugaskan penilai. */
const eligibleFor = (st, tg, unit) =>
  st.reviewers.filter((r) =>
    tg[0] === 'A'
      ? r.admin || r.general
      : r.admin || r.scope === 'all' || r.scope === unit,
  );
const isAssignedTo = (st, role, c) =>
  st.scheme === 'single' &&
  (st.assign[tgA(c)] === role.id || st.assign[tgC(c)] === role.id);

/* Penilai umum perlu melihat semua pendaftar untuk mengisi penilaian umum; pada skema satu
   penilai, penilai juga selalu melihat berkas yang ditugaskan kepadanya. */
const canSee = (st, role, c) =>
  role.admin ||
  role.general ||
  st.preset === 'open' ||
  role.units.includes(c.unit) ||
  isAssignedTo(st, role, c);
/* Hak memutuskan mengikuti cakupan divisi, bukan penugasan penilaian. */
const canEdit = (role, c) => role.admin || role.units.includes(c.unit);
/* Hak mengisi penilaian: skema multi mengikuti cakupan; skema single hanya penilai yang ditugaskan
   (admin tetap bisa mengisi sebagai cadangan, tetapi nilainya baru dipakai jika ia yang ditugaskan). */
function canAssess(st, role, tg, c) {
  if (st.scheme === 'single') return st.assign[tg] === role.id;
  return tg[0] === 'A' ? role.admin || role.general : canEdit(role, c);
}
const showRank = (st, role) =>
  role.admin || st.preset === 'open' || !st.hideRank;
const isMasked = (st, role) => !role.admin && st.preset === 'blind' && st.blind;
const showOthers = (st, role, tg) =>
  role.admin ||
  st.preset === 'open' ||
  !st.hideOthers ||
  !!st.assess[tg]?.[role.id];
/* "Perlu dinilai" = bagian yang menjadi tugasnya belum punya penilaian lengkap yang dipakai.
   Skema multi: cukup satu penilai per bagian. Skema single: yang ditugaskan kepadanya. Admin
   melihat semua yang belum lengkap, termasuk yang belum ditugaskan ke siapa pun. Definisi ini
   sama dengan status "Belum dinilai" di tab Pendaftar. */
function needsMine(st, role, c) {
  if (st.scheme === 'boolean') return false;
  const missA = !scoreOf(st, tgA(c), c.unit),
    missC = !scoreOf(st, tgC(c), c.unit);
  if (role.admin) return missA || missC;
  return (
    (canAssess(st, role, tgA(c), c) && missA) ||
    (canAssess(st, role, tgC(c), c) && missC)
  );
}

/* ---------- penempatan ---------- */
const hasPlacement = (st, app) =>
  app.choices.some((c) => st.dec[c.id] === 'offer');
const placementPeriod = (st, uid) => st.placement?.[uid] || 1;
const periodLabel = (period) =>
  period === 'reserve' ? 'Cadangan' : `Pilihan ${period}`;
function placementQueue(st, uid, period = placementPeriod(st, uid)) {
  if (period === 'reserve')
    return CHOICES.filter(
      (c) =>
        c.unit === uid &&
        c.rank <= 3 &&
        st.dec[c.id] === 'reserve' &&
        !hasPlacement(st, c.app),
    );
  return CHOICES.filter(
    (c) =>
      c.unit === uid &&
      c.rank === period &&
      st.status[c.id] === 'passed' &&
      !st.dec[c.id] &&
      !hasPlacement(st, c.app),
  );
}
function periodComplete(st, uid, period) {
  if (period === 'reserve') return placementQueue(st, uid, period).length === 0;
  return CHOICES.filter((c) => c.unit === uid && c.rank === period).every(
    (c) =>
      hasPlacement(st, c.app) || st.status[c.id] === 'failed' || !!st.dec[c.id],
  );
}
function nextPlacementPeriod(st, uid) {
  const current = placementPeriod(st, uid);
  if (!periodComplete(st, uid, current)) return null;
  if (current === 'reserve') return null;
  return current < 3 ? current + 1 : 'reserve';
}
function unitStats(st, u) {
  const cs = CHOICES.filter((c) => c.unit === u.id);
  const placed = cs.filter((c) => st.dec[c.id] === 'offer');
  const reserve = cs
    .filter(
      (c) =>
        st.dec[c.id] === 'reserve' &&
        !placed.some((p) => p.app.id === c.app.id),
    )
    .sort((a, b) => (berkasOf(st, b).pct || 0) - (berkasOf(st, a).pct || 0));
  const direct = directCount(u.id);
  const quota = st.quota[u.id];
  return {
    quota,
    direct,
    placed,
    reserve,
    open: quota - direct - placed.length,
    period: placementPeriod(st, u.id),
  };
}

/* ---------- state awal ---------- */
/* Potret kondisi hari ini: lima divisi sudah selesai menilai dan menentukan hasil.
   Tiga divisi lainnya masih di tengah penilaian. */
const DECIDED_UNITS = ['mentor', 'medik', 'eo', 'publikasi', 'dokumentasi'];
const seedDone = (c) => DECIDED_UNITS.includes(c.unit);
function seed() {
  const assess = {};
  APPS.forEach((app, i) => {
    const inDecided = app.choices.some(seedDone);
    if (R() < 0.85 || inDecided) {
      const rid = i % 2 ? 'r_nadia' : 'r_raka',
        bias = rid === 'r_nadia' ? 0.8 : 0;
      assess['A:' + app.id] = {
        [rid]: {
          mot: clamp(
            Math.round(1 + app.a * 4 + (R() - 0.5) * 1.4 + bias),
            1,
            5,
          ),
          kom: app.ans.waktu.startsWith('Ya'),
          exp: app.exp,
          cat: R() < 0.15 ? pick(NOTES) : '',
        },
      };
    }
    app.choices.forEach((c) => {
      if (R() < 0.75 || seedDone(c)) {
        const v = {
          rel: clamp(Math.round(1 + c.fit * 4 + (R() - 0.5) * 1.3), 1, 5),
        };
        if (SEED_RUBRICS.extra[c.unit])
          v.porto = c.fit > 0.62 ? '2' : c.fit > 0.4 ? '1' : '0';
        assess['C:' + c.id] = { ['k_' + c.unit]: v };
      }
    });
  });
  /* Penugasan awal mencerminkan siapa yang memang menilai di data contoh: penilaian umum dibagi
     Raka dan Nadia, penilaian divisi oleh penilai divisinya. Dipakai saat skema "satu penilai". */
  const assign = {};
  APPS.forEach((app, i) => {
    assign['A:' + app.id] =
      Object.keys(assess['A:' + app.id] || {})[0] ||
      (i % 2 ? 'r_nadia' : 'r_raka');
    app.choices.forEach((c) => {
      assign['C:' + c.id] = 'k_' + c.unit;
    });
  });
  const st = {
    assess,
    assign,
    status: {},
    dec: {},
    snap: {},
    log: [],
    quota: Object.fromEntries(UNITS.map((u) => [u.id, u.quota])),
    placement: Object.fromEntries(
      OPEN.map((u) => [u.id, DECIDED_UNITS.includes(u.id) ? 2 : 1]),
    ),
    preset: 'per_unit',
    blind: true,
    hideRank: true,
    hideOthers: true,
    minChoices: 1,
    maxChoices: 3,
    scheme: 'multi',
    reviewers: SEED_REVIEWERS,
    rubrics: SEED_RUBRICS,
    lampiran: [
      {
        id: 'twibbon',
        label: 'Twibbon',
        kind: 'link',
        required: false,
        visible: true,
      },
      {
        id: 'portofolio',
        label: 'Portofolio',
        kind: 'link',
        required: false,
        visible: true,
      },
      {
        id: 'asesmen',
        label: 'Nilai asesmen',
        kind: 'number',
        required: false,
        visible: true,
      },
    ],
  };
  CHOICES.forEach((c) => {
    const b = berkasOf(st, c);
    if (b.pct != null && seedDone(c))
      applyAct(st, c, b.pct >= 0.55 && !b.gate ? 'pass' : 'fail');
  });
  DECIDED_UNITS.forEach((u) => {
    const el = CHOICES.filter(
      (c) => c.unit === u && c.rank === 1 && st.status[c.id] === 'passed',
    ).sort((a, b) => berkasOf(st, b).pct - berkasOf(st, a).pct);
    const avail = st.quota[u] - directCount(u);
    el.forEach((c, k) =>
      applyAct(
        st,
        c,
        k < avail ? 'offer' : k < avail + 3 ? 'reserve' : 'reject',
      ),
    );
  });
  st.log.push(
    `Seleksi di Divisi ${DECIDED_UNITS.map((u) => U[u].short)
      .join(', ')
      .replace(
        /, ([^,]*)$/,
        ' dan $1',
      )} selesai; hasil disusun berdasarkan skor.`,
  );
  return st;
}
/* Rubrik dan daftar penilai diganti utuh lewat structuredClone saat diedit, jadi cukup disalin dangkal di sini. */
const cloneSt = (s) => ({
  ...s,
  assign: { ...s.assign },
  status: { ...s.status },
  dec: { ...s.dec },
  snap: { ...s.snap },
  quota: { ...s.quota },
  placement: { ...s.placement },
  log: [...s.log],
  lampiran: s.lampiran.map((l) => ({ ...l })),
});

/* Bagian berkas yang penugasannya kosong atau menunjuk penilai yang sudah dihapus/tidak memenuhi syarat. */
const ALL_TGS = [
  ...APPS.map((a) => ['A:' + a.id, null]),
  ...CHOICES.map((c) => ['C:' + c.id, c.unit]),
];
function unassignedTgs(st) {
  return ALL_TGS.filter(
    ([tg, unit]) =>
      !eligibleFor(st, tg, unit).some((r) => r.id === st.assign[tg]),
  );
}
/* Bagi rata: tiap bagian kosong diberikan ke penilai yang memenuhi syarat dengan beban paling
   sedikit. Admin hanya dipakai jika tidak ada penilai lain. */
function autoAssign(st) {
  const load = {};
  ALL_TGS.forEach(([tg]) => {
    const r = st.assign[tg];
    if (r) load[r] = (load[r] || 0) + 1;
  });
  let n = 0;
  unassignedTgs(st).forEach(([tg, unit]) => {
    const pool = eligibleFor(st, tg, unit);
    const cands = pool.some((r) => !r.admin)
      ? pool.filter((r) => !r.admin)
      : pool;
    if (!cands.length) return;
    const r = cands.reduce((a, b) =>
      (load[b.id] || 0) < (load[a.id] || 0) ? b : a,
    );
    st.assign[tg] = r.id;
    load[r.id] = (load[r.id] || 0) + 1;
    n++;
  });
  return n;
}

/* readyRank = urutan pilihan tertinggi yang semua pendaftarnya (urutan itu dan sebelumnya) sudah
   dinilai dan diputuskan. ready = semua urutan selesai. */
function unitProgress(st, uid) {
  const cs = CHOICES.filter((c) => c.unit === uid);
  const pending = (c) => ['unscored', 'scored'].includes(phaseOf(st, c));
  let readyRank = 0;
  for (let r = 1; r <= 3; r++) {
    if (cs.some((c) => c.rank === r && pending(c))) break;
    readyRank = r;
  }
  const unscored = cs.filter((c) => phaseOf(st, c) === 'unscored').length;
  const undecided = cs.filter((c) => phaseOf(st, c) === 'scored').length;
  const drift = cs.filter((c) => driftOf(st, c)).length;
  const unassigned =
    st.scheme === 'single'
      ? cs.filter(
          (c) =>
            phaseOf(st, c) === 'unscored' &&
            [tgA(c), tgC(c)].some(
              (tg) =>
                !eligibleFor(st, tg, c.unit).some(
                  (r) => r.id === st.assign[tg],
                ),
            ),
        ).length
      : 0;
  return {
    total: cs.length,
    unscored,
    undecided,
    drift,
    unassigned,
    readyRank,
    ready: unscored + undecided === 0,
  };
}

/* =====================================================================
   KOMPONEN DASAR
   ===================================================================== */
const ICONS = {
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  filter: (
    <>
      <path d="M3 6h18" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  chevDown: <path d="m6 9 6 6 6-6" />,
  chevLeft: <path d="m15 18-6-6 6-6" />,
  chevRight: <path d="m9 18 6-6-6-6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  clipboard: (
    <>
      <rect width="8" height="4" x="8" y="2" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),
  userCheck: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m16 11 2 2 4-4" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  sliders: (
    <>
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </>
  ),
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>
  ),
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  send: (
    <>
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </>
  ),
  home: (
    <>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  calendar: (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  mail: (
    <>
      <path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z" />
      <path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" />
    </>
  ),
  circleCheck: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  arrowUp: (
    <>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </>
  ),
  plus: (
    <>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
    </>
  ),
};
function Icon({ name, size = 16, className = '' }) {
  return (
    <svg
      className={'om-ico ' + className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/* Popover berposisi fixed supaya tidak terpotong oleh wadah tabel yang bisa digulir. */
function Popover({
  anchorRef,
  open,
  onClose,
  width = 240,
  align = 'start',
  children,
  label,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return undefined;
    }
    /* Dihitung ulang saat isi popover berubah ukuran, supaya tetap muat di layar dan tidak menimpa pemicunya. */
    const place = () => {
      const r = anchorRef.current.getBoundingClientRect();
      let left = align === 'end' ? r.right - width : r.left;
      left = clamp(left, 8, window.innerWidth - width - 8);
      const h = ref.current ? ref.current.offsetHeight : 0;
      let top = r.bottom + 6;
      if (h && top + h > window.innerHeight - 8 && r.top - h - 6 > 8)
        top = r.top - h - 6;
      setPos({ top, left });
    };
    place();
    const ro =
      typeof ResizeObserver !== 'undefined' && ref.current
        ? new ResizeObserver(place)
        : null;
    ro?.observe(ref.current);
    return () => ro?.disconnect();
  }, [open, width, align, anchorRef]);
  useEffect(() => {
    if (!open) return undefined;
    const first = ref.current?.querySelector(
      'button:not(:disabled),input,select',
    );
    first?.focus({ preventScroll: true });
    const onDown = (e) => {
      if (
        !ref.current?.contains(e.target) &&
        !anchorRef.current?.contains(e.target)
      )
        onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        anchorRef.current?.focus();
      }
    };
    const onScroll = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose, anchorRef]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className="om-pop"
      role="dialog"
      aria-label={label}
      style={{ width, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
    >
      {children}
    </div>
  );
}

function MenuButton({
  className,
  items,
  onSelect,
  label,
  children,
  align = 'start',
  width = 240,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  const onKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const btns = [...e.currentTarget.querySelectorAll('[role=menuitem]')];
    const i = btns.indexOf(document.activeElement);
    btns[
      (i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length
    ]?.focus();
  };
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      <Popover
        anchorRef={ref}
        open={open}
        onClose={close}
        align={align}
        width={width}
        label={label}
      >
        <div role="menu" className="om-menu" onKeyDown={onKey}>
          {items.map((it, i) =>
            it.sep ? (
              <div key={i} className="om-menu-sep" role="separator" />
            ) : it.note ? (
              <p key={i} className="om-menu-note">
                {it.note}
              </p>
            ) : (
              <button
                key={it.id}
                type="button"
                role="menuitem"
                className={'om-menu-item' + (it.danger ? ' danger' : '')}
                onClick={() => {
                  setOpen(false);
                  onSelect(it.id);
                }}
              >
                {it.icon && <Icon name={it.icon} />}
                <span>{it.label}</span>
              </button>
            ),
          )}
        </div>
      </Popover>
    </>
  );
}

function Switch({ checked, onChange, disabled, label, description }) {
  return (
    <label className={'om-switch-row' + (disabled ? ' is-disabled' : '')}>
      <span className="om-switch-text">
        <span>{label}</span>
        {description && <small>{description}</small>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="om-switch"
        onClick={() => onChange(!checked)}
      >
        <i />
      </button>
    </label>
  );
}

function Pill({ phase, children }) {
  const m = PHASE[phase];
  return <span className={'om-pill t-' + m.tone}>{children ?? m.label}</span>;
}

function Avatar({ name, masked }) {
  return (
    <span
      className={'om-avatar' + (masked ? ' masked' : '')}
      aria-hidden="true"
    >
      {masked ? <Icon name="eyeOff" size={14} /> : initials(name)}
    </span>
  );
}

function Notice({ icon = 'info', tone = 'navy', children, action }) {
  return (
    <div className={'om-notice t-' + tone} role="note">
      <Icon name={icon} size={16} />
      <div className="om-notice-body">{children}</div>
      {action}
    </div>
  );
}

function Pagination({ total, page, pageSize, onPageChange, onPageSizeChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? page * pageSize + 1 : 0;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="om-pagination" aria-label="Paginasi tabel">
      <span className="om-dim om-small">
        {from}–{to} dari {total}
      </span>
      <label className="om-inline">
        <span>Baris</span>
        <select
          className="om-select sm"
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(0);
          }}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="om-icon-btn sm"
        aria-label="Halaman sebelumnya"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        <Icon name="chevLeft" size={15} />
      </button>
      <span className="om-num om-small">
        {page + 1}/{pages}
      </span>
      <button
        type="button"
        className="om-icon-btn sm"
        aria-label="Halaman berikutnya"
        disabled={page >= pages - 1}
        onClick={() => onPageChange(page + 1)}
      >
        <Icon name="chevRight" size={15} />
      </button>
    </div>
  );
}

function ScoreBar({ b }) {
  if (b.pct == null)
    return <span className="om-dim">{b.partial ? 'Belum lengkap' : '—'}</span>;
  return (
    <span className="om-score">
      <span className="om-score-track">
        <i style={{ width: `${Math.round(b.pct * 100)}%` }} />
      </span>
      <span className="om-num">{pct(b.pct)}</span>
    </span>
  );
}

/* =====================================================================
   TAB: PENDAFTAR
   ===================================================================== */
/* Skema satu penilai: lihat & ubah siapa yang menilai baris ini (bagian divisi dan bagian umum). */
function AssignCell({ st, c, reassign }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  const who = (tg, unit) => {
    const rid = st.assign[tg];
    return eligibleFor(st, tg, unit).some((r) => r.id === rid)
      ? reviewerName(st, rid) || 'Penilai baru'
      : null;
  };
  const parts = [
    [tgC(c), `Penilaian ${U[c.unit].name}`, c.unit],
    [tgA(c), 'Penilaian umum', null],
  ];
  const cName = who(tgC(c), c.unit),
    aName = who(tgA(c), null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className="om-assign-btn"
        aria-expanded={open}
        aria-label={`Penilai untuk ${c.app.code}: ${cName ?? 'belum ditugaskan'}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cName ? '' : 'om-unassigned'}>
          {cName ?? 'Belum ditugaskan'}
        </span>
        <small className={aName ? '' : 'om-unassigned'}>
          Umum: {aName ?? 'belum ditugaskan'}
        </small>
      </button>
      <Popover
        anchorRef={ref}
        open={open}
        onClose={close}
        width={290}
        align="end"
        label="Penugasan penilai"
      >
        <div className="om-filter">
          {parts.map(([tg, label, unit]) => {
            const cur = who(tg, unit) ? st.assign[tg] : '';
            return (
              <label key={tg} className="om-field">
                <span>{label}</span>
                <select
                  className="om-select sm"
                  value={cur}
                  onChange={(e) => reassign([[tg]], e.target.value)}
                >
                  {!cur && <option value="">Pilih penilai…</option>}
                  {eligibleFor(st, tg, unit).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || 'Penilai baru'}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
          <p className="om-small om-dim">
            Penilaian umum berlaku untuk semua pilihan divisi pendaftar ini.
          </p>
        </div>
      </Popover>
    </>
  );
}

function BulkAssign({ st, selected, reassign, onDone }) {
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState('C');
  const [rid, setRid] = useState('');
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  const tgOf = (c) => (part === 'A' ? tgA(c) : tgC(c));
  const okFor = (c, id) =>
    eligibleFor(st, tgOf(c), c.unit).some((r) => r.id === id);
  const pool = st.reviewers.filter((r) => selected.some((c) => okFor(c, r.id)));
  const targets = rid ? selected.filter((c) => okFor(c, rid)) : [];
  const tgs = [...new Set(targets.map(tgOf))].map((t) => [t]);
  useEffect(() => {
    if (rid && !pool.some((r) => r.id === rid)) setRid('');
  }, [part]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <button
        ref={ref}
        type="button"
        className="om-btn sm outline-light"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Tugaskan penilai
      </button>
      <Popover
        anchorRef={ref}
        open={open}
        onClose={close}
        width={300}
        label="Tugaskan penilai"
      >
        <div className="om-filter">
          <div className="om-field">
            <span>Bagian yang ditugaskan</span>
            <div className="om-seg" role="radiogroup">
              {[
                ['C', 'Penilaian divisi'],
                ['A', 'Penilaian umum'],
              ].map(([id, l]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={part === id}
                  className={part === id ? 'on' : ''}
                  onClick={() => setPart(id)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <label className="om-field">
            <span>Penilai</span>
            <select
              className="om-select sm"
              value={rid}
              onChange={(e) => setRid(e.target.value)}
            >
              <option value="">Pilih penilai…</option>
              {pool.map((r) => (
                <option key={r.id} value={r.id}>
                  {roleLabel({ ...r, name: r.name || 'Penilai baru' })}
                </option>
              ))}
            </select>
          </label>
          {rid && (
            <p className="om-small om-dim">
              Berlaku untuk {targets.length} dari {selected.length} baris
              {targets.length < selected.length
                ? '; sisanya di luar cakupan penilai ini'
                : ''}
              .
            </p>
          )}
          <div className="om-filter-foot">
            <button type="button" className="om-btn ghost sm" onClick={close}>
              Batal
            </button>
            <button
              type="button"
              className="om-btn sm"
              disabled={!tgs.length}
              onClick={() => {
                reassign(tgs, rid);
                close();
                onDone();
              }}
            >
              Tugaskan
            </button>
          </div>
        </div>
      </Popover>
    </>
  );
}

function PendaftarView({
  st,
  role,
  rows,
  counts,
  filters,
  setFilters,
  sort,
  setSort,
  openNilai,
  act,
  bulkAct,
  reassign,
  visUnits,
  toast,
}) {
  const assignCol = st.scheme === 'single' && role.admin;
  const [sel, setSel] = useState({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtn = useRef(null);
  const masked = isMasked(st, role);
  const rankVisible = showRank(st, role);
  const shown = rows.slice(page * pageSize, (page + 1) * pageSize);
  const selIds = Object.keys(sel).filter((id) => sel[id]);
  const selected = selIds.map((id) => CH[id]).filter(Boolean);

  useEffect(() => {
    setPage(0);
  }, [filters]);
  useEffect(() => {
    setSel({});
  }, [role.id, st.preset]);

  const activeFilterCount =
    (filters.unit ? 1 : 0) + filters.phases.length + (filters.gate ? 1 : 0);
  const clearFilters = () =>
    setFilters((f) => ({ ...f, unit: '', phases: [], gate: false }));
  const allChecked = shown.length > 0 && shown.every((r) => sel[r.c.id]);
  const someChecked = !allChecked && shown.some((r) => sel[r.c.id]);
  const toggleAll = () => {
    if (allChecked) setSel({});
    else setSel(Object.fromEntries(shown.map((r) => [r.c.id, true])));
  };

  const bulkOptions = ['pass', 'fail', 'offer', 'reserve', 'reject', 'ack']
    .map((a) => ({
      a,
      n: selected.filter((c) => canEdit(role, c) && canApply(st, c, a)).length,
    }))
    .filter((o) => o.n > 0);

  const sortHead = (key, label, cls = '') => {
    const on = sort.key === key;
    return (
      <th
        className={cls}
        aria-sort={on ? (sort.dir < 0 ? 'descending' : 'ascending') : 'none'}
      >
        <button
          type="button"
          className="om-th-btn"
          onClick={() =>
            setSort((s) =>
              s.key === key
                ? { key, dir: -s.dir }
                : { key, dir: key === 'score' ? -1 : 1 },
            )
          }
        >
          {label}
          {on && (
            <Icon name={sort.dir < 0 ? 'arrowDown' : 'arrowUp'} size={13} />
          )}
        </button>
      </th>
    );
  };

  const exportCsv = () => {
    const head = ['kode', 'nama', 'nim', 'pilihan']
      .concat(rankVisible ? ['urutan_pilihan'] : [])
      .concat(['skor_berkas', 'status']);
    const esc = (x) => {
      const s = String(x ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [head.join(',')].concat(
      rows.map((r) => {
        const c = r.c;
        return [
          c.app.code,
          masked ? '' : c.app.name,
          masked ? '' : c.app.nim,
          U[c.unit].name,
        ]
          .concat(rankVisible ? [c.rank] : [])
          .concat([pct(r.b.pct), PHASE[r.phase].label])
          .map(esc)
          .join(',');
      }),
    );
    try {
      const blob = new Blob(['﻿' + lines.join('\n')], {
        type: 'text/csv;charset=utf-8',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'oprec-oskm-itb-2027.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast(`${rows.length} baris diekspor ke CSV`);
    } catch {
      toast('Browser menolak unduhan. Coba lagi dari tab baru.');
    }
  };

  const runBulk = (a) => {
    bulkAct(selected, a);
    setSel({});
  };

  return (
    <div className="om-stack">
      <div className="om-queue" role="tablist" aria-label="Antrean">
        {QUEUES.map((q) => (
          <button
            key={q.id}
            type="button"
            role="tab"
            aria-selected={filters.queue === q.id}
            className={'om-queue-btn' + (filters.queue === q.id ? ' on' : '')}
            onClick={() => setFilters((f) => ({ ...f, queue: q.id }))}
          >
            {q.label}
            <span className="om-count">{counts[q.id]}</span>
          </button>
        ))}
      </div>

      <div className="om-toolbar">
        <label className="om-search">
          <Icon name="search" />
          <input
            type="search"
            placeholder={
              masked
                ? 'Cari kode pendaftar, mis. P-1042'
                : 'Cari nama, NIM, atau kode pendaftar'
            }
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </label>
        <button
          ref={filterBtn}
          type="button"
          className={'om-btn outline' + (activeFilterCount ? ' has-count' : '')}
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((o) => !o)}
        >
          <Icon name="filter" />
          Filter
          {activeFilterCount > 0 && (
            <span className="om-badge">{activeFilterCount}</span>
          )}
        </button>
        <button type="button" className="om-btn outline" onClick={exportCsv}>
          <Icon name="download" />
          Ekspor CSV
        </button>
        <Popover
          anchorRef={filterBtn}
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          width={300}
          align="end"
          label="Filter pendaftar"
        >
          <div className="om-filter">
            <fieldset>
              <legend>Pilihan divisi</legend>
              <select
                className="om-select"
                value={filters.unit}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, unit: e.target.value }))
                }
              >
                <option value="">Semua divisi</option>
                {visUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </fieldset>
            <fieldset>
              <legend>Status</legend>
              <div className="om-check-grid">
                {PHASE_ORDER.map((p) => (
                  <label key={p} className="om-check">
                    <input
                      type="checkbox"
                      checked={filters.phases.includes(p)}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          phases: e.target.checked
                            ? [...f.phases, p]
                            : f.phases.filter((x) => x !== p),
                        }))
                      }
                    />
                    <span>{PHASE[p].label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="om-check">
              <input
                type="checkbox"
                checked={filters.gate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, gate: e.target.checked }))
                }
              />
              <span>Hanya yang tidak memenuhi syarat wajib</span>
            </label>
            <div className="om-filter-foot">
              <button
                type="button"
                className="om-btn ghost sm"
                onClick={clearFilters}
                disabled={!activeFilterCount}
              >
                Hapus filter
              </button>
              <button
                type="button"
                className="om-btn sm"
                onClick={() => setFilterOpen(false)}
              >
                Selesai
              </button>
            </div>
          </div>
        </Popover>
      </div>

      {activeFilterCount > 0 && (
        <div className="om-chips">
          {filters.unit && (
            <button
              type="button"
              className="om-chip"
              onClick={() => setFilters((f) => ({ ...f, unit: '' }))}
            >
              {U[filters.unit].name}
              <Icon name="x" size={12} />
            </button>
          )}
          {filters.phases.map((p) => (
            <button
              key={p}
              type="button"
              className="om-chip"
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  phases: f.phases.filter((x) => x !== p),
                }))
              }
            >
              {PHASE[p].label}
              <Icon name="x" size={12} />
            </button>
          ))}
          {filters.gate && (
            <button
              type="button"
              className="om-chip"
              onClick={() => setFilters((f) => ({ ...f, gate: false }))}
            >
              Tidak memenuhi syarat wajib
              <Icon name="x" size={12} />
            </button>
          )}
          <button type="button" className="om-link" onClick={clearFilters}>
            Hapus semua
          </button>
        </div>
      )}

      {filters.queue === 'lolos' && counts.lolos > 0 && (
        <Notice icon="info">
          <strong>{counts.lolos} pilihan belum diloloskan:</strong>
          <ul className="om-why">
            <li>
              <b>{counts.lolos}</b> sudah dinilai lengkap. Tentukan lolos atau
              tidak.
            </li>
          </ul>
        </Notice>
      )}
      {filters.queue === 'tempat' && counts.tempat > 0 && (
        <Notice icon="info">
          <strong>{counts.tempat} pilihan belum ditempatkan:</strong>
          <ul className="om-why">
            {counts.why.passed > 0 && (
              <li>
                <b>{counts.why.passed}</b> lolos. Tentukan: ditempatkan,
                cadangan, atau tidak diterima.
              </li>
            )}
            {counts.why.drift > 0 && (
              <li>
                <b>{counts.why.drift}</b> sudah ditetapkan, tetapi nilainya
                berubah. Tinjau ulang.
              </li>
            )}
          </ul>
        </Notice>
      )}

      {masked && (
        <Notice icon="eyeOff">
          Nama pendaftar disembunyikan selama seleksi berkas agar penilaian
          tidak dipengaruhi siapa orangnya. Isi jawaban tetap ditampilkan apa
          adanya.
        </Notice>
      )}

      <div className="om-table-wrap">
        <table className="om-table">
          <thead>
            <tr>
              <th className="om-col-check">
                <input
                  type="checkbox"
                  aria-label="Pilih semua baris yang tampil"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={toggleAll}
                />
              </th>
              {sortHead('name', 'Pendaftar')}
              {sortHead('unit', 'Pilihan')}
              {sortHead('score', 'Skor berkas', 'om-right')}
              {assignCol && <th>Penilai</th>}
              <th>Status</th>
              <th>
                <span className="om-sr">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const c = r.c,
                ed = canEdit(role, c);
              const acts = ed ? menuFor(st, c, r.phase) : [];
              return (
                <tr key={c.id} className={sel[c.id] ? 'is-sel' : ''}>
                  <td className="om-col-check">
                    <input
                      type="checkbox"
                      aria-label={`Pilih ${masked ? c.app.code : c.app.name} untuk ${U[c.unit].name}`}
                      checked={!!sel[c.id]}
                      onChange={(e) =>
                        setSel((s) => ({ ...s, [c.id]: e.target.checked }))
                      }
                    />
                  </td>
                  <td>
                    <div className="om-who">
                      <Avatar name={c.app.name} masked={masked} />
                      <div>
                        <button
                          type="button"
                          className="om-who-name"
                          onClick={() => openNilai(c.id)}
                        >
                          {masked ? c.app.code : c.app.name}
                        </button>
                        <small>
                          {masked
                            ? 'Nama disembunyikan'
                            : `${c.app.nim} · ${c.app.prodi}`}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="om-choice">
                      {U[c.unit].name}
                      {rankVisible && (
                        <small>
                          Pilihan {c.rank} dari {c.app.choices.length}
                        </small>
                      )}
                    </div>
                  </td>
                  <td className="om-right">
                    <span className="om-score-cell">
                      {r.b.gate && (
                        <span
                          className="om-gate"
                          title="Tidak memenuhi syarat wajib"
                        >
                          <Icon name="alert" size={14} />
                          <span className="om-sr">
                            Tidak memenuhi syarat wajib
                          </span>
                        </span>
                      )}
                      <ScoreBar b={r.b} />
                    </span>
                  </td>
                  {assignCol && (
                    <td>
                      <AssignCell st={st} c={c} reassign={reassign} />
                    </td>
                  )}
                  <td>
                    <span className="om-status-cell">
                      {acts.length ? (
                        <MenuButton
                          className={'om-pill as-btn t-' + PHASE[r.phase].tone}
                          items={acts}
                          label={`Ubah status: ${PHASE[r.phase].label}`}
                          onSelect={(a) =>
                            a === 'score' ? openNilai(c.id) : act(c, a)
                          }
                        >
                          {PHASE[r.phase].label}
                          <Icon name="chevDown" size={13} />
                        </MenuButton>
                      ) : (
                        <span title={PHASE[r.phase].hint}>
                          <Pill phase={r.phase} />
                        </span>
                      )}
                      {r.drift && (
                        <span
                          className="om-drift"
                          title={`${r.drift.reason}: ${pct(r.drift.from)} → ${pct(r.drift.to)}. Tinjau ulang keputusannya.`}
                        >
                          <Icon name="alert" size={14} />
                          <span className="om-sr">
                            {r.drift.reason}, perlu ditinjau ulang
                          </span>
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="om-right">
                    <button
                      type="button"
                      className="om-row-link"
                      onClick={() => openNilai(c.id)}
                    >
                      {ed && needsMine(st, role, c) ? 'Nilai' : 'Lihat'}
                      <Icon name="chevRight" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <div className="om-empty">
            <p>Tidak ada pendaftar di antrean ini.</p>
            {(activeFilterCount > 0 || filters.q) && (
              <button
                type="button"
                className="om-btn outline sm"
                onClick={() => {
                  clearFilters();
                  setFilters((f) => ({ ...f, q: '' }));
                }}
              >
                Hapus pencarian dan filter
              </button>
            )}
          </div>
        )}
      </div>

      <div className="om-table-foot">
        <span>
          Pendaftar yang memilih beberapa divisi muncul sekali untuk tiap
          pilihannya.
        </span>
        <Pagination
          total={rows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {selected.length > 0 && (
        <div
          className="om-bulk"
          role="region"
          aria-label="Aksi untuk baris terpilih"
        >
          <strong>{selected.length} dipilih</strong>
          <div className="om-bulk-acts">
            {bulkOptions.length
              ? bulkOptions.map((o) => (
                  <button
                    key={o.a}
                    type="button"
                    className={
                      'om-btn sm ' +
                      (o.a === 'offer' || o.a === 'pass' ? '' : 'outline-light')
                    }
                    onClick={() => runBulk(o.a)}
                  >
                    {ACT_LABEL[o.a]}
                    {o.n !== selected.length && (
                      <span className="om-bulk-n">{o.n}</span>
                    )}
                  </button>
                ))
              : !assignCol && (
                  <span className="om-bulk-none">
                    Tidak ada aksi yang bisa diterapkan ke baris ini.
                  </span>
                )}
            {assignCol && (
              <BulkAssign
                st={st}
                selected={selected}
                reassign={reassign}
                onDone={() => setSel({})}
              />
            )}
          </div>
          <button
            type="button"
            className="om-icon-btn on-dark"
            aria-label="Batal pilih"
            onClick={() => setSel({})}
          >
            <Icon name="x" />
          </button>
        </div>
      )}
    </div>
  );
}

function menuFor(st, c, phase) {
  const items = [];
  const add = (id, extra = {}) => {
    if (canApply(st, c, id)) items.push({ id, label: ACT_LABEL[id], ...extra });
  };
  const drift = driftOf(st, c);
  if (drift) {
    items.push({
      note: `${drift.reason} (${pct(drift.from)} → ${pct(drift.to)}).`,
    });
    add('ack', { icon: 'check' });
    items.push({ sep: true });
  }
  if (phase === 'unscored') {
    items.push({ id: 'score', label: 'Nilai sekarang', icon: 'clipboard' });
    items.push({
      note: 'Lolos atau tidak bisa ditetapkan setelah penilaian lengkap.',
    });
  } else if (phase === 'scored') {
    add('pass', { icon: 'check' });
    add('fail', { icon: 'x' });
    items.push({ sep: true });
    items.push({ id: 'score', label: 'Lihat penilaian', icon: 'clipboard' });
  } else if (phase === 'failed') {
    add('reset', { icon: 'arrowUp' });
    items.push({ sep: true });
    items.push({ id: 'score', label: 'Lihat penilaian', icon: 'clipboard' });
  } else if (phase === 'passed') {
    add('offer', { icon: 'userCheck' });
    add('reserve');
    add('reject');
    items.push({ sep: true });
    add('reset', { icon: 'arrowUp' });
  } else if (['offer', 'reserve', 'reject'].includes(phase)) {
    add('offer', { icon: 'userCheck' });
    add('reserve');
    add('reject');
    items.push({ sep: true });
    add('undecide', { icon: 'arrowUp' });
  }
  return items.some((i) => i.id) ? items : [];
}

/* =====================================================================
   TAB: NILAI
   ===================================================================== */
function NilaiView({
  st,
  role,
  rows,
  focusId,
  setFocusId,
  saveAssess,
  reassign,
  filters,
  setFilters,
  counts,
}) {
  const queue = rows.map((r) => r.c);
  const c = CH[focusId] && queue.includes(CH[focusId]) ? CH[focusId] : queue[0];
  const masked = isMasked(st, role);
  const [draft, setDraft] = useState({});
  const [cur, setCur] = useState(0);
  const [activeSrc, setActiveSrc] = useState(null);
  const listRef = useRef(null);

  const parts = useMemo(
    () =>
      c
        ? [
            {
              tg: tgA(c),
              rb: rubricFor(st, 'A'),
              title: 'Penilaian umum',
              note: 'Cukup dinilai sekali. Berlaku untuk semua divisi yang dipilih pendaftar ini.',
            },
            {
              tg: tgC(c),
              rb: rubricFor(st, 'C', c.unit),
              title: `Penilaian ${U[c.unit].name}`,
              note: null,
            },
          ].filter((x) => x.rb.criteria.length)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c, st.rubrics],
  );
  const blocks = useMemo(
    () => parts.filter((p) => canAssess(st, role, p.tg, c)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parts, role, st.scheme, st.assign],
  );
  /* Bagian berkas yang dinilai orang lain (skema satu penilai), untuk ditampilkan sebagai keterangan. */
  const elsewhere = parts.filter((p) => !blocks.includes(p));

  /* Pratinjau langsung: hitung skor berkas seolah draf ini sudah disimpan, memakai fungsi skor
     yang sama dengan tabel dan penempatan, jadi angkanya pasti cocok setelah disimpan. */
  const preview = useMemo(() => {
    if (!c || !blocks.length) return null;
    const assess = { ...st.assess };
    blocks.forEach((b) => {
      assess[b.tg] = { ...(assess[b.tg] || {}), [role.id]: draft[b.tg] || {} };
    });
    const now = berkasOf({ ...st, assess }, c);
    const mine = blocks.map((b) => {
      const d = draft[b.tg] || {};
      return {
        tg: b.tg,
        title: b.title,
        max: rbMax(b.rb),
        pts: b.rb.criteria.reduce(
          (s, cr) => s + (valueOk(cr, d[cr.id]) ? critPts(cr, d[cr.id]) : 0),
          0,
        ),
        missing: b.rb.criteria.filter((cr) => !valueOk(cr, d[cr.id])).length,
        gate: b.rb.criteria.some(
          (cr) => cr.scoring === 'gate' && d[cr.id] === false,
        ),
      };
    });
    const snap = st.snap[c.id];
    const willDrift =
      !!snap &&
      phaseOf(st, c) !== 'released' &&
      (now.pct == null ||
        Math.abs(now.pct - snap.pct) >= 0.005 ||
        now.gate !== snap.gate);
    return { now, saved: berkasOf(st, c), mine, snap, willDrift };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, c, blocks, draft, role.id]);

  useEffect(() => {
    if (!c) return;
    const d = {};
    blocks.forEach((b) => {
      d[b.tg] = { ...(st.assess[b.tg]?.[role.id] || {}) };
    });
    setDraft(d);
    setCur(0);
    setActiveSrc(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id, role.id]);

  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-current=true]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [c?.id]);

  const cursor = useMemo(
    () =>
      blocks.flatMap((b) =>
        b.rb.criteria
          .filter((cr) => cr.kind !== 'text')
          .map((cr) => ({ tg: b.tg, cr })),
      ),
    [blocks],
  );
  const curItem = cursor[clamp(cur, 0, Math.max(0, cursor.length - 1))];
  useEffect(() => {
    setActiveSrc(curItem?.cr.src || null);
  }, [curItem]);

  const idx = c ? queue.indexOf(c) : -1;
  const go = useCallback(
    (d) => {
      const j = clamp(idx + d, 0, queue.length - 1);
      if (queue[j] && j !== idx) setFocusId(queue[j].id);
    },
    [idx, queue, setFocusId],
  );

  const setVal = (tg, cr, v) => {
    setDraft((d) => ({
      ...d,
      [tg]: { ...d[tg], [cr.id]: d[tg]?.[cr.id] === v ? undefined : v },
    }));
    const i = cursor.findIndex((x) => x.tg === tg && x.cr.id === cr.id);
    if (i >= 0 && cr.kind !== 'text')
      setCur(Math.min(i + 1, cursor.length - 1));
  };
  const dirty = blocks.some(
    (b) =>
      JSON.stringify(draft[b.tg] || {}) !==
      JSON.stringify(st.assess[b.tg]?.[role.id] || {}),
  );

  const save = useCallback(
    (next) => {
      if (!c) return;
      const n = saveAssess(
        blocks.map((b) => ({ tg: b.tg, vals: draft[b.tg] || {} })),
      );
      if (next && n && idx < queue.length - 1) setFocusId(queue[idx + 1].id);
    },
    [c, blocks, draft, saveAssess, idx, queue, setFocusId],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tn = e.target.tagName;
      if (tn === 'TEXTAREA' || tn === 'INPUT' || tn === 'SELECT') return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Enter' && tn !== 'BUTTON' && blocks.length) {
        e.preventDefault();
        save(true);
      } else if (/^[1-9]$/.test(e.key) && curItem) {
        const n = +e.key,
          cr = curItem.cr;
        let v;
        if (cr.kind === 'scale') {
          if (n < cr.min || n > cr.max) return;
          v = n;
        } else if (cr.kind === 'enum') {
          if (!cr.options[n - 1]) return;
          v = cr.options[n - 1].id;
        } else if (cr.kind === 'boolean') {
          if (n > 2) return;
          v = n === 1;
        }
        e.preventDefault();
        setDraft((d) => ({
          ...d,
          [curItem.tg]: { ...d[curItem.tg], [cr.id]: v },
        }));
        setCur((x) => Math.min(x + 1, cursor.length - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, save, curItem, cursor.length, blocks.length]);

  const queueSelect = (
    <select
      className="om-select sm"
      aria-label="Antrean"
      value={filters.queue}
      onChange={(e) => setFilters((f) => ({ ...f, queue: e.target.value }))}
    >
      {QUEUES.map((q) => (
        <option key={q.id} value={q.id}>
          {q.label} ({counts[q.id]})
        </option>
      ))}
    </select>
  );

  if (!c) {
    return (
      <div className="om-panel om-empty big">
        <Icon name="circleCheck" size={28} />
        <h3>Antrean ini sudah kosong</h3>
        <p>
          Tidak ada pendaftar yang cocok dengan antrean dan filter yang dipilih.
        </p>
        <div className="om-row">{queueSelect}</div>
      </div>
    );
  }

  const nameOf = (app) => (masked ? app.code : app.name);
  const visChoices = c.app.choices.filter((x) => canSee(st, role, x));
  const rankVisible = showRank(st, role);

  return (
    <div className="om-nilai">
      <aside className="om-panel om-nq">
        <div className="om-nq-head">{queueSelect}</div>
        <div className="om-nq-list" ref={listRef}>
          {queue.slice(0, 300).map((x) => {
            const done = !needsMine(st, role, x);
            return (
              <button
                key={x.id}
                type="button"
                className="om-nq-item"
                aria-current={x === c}
                onClick={() => setFocusId(x.id)}
              >
                <span
                  className={'om-nq-dot' + (done ? ' done' : '')}
                  aria-label={done ? 'Sudah dinilai' : 'Belum dinilai'}
                >
                  {done && <Icon name="check" size={10} />}
                </span>
                <span className="om-nq-text">
                  <span>{nameOf(x.app)}</span>
                  <small>
                    {U[x.unit].short}
                    {rankVisible ? ` · pilihan ${x.rank}` : ''}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="om-panel om-answers" aria-label="Jawaban pendaftar">
        <header className="om-ans-head">
          <div className="om-ans-nav">
            <button
              type="button"
              className="om-icon-btn"
              aria-label="Pendaftar sebelumnya"
              onClick={() => go(-1)}
              disabled={idx <= 0}
            >
              <Icon name="chevLeft" />
            </button>
            <span className="om-num">
              {idx + 1} dari {queue.length}
            </span>
            <button
              type="button"
              className="om-icon-btn"
              aria-label="Pendaftar berikutnya"
              onClick={() => go(1)}
              disabled={idx >= queue.length - 1}
            >
              <Icon name="chevRight" />
            </button>
          </div>
          <div className="om-who lg">
            <Avatar name={c.app.name} masked={masked} />
            <div>
              <h2>{nameOf(c.app)}</h2>
              <small>
                {masked
                  ? 'Nama disembunyikan selama seleksi berkas'
                  : `${c.app.nim} · ${c.app.prodi} · angkatan ${c.app.ang}`}
              </small>
            </div>
          </div>
          <div className="om-choice-tags" aria-label="Divisi yang dipilih">
            {visChoices.map((x) => (
              <span key={x.id} className={'om-tag' + (x === c ? ' on' : '')}>
                {rankVisible ? `${x.rank}. ` : ''}
                {U[x.unit].short}
                {x === c && <span className="om-sr"> (sedang dinilai)</span>}
              </span>
            ))}
          </div>
        </header>

        <div className="om-qa-group">
          <h3>Jawaban umum</h3>
          {['mot', 'exp', 'waktu'].map((k) => (
            <div key={k} className={'om-qa' + (activeSrc === k ? ' on' : '')}>
              <p className="om-q">{GENERAL_Q[k]}</p>
              <p className="om-a">{c.app.ans[k]}</p>
            </div>
          ))}
        </div>
        <div className="om-qa-group">
          <h3>Jawaban untuk {U[c.unit].name}</h3>
          {UQ[c.unit].qs.map((q, k) => (
            <div
              key={k}
              className={'om-qa' + (activeSrc === 'unit' ? ' on' : '')}
            >
              <p className="om-q">{q}</p>
              <p className="om-a">{c.app.ans.unit[c.unit][k]}</p>
            </div>
          ))}
        </div>
      </section>

      <aside className="om-panel om-rubric" aria-label="Penilaian">
        {preview && (
          <ScorePreview p={preview} phase={phaseOf(st, c)} scheme={st.scheme} />
        )}
        {!blocks.length && (
          <div className="om-rubric-empty">
            <Icon name="lock" size={20} />
            <p>
              {st.scheme === 'single'
                ? 'Berkas ini tidak ditugaskan kepadamu. Jawaban hanya bisa dibaca.'
                : `Kamu tidak ditugaskan menilai ${U[c.unit].name}. Jawaban hanya bisa dibaca. Penugasan penilai diatur admin oprec di Pengaturan.`}
            </p>
          </div>
        )}
        {st.scheme === 'single' && elsewhere.length > 0 && (
          <div className="om-assigned-else">
            {elsewhere.map((p) => {
              const rid = st.assign[p.tg];
              const ok = eligibleFor(st, p.tg, c.unit).some(
                (r) => r.id === rid,
              );
              return (
                <div key={p.tg} className="om-assigned-row">
                  <span>
                    {p.title}:{' '}
                    <strong>
                      {ok ? reviewerName(st, rid) : 'belum ditugaskan'}
                    </strong>
                    {ok &&
                      (scoreOf(st, p.tg, c.unit)
                        ? ' · sudah dinilai'
                        : ' · belum dinilai')}
                  </span>
                  {role.admin && (
                    <select
                      className="om-select sm"
                      aria-label={`Penilai ${p.title}`}
                      value={ok ? rid : ''}
                      onChange={(e) => reassign([[p.tg]], e.target.value)}
                    >
                      {!ok && <option value="">Pilih penilai…</option>}
                      {eligibleFor(st, p.tg, c.unit).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name || 'Penilai baru'}
                          {r.id === role.id ? ' (saya)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {blocks.length > 0 && (
          <>
            {blocks.map((b) => {
              const d = draft[b.tg] || {};
              const sc = scoreOf(st, b.tg, c.unit);
              const others = sc ? sc.per.filter((p) => p.rid !== role.id) : [];
              return (
                <div key={b.tg} className="om-rb-block">
                  <div className="om-rb-title">
                    <h3>{b.title}</h3>
                    {b.note && <p>{b.note}</p>}
                  </div>
                  {b.rb.criteria.map((cr) => {
                    const isCur =
                      curItem && curItem.tg === b.tg && curItem.cr.id === cr.id;
                    const max = critMax(cr),
                      filled = valueOk(cr, d[cr.id]);
                    return (
                      <div
                        key={cr.id}
                        className={'om-crit' + (isCur ? ' on' : '')}
                        onMouseEnter={() => cr.src && setActiveSrc(cr.src)}
                        onFocusCapture={() => cr.src && setActiveSrc(cr.src)}
                      >
                        <div className="om-crit-label">
                          <span>{cr.label}</span>
                          {cr.scoring === 'gate' && (
                            <span className="om-req">Syarat wajib</span>
                          )}
                          {max > 0 && (
                            <span
                              className={'om-crit-pts' + (filled ? ' on' : '')}
                            >
                              <span className="om-num">
                                {filled ? critPts(cr, d[cr.id]) : '–'}
                              </span>
                              /{max}
                            </span>
                          )}
                        </div>
                        <CritInput
                          cr={cr}
                          v={d[cr.id]}
                          onPick={(v) => setVal(b.tg, cr, v)}
                          onText={(v) =>
                            setDraft((dd) => ({
                              ...dd,
                              [b.tg]: { ...dd[b.tg], [cr.id]: v },
                            }))
                          }
                        />
                        {cr.scoring === 'gate' && (
                          <small className="om-crit-help">
                            Jika “Tidak”, pendaftar ditandai tetapi tidak
                            otomatis gugur.
                          </small>
                        )}
                      </div>
                    );
                  })}
                  {st.scheme === 'multi' && (
                    <div className="om-others">
                      <span>Nilai dari penilai lain</span>
                      {!others.length ? (
                        <small>Belum ada.</small>
                      ) : showOthers(st, role, b.tg) ? (
                        others.map((p) => (
                          <div key={p.rid} className="om-others-row">
                            <span>{reviewerName(st, p.rid)}</span>
                            <span className="om-num">
                              {pct(p.pct)}
                              {p.gate ? ' · syarat wajib tidak terpenuhi' : ''}
                            </span>
                          </div>
                        ))
                      ) : (
                        <small className="om-locked">
                          <Icon name="lock" size={13} />
                          Muncul setelah kamu menyimpan nilaimu sendiri.
                        </small>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="om-rb-foot">
              <div className="om-rb-actions">
                <button
                  type="button"
                  className="om-btn"
                  onClick={() => save(true)}
                >
                  Simpan &amp; lanjut
                  <Icon name="arrowRight" />
                </button>
                <button
                  type="button"
                  className="om-btn outline"
                  onClick={() => save(false)}
                  disabled={!dirty}
                >
                  Simpan
                </button>
              </div>
              <p className="om-keys">
                {dirty ? (
                  <span className="om-unsaved">
                    Ada perubahan yang belum disimpan.
                  </span>
                ) : null}
                Pintasan: <kbd>1</kbd>–<kbd>5</kbd> isi nilai, <kbd>Enter</kbd>{' '}
                simpan &amp; lanjut, <kbd>J</kbd>/<kbd>K</kbd> pindah pendaftar.
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function ScorePreview({ p, phase, scheme }) {
  const { now, saved, mine, snap, willDrift } = p;
  const missingMine = mine.reduce((s, m) => s + m.missing, 0);
  const delta =
    now.pct != null && saved.pct != null
      ? Math.round(now.pct * 100) - Math.round(saved.pct * 100)
      : 0;
  const decided =
    snap && ['passed', 'failed', 'offer', 'reserve', 'reject'].includes(phase);
  return (
    <section
      className="om-preview"
      aria-live="polite"
      aria-label="Pratinjau skor"
    >
      <div className="om-preview-top">
        <span className="om-preview-label">
          Skor berkas
          <small>
            {scheme === 'multi'
              ? 'Rata-rata semua penilai yang sudah lengkap, termasuk nilaimu'
              : 'Dari penilai yang ditugaskan'}
          </small>
        </span>
        <span className="om-preview-score">
          <strong className="om-num">
            {now.pct == null ? '—' : pct(now.pct)}
          </strong>
          {now.pct != null && saved.pct != null && delta !== 0 && (
            <span className={'om-preview-delta' + (delta < 0 ? ' down' : '')}>
              {delta > 0 ? '+' : ''}
              {delta} dari {pct(saved.pct)}
            </span>
          )}
        </span>
      </div>
      <span className="om-score-track wide">
        <i
          style={{
            width: `${now.pct == null ? 0 : Math.round(now.pct * 100)}%`,
          }}
        />
      </span>
      <ul className="om-preview-parts">
        {mine.map((m) => (
          <li key={m.tg}>
            <span>{scheme === 'multi' ? `Nilaimu · ${m.title}` : m.title}</span>
            <span className="om-num">
              {m.pts}/{m.max} poin
              {m.missing ? ` · ${m.missing} belum diisi` : ''}
            </span>
          </li>
        ))}
      </ul>
      {now.pct == null && (
        <p className="om-preview-note">
          {missingMine
            ? `Lengkapi ${missingMine} kriteria lagi untuk melihat skor berkas.`
            : 'Skor berkas muncul setelah bagian penilaian lainnya juga lengkap.'}
        </p>
      )}
      {now.pct != null && missingMine > 0 && scheme === 'multi' && (
        <p className="om-preview-note">
          Nilaimu belum ikut dihitung sampai semua kriteriamu terisi.
        </p>
      )}
      {now.gate && (
        <p className="om-preview-note warn">
          <Icon name="alert" size={13} />
          Tidak memenuhi syarat wajib. Pendaftar akan ditandai.
        </p>
      )}
      {decided && willDrift && (
        <p className="om-preview-note warn">
          <Icon name="alert" size={13} />
          Sudah diputuskan “{PHASE[phase].label}” pada skor {pct(snap.pct)}.
          Jika disimpan, keputusan ini ditandai untuk ditinjau ulang.
        </p>
      )}
    </section>
  );
}

function CritInput({ cr, v, onPick, onText }) {
  if (cr.kind === 'scale') {
    const opts = [];
    for (let x = cr.min; x <= cr.max; x++) opts.push(x);
    return (
      <div>
        <div
          className="om-opts scale"
          role="group"
          aria-label={cr.label}
          style={{
            gridTemplateColumns: `repeat(${Math.min(opts.length, 6)}, minmax(0, 1fr))`,
          }}
        >
          {opts.map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={v === x}
              onClick={() => onPick(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="om-scale-ends">
          <span>Kurang</span>
          <span>Sangat baik</span>
        </div>
      </div>
    );
  }
  if (cr.kind === 'boolean') {
    return (
      <div className="om-opts" role="group" aria-label={cr.label}>
        <button
          type="button"
          aria-pressed={v === true}
          onClick={() => onPick(true)}
        >
          Ya
        </button>
        <button
          type="button"
          aria-pressed={v === false}
          onClick={() => onPick(false)}
        >
          Tidak
        </button>
      </div>
    );
  }
  if (cr.kind === 'enum') {
    return (
      <div className="om-opts" role="group" aria-label={cr.label}>
        {cr.options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={v === o.id}
            onClick={() => onPick(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <textarea
      className="om-textarea"
      aria-label={cr.label}
      placeholder="Opsional. Tidak memengaruhi skor."
      value={v || ''}
      onChange={(e) => onText(e.target.value)}
    />
  );
}

/* =====================================================================
   TAB: PENEMPATAN
   ===================================================================== */
function PenempatanView({ st, role, place, advancePlacement, act }) {
  const masked = isMasked(st, role);
  const [placementMode, setPlacementMode] = useState('compact');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const visUnits = OPEN.filter((u) => role.admin || role.units.includes(u.id));
  const cf = [];
  const stats = visUnits.map((u) => ({ u, s: unitStats(st, u) }));
  const pagedStats = stats.slice(page * pageSize, (page + 1) * pageSize);
  const tot = stats.reduce(
    (t, { s }) => ({ open: t.open + Math.max(0, s.open) }),
    { open: 0 },
  );
  const progress = Object.fromEntries(
    OPEN.map((u) => [u.id, unitProgress(st, u.id)]),
  );
  const nameOf = (app) => (masked ? app.code : app.name);

  const [selectedUnit, setSelectedUnit] = useState(visUnits[0]?.id || '');
  const selected = visUnits.find((u) => u.id === selectedUnit) || visUnits[0];
  const period = selected ? placementPeriod(st, selected.id) : 1;
  const queue = selected
    ? placementQueue(st, selected.id, period).sort(
        (a, b) => (berkasOf(st, b).pct || 0) - (berkasOf(st, a).pct || 0),
      )
    : [];
  const next = selected ? nextPlacementPeriod(st, selected.id) : null;
  const [queuePage, setQueuePage] = useState(0);
  const [queueSize, setQueueSize] = useState(25);
  const shownQueue = queue.slice(
    queuePage * queueSize,
    (queuePage + 1) * queueSize,
  );

  return (
    <div className="om-stack lg">
      {!role.admin && (
        <Notice icon="lock">
          Penempatan dikelola admin oprec. Kamu melihat progres divisi yang kamu
          nilai dalam mode baca saja.
        </Notice>
      )}
      <section className="om-stack">
        <div className="om-sec-head">
          <h2 className="om-h2">Periode seleksi</h2>
          <p className="om-dim">
            Setiap divisi berjalan mandiri. Pilihan berikutnya baru dibuka
            setelah antrean pilihan sebelumnya di divisi itu selesai.
          </p>
        </div>
        <div className="om-table-wrap">
          <table className="om-table">
            <thead>
              <tr>
                <th>Bidang</th>
                <th>Divisi</th>
                <th>Periode aktif</th>
                <th className="om-right">Antrean</th>
                <th className="om-right">Ditempatkan</th>
                <th className="om-right">Sisa kuota</th>
                <th>
                  <span className="om-sr">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.map(({ u, s }) => {
                const current = placementPeriod(st, u.id);
                const pending = placementQueue(st, u.id, current);
                const canAdvance = !!nextPlacementPeriod(st, u.id);
                return (
                  <tr
                    key={u.id}
                    className={selected?.id === u.id ? 'is-sel' : ''}
                  >
                    <td>{U[u.parent]?.name}</td>
                    <td>
                      <button
                        type="button"
                        className="om-who-name"
                        onClick={() => {
                          setSelectedUnit(u.id);
                          setQueuePage(0);
                        }}
                      >
                        {u.name}
                      </button>
                    </td>
                    <td>
                      <span className="om-pill sm t-navy">
                        {periodLabel(current)}
                      </span>
                    </td>
                    <td className="om-right om-num">{pending.length}</td>
                    <td className="om-right om-num">
                      {s.direct + s.placed.length}
                    </td>
                    <td className="om-right om-num">{Math.max(0, s.open)}</td>
                    <td className="om-right">
                      {role.admin && canAdvance && (
                        <button
                          type="button"
                          className="om-btn outline xs"
                          onClick={() => advancePlacement(u.id)}
                        >
                          Buka {periodLabel(nextPlacementPeriod(st, u.id))}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {selected && (
        <section className="om-stack">
          <div className="om-sec-head">
            <h2 className="om-h2">
              {selected.name} · {periodLabel(period)}
            </h2>
            <p className="om-dim">
              {period === 'reserve'
                ? 'Cadangan diurutkan berdasarkan skor tertinggi dan hanya dipakai setelah seluruh pilihan selesai.'
                : `Pendaftar pilihan ${period} yang lolos seleksi dan belum ditempatkan di divisi lain.`}
            </p>
          </div>
          <div className="om-table-wrap">
            <table className="om-table">
              <thead>
                <tr>
                  <th>Pendaftar</th>
                  <th>Fakultas</th>
                  <th className="om-right">Skor</th>
                  <th>Status</th>
                  <th>
                    <span className="om-sr">Hasil</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shownQueue.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="om-who">
                        <Avatar name={c.app.name} masked={masked} />
                        <div>
                          <strong>{nameOf(c.app)}</strong>
                          <small>
                            {masked
                              ? c.app.code
                              : `${c.app.nim} · pilihan ${c.rank}`}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{c.app.fak}</td>
                    <td className="om-right om-num">
                      {pct(berkasOf(st, c).pct)}
                    </td>
                    <td>
                      <Pill phase={phaseOf(st, c)} />
                    </td>
                    <td className="om-right">
                      {role.admin && (
                        <span className="om-row-actions">
                          <button
                            type="button"
                            className="om-btn xs"
                            disabled={unitStats(st, selected).open <= 0}
                            onClick={() => place(c.id)}
                          >
                            Tempatkan
                          </button>
                          <button
                            type="button"
                            className="om-btn outline xs"
                            onClick={() => act(c, 'reserve')}
                          >
                            Cadangan
                          </button>
                          <button
                            type="button"
                            className="om-btn ghost xs"
                            onClick={() => act(c, 'reject')}
                          >
                            Tidak diterima
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!queue.length && (
              <div className="om-empty">
                <p>Tidak ada pendaftar yang menunggu pada periode ini.</p>
              </div>
            )}
          </div>
          <Pagination
            total={queue.length}
            page={queuePage}
            pageSize={queueSize}
            onPageChange={setQueuePage}
            onPageSizeChange={setQueueSize}
          />
          {role.admin && next && (
            <button
              type="button"
              className="om-btn outline"
              onClick={() => advancePlacement(selected.id)}
            >
              Selesaikan {periodLabel(period)} dan buka {periodLabel(next)}
            </button>
          )}
        </section>
      )}
    </div>
  );

  return (
    <div className="om-stack lg">
      {!role.admin && (
        <Notice icon="lock">
          Penempatan dikelola admin oprec. Kamu melihat divisi yang kamu nilai
          dalam mode baca saja.
        </Notice>
      )}

      {role.admin && (
        <>
          <section className="om-step">
            <StepHead
              n={1}
              done={!cf.length}
              title="Konflik penempatan"
              sub={
                cf.length
                  ? `${cf.length} pendaftar ditempatkan di lebih dari satu divisi. Pilih satu; pilihan lainnya dilepas.`
                  : 'Tidak ada pendaftar yang ditempatkan di lebih dari satu divisi.'
              }
            />
            {cf.length > 0 && (
              <div className="om-panel om-list">
                {cf.map((a) => {
                  const offs = a.choices
                    .filter((c) => st.dec[c.id] === 'offer')
                    .sort((x, y) => x.rank - y.rank);
                  return (
                    <div key={a.id} className="om-conf">
                      <div className="om-who">
                        <Avatar name={a.name} />
                        <div>
                          <strong>{a.name}</strong>
                          <small>
                            {a.nim} · {a.prodi}
                          </small>
                        </div>
                      </div>
                      <div className="om-conf-opts">
                        {offs.map((c, k) => (
                          <button
                            key={c.id}
                            type="button"
                            className={'om-conf-opt' + (k === 0 ? ' sug' : '')}
                            onClick={() => place(c.id)}
                          >
                            <span className="om-conf-main">
                              {U[c.unit].name}
                            </span>
                            <span className="om-conf-meta">
                              Pilihan {c.rank} · skor {pct(berkasOf(st, c).pct)}
                            </span>
                            {k === 0 && (
                              <span className="om-sug">Disarankan</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <section className="om-step">
        {role.admin ? (
          <StepHead
            n={2}
            done={tot.open === 0}
            title="Kuota divisi"
            sub="Tempatkan cadangan dengan skor tertinggi."
          />
        ) : (
          <h2 className="om-h2">Kuota di divisi yang kamu nilai</h2>
        )}
        <div
          className="om-seg"
          role="radiogroup"
          aria-label="Tampilan penempatan"
        >
          <button
            type="button"
            role="radio"
            aria-checked={placementMode === 'compact'}
            className={placementMode === 'compact' ? 'on' : ''}
            onClick={() => setPlacementMode('compact')}
          >
            Tabel ringkas
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={placementMode === 'cards'}
            className={placementMode === 'cards' ? 'on' : ''}
            onClick={() => setPlacementMode('cards')}
          >
            Kartu
          </button>
        </div>
        {placementMode === 'compact' && (
          <>
            <div className="om-table-wrap">
              <table className="om-table">
                <thead>
                  <tr>
                    <th>Bidang</th>
                    <th>Divisi</th>
                    <th className="om-right">Kuota</th>
                    <th className="om-right">Ditempatkan</th>
                    <th className="om-right">Cadangan</th>
                    <th className="om-right">Kosong</th>
                    <th>Status</th>
                    <th>
                      <span className="om-sr">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedStats.map(({ u, s }) => {
                    const pg = progress[u.id];
                    const next = s.reserve[0];
                    return (
                      <tr key={u.id}>
                        <td>{U[u.parent]?.name}</td>
                        <td>
                          <div className="om-choice">
                            {u.name}
                            <small>
                              {CHOICES.filter((c) => c.unit === u.id).length}{' '}
                              pendaftar
                            </small>
                          </div>
                        </td>
                        <td className="om-right om-num">{s.quota}</td>
                        <td className="om-right om-num">
                          {s.placed.length + s.direct}
                        </td>
                        <td className="om-right om-num">{s.reserve.length}</td>
                        <td className="om-right om-num">
                          {Math.max(0, s.open)}
                        </td>
                        <td>
                          <span
                            className={
                              'om-pill sm t-' +
                              (!pg.ready
                                ? 'neutral'
                                : s.open <= 0
                                  ? 'green'
                                  : 'navy')
                            }
                          >
                            {!pg.ready
                              ? 'Menilai'
                              : s.open <= 0
                                ? 'Kuota terisi'
                                : 'Perlu penempatan'}
                          </span>
                        </td>
                        <td className="om-right">
                          {role.admin && s.open > 0 && next && (
                            <button
                              type="button"
                              className="om-btn outline xs"
                              onClick={() => place(next.id)}
                            >
                              Tempatkan
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              total={stats.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
        {placementMode === 'cards' && (
          <div className="om-units">
            {stats.map(({ u, s }) => {
              const over = Math.max(0, -s.open);
              const seg = (n) =>
                `${(n / Math.max(s.quota, s.direct + s.placed.length)) * 100}%`;
              const next = s.reserve[0];
              const directs = DIRECT.filter((d) => d.unit === u.id);
              const pg = progress[u.id];
              const stage = !pg.ready
                ? { label: 'Menilai', tone: 'neutral' }
                : s.placed.length && s.open <= 0
                  ? { label: 'Kuota terisi', tone: 'green' }
                  : s.placed.length
                    ? { label: 'Mengisi kuota', tone: 'navy' }
                    : { label: 'Menentukan hasil', tone: 'navy' };
              return (
                <article key={u.id} className="om-panel om-unit">
                  <header>
                    <h3>{u.name}</h3>
                    <span className="om-num om-dim">{s.quota} kuota</span>
                  </header>
                  <div className="om-unit-stage">
                    <span className={'om-pill t-' + stage.tone}>
                      {stage.label}
                    </span>
                    {!pg.ready && (
                      <small>
                        {[
                          pg.unscored && `${pg.unscored} belum dinilai`,
                          pg.unassigned && `${pg.unassigned} belum ditugaskan`,
                          pg.undecided && `${pg.undecided} belum diputuskan`,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </small>
                    )}
                  </div>
                  {pg.drift > 0 && (
                    <p className="om-warn amber">
                      <Icon name="alert" size={14} />
                      {pg.drift} keputusan perlu ditinjau ulang karena nilainya
                      berubah.
                    </p>
                  )}
                  <div
                    className="om-seats"
                    role="img"
                    aria-label={`${s.direct} ditunjuk langsung, ${s.placed.length} ditempatkan, ${Math.max(0, s.open)} kosong dari ${s.quota} kuota`}
                  >
                    <i className="d" style={{ width: seg(s.direct) }} />
                    <i className="j" style={{ width: seg(s.placed.length) }} />
                  </div>
                  <dl className="om-kv">
                    {s.direct > 0 && (
                      <>
                        <dt>
                          <i className="sw d" />
                          Ditunjuk langsung
                        </dt>
                        <dd>{s.direct}</dd>
                      </>
                    )}
                    <dt>
                      <i className="sw j" />
                      Ditempatkan
                    </dt>
                    <dd>{s.placed.length}</dd>
                    <dt>
                      <i className="sw e" />
                      Kosong
                    </dt>
                    <dd>{Math.max(0, s.open)}</dd>
                  </dl>
                  {over > 0 && (
                    <p className="om-warn">
                      <Icon name="alert" size={14} />
                      Penempatan melebihi kuota sebanyak {over}. Kurangi
                      penempatan atau tambah kuota di Pengaturan.
                    </p>
                  )}
                  {directs.length > 0 && (
                    <p className="om-dim om-small">
                      Ditunjuk langsung: {directs.map((d) => d.name).join(', ')}
                      .
                    </p>
                  )}
                  <div className="om-reserve">
                    <span>Cadangan berikutnya</span>
                    {s.reserve.length ? (
                      s.reserve.slice(0, 3).map((c, k) => (
                        <div key={c.id} className="om-reserve-row">
                          <span>
                            {k + 1}. {nameOf(c.app)}
                          </span>
                          <span className="om-num om-dim">
                            {pct(berkasOf(st, c).pct)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <small className="om-dim">Belum ada cadangan.</small>
                    )}
                  </div>
                  {role.admin && s.open > 0 && next && (
                    <button
                      type="button"
                      className="om-btn outline sm"
                      onClick={() => place(next.id)}
                    >
                      Tempatkan {firstName(next.app.name)}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
        {role.admin && (
          <p className="om-dim om-small">
            Divisi Bendahara tidak membuka pendaftaran;{' '}
            {DIRECT.filter((d) => d.unit === 'bendahara')
              .map((d) => d.name)
              .join(' dan ')}{' '}
            ditunjuk langsung oleh ketua.
          </p>
        )}
      </section>
    </div>
  );
}

function StepHead({ n, title, sub, done }) {
  return (
    <header className="om-step-head">
      <span className={'om-step-n' + (done ? ' done' : '')} aria-hidden="true">
        {done ? <Icon name="check" size={14} /> : n}
      </span>
      <div>
        <h2>
          {title}
          {done && <span className="om-sr"> (selesai)</span>}
        </h2>
        <p>{sub}</p>
      </div>
    </header>
  );
}

/* =====================================================================
   TAB: RINGKASAN
   ===================================================================== */
/* Alur seleksi untuk Sankey. Tiap entitas (orang, atau pilihan bila satu divisi dipilih)
   melewati tiga tahap; di tiap tahap ia jatuh ke tepat satu simpul, jadi jumlahnya selalu kekal. */
const FLOW_NODES = {
  all: { label: 'Pendaftar', tone: 'go' },
  passed: { label: 'Lolos', tone: 'go' },
  failed: { label: 'Tidak lolos', tone: 'stop' },
  pending1: { label: 'Belum dinilai', tone: 'wait' },
  placed: { label: 'Ditempatkan', tone: 'done' },
  reserve: { label: 'Cadangan', tone: 'reserve' },
  pending2: { label: 'Belum ditempatkan', tone: 'wait' },
  rejected: { label: 'Tidak diterima', tone: 'stop' },
  released: { label: 'Divisi lain', tone: 'aside' },
};
const FLOW_COLS = [
  ['all'],
  ['passed', 'failed', 'pending1'],
  ['placed', 'reserve', 'pending2', 'rejected', 'released'],
];
const FLOW_COLOR = {
  go: '#2B6282',
  done: '#29BC5B',
  stop: '#F16350',
  wait: '#9DA4A8',
  reserve: '#E3B13F',
  aside: '#C4CACE',
};
function flowPath(phases) {
  const has = (...p) => phases.some((x) => p.includes(x));
  const path = ['all'];
  if (has('passed', 'offer', 'reserve', 'reject', 'released'))
    path.push('passed');
  else if (phases.every((x) => x === 'failed')) return [...path, 'failed'];
  else return [...path, 'pending1'];
  if (has('offer')) path.push('placed');
  else if (has('reserve')) return [...path, 'reserve'];
  /* Masih ada pilihan lain yang belum tuntas: hasilnya belum final, bukan "tidak diterima". */ else if (
    has('passed', 'unscored', 'scored')
  )
    return [...path, 'pending2'];
  else if (has('reject')) return [...path, 'rejected'];
  else return [...path, 'released'];
  return path;
}
function buildFlow(st, unitIds, unit) {
  const groups = unit
    ? CHOICES.filter((c) => c.unit === unit).map((c) => [phaseOf(st, c)])
    : APPS.map((a) =>
        a.choices
          .filter((c) => unitIds.includes(c.unit))
          .map((c) => phaseOf(st, c)),
      ).filter((p) => p.length);
  const nodes = {},
    links = {};
  groups.forEach((ph) => {
    const p = flowPath(ph);
    p.forEach((n, i) => {
      nodes[n] = (nodes[n] || 0) + 1;
      if (i) {
        const k = p[i - 1] + '>' + n;
        links[k] = (links[k] || 0) + 1;
      }
    });
  });
  return { total: groups.length, nodes, links };
}

function SankeyChart({ flow, unitNoun }) {
  const [hover, setHover] = useState(null);
  const [table, setTable] = useState(false);
  const wrapRef = useRef(null);
  /* Kolom terakhir menyisakan ±230px untuk label terpanjang ("Tawaran belum dikirim 30 · 20%"). */
  const W = 920,
    H = 340,
    NW = 12,
    GAP = 18,
    X = [0, 220, 440, 660];
  const k = flow.total ? (H - GAP * 4) / flow.total : 0;
  const pos = {};
  FLOW_COLS.forEach((col, ci) => {
    let y = 0;
    col.forEach((id) => {
      const n = flow.nodes[id] || 0;
      if (!n) return;
      const h = Math.max(3, n * k);
      pos[id] = { x: X[ci], y, h, n, used: 0, usedIn: 0 };
      y += h + GAP;
    });
  });
  const pctOf = (n) => (flow.total ? Math.round((n / flow.total) * 100) : 0);
  const order = FLOW_COLS.flat();
  const rank = (key) => key.split('>').map((id) => order.indexOf(id));
  const sorted = Object.entries(flow.links).sort(([a], [b]) => {
    const [a0, a1] = rank(a),
      [b0, b1] = rank(b);
    return a0 - b0 || a1 - b1;
  });
  const links = sorted.map(([key, n]) => {
    const [s, t] = key.split('>'),
      a = pos[s],
      b = pos[t];
    const hs = (n / a.n) * a.h,
      ht = (n / b.n) * b.h;
    const y0 = a.y + a.used,
      y1 = b.y + b.usedIn;
    a.used += hs;
    b.usedIn += ht;
    const x0 = a.x + NW,
      x1 = b.x,
      mx = (x0 + x1) / 2;
    return {
      key,
      s,
      t,
      n,
      d: `M${x0},${y0}C${mx},${y0} ${mx},${y1} ${x1},${y1}L${x1},${y1 + ht}C${mx},${y1 + ht} ${mx},${y0 + hs} ${x0},${y0 + hs}Z`,
    };
  });
  const move = (e, tip) => {
    const r = wrapRef.current.getBoundingClientRect();
    setHover({ ...tip, x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const linkTip = (l) => ({
    id: l.key,
    title: `${FLOW_NODES[l.s].label} → ${FLOW_NODES[l.t].label}`,
    body: `${l.n} ${unitNoun} · ${Math.round((l.n / flow.nodes[l.s]) * 100)}% dari “${FLOW_NODES[l.s].label}”`,
  });
  const nodeTip = (id) => ({
    id,
    title: FLOW_NODES[id].label,
    body: `${flow.nodes[id]} ${unitNoun} · ${pctOf(flow.nodes[id])}% dari semua`,
  });
  const active = hover?.id;
  const dimmed = (l) =>
    active && active !== l.key && active !== l.s && active !== l.t;

  return (
    <>
      <div className="om-chart-tools">
        <button
          type="button"
          className="om-link"
          onClick={() => setTable((t) => !t)}
        >
          {table ? 'Tampilkan diagram' : 'Tampilkan sebagai tabel'}
        </button>
      </div>
      {table ? (
        <table className="om-rtable">
          <thead>
            <tr>
              <th>Tahap</th>
              <th>Hasil</th>
              <th className="om-right">Jumlah</th>
              <th className="om-right">Dari semua</th>
            </tr>
          </thead>
          <tbody>
            {FLOW_COLS.slice(1).flatMap((col, i) =>
              col
                .filter((id) => flow.nodes[id])
                .map((id) => (
                  <tr key={id}>
                    <td>{['Seleksi', 'Keputusan'][i]}</td>
                    <td>{FLOW_NODES[id].label}</td>
                    <td className="om-right om-num">{flow.nodes[id]}</td>
                    <td className="om-right om-num">
                      {pctOf(flow.nodes[id])}%
                    </td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      ) : (
        <div
          className="om-sankey"
          ref={wrapRef}
          onMouseLeave={() => setHover(null)}
        >
          <svg
            viewBox={`-4 -8 ${W + 8} ${H + 16}`}
            role="img"
            aria-label={`Alur seleksi ${flow.total} ${unitNoun}: ${Object.keys(
              pos,
            )
              .filter((id) => id !== 'all')
              .map((id) => `${FLOW_NODES[id].label} ${flow.nodes[id]}`)
              .join(', ')}`}
          >
            {links.map((l) => (
              <path
                key={l.key}
                d={l.d}
                fill={FLOW_COLOR[FLOW_NODES[l.t].tone]}
                className={
                  'om-sk-link' +
                  (dimmed(l) ? ' dim' : '') +
                  (active === l.key ? ' on' : '')
                }
                onMouseMove={(e) => move(e, linkTip(l))}
              />
            ))}
            {Object.entries(pos).map(([id, p]) => (
              <g key={id} onMouseMove={(e) => move(e, nodeTip(id))}>
                <rect
                  x={p.x}
                  y={p.y}
                  width={NW}
                  height={p.h}
                  rx="3"
                  fill={FLOW_COLOR[FLOW_NODES[id].tone]}
                />
                <rect
                  x={p.x - 6}
                  y={p.y - 4}
                  width={NW + 12}
                  height={p.h + 8}
                  fill="transparent"
                />
                <text
                  x={p.x + NW + 8}
                  y={p.y + p.h / 2}
                  dy="0.35em"
                  className="om-sk-label"
                >
                  {FLOW_NODES[id].label}{' '}
                  <tspan className="om-sk-val">{p.n}</tspan>
                  {id !== 'all' && (
                    <tspan className="om-sk-pct"> · {pctOf(p.n)}%</tspan>
                  )}
                </text>
              </g>
            ))}
          </svg>
          {hover && (
            <div
              className="om-tip"
              style={{ left: hover.x, top: hover.y }}
              role="tooltip"
            >
              <strong>{hover.title}</strong>
              <span>{hover.body}</span>
            </div>
          )}
        </div>
      )}
      <div className="om-legend" aria-label="Arti warna">
        {[
          ['go', 'Lanjut'],
          ['done', 'Ditempatkan'],
          ['wait', 'Belum selesai'],
          ['reserve', 'Cadangan'],
          ['stop', 'Berhenti'],
        ].map(([t, l]) => (
          <span key={t}>
            <i style={{ background: FLOW_COLOR[t] }} />
            {l}
          </span>
        ))}
      </div>
    </>
  );
}

function GrafikView({ st, role }) {
  const vis = OPEN.filter((u) => role.admin || role.units.includes(u.id));
  const cs = CHOICES.filter((c) => vis.some((u) => u.id === c.unit));
  const nApps = new Set(cs.map((c) => c.app.id)).size;
  const [flowUnit, setFlowUnit] = useState('');
  const flow = useMemo(
    () =>
      buildFlow(
        st,
        vis.map((u) => u.id),
        flowUnit,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [st, role.id, flowUnit],
  );
  const supply = vis.map((u) => {
    const all = CHOICES.filter((c) => c.unit === u.id);
    return {
      u,
      all: all.length,
      first: all.filter((c) => c.rank === 1).length,
      quota: st.quota[u.id],
    };
  });
  const sMax = Math.max(1, ...supply.map((s) => Math.max(s.all, s.quota)));

  const unitNoun = flowUnit ? 'pilihan' : 'orang';

  return (
    <div className="om-stack lg">
      <div className="om-charts">
        <section className="om-panel om-chart wide">
          <div className="om-chart-head">
            <div>
              <h3>Bagaimana persebaran pendaftar?</h3>
              <p>
                {flowUnit
                  ? `Setiap pilihan untuk ${U[flowUnit].name}.`
                  : 'Dihitung per orang.'}
              </p>
            </div>
            <select
              className="om-select sm"
              aria-label="Lingkup alur"
              value={flowUnit}
              onChange={(e) => setFlowUnit(e.target.value)}
            >
              <option value="">
                {vis.length > 1 ? 'Semua divisi' : vis[0]?.name}
              </option>
              {vis.length > 1 &&
                vis.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>
          {flow.total ? (
            <SankeyChart flow={flow} unitNoun={unitNoun} />
          ) : (
            <p className="om-dim">Belum ada pendaftar.</p>
          )}
        </section>

        <section className="om-panel om-chart">
          <h3>Divisi mana yang kurang pendaftar?</h3>
          <p>
            Batang gelap: memilih sebagai pilihan 1. Batang terang: semua
            pilihan. Garis: kuota.
          </p>
          <div className="om-bars">
            {supply.map((s) => {
              const low = s.first < s.quota;
              return (
                <div key={s.u.id} className="om-bar-row">
                  <span className="om-bar-label">{s.u.short}</span>
                  <span className="om-track">
                    <i
                      className="lite"
                      style={{ width: `${(s.all / sMax) * 100}%` }}
                    />
                    <i style={{ width: `${(s.first / sMax) * 100}%` }} />
                    <b
                      className="om-quota-line"
                      style={{ left: `${(s.quota / sMax) * 100}%` }}
                    />
                  </span>
                  <span className={'om-num om-bar-val' + (low ? ' warn' : '')}>
                    {s.first}/{s.quota}
                  </span>
                </div>
              );
            })}
          </div>
          {role.admin && (
            <p className="om-small om-dim">
              Angka merah: pendaftar pilihan 1 lebih sedikit dari kuota.
            </p>
          )}
        </section>

        {/* {general && <CalibChart title="Apakah standar penilaian umum seragam?" sub="Penilai umum menilai kelompok pendaftar yang setara." data={general} />} */}

        <section className="om-panel om-chart">
          <h3>Seberapa jauh penilaian berjalan?</h3>
          <p>
            Pilihan yang penilaian umum dan penilaian divisinya sudah terisi.
          </p>
          <div className="om-bars">
            {vis.map((u) => {
              const all = CHOICES.filter((c) => c.unit === u.id),
                d = all.filter((c) => berkasOf(st, c).pct != null).length;
              return (
                <div key={u.id} className="om-bar-row">
                  <span className="om-bar-label">{u.short}</span>
                  <span className="om-track thin">
                    <i style={{ width: `${(d / all.length) * 100}%` }} />
                  </span>
                  <span className="om-num om-bar-val">
                    {d}/{all.length}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function CalibChart({ title, sub, data }) {
  return (
    <section className="om-panel om-chart">
      <h3>{title}</h3>
      <p>{sub}</p>
      <div className="om-bars">
        {data.rows.map((r) => (
          <div key={r.name} className="om-bar-row">
            <span className="om-bar-label">
              {r.name}
              {r.high && <small className="om-flag">Cenderung tinggi</small>}
            </span>
            <span className="om-track range">
              <b className="om-mean" style={{ left: `${data.mean * 100}%` }} />
              <i
                className="rng"
                style={{
                  left: `${r.q1 * 100}%`,
                  width: `${Math.max(1, (r.q3 - r.q1) * 100)}%`,
                }}
              />
              <i
                className={'dot' + (r.high ? ' warn' : '')}
                style={{ left: `${r.m * 100}%` }}
              />
            </span>
            <span className="om-num om-bar-val">{Math.round(r.m * 100)}</span>
          </div>
        ))}
      </div>
      <p className="om-small om-dim">
        Titik: rata-rata. Batang: rentang nilai tengah. Garis putus: rata-rata
        semua penilai ({Math.round(data.mean * 100)}).
      </p>
    </section>
  );
}

/* =====================================================================
   TAB: PENGATURAN
   ===================================================================== */
const VIS_OPTS = [
  {
    id: 'open',
    label: 'Terbuka',
    desc: 'Setiap penilai melihat semua pendaftar, urutan pilihan, dan nilai penilai lain.',
  },
  {
    id: 'per_unit',
    label: 'Per divisi',
    desc: 'Penilai hanya melihat pendaftar yang memilih divisi yang ia nilai.',
  },
  {
    id: 'anon',
    label: 'Anonim',
    desc: 'Seperti Per divisi, ditambah nama pendaftar disembunyikan selama seleksi berkas.',
  },
];
const KIND_OPTS = [
  { id: 'scale', label: 'Skala angka' },
  { id: 'boolean', label: 'Ya / Tidak' },
  { id: 'enum', label: 'Pilihan' },
  { id: 'text', label: 'Catatan' },
];
const KIND_DEFAULTS = {
  scale: { min: 1, max: 5, scoring: 'weighted', weight: 1 },
  boolean: { scoring: 'gate', points: 2 },
  enum: {
    scoring: 'points',
    options: [
      { id: 'o1', label: 'Kurang', points: 0 },
      { id: 'o2', label: 'Cukup', points: 2 },
      { id: 'o3', label: 'Baik', points: 4 },
    ],
  },
  text: { scoring: 'none' },
};
const critRule = (c) => {
  if (c.kind === 'scale') return `Nilai ${c.min}–${c.max}`;
  if (c.kind === 'boolean') return 'Ya atau tidak';
  if (c.kind === 'enum')
    return c.options.map((o) => o.label).join(' / ') || 'Belum ada pilihan';
  return 'Teks bebas';
};
const critEffect = (c) => {
  if (c.scoring === 'weighted')
    return `bobot ×${c.weight}, maks. ${critMax(c)} poin`;
  if (c.scoring === 'points')
    return c.kind === 'boolean'
      ? `${c.points} poin jika Ya`
      : `${c.options.map((o) => o.points).join(' / ')} poin`;
  if (c.scoring === 'gate') return 'syarat wajib';
  return 'tidak memengaruhi skor';
};

function CritEditor({ c, disabled, onChange }) {
  const scored = c.scoring !== 'none';
  const setKind = (kind) => {
    if (kind !== c.kind)
      onChange({ kind, ...structuredClone(KIND_DEFAULTS[kind]) });
  };
  const setOpt = (i, patch) =>
    onChange({
      options: c.options.map((o, j) => (j === i ? { ...o, ...patch } : o)),
    });
  return (
    <fieldset className="om-crit-form" disabled={disabled}>
      <label className="om-field">
        <span>Nama kriteria</span>
        <input
          className="om-input"
          value={c.label}
          placeholder="mis. Kemampuan desain"
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </label>
      <div className="om-field">
        <span id={`k-${c.id}`}>Cara menilai</span>
        <div className="om-seg" role="radiogroup" aria-labelledby={`k-${c.id}`}>
          {KIND_OPTS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={c.kind === k.id}
              className={c.kind === k.id ? 'on' : ''}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {c.kind === 'scale' && (
        <div className="om-field-row">
          <label className="om-field">
            <span>Dari</span>
            <select
              className="om-select sm"
              value={c.min}
              onChange={(e) => onChange({ min: +e.target.value })}
            >
              {[0, 1].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="om-field">
            <span>Sampai</span>
            <select
              className="om-select sm"
              value={c.max}
              onChange={(e) => onChange({ max: +e.target.value })}
            >
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="om-field">
            <span>Bobot</span>
            <select
              className="om-select sm"
              value={scored ? c.weight : 0}
              onChange={(e) => {
                const w = +e.target.value;
                onChange(
                  w ? { scoring: 'weighted', weight: w } : { scoring: 'none' },
                );
              }}
            >
              <option value={0}>Tidak dinilai</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  ×{n}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {c.kind === 'boolean' && (
        <div className="om-field">
          <span>Jika dijawab “Ya”</span>
          <div className="om-choice-list" role="radiogroup">
            {[
              [
                'gate',
                'Syarat wajib',
                'Pendaftar yang dijawab “Tidak” ditandai. Tidak menambah skor.',
              ],
              ['points', 'Tambah poin', null],
              ['none', 'Tidak dinilai', 'Hanya sebagai catatan untuk tim.'],
            ].map(([id, label, hint]) => (
              <label key={id} className="om-choice-opt">
                <input
                  type="radio"
                  name={`b-${c.id}`}
                  checked={c.scoring === id}
                  onChange={() => onChange({ scoring: id })}
                />
                <span>
                  <strong>{label}</strong>
                  {id === 'points' ? (
                    <span className="om-inline-num">
                      {' '}
                      sebanyak{' '}
                      <input
                        type="number"
                        min={1}
                        max={20}
                        className="om-input xs"
                        value={c.points}
                        onChange={(e) =>
                          onChange({
                            points: clamp(+e.target.value || 0, 0, 20),
                            scoring: 'points',
                          })
                        }
                        aria-label="Poin jika Ya"
                      />{' '}
                      poin
                    </span>
                  ) : (
                    <small>{hint}</small>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {c.kind === 'enum' && (
        <div className="om-field">
          <span>Pilihan jawaban{scored ? ' dan poinnya' : ''}</span>
          <div className="om-opt-list">
            {c.options.map((o, i) => (
              <div key={o.id} className="om-opt-row">
                <input
                  className="om-input"
                  value={o.label}
                  aria-label={`Pilihan ${i + 1}`}
                  onChange={(e) => setOpt(i, { label: e.target.value })}
                />
                {scored && (
                  <input
                    type="number"
                    min={0}
                    max={20}
                    className="om-input xs"
                    value={o.points}
                    aria-label={`Poin pilihan ${i + 1}`}
                    onChange={(e) =>
                      setOpt(i, { points: clamp(+e.target.value || 0, 0, 20) })
                    }
                  />
                )}
                <button
                  type="button"
                  className="om-icon-btn sm"
                  aria-label={`Hapus pilihan ${o.label || i + 1}`}
                  disabled={c.options.length <= 2}
                  onClick={() =>
                    onChange({ options: c.options.filter((_, j) => j !== i) })
                  }
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="om-link sm"
              onClick={() =>
                onChange({
                  options: [
                    ...c.options,
                    { id: uid('o'), label: '', points: 0 },
                  ],
                })
              }
            >
              <Icon name="plus" size={14} />
              Tambah pilihan
            </button>
          </div>
          <label className="om-check">
            <input
              type="checkbox"
              checked={scored}
              onChange={(e) =>
                onChange({ scoring: e.target.checked ? 'points' : 'none' })
              }
            />
            <span>Masukkan ke skor</span>
          </label>
        </div>
      )}

      {c.kind === 'text' && (
        <p className="om-small om-dim">
          Penilai menulis catatan bebas. Tidak memengaruhi skor.
        </p>
      )}

      <label className="om-field">
        <span>Sorot jawaban saat menilai</span>
        <select
          className="om-select sm"
          value={c.src || ''}
          onChange={(e) => onChange({ src: e.target.value || undefined })}
        >
          {SOURCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}

function CritList({ list, disabled, onEdit, onAdd, emptyText }) {
  const [openId, setOpenId] = useState(null);
  const max = list.reduce((s, c) => s + critMax(c), 0);
  return (
    <div className="om-crit-list">
      {!list.length && (
        <p className="om-small om-dim om-crit-empty">{emptyText}</p>
      )}
      {list.map((c, i) => {
        const open = openId === c.id;
        return (
          <div key={c.id} className={'om-crit-item' + (open ? ' open' : '')}>
            <div className="om-crit-sum">
              <button
                type="button"
                className="om-crit-toggle"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : c.id)}
              >
                <Icon name={open ? 'chevDown' : 'chevRight'} size={14} />
                <span className="om-crit-name">
                  {c.label || <em>Tanpa nama</em>}
                </span>
                <span className="om-crit-meta">
                  {critRule(c)} · {critEffect(c)}
                </span>
              </button>
              {!disabled && (
                <span className="om-crit-acts">
                  <button
                    type="button"
                    className="om-icon-btn sm"
                    aria-label={`Naikkan ${c.label}`}
                    disabled={i === 0}
                    onClick={() => onEdit('move', c, -1)}
                  >
                    <Icon name="arrowUp" size={14} />
                  </button>
                  <button
                    type="button"
                    className="om-icon-btn sm"
                    aria-label={`Turunkan ${c.label}`}
                    disabled={i === list.length - 1}
                    onClick={() => onEdit('move', c, 1)}
                  >
                    <Icon name="arrowDown" size={14} />
                  </button>
                  <button
                    type="button"
                    className="om-icon-btn sm danger"
                    aria-label={`Hapus ${c.label}`}
                    onClick={() => onEdit('delete', c)}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </span>
              )}
            </div>
            {open && (
              <CritEditor
                c={c}
                disabled={disabled}
                onChange={(patch) => onEdit('patch', c, patch)}
              />
            )}
          </div>
        );
      })}
      <div className="om-crit-foot">
        {!disabled && (
          <button
            type="button"
            className="om-btn outline sm"
            onClick={() => {
              const id = onAdd();
              setOpenId(id);
            }}
          >
            <Icon name="plus" size={14} />
            Tambah kriteria
          </button>
        )}
        <span className="om-small om-dim">
          Skor maksimum: <span className="om-num">{max}</span> poin
        </span>
      </div>
    </div>
  );
}

const SCHEME_OPTS = [
  {
    id: 'multi',
    label: 'Beberapa penilai per berkas',
    desc: 'Setiap bagian berkas boleh dinilai lebih dari satu penilai yang cakupannya sesuai. Skor = rata-rata semua penilai, dan penilai bisa melihat nilai penilai lain.',
  },
  {
    id: 'single',
    label: 'Satu penilai per berkas',
    desc: 'Admin oprec menugaskan tepat satu penilai untuk tiap bagian berkas. Penilai hanya menilai berkas yang ditugaskan kepadanya.',
  },
  {
    id: 'boolean',
    label: 'Lolos atau tidak lolos',
    desc: 'Tidak memakai skor. Penilai langsung menetapkan hasil untuk setiap pendaftar.',
  },
];
function SchemeSection({ st, ad, setScheme, autoAssignAll }) {
  const loads =
    st.scheme === 'single'
      ? st.reviewers
          .map((r) => {
            const mine = ALL_TGS.filter(([tg]) => st.assign[tg] === r.id);
            const done = mine.filter(([tg, unit]) =>
              scoreOf(st, tg, unit),
            ).length;
            return {
              r,
              a: mine.filter(([tg]) => tg[0] === 'A').length,
              c: mine.filter(([tg]) => tg[0] === 'C').length,
              done,
              total: mine.length,
            };
          })
          .filter((x) => x.total)
      : [];
  const gaps = st.scheme === 'single' ? unassignedTgs(st).length : 0;
  return (
    <section className="om-set" data-settings="penilaian">
      <div className="om-set-head">
        <h2>Skema penilaian</h2>
        <p>
          Tentukan apakah satu berkas boleh dinilai beberapa orang, atau dibagi
          sehingga setiap berkas punya satu penilai.
        </p>
      </div>
      <div className="om-panel om-vis">
        <div
          className="om-radio-cards"
          role="radiogroup"
          aria-label="Skema penilaian"
        >
          {SCHEME_OPTS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={st.scheme === o.id}
              disabled={!ad}
              className={'om-radio-card' + (st.scheme === o.id ? ' on' : '')}
              onClick={() => st.scheme !== o.id && setScheme(o.id)}
            >
              <span className="om-radio-dot" aria-hidden="true" />
              <span>
                <strong>{o.label}</strong>
                <small>{o.desc}</small>
              </span>
            </button>
          ))}
        </div>
        {st.scheme === 'single' && (
          <div className="om-assign-sum">
            <div className="om-assign-head">
              <h3>Pembagian penilaian</h3>
              {gaps > 0 ? (
                <span className="om-pill t-amber">
                  {gaps} bagian belum ditugaskan
                </span>
              ) : (
                <span className="om-pill t-teal">
                  Semua berkas sudah punya penilai
                </span>
              )}
            </div>
            <table className="om-rtable">
              <thead>
                <tr>
                  <th>Penilai</th>
                  <th className="om-right">Umum</th>
                  <th className="om-right">Divisi</th>
                  <th className="om-right">Selesai</th>
                </tr>
              </thead>
              <tbody>
                {loads.map(({ r, a, c, done, total }) => (
                  <tr key={r.id}>
                    <td>{r.name || 'Penilai baru'}</td>
                    <td className="om-right om-num">{a}</td>
                    <td className="om-right om-num">{c}</td>
                    <td className="om-right om-num">
                      {done}/{total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="om-assign-foot">
              {ad && (
                <button
                  type="button"
                  className="om-btn outline sm"
                  disabled={!gaps}
                  onClick={autoAssignAll}
                >
                  Bagi rata yang belum ditugaskan
                </button>
              )}
              <span className="om-small om-dim">
                Penugasan per berkas bisa diubah di tab Pendaftar: kolom
                Penilai, atau pilih beberapa baris lalu “Tugaskan penilai”.
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PengaturanView({ st, role, update, setScheme, autoAssignAll }) {
  const ad = role.admin;
  const [settingsTab, setSettingsTab] = useState('struktur');
  const preset = st.preset === 'blind' ? 'anon' : st.preset;
  const setPreset = (id) =>
    update(
      (n) => {
        n.preset = id === 'anon' ? 'blind' : id;
      },
      `Visibilitas diubah ke ${VIS_OPTS.find((o) => o.id === id).label}`,
    );
  const [extraUnit, setExtraUnit] = useState(
    Object.keys(st.rubrics.extra)[0] || OPEN[0].id,
  );
  const roots = UNITS.filter((u) => !u.parent);

  /* group = "umum" | "divisi" | id divisi untuk kriteria khusus */
  const listOf = (rubrics, group) =>
    group === 'umum' || group === 'divisi'
      ? rubrics[group]
      : (rubrics.extra[group] ||= []);
  const editRubric = (group) => (action, c, arg) => {
    const msg =
      action === 'delete'
        ? `Kriteria “${c.label || 'tanpa nama'}” dihapus`
        : null;
    update(
      (n) => {
        n.rubrics = structuredClone(n.rubrics);
        const list = listOf(n.rubrics, group);
        const i = list.findIndex((x) => x.id === c.id);
        if (action === 'patch') list[i] = { ...list[i], ...arg };
        else if (action === 'delete') list.splice(i, 1);
        else if (action === 'move') {
          const j = i + arg;
          [list[i], list[j]] = [list[j], list[i]];
        }
      },
      msg,
      action === 'delete',
    );
  };
  const addCrit = (group) => () => {
    const id = uid('c');
    update(
      (n) => {
        n.rubrics = structuredClone(n.rubrics);
        listOf(n.rubrics, group).push({
          id,
          label: '',
          kind: 'scale',
          ...structuredClone(KIND_DEFAULTS.scale),
        });
      },
      null,
      false,
    );
    return id;
  };
  const editReviewers = (fn, msg, undoable = false) =>
    update(
      (n) => {
        n.reviewers = fn(n.reviewers.map((r) => ({ ...r })));
      },
      msg,
      undoable,
    );

  const unitRow = (u, child) => {
    const n = CHOICES.filter((c) => c.unit === u.id).length;
    const hasKids = UNITS.some((k) => k.parent === u.id);
    return (
      <div
        key={u.id}
        className={
          'om-unit-row' + (child ? ' child' : '') + (u.open ? '' : ' closed')
        }
      >
        <div>
          <span className="om-unit-name">{u.name}</span>
          <small>
            {u.open
              ? `${n} peminat`
              : hasKids
                ? 'Pendaftaran dibuka di divisinya'
                : 'Tidak membuka pendaftaran'}
          </small>
        </div>
        {(u.open || u.id === 'bendahara') && (
          <div
            className="om-stepper"
            role="group"
            aria-label={`Kuota ${u.name}`}
          >
            <button
              type="button"
              aria-label="Kurangi kuota"
              disabled={!ad || st.quota[u.id] <= 0}
              onClick={() =>
                update(
                  (s) => {
                    s.quota[u.id] = Math.max(0, s.quota[u.id] - 1);
                  },
                  null,
                  false,
                )
              }
            >
              <Icon name="minus" size={14} />
            </button>
            <span className="om-num">{st.quota[u.id]}</span>
            <button
              type="button"
              aria-label="Tambah kuota"
              disabled={!ad}
              onClick={() =>
                update(
                  (s) => {
                    s.quota[u.id] += 1;
                  },
                  null,
                  false,
                )
              }
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="om-settings" data-settings-tab={settingsTab}>
      {!ad && (
        <Notice icon="lock">
          Hanya admin oprec yang bisa mengubah pengaturan. Kamu melihatnya dalam
          mode baca saja.
        </Notice>
      )}
      <div
        className="om-seg om-settings-nav"
        role="tablist"
        aria-label="Bagian pengaturan"
      >
        {[
          ['struktur', 'Struktur'],
          ['penilaian', 'Penilaian'],
          ['tim', 'Tim & akses'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={settingsTab === id}
            className={settingsTab === id ? 'on' : ''}
            onClick={() => setSettingsTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="om-set" data-settings="struktur">
        <div className="om-set-head">
          <h2>Divisi yang membuka pendaftaran</h2>
          <p>
            Diambil dari organogram kegiatan. Kuota sudah termasuk anggota yang
            ditunjuk langsung tanpa mendaftar.
          </p>
        </div>
        <div className="om-panel om-tree">
          {roots.map((r) => [
            unitRow(r, false),
            ...UNITS.filter((k) => k.parent === r.id).map((k) =>
              unitRow(k, true),
            ),
          ])}
        </div>
      </section>

      <section className="om-set" data-settings="struktur">
        <div className="om-set-head">
          <h2>Lampiran pendaftar</h2>
          <p>
            Tentukan data tambahan yang dikumpulkan per pendaftar. Kolom hanya
            muncul di Dashboard bila diaktifkan.
          </p>
        </div>
        <div className="om-panel om-team">
          {st.lampiran.map((l) => (
            <div
              key={l.id}
              className="om-team-row"
              style={{
                gridTemplateColumns: 'minmax(0,1.4fr) 120px 120px 32px',
              }}
            >
              <input
                className="om-input"
                value={l.label}
                disabled={!ad}
                onChange={(e) =>
                  update((n) => {
                    n.lampiran = n.lampiran.map((x) =>
                      x.id === l.id ? { ...x, label: e.target.value } : x,
                    );
                  })
                }
              />
              <span className="om-small om-dim">
                {l.kind === 'link' ? 'Tautan' : 'Angka'}
              </span>
              <label className="om-check">
                <input
                  type="checkbox"
                  checked={l.visible}
                  disabled={!ad}
                  onChange={(e) =>
                    update((n) => {
                      n.lampiran = n.lampiran.map((x) =>
                        x.id === l.id ? { ...x, visible: e.target.checked } : x,
                      );
                    })
                  }
                />
                <span>Aktif</span>
              </label>
              <button
                type="button"
                className="om-icon-btn sm danger"
                disabled={!ad}
                onClick={() =>
                  update((n) => {
                    n.lampiran = n.lampiran.filter((x) => x.id !== l.id);
                  })
                }
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
          {ad && (
            <div className="om-team-foot">
              <button
                type="button"
                className="om-btn outline sm"
                onClick={() =>
                  update((n) => {
                    n.lampiran = [
                      ...n.lampiran,
                      {
                        id: uid('l'),
                        label: 'Lampiran baru',
                        kind: 'link',
                        required: false,
                        visible: false,
                      },
                    ];
                  })
                }
              >
                <Icon name="plus" size={14} />
                Tambah lampiran
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="om-set" data-settings="struktur">
        <div className="om-set-head">
          <h2>Formulir pendaftaran</h2>
          <p>
            Pendaftar mengurutkan divisi yang diminati. Pertanyaan khusus sebuah
            divisi hanya muncul jika divisi itu dipilih.
          </p>
        </div>
        <div className="om-panel om-form-set">
          <div className="om-inline-field">
            <label htmlFor="om-max">Pendaftar boleh memilih hingga</label>
            <select
              id="om-max"
              className="om-select sm"
              value={st.maxChoices}
              disabled={!ad}
              onChange={(e) =>
                update(
                  (s) => {
                    s.maxChoices = +e.target.value;
                  },
                  null,
                  false,
                )
              }
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} divisi
                </option>
              ))}
            </select>
          </div>
          <div
            className="om-form-preview"
            aria-label="Pratinjau pertanyaan pilihan divisi"
          >
            <p className="om-preview-label">Pratinjau di formulir</p>
            <p className="om-preview-q">
              Divisi mana yang ingin kamu ikuti? Urutkan dari yang paling
              diminati.
            </p>
            {Array.from({ length: st.maxChoices }, (_, i) => (
              <div key={i} className="om-preview-row">
                <span>
                  Pilihan {i + 1}
                  {i === 0 ? ' *' : ''}
                </span>
                <select
                  className="om-select sm"
                  defaultValue=""
                  aria-label={`Pilihan ${i + 1}`}
                >
                  <option value="">
                    {i === 0 ? 'Pilih divisi' : 'Opsional'}
                  </option>
                  {OPEN.map((u) => (
                    <option key={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="om-set" data-settings="penilaian">
        <div className="om-set-head">
          <h2>Kriteria penilaian</h2>
          <p>
            Skor = total poin dibagi poin maksimum. Kriteria bisa berupa skala
            angka, ya/tidak, pilihan, atau catatan yang tidak dinilai.
          </p>
          <p>
            Pengurus divisi yang tidak ikut menilai cukup menyerahkan kriteria
            divisinya ke admin oprec untuk dimasukkan di sini.
          </p>
        </div>
        <div className="om-panel om-rubrics">
          {ad && (
            <Notice icon="info">
              Penilaian sudah berjalan. Mengubah kriteria akan menghitung ulang
              skor. Kriteria baru membuat penilaian yang ada perlu dilengkapi,
              dan keputusan yang skornya berubah akan ditandai untuk ditinjau
              ulang.
            </Notice>
          )}

          <div className="om-rubric-group">
            <h3>Penilaian umum</h3>
            <p>
              Dinilai sekali per pendaftar dan berlaku untuk semua divisi
              pilihannya.
            </p>
            <CritList
              list={st.rubrics.umum}
              disabled={!ad}
              onEdit={editRubric('umum')}
              onAdd={addCrit('umum')}
              emptyText="Belum ada kriteria umum."
            />
          </div>

          <div className="om-rubric-group">
            <h3>Penilaian untuk semua divisi</h3>
            <p>
              Dinilai untuk setiap pilihan divisi, dengan kriteria yang sama di
              semua divisi.
            </p>
            <CritList
              list={st.rubrics.divisi}
              disabled={!ad}
              onEdit={editRubric('divisi')}
              onAdd={addCrit('divisi')}
              emptyText="Belum ada kriteria."
            />
          </div>

          <div className="om-rubric-group">
            <div className="om-rubric-group-head">
              <div>
                <h3>Kriteria khusus divisi</h3>
                <p>
                  Ditambahkan di atas kriteria untuk semua divisi, hanya untuk
                  divisi yang dipilih.
                </p>
              </div>
              <select
                className="om-select sm"
                aria-label="Divisi"
                value={extraUnit}
                onChange={(e) => setExtraUnit(e.target.value)}
              >
                {OPEN.map((u) => {
                  const n = st.rubrics.extra[u.id]?.length || 0;
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {n ? ` (${n})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <CritList
              key={extraUnit}
              list={st.rubrics.extra[extraUnit] || []}
              disabled={!ad}
              onEdit={editRubric(extraUnit)}
              onAdd={addCrit(extraUnit)}
              emptyText={`${U[extraUnit].name} belum punya kriteria khusus.`}
            />
          </div>

          <p className="om-small om-dim">
            Syarat wajib hanya menandai pendaftar. Keputusan menggugurkan tetap
            di tangan tim.
          </p>
        </div>
      </section>

      <SchemeSection
        st={st}
        ad={ad}
        setScheme={setScheme}
        autoAssignAll={autoAssignAll}
      />

      <section className="om-set" data-settings="tim">
        <div className="om-set-head">
          <h2>Tim penilai</h2>
          <p>
            Penilai bisa siapa saja, misalnya pengurus divisi masing-masing atau
            seluruhnya dari tim HR. Tiap penilai masuk dengan akun mahasiswanya
            sendiri, jadi setiap nilai tercatat atas nama orangnya.
          </p>
        </div>
        <div className="om-panel om-team">
          <div className="om-team-head" aria-hidden="true">
            <span>Nama</span>
            <span>
              {st.scheme === 'single'
                ? 'Boleh ditugaskan menilai'
                : 'Divisi yang dinilai'}
            </span>
            <span>Ikut mengisi</span>
            <span />
          </div>
          {st.reviewers.map((r) => (
            <div key={r.id} className="om-team-row">
              <div className="om-who">
                <Avatar name={r.name || '?'} />
                {r.admin ? (
                  <div>
                    <strong>{r.name}</strong>
                    <small>Admin oprec</small>
                  </div>
                ) : (
                  <input
                    className="om-input"
                    value={r.name}
                    aria-label="Nama penilai"
                    disabled={!ad}
                    placeholder="Nama penilai"
                    onChange={(e) =>
                      editReviewers((rs) =>
                        rs.map((x) =>
                          x.id === r.id ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                  />
                )}
              </div>
              {r.admin ? (
                <span className="om-small om-dim">Semua divisi</span>
              ) : (
                <select
                  className="om-select sm"
                  aria-label={`Divisi yang dinilai ${r.name}`}
                  value={r.scope}
                  disabled={!ad}
                  onChange={(e) =>
                    editReviewers((rs) =>
                      rs.map((x) =>
                        x.id === r.id ? { ...x, scope: e.target.value } : x,
                      ),
                    )
                  }
                >
                  <option value="all">Semua divisi</option>
                  <option value="none">Hanya penilaian umum</option>
                  {OPEN.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              )}
              <label className="om-check">
                <input
                  type="checkbox"
                  checked={r.general}
                  disabled={!ad || r.admin}
                  onChange={(e) =>
                    editReviewers((rs) =>
                      rs.map((x) =>
                        x.id === r.id ? { ...x, general: e.target.checked } : x,
                      ),
                    )
                  }
                />
                <span className="om-team-general">Penilaian umum</span>
              </label>
              {r.admin || !ad ? (
                <span />
              ) : (
                <button
                  type="button"
                  className="om-icon-btn sm danger"
                  aria-label={`Hapus ${r.name || 'penilai'}`}
                  onClick={() =>
                    editReviewers(
                      (rs) => rs.filter((x) => x.id !== r.id),
                      `${r.name || 'Penilai'} dihapus dari tim penilai`,
                      true,
                    )
                  }
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          ))}
          {ad && (
            <div className="om-team-foot">
              <button
                type="button"
                className="om-btn outline sm"
                onClick={() =>
                  editReviewers((rs) => [
                    ...rs,
                    {
                      id: uid('r'),
                      name: '',
                      admin: false,
                      scope: 'all',
                      general: false,
                    },
                  ])
                }
              >
                <Icon name="plus" size={14} />
                Tambah penilai
              </button>
              <span className="om-small om-dim">
                Nilai yang sudah diisi penilai tetap tersimpan meski ia dihapus.
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="om-set" data-settings="tim">
        <div className="om-set-head">
          <h2>Siapa yang bisa melihat apa</h2>
          <p>
            Admin oprec selalu melihat semua data. Aturan ini berlaku untuk
            penilai.
          </p>
        </div>
        <div className="om-panel om-vis">
          <div
            className="om-radio-cards"
            role="radiogroup"
            aria-label="Visibilitas untuk penilai"
          >
            {VIS_OPTS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={preset === o.id}
                disabled={!ad}
                className={'om-radio-card' + (preset === o.id ? ' on' : '')}
                onClick={() => setPreset(o.id)}
              >
                <span className="om-radio-dot" aria-hidden="true" />
                <span>
                  <strong>{o.label}</strong>
                  <small>{o.desc}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="om-switches">
            <Switch
              label="Sembunyikan urutan pilihan dari penilai"
              description="Penilai tidak tahu apakah divisinya pilihan pertama atau cadangan pendaftar."
              checked={st.preset === 'open' ? false : st.hideRank}
              disabled={!ad || st.preset === 'open'}
              onChange={(v) =>
                update(
                  (s) => {
                    s.hideRank = v;
                  },
                  null,
                  false,
                )
              }
            />
            {st.scheme === 'multi' && (
              <Switch
                label="Sembunyikan nilai penilai lain sampai penilai menyimpan nilainya"
                description="Mencegah penilai terpengaruh nilai orang lain."
                checked={st.preset === 'open' ? false : st.hideOthers}
                disabled={!ad || st.preset === 'open'}
                onChange={(v) =>
                  update(
                    (s) => {
                      s.hideOthers = v;
                    },
                    null,
                    false,
                  )
                }
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* =====================================================================
   KERANGKA APLIKASI
   ===================================================================== */
/* =====================================================================
   DASBOR PILIHAN — semua pendaftar sekaligus, satu baris per orang
   ===================================================================== */
/* Ringkasan posisi seorang pendaftar di seluruh pilihannya. */
function statusOf(st, app) {
  const ph = app.choices.map((c) => ({ c, p: phaseOf(st, c) }));
  const by = (...ps) => ph.find((x) => ps.includes(x.p));
  const o = by('offer');
  if (o) return { key: 'tempat', label: 'Sudah ditempatkan', unit: o.c.unit };
  if (ph.some((x) => ['unscored', 'scored', 'passed'].includes(x.p)))
    return { key: 'proses', label: 'Dalam seleksi', unit: null };
  if (ph.some((x) => x.p === 'failed'))
    return { key: 'tidak', label: 'Tidak lolos', unit: null };
  return { key: 'tidak', label: 'Tidak diterima', unit: null };
}
const STATUS_TONE = { tempat: 'navy-solid', proses: 'neutral', tidak: 'red' };
const STATUS_OPTS = [
  ['', 'Semua status'],
  ['proses', 'Dalam seleksi'],
  ['tempat', 'Sudah ditempatkan'],
  ['tidak', 'Tidak lolos / tidak diterima'],
];
const GROUP_OPTS = [
  ['', 'Tanpa kelompok'],
  ['fak', 'Fakultas'],
  ['pil1', 'Pilihan 1'],
  ['pil2', 'Pilihan 2'],
  ['pil3', 'Pilihan 3'],
  ['periode', 'Periode daftar'],
  ['syarat', 'Syarat umum'],
  ['ang', 'Angkatan'],
  ['status', 'Status'],
];
const SORT_OPTS = [
  ['at', 'Waktu daftar'],
  ['name', 'Nama'],
  ['nim', 'NIM'],
  ['asesmen', 'Nilai asesmen'],
  ['n', 'Jumlah pilihan'],
];
const DOT = (p) =>
  ['offer', 'passed', 'reserve'].includes(p)
    ? 'go'
    : ['failed', 'reject', 'released'].includes(p)
      ? 'stop'
      : 'wait';
const choiceAt = (app, r) => app.choices.find((c) => c.rank === r);
const DASH0 = {
  q: '',
  fak: '',
  periode: '',
  unit: '',
  rank: '',
  syarat: '',
  pindah: '',
  status: '',
  sort: 'at',
  dir: 1,
  group: '',
};

function DasborView({ st, dash, setDash, openSheets, toast }) {
  const set = (patch) => setDash((d) => ({ ...d, ...patch }));
  const [closed, setClosed] = useState({});
  const [dasborMode, setDasborMode] = useState('tabel');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const listRef = useRef(null);
  const ranks = [1, 2, 3];
  const units = OPEN;
  const lampiranAktif = st.lampiran.filter((l) => l.visible);
  const lampiranValue = (app, l) =>
    l.id === 'twibbon'
      ? TWIBBON[app.twibbon]
      : l.id === 'asesmen'
        ? app.asesmen
        : '—';

  /* Matriks divisi × urutan pilihan. */
  const mat = units.map((u) => {
    const cs = CHOICES.filter((c) => c.unit === u.id);
    return {
      u,
      by: ranks.map((r) => cs.filter((c) => c.rank === r).length),
      total: cs.length,
      quota: st.quota[u.id] - directCount(u.id),
    };
  });
  const colTot = ranks.map((_, i) => mat.reduce((s, m) => s + m.by[i], 0));
  const maxCell = Math.max(1, ...mat.flatMap((m) => m.by));

  const rows = useMemo(() => {
    const q = dash.q.trim().toLowerCase();
    let out = APPS.map((app) => ({
      app,
      s: statusOf(st, app),
      sy: syaratOf(app),
    }));
    if (q)
      out = out.filter(
        ({ app }) => app.name.toLowerCase().includes(q) || app.nim.includes(q),
      );
    if (dash.fak) out = out.filter(({ app }) => app.fak === dash.fak);
    if (dash.periode)
      out = out.filter(({ app }) => app.periode === dash.periode);
    if (dash.unit)
      out = out.filter(({ app }) =>
        app.choices.some(
          (c) =>
            c.unit === dash.unit &&
            (!dash.rank || c.rank === Number(dash.rank)),
        ),
      );
    else if (dash.rank)
      out = out.filter(({ app }) => app.choices.length >= Number(dash.rank));
    if (dash.syarat) out = out.filter((r) => r.sy === dash.syarat);
    if (dash.pindah)
      out = out.filter(({ app }) => (dash.pindah === 'ya') === app.pindah);
    if (dash.status) out = out.filter((r) => r.s.key === dash.status);
    const val = ({ app }) =>
      ({
        at: app.at,
        name: app.name,
        nim: app.nim,
        asesmen: app.asesmen,
        n: app.choices.length,
      })[dash.sort];
    return out.sort((a, b) => {
      const x = val(a),
        y = val(b);
      return (
        dash.dir * (typeof x === 'string' ? x.localeCompare(y, 'id') : x - y)
      );
    });
  }, [st, dash]);

  const groupKey = ({ app, s, sy }) => {
    switch (dash.group) {
      case 'fak':
        return app.fak;
      case 'pil1':
      case 'pil2':
      case 'pil3': {
        const c = choiceAt(app, Number(dash.group[3]));
        return c ? U[c.unit].short : 'Tidak mengisi';
      }
      case 'periode':
        return 'Periode ' + app.periode;
      case 'syarat':
        return SYARAT[sy];
      case 'ang':
        return 'Angkatan ' + app.ang;
      case 'status':
        return s.label;
      default:
        return '';
    }
  };
  const groups = useMemo(() => {
    const paged = rows.slice(page * pageSize, (page + 1) * pageSize);
    if (!dash.group) return [['', paged]];
    const m = new Map();
    paged.forEach((r) => {
      const k = groupKey(r);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    });
    return [...m].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'id'),
    );
  }, [rows, dash.group, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = [
    'fak',
    'periode',
    'unit',
    'rank',
    'syarat',
    'pindah',
    'status',
  ].filter((k) => dash[k]).length;
  const pickCell = (unit, rank) => {
    set({ unit, rank: rank ? String(rank) : '' });
    requestAnimationFrame(() =>
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };
  const nSy = (k) => APPS.filter((a) => syaratOf(a) === k).length;
  const nChoices = CHOICES.length;

  const exportCsv = () => {
    const esc = (x) => {
      const s = String(x ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = [
      'nim',
      'nama',
      'fakultas',
      'prodi',
      'angkatan',
      'periode',
      'waktu_daftar',
      'pilihan_1',
      'pilihan_2',
      'pilihan_3',
      'bersedia_dipindah',
      'twibbon',
      'nilai_asesmen',
      'status',
      'penempatan',
    ];
    const lines = [head.join(',')].concat(
      rows.map(({ app, s }) =>
        [
          app.nim,
          app.name,
          app.fak,
          app.prodi,
          app.ang,
          app.periode,
          fmtWaktu(app.at),
          ...ranks.map((r) =>
            choiceAt(app, r) ? U[choiceAt(app, r).unit].short : '',
          ),
          app.pindah ? 'ya' : 'tidak',
          TWIBBON[app.twibbon],
          app.asesmen,
          s.label,
          s.unit ? U[s.unit].short : '',
        ]
          .map(esc)
          .join(','),
      ),
    );
    try {
      const blob = new Blob(['﻿' + lines.join('\n')], {
        type: 'text/csv;charset=utf-8',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'dasbor-pilihan-oskm-itb-2027.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast(`${rows.length} pendaftar diekspor ke CSV`);
    } catch {
      toast('Browser menolak unduhan. Coba lagi dari tab baru.');
    }
  };

  if (dasborMode === 'grafik')
    return (
      <div className="om-stack lg">
        <div className="om-mode">
          <div
            className="om-seg"
            role="radiogroup"
            aria-label="Tampilan dashboard"
          >
            <button
              type="button"
              role="radio"
              aria-checked={false}
              onClick={() => setDasborMode('tabel')}
            >
              Tabel
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={true}
              className="on"
            >
              Grafik
            </button>
          </div>
        </div>
        <GrafikView
          st={st}
          role={{ admin: true, units: OPEN.map((u) => u.id), id: 'admin' }}
        />
      </div>
    );

  return (
    <div className="om-stack lg">
      <div className="om-mode">
        <div
          className="om-seg"
          role="radiogroup"
          aria-label="Tampilan dashboard"
        >
          <button type="button" role="radio" aria-checked={true} className="on">
            Tabel
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={false}
            onClick={() => setDasborMode('grafik')}
          >
            Grafik
          </button>
        </div>
      </div>
      <div className="om-kpis" data-tour="dasbor-kpi">
        <div className="om-kpi">
          <span>Pendaftar</span>
          <strong className="om-num">{APPS.length}</strong>
          <small>
            {nChoices} pilihan · rata-rata {fmt1(nChoices / APPS.length)} per
            orang
          </small>
        </div>
        {lampiranAktif.some((l) => l.kind === 'link') && (
          <button
            type="button"
            className="om-kpi as-btn"
            onClick={() => set({ syarat: 'bermasalah' })}
          >
            <span>Lampiran bermasalah</span>
            <strong className="om-num">{nSy('bermasalah')}</strong>
            <small>Perlu diperiksa sebelum penilaian</small>
          </button>
        )}
        {lampiranAktif.some((l) => l.kind === 'number') && (
          <div className="om-kpi">
            <span>Lampiran angka</span>
            <strong className="om-num">
              {lampiranAktif.filter((l) => l.kind === 'number').length}
            </strong>
            <small>Kolom aktif di dashboard</small>
          </div>
        )}
        <button
          type="button"
          className="om-kpi as-btn"
          onClick={() => set({ pindah: 'ya' })}
        >
          <span>Bersedia dipindahkan</span>
          <strong className="om-num">
            {APPS.filter((a) => a.pindah).length}
          </strong>
          <small>Bisa ditempatkan di luar pilihannya</small>
        </button>
      </div>

      <section className="om-stack" data-tour="dasbor-matrix">
        <div className="om-sec-head">
          <h2 className="om-h2">Pendaftar per divisi</h2>
          <p className="om-dim">
            Klik angka untuk melihat orangnya di daftar bawah.
          </p>
        </div>
        <div className="om-table-wrap">
          <table className="om-table om-matrix">
            <thead>
              <tr>
                <th>Divisi</th>
                {ranks.map((r) => (
                  <th key={r} className="om-right">
                    Pilihan {r}
                  </th>
                ))}
                <th className="om-right">Total</th>
                <th className="om-right">Kuota</th>
                <th>
                  <span className="om-sr">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {mat.map(({ u, by, total, quota }, idx) => {
                return (
                  <React.Fragment key={u.id}>
                    {(idx === 0 || mat[idx - 1].u.parent !== u.parent) && (
                      <tr className="om-group-row">
                        <td colSpan={7}>
                          <strong>{U[u.parent]?.name}</strong>
                        </td>
                      </tr>
                    )}
                    <tr className={dash.unit === u.id ? 'is-sel' : ''}>
                      <td>
                        <div className="om-choice">
                          {u.name}
                          <small>{U[u.parent]?.name ?? 'Tanpa bidang'}</small>
                        </div>
                      </td>
                      {by.map((n, i) => (
                        <td key={i} className="om-right">
                          <button
                            type="button"
                            className={
                              'om-cell' +
                              (dash.unit === u.id && dash.rank === String(i + 1)
                                ? ' on'
                                : '')
                            }
                            style={{ '--fill': `${(n / maxCell) * 100}%` }}
                            onClick={() => pickCell(u.id, i + 1)}
                            aria-label={`${n} pendaftar memilih ${u.name} sebagai pilihan ${i + 1}`}
                          >
                            {n}
                          </button>
                        </td>
                      ))}
                      <td className="om-right">
                        <button
                          type="button"
                          className={
                            'om-cell plain' +
                            (dash.unit === u.id && !dash.rank ? ' on' : '')
                          }
                          onClick={() => pickCell(u.id, 0)}
                        >
                          {total}
                        </button>
                      </td>
                      <td className="om-right om-num">{quota}</td>
                      <td className="om-right">
                        <button
                          type="button"
                          className="om-row-link"
                          onClick={() => openSheets(u.id)}
                        >
                          Sheets
                          <Icon name="chevRight" size={14} />
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {colTot.map((n, i) => (
                  <td key={i} className="om-right om-num">
                    {n}
                  </td>
                ))}
                <td className="om-right om-num">{nChoices}</td>
                <td className="om-right om-num">
                  {mat.reduce((s, m) => s + m.quota, 0)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="om-stack" ref={listRef} data-tour="dasbor-list">
        <div className="om-sec-head">
          <h2 className="om-h2">Semua pendaftar</h2>
          <p className="om-dim">
            Satu baris per orang, lengkap dengan pilihan 1–3 dan syarat umumnya.
          </p>
        </div>
        <div className="om-toolbar" data-tour="dasbor-controls">
          <label className="om-search">
            <Icon name="search" />
            <input
              type="search"
              placeholder="Cari nama atau NIM"
              value={dash.q}
              onChange={(e) => set({ q: e.target.value })}
            />
          </label>
          <label className="om-inline">
            <span>Kelompokkan</span>
            <select
              className="om-select"
              value={dash.group}
              onChange={(e) => set({ group: e.target.value })}
            >
              {GROUP_OPTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="om-inline">
            <span>Urutkan</span>
            <select
              className="om-select"
              value={dash.sort}
              onChange={(e) =>
                set({
                  sort: e.target.value,
                  dir:
                    e.target.value === 'asesmen' || e.target.value === 'n'
                      ? -1
                      : 1,
                })
              }
            >
              {SORT_OPTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="om-icon-btn"
            aria-label={
              dash.dir > 0
                ? 'Urutan naik, ubah ke turun'
                : 'Urutan turun, ubah ke naik'
            }
            onClick={() => set({ dir: -dash.dir })}
          >
            <Icon name={dash.dir > 0 ? 'arrowUp' : 'arrowDown'} />
          </button>
          <button type="button" className="om-btn outline" onClick={exportCsv}>
            <Icon name="download" />
            Ekspor CSV
          </button>
        </div>
        <div className="om-filters">
          <select
            className="om-select sm"
            aria-label="Fakultas"
            value={dash.fak}
            onChange={(e) => set({ fak: e.target.value })}
          >
            <option value="">Semua fakultas</option>
            {FAKULTAS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select
            className="om-select sm"
            aria-label="Periode"
            value={dash.periode}
            onChange={(e) => set({ periode: e.target.value })}
          >
            <option value="">Semua periode</option>
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            className="om-select sm"
            aria-label="Divisi"
            value={dash.unit}
            onChange={(e) => set({ unit: e.target.value })}
          >
            <option value="">Semua divisi</option>
            {unitGroups(units).map(({ bidang, units: grouped }) => (
              <optgroup key={bidang.id} label={bidang.name}>
                {grouped.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.short}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            className="om-select sm"
            aria-label="Urutan pilihan"
            value={dash.rank}
            onChange={(e) => set({ rank: e.target.value })}
          >
            <option value="">
              {dash.unit ? 'di pilihan mana saja' : 'Semua urutan'}
            </option>
            {ranks.map((r) => (
              <option key={r} value={r}>
                {dash.unit ? `sebagai pilihan ${r}` : `Punya pilihan ${r}`}
              </option>
            ))}
          </select>
          <select
            className="om-select sm"
            aria-label="Syarat umum"
            value={dash.syarat}
            onChange={(e) => set({ syarat: e.target.value })}
          >
            <option value="">Semua syarat</option>
            {Object.entries(SYARAT).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <select
            className="om-select sm"
            aria-label="Bersedia dipindahkan"
            value={dash.pindah}
            onChange={(e) => set({ pindah: e.target.value })}
          >
            <option value="">Bersedia dipindah?</option>
            <option value="ya">Bersedia dipindah</option>
            <option value="tidak">Tidak bersedia</option>
          </select>
          <select
            className="om-select sm"
            aria-label="Status"
            value={dash.status}
            onChange={(e) => set({ status: e.target.value })}
          >
            {STATUS_OPTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {active > 0 && (
            <button
              type="button"
              className="om-link"
              onClick={() =>
                set({
                  fak: '',
                  periode: '',
                  unit: '',
                  rank: '',
                  syarat: '',
                  pindah: '',
                  status: '',
                })
              }
            >
              Hapus {active} filter
            </button>
          )}
        </div>

        <div className="om-table-wrap">
          <table className="om-table om-dash">
            <thead>
              <tr>
                <th>Pendaftar</th>
                <th>Fakultas</th>
                <th>Daftar</th>
                {ranks.map((r) => (
                  <th key={r}>Pilihan {r}</th>
                ))}
                <th>Pindah?</th>
                {lampiranAktif.map((l) => (
                  <th
                    key={l.id}
                    className={l.kind === 'number' ? 'om-right' : ''}
                  >
                    {l.label}
                  </th>
                ))}
                <th>Status</th>
              </tr>
            </thead>
            {groups.map(([g, list]) => (
              <tbody key={g || 'all'}>
                {dash.group && (
                  <tr className="om-group-row">
                    <td colSpan={11}>
                      <button
                        type="button"
                        className="om-group-btn"
                        aria-expanded={!closed[g]}
                        onClick={() => setClosed((c) => ({ ...c, [g]: !c[g] }))}
                      >
                        <Icon
                          name={closed[g] ? 'chevRight' : 'chevDown'}
                          size={14}
                        />
                        <strong>{g}</strong>
                        <span className="om-count">{list.length}</span>
                      </button>
                    </td>
                  </tr>
                )}
                {!closed[g] &&
                  list.map(({ app, s, sy }) => (
                    <tr key={app.id}>
                      <td>
                        <div className="om-who">
                          <Avatar name={app.name} />
                          <div>
                            <strong className="om-who-strong">
                              {app.name}
                            </strong>
                            <small>
                              {app.nim} · {app.prodi}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{app.fak}</td>
                      <td className="nowrap">
                        <div className="om-choice">
                          {app.periode}
                          <small>{fmtWaktu(app.at)}</small>
                        </div>
                      </td>
                      {ranks.map((r) => {
                        const c = choiceAt(app, r);
                        if (!c)
                          return (
                            <td key={r}>
                              <span className="om-dim">—</span>
                            </td>
                          );
                        const p = phaseOf(st, c);
                        return (
                          <td key={r}>
                            <span
                              className={
                                'om-dchip ' +
                                DOT(p) +
                                (dash.unit === c.unit ? ' hl' : '')
                              }
                              title={`${U[c.unit].name}: ${PHASE[p].label}`}
                            >
                              <i />
                              {U[c.unit].short}
                            </span>
                          </td>
                        );
                      })}
                      <td>
                        {app.pindah ? (
                          'Ya'
                        ) : (
                          <span className="om-dim">Tidak</span>
                        )}
                      </td>
                      {lampiranAktif.map((l) => (
                        <td
                          key={l.id}
                          className={
                            l.kind === 'number' ? 'om-right om-num' : ''
                          }
                        >
                          {lampiranValue(app, l)}
                        </td>
                      ))}
                      <td>
                        <span className={'om-pill sm t-' + STATUS_TONE[s.key]}>
                          {s.label}
                          {s.unit ? ` · ${U[s.unit].short}` : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
          {!rows.length && (
            <div className="om-empty">
              <p>Tidak ada pendaftar yang cocok dengan filter ini.</p>
            </div>
          )}
        </div>
        <div className="om-table-foot">
          <span>
            {rows.length} dari {APPS.length} pendaftar.{' '}
            <span className="om-legend">
              <i className="om-dot wait" />
              dalam seleksi <i className="om-dot go" />
              lolos/ditawari <i className="om-dot done" />
              bergabung <i className="om-dot stop" />
              tidak lanjut
            </span>
          </span>
          <Pagination
            total={rows.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </section>
    </div>
  );
}

/* =====================================================================
   SHEETS — tampilan menyamping per divisi, seperti sheet pendivisian
   Tiga blok berdampingan (pilihan 1, 2, 3); jawaban memanjang ke kanan.
   ===================================================================== */
function SheetsView({ st, role, act, openNilai, unit, setUnit, visUnits }) {
  const [general, setGeneral] = useState(false);
  const [onlySafe, setOnlySafe] = useState(false);
  const [open, setOpen] = useState({});
  const [activeRank, setActiveRank] = useState('1');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const masked = isMasked(st, role);
  const rankVisible = showRank(st, role);
  const u = U[unit] ? unit : visUnits[0]?.id;
  if (!u)
    return <Notice icon="lock">Belum ada divisi yang bisa kamu lihat.</Notice>;
  const cs = CHOICES.filter(
    (c) =>
      c.unit === u &&
      canSee(st, role, c) &&
      (!onlySafe || syaratOf(c.app) === 'aman'),
  ).sort((a, b) => a.app.at.localeCompare(b.app.at));
  const blocks = rankVisible
    ? [1, 2, 3]
        .map((r) => ({
          id: String(r),
          title: `Pilihan ${r}`,
          list: cs.filter((c) => c.rank === r),
        }))
        .filter((b) => b.list.length)
    : [{ id: 'all', title: 'Semua pendaftar', list: cs }];
  const selectedBlock =
    blocks.find((b) => b.id === (rankVisible ? activeRank : 'all')) ||
    blocks[0];
  const shownList = selectedBlock
    ? selectedBlock.list.slice(page * pageSize, (page + 1) * pageSize)
    : [];
  const qs = UQ[u].qs;
  const gq = general ? Object.entries(GENERAL_Q) : [];
  const placeOf = (app) => {
    const s = statusOf(st, app);
    return s.unit
      ? {
          text: U[s.unit].short,
          here: s.unit === u,
          tone: STATUS_TONE[s.key],
          label: s.label,
        }
      : null;
  };

  return (
    <div className="om-stack">
      <div className="om-toolbar" data-tour="sheets-controls">
        <label className="om-inline">
          <span>Divisi</span>
          <select
            className="om-select"
            value={u}
            onChange={(e) => setUnit(e.target.value)}
          >
            {unitGroups(visUnits).map(({ bidang, units: grouped }) => (
              <optgroup key={bidang.id} label={bidang.name}>
                {grouped.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({CHOICES.filter((c) => c.unit === x.id).length})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="om-check">
          <input
            type="checkbox"
            checked={general}
            onChange={(e) => setGeneral(e.target.checked)}
          />
          <span>Tampilkan jawaban umum</span>
        </label>
        <label className="om-check">
          <input
            type="checkbox"
            checked={onlySafe}
            onChange={(e) => setOnlySafe(e.target.checked)}
          />
          <span>Hanya yang syaratnya aman</span>
        </label>
      </div>
      <p className="om-dim om-small">
        Isi kolom Status langsung di sini, sama seperti di sheet pendivisian.
        Status baru bisa diisi setelah berkasnya dinilai lengkap; klik{' '}
        <b>Nilai</b> untuk membuka rubriknya.
        {!rankVisible &&
          ' Urutan pilihan disembunyikan untuk penilai divisi di oprec ini.'}
      </p>
      {rankVisible && (
        <div className="om-seg" role="tablist" aria-label="Urutan pilihan">
          {blocks.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={activeRank === b.id}
              className={activeRank === b.id ? 'on' : ''}
              onClick={() => {
                setActiveRank(b.id);
                setPage(0);
              }}
            >
              {b.title} <span className="om-count">{b.list.length}</span>
            </button>
          ))}
        </div>
      )}
      {masked && (
        <Notice icon="eyeOff">
          Nama pendaftar disembunyikan selama seleksi berkas. Isi jawaban tetap
          ditampilkan apa adanya.
        </Notice>
      )}
      <div className="om-sheet-wrap" data-tour="sheets-grid">
        <div className="om-sheet-blocks">
          {[{ ...selectedBlock, list: shownList }].filter(Boolean).map((b) => {
            const lolos = b.list.filter(
              (c) => st.status[c.id] === 'passed',
            ).length;
            const ga = b.list.filter(
              (c) => st.status[c.id] === 'failed',
            ).length;
            return (
              <table key={b.title} className="om-sheet">
                <thead>
                  <tr className="om-sheet-title">
                    <th colSpan={7 + gq.length + qs.length}>
                      <span>{b.title}</span>
                      <small>
                        {b.list.length} pendaftar · {lolos} lolos · {ga} ga
                        lolos
                      </small>
                    </th>
                  </tr>
                  <tr>
                    <th className="num">#</th>
                    <th>NIM</th>
                    <th>Nama</th>
                    <th>Penempatan</th>
                    <th>Syarat</th>
                    <th className="num">Skor</th>
                    <th>Status</th>
                    {gq.map(([k, q]) => (
                      <th key={k} className="ans gen" title={q}>
                        {q}
                      </th>
                    ))}
                    {qs.map((q, k) => (
                      <th key={k} className="ans" title={q}>
                        {q}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.list.map((c, i) => {
                    const sc = berkasOf(st, c),
                      pl = placeOf(c.app),
                      sy = syaratOf(c.app);
                    const val =
                      st.status[c.id] === 'passed'
                        ? 'pass'
                        : st.status[c.id] === 'failed'
                          ? 'fail'
                          : '';
                    const ed = canEdit(role, c) && !isLocked(st, c);
                    const ex = !!open[c.id];
                    return (
                      <tr key={c.id} className={ex ? 'ex' : ''}>
                        <td className="num">{i + 1}</td>
                        <td className="nowrap">{masked ? '—' : c.app.nim}</td>
                        <td className="nowrap">
                          <button
                            type="button"
                            className="om-who-name"
                            onClick={() => openNilai(c.id)}
                          >
                            {masked ? c.app.code : c.app.name}
                          </button>
                        </td>
                        <td className="nowrap">
                          {pl ? (
                            <span
                              className={
                                'om-pill sm t-' + (pl.here ? pl.tone : 'muted')
                              }
                              title={pl.label}
                            >
                              {pl.text}
                            </span>
                          ) : (
                            <span className="om-dim">—</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={
                              'om-pill sm t-' +
                              (sy === 'aman'
                                ? 'green'
                                : sy === 'belum'
                                  ? 'neutral'
                                  : 'red')
                            }
                            title={`Twibbon: ${TWIBBON[c.app.twibbon]} · asesmen ${c.app.asesmen}`}
                          >
                            {sy === 'aman'
                              ? 'Aman'
                              : sy === 'belum'
                                ? 'Belum'
                                : 'Masalah'}
                          </span>
                        </td>
                        <td className="num om-num">
                          {sc.pct == null ? (
                            <span className="om-dim">—</span>
                          ) : (
                            pct(sc.pct)
                          )}
                        </td>
                        <td className="nowrap">
                          {isLocked(st, c) ? (
                            <Pill phase={phaseOf(st, c)} />
                          ) : st.scheme !== 'boolean' &&
                            sc.pct == null &&
                            !val ? (
                            ed ? (
                              <button
                                type="button"
                                className="om-btn outline xs"
                                onClick={() => openNilai(c.id)}
                              >
                                Nilai
                              </button>
                            ) : (
                              <span className="om-dim">Belum dinilai</span>
                            )
                          ) : (
                            <select
                              className={'om-status-sel ' + (val || 'none')}
                              value={val}
                              disabled={!ed}
                              aria-label={`Status ${masked ? c.app.code : c.app.name}`}
                              onChange={(e) =>
                                act(c, e.target.value || 'reset')
                              }
                            >
                              <option value="">—</option>
                              <option value="pass">LOLOS</option>
                              <option value="fail">GA LOLOS</option>
                            </select>
                          )}
                        </td>
                        {gq.map(([k]) => (
                          <td
                            key={k}
                            className="ans gen"
                            onClick={() =>
                              setOpen((o) => ({ ...o, [c.id]: !ex }))
                            }
                          >
                            <div>{c.app.ans[k]}</div>
                          </td>
                        ))}
                        {qs.map((_, k) => (
                          <td
                            key={k}
                            className="ans"
                            onClick={() =>
                              setOpen((o) => ({ ...o, [c.id]: !ex }))
                            }
                          >
                            <div>{c.app.ans.unit[u][k]}</div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })}
        </div>
      </div>
      <p className="om-dim om-small">
        Klik sel jawaban untuk membaca jawaban lengkapnya.
      </p>
      {selectedBlock && (
        <Pagination
          total={selectedBlock.list.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
}

const TABS = [
  { id: 'dasbor', label: 'Dashboard', icon: 'grid', admin: true },
  { id: 'pendaftar', label: 'Pendaftar', icon: 'users' },
  { id: 'nilai', label: 'Nilai', icon: 'clipboard' },
  { id: 'penempatan', label: 'Penempatan', icon: 'userCheck' },
  { id: 'pengaturan', label: 'Pengaturan', icon: 'sliders' },
];
const STEPS = ['Pendaftaran', 'Seleksi', 'Keputusan', 'Penempatan', 'Selesai'];
const NAV = [
  { label: 'Beranda', icon: 'home' },
  { label: 'Kegiatan', icon: 'calendar', on: true },
  { label: 'Anggota', icon: 'user' },
  { label: 'Inbox', icon: 'mail' },
  { label: 'Laporan', icon: 'alert' },
];

export default function ManajemenOprec() {
  const [st, setSt] = useState(seed);
  const stRef = useRef(st);
  stRef.current = st;
  const [roleId, setRoleId] = useState('r_raka');
  const role = useMemo(() => roleOf(st, roleId), [st.reviewers, roleId]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Kalau penilai yang sedang "dilihat sebagai" dihapus, kembali ke admin. */
  useEffect(() => {
    if (!st.reviewers.some((r) => r.id === roleId))
      setRoleId(st.reviewers[0].id);
  }, [st.reviewers, roleId]);
  const [tab, setTab] = useState('dasbor');
  const [nilaiMode, setNilaiMode] = useState('berkas');
  const [sheetsUnit, setSheetsUnit] = useState('mentor');
  const [dash, setDash] = useState(DASH0);
  const [filters, setFilters] = useState({
    q: '',
    unit: '',
    phases: [],
    gate: false,
    queue: 'all',
  });
  const [sort, setSort] = useState({ key: 'score', dir: -1 });
  const [focusId, setFocusId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  /* Strip demo bisa satu atau dua baris; sidebar menempel tepat di bawahnya. */
  const rootRef = useRef(null),
    demoRef = useRef(null);
  useLayoutEffect(() => {
    const el = demoRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() =>
      rootRef.current?.style.setProperty('--demo-h', `${el.offsetHeight}px`),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const toastTimer = useRef(null);

  const toast = useCallback((text, undo) => {
    clearTimeout(toastTimer.current);
    setToastMsg({ text, undo, key: Date.now() });
    toastTimer.current = setTimeout(
      () => setToastMsg(null),
      undo ? 6000 : 3200,
    );
  }, []);

  /* Semua perubahan lewat sini: klon state, terapkan, tawarkan Urungkan. */
  const update = useCallback(
    (fn, msg, undoable = true) => {
      const prev = stRef.current;
      const next = cloneSt(prev);
      const res = fn(next);
      stRef.current = next;
      setSt(next);
      const text = typeof msg === 'function' ? msg(res) : msg;
      if (text)
        toast(
          text,
          undoable
            ? () => {
                stRef.current = prev;
                setSt(prev);
                toast('Perubahan dibatalkan');
              }
            : null,
        );
      return res;
    },
    [toast],
  );

  const act = useCallback(
    (c, a) => {
      update(
        (n) => applyAct(n, c, a),
        `${isMasked(stRef.current, role) ? c.app.code : c.app.name} ${ACT_DONE[a]} (${U[c.unit].short})`,
      );
    },
    [update, role],
  );

  const bulkAct = useCallback(
    (list, a) => {
      update(
        (n) => {
          let k = 0;
          list.forEach((c) => {
            if (canEdit(role, c) && canApply(n, c, a)) {
              applyAct(n, c, a);
              k++;
            }
          });
          return { k, skipped: list.length - k };
        },
        (r) =>
          `${r.k} baris ${ACT_DONE[a]}${r.skipped ? `. ${r.skipped} dilewati karena statusnya tidak sesuai.` : '.'}`,
      );
    },
    [update, role],
  );

  const saveAssess = useCallback(
    (entries) => {
      const filled = entries.filter((e) =>
        Object.values(e.vals).some((v) => v != null && v !== ''),
      );
      if (!filled.length) {
        toast('Belum ada nilai yang diisi.');
        return 0;
      }
      update(
        (n) => {
          n.assess = { ...n.assess };
          filled.forEach((e) => {
            n.assess[e.tg] = {
              ...(n.assess[e.tg] || {}),
              [role.id]: { ...e.vals },
            };
          });
        },
        'Nilai tersimpan',
        false,
      );
      return filled.length;
    },
    [update, role, toast],
  );

  const setScheme = useCallback(
    (v) => {
      update(
        (n) => {
          n.scheme = v;
          return v === 'single' ? autoAssign(n) : 0;
        },
        (k) =>
          v === 'single'
            ? `Skema diubah ke satu penilai per berkas${k ? `; ${k} bagian berkas yang kosong dibagi rata` : ''}`
            : 'Skema diubah ke beberapa penilai per berkas',
      );
    },
    [update],
  );
  const autoAssignAll = useCallback(() => {
    update(
      (n) => autoAssign(n),
      (k) =>
        k
          ? `${k} bagian berkas dibagi rata ke penilai`
          : 'Semua berkas sudah punya penilai',
    );
  }, [update]);

  /* Skema satu penilai: tetapkan penilai untuk sekumpulan bagian berkas ([[tg], ...]). */
  const reassign = useCallback(
    (tgs, rid) => {
      if (!rid) return;
      update(
        (n) => {
          tgs.forEach(([tg]) => {
            n.assign[tg] = rid;
          });
          return tgs.length;
        },
        (k) =>
          `${k} bagian berkas ditugaskan ke ${reviewerName(stRef.current, rid)}`,
      );
    },
    [update],
  );

  const place = useCallback(
    (id) => {
      const c = CH[id];
      if (!c) return;
      update(
        (n) => {
          if (!canApply(n, c, 'offer') || hasPlacement(n, c.app)) return false;
          applyAct(n, c, 'offer');
          n.log.push(`${c.app.name} ditempatkan di ${U[c.unit].name}.`);
          return true;
        },
        (ok) =>
          ok
            ? `${c.app.name} ditempatkan di ${U[c.unit].name}.`
            : 'Pendaftar tidak dapat ditempatkan dari antrean ini.',
      );
    },
    [update],
  );

  const advancePlacement = useCallback(
    (uid) => {
      update(
        (n) => {
          const next = nextPlacementPeriod(n, uid);
          if (!next) return null;
          n.placement[uid] = next;
          return next;
        },
        (next) =>
          next
            ? `${U[uid].name} dibuka untuk ${periodLabel(next)}.`
            : 'Antrean periode ini belum selesai.',
      );
    },
    [update],
  );

  const visUnits = OPEN.filter(
    (u) => role.admin || st.preset === 'open' || role.units.includes(u.id),
  );

  /* Baris tabel: dipakai bersama oleh Pendaftar dan Nilai. */
  const { rows, counts } = useMemo(() => {
    const masked = isMasked(st, role);
    const q = filters.q.trim().toLowerCase();
    let base = CHOICES.filter((c) => canSee(st, role, c));
    if (filters.unit) base = base.filter((c) => c.unit === filters.unit);
    if (q)
      base = base.filter((c) =>
        masked
          ? c.app.code.toLowerCase().includes(q)
          : c.app.name.toLowerCase().includes(q) ||
            c.app.nim.includes(q) ||
            c.app.code.toLowerCase().includes(q),
      );
    const enriched = base
      .map((c) => ({
        c,
        b: berkasOf(st, c),
        phase: phaseOf(st, c),
        drift: driftOf(st, c),
      }))
      .filter(
        (r) =>
          (!filters.gate || r.b.gate) &&
          (!filters.phases.length || filters.phases.includes(r.phase)),
      );
    const inQueue = {
      all: () => true,
      todo: (r) => needsMine(st, role, r.c),
      lolos: (r) => canEdit(role, r.c) && r.phase === 'scored',
      tempat: (r) => canEdit(role, r.c) && (r.phase === 'passed' || !!r.drift),
      done: (r) => DONE_PHASES.includes(r.phase) && !r.drift,
    };
    const counts = Object.fromEntries(
      QUEUES.map((qq) => [qq.id, enriched.filter(inQueue[qq.id]).length]),
    );
    counts.why = { passed: 0, drift: 0 };
    enriched.filter(inQueue.tempat).forEach((r) => {
      if (r.drift) counts.why.drift++;
      else counts.why.passed++;
    });
    const out = enriched.filter(inQueue[filters.queue]);
    const val = (r) =>
      sort.key === 'name'
        ? masked
          ? r.c.app.code
          : r.c.app.name
        : sort.key === 'unit'
          ? U[r.c.unit].name
          : r.b.pct;
    out.sort((a, b) => {
      const x = val(a),
        y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return typeof x === 'string'
        ? sort.dir * x.localeCompare(y, 'id')
        : sort.dir * (x - y);
    });
    return { rows: out, counts };
  }, [st, role, filters, sort]);

  const openNilai = useCallback((id) => {
    setFocusId(id);
    setNilaiMode('berkas');
    setTab('nilai');
  }, []);
  const openSheets = useCallback((uid) => {
    setSheetsUnit(uid);
    setNilaiMode('sheets');
    setTab('nilai');
  }, []);
  useEffect(() => {
    setFilters((f) => ({ ...f, unit: '' }));
    setFocusId(null);
  }, [roleId]);
  /* Dasbor pilihan hanya untuk admin oprec. */
  useEffect(() => {
    if (!role.admin && tab === 'dasbor') setTab('pendaftar');
  }, [role.admin, tab]);
  /* Wizard panduan prototipe mengatur tampilan lewat event window. */
  useEffect(() => {
    const on = (e) => {
      const d = e.detail || {};
      if (d.role) setRoleId(d.role);
      if (d.tab) setTab(d.tab);
      if (d.nilaiMode) setNilaiMode(d.nilaiMode);
      if (d.unit) setSheetsUnit(d.unit);
      if (d.dash) setDash({ ...DASH0, ...d.dash });
    };
    window.addEventListener('oprec-proto', on);
    return () => window.removeEventListener('oprec-proto', on);
  }, []);

  /* Posisi oprec di siklusnya, untuk memandu pengguna baru. */
  /* Tahap keseluruhan = tahap paling awal yang belum selesai di semua divisi.
     Divisi bisa berjalan dengan kecepatan berbeda, jadi petunjuknya menyebut divisi yang tertinggal. */
  const prog = OPEN.map((u) => ({
    u,
    p: unitProgress(st, u.id),
    s: unitStats(st, u),
  }));
  const lagBerkas = prog.filter((x) => !x.p.ready).map((x) => x.u);
  const lagDecide = prog
    .filter(
      (x) =>
        x.p.ready &&
        CHOICES.some((c) => c.unit === x.u.id && phaseOf(st, c) === 'passed'),
    )
    .map((x) => x.u);
  const anyPlaced = CHOICES.some((c) => st.dec[c.id] === 'offer');
  const allSeated = prog.every((x) => x.s.open <= 0);
  const stepIdx = lagBerkas.length
    ? 1
    : lagDecide.length || !anyPlaced
      ? 2
      : allSeated
        ? 4
        : 3;
  const names = (us) =>
    us
      .map((u) => u.short)
      .join(', ')
      .replace(/, ([^,]*)$/, ' dan $1');
  const readyN = OPEN.length - lagBerkas.length;
  const goTodo = () => {
    setFilters((f) => ({ ...f, queue: 'todo' }));
    setTab('nilai');
  };
  const nextHint = [
    null,
    {
      text: `${names(lagBerkas)} masih menilai.`,
      go: goTodo,
      tab: 'nilai',
      cta: 'Lihat yang perlu dinilai',
    },
    {
      text: 'Seleksi selesai. Tentukan siapa yang ditempatkan, cadangan, atau tidak diterima.',
      tab: 'penempatan',
      cta: 'Buka Penempatan',
    },
    {
      text: 'Masih ada kuota kosong. Tempatkan cadangan dengan skor tertinggi.',
      tab: 'penempatan',
      cta: 'Buka Penempatan',
    },
    { text: 'Semua kuota terisi.', tab: 'penempatan', cta: 'Lihat hasil' },
  ][stepIdx];
  const stepNote = stepIdx === 1 ? ` · ${readyN}/${OPEN.length} divisi` : '';

  return (
    <div className="om" ref={rootRef}>
      <style>{CSS}</style>

      <div
        className="om-demo"
        role="region"
        aria-label="Kontrol purwarupa"
        ref={demoRef}
        data-tour="demo"
      >
        <a className="om-demo-home" href="/prototype/oprec">
          <Icon name="chevLeft" size={14} />
          Beranda prototipe
        </a>
        <span className="om-demo-tag">Purwarupa</span>
        <span className="om-demo-text">
          Data contoh fiktif. Perubahan hilang saat halaman dimuat ulang.
        </span>
        <label className="om-demo-field" data-tour="role">
          <span>Lihat sebagai</span>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {st.reviewers.map((r) => (
              <option key={r.id} value={r.id}>
                {roleLabel({ ...r, name: r.name || 'Penilai baru' })}
              </option>
            ))}
          </select>
        </label>
        <label className="om-demo-field">
          <span>Visibilitas</span>
          <select
            value={st.preset}
            onChange={(e) =>
              update(
                (n) => {
                  n.preset = e.target.value;
                },
                null,
                false,
              )
            }
          >
            <option value="open">Terbuka</option>
            <option value="per_unit">Per divisi</option>
            <option value="blind">Anonim</option>
          </select>
        </label>
        <label className="om-demo-field">
          <span>Skema penilaian</span>
          <select value={st.scheme} onChange={(e) => setScheme(e.target.value)}>
            <option value="multi">Beberapa penilai</option>
            <option value="single">Satu penilai</option>
          </select>
        </label>
      </div>

      <div className="om-shell">
        <nav className="om-side" aria-label="Navigasi utama">
          <div className="om-brand">
            <span className="om-brand-mark" aria-hidden="true">
              a
            </span>
            anmategra
          </div>
          <ul>
            {NAV.map((n) => (
              <li key={n.label}>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className={n.on ? 'on' : ''}
                  aria-current={n.on ? 'page' : undefined}
                >
                  <Icon name={n.icon} size={20} />
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="om-side-foot">
            <Avatar name="HMIF ITB" />
            <div>
              <strong>HMIF ITB</strong>
              <small>Lembaga</small>
            </div>
          </div>
        </nav>

        <main className="om-main">
          <nav className="om-crumbs" aria-label="Breadcrumb">
            <a href="#" onClick={(e) => e.preventDefault()}>
              Kegiatan
            </a>
            <Icon name="chevRight" size={14} />
            <a href="#" onClick={(e) => e.preventDefault()}>
              {EVENT_NAME}
            </a>
            <Icon name="chevRight" size={14} />
            <span aria-current="page">Open Recruitment</span>
          </nav>

          <header className="om-head">
            <div className="om-head-row">
              <h1>Open Recruitment</h1>
              <span className="om-head-meta">
                {APPS.length} pendaftar · pendaftaran ditutup {CLOSES}
              </span>
            </div>
            <ol className="om-steps" aria-label="Tahapan open recruitment">
              {STEPS.map((s, i) => (
                <li
                  key={s}
                  className={i < stepIdx ? 'done' : i === stepIdx ? 'cur' : ''}
                  aria-current={i === stepIdx ? 'step' : undefined}
                >
                  <span className="om-steps-dot" aria-hidden="true">
                    {i < stepIdx && <Icon name="check" size={11} />}
                  </span>
                  {s}
                  {i === stepIdx && stepNote && (
                    <span className="om-steps-note">{stepNote}</span>
                  )}
                </li>
              ))}
            </ol>
            {nextHint && (
              <p className="om-next">
                <span>
                  <strong>Berikutnya:</strong> {nextHint.text}
                </span>
                {tab !== nextHint.tab && (
                  <button
                    type="button"
                    className="om-link"
                    onClick={nextHint.go ?? (() => setTab(nextHint.tab))}
                  >
                    {nextHint.cta}
                    <Icon name="arrowRight" size={14} />
                  </button>
                )}
              </p>
            )}
          </header>

          <div
            className="om-tabs"
            role="tablist"
            aria-label="Bagian open recruitment"
            data-tour="tabs"
          >
            {TABS.filter((t) => !t.admin || role.admin).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'on' : ''}
                onClick={() => setTab(t.id)}
                data-tour={'tab-' + t.id}
              >
                <Icon name={t.icon} />
                {t.label}
                {t.id === 'nilai' && counts.todo > 0 && (
                  <span className="om-tab-count" title="Perlu dinilai">
                    {counts.todo}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="om-view" role="tabpanel">
            {tab === 'pendaftar' && (
              <PendaftarView
                st={st}
                role={role}
                rows={rows}
                counts={counts}
                filters={filters}
                setFilters={setFilters}
                sort={sort}
                setSort={setSort}
                openNilai={openNilai}
                act={act}
                bulkAct={bulkAct}
                reassign={reassign}
                visUnits={visUnits}
                toast={toast}
              />
            )}
            {tab === 'dasbor' && role.admin && (
              <DasborView
                st={st}
                dash={dash}
                setDash={setDash}
                openSheets={openSheets}
                toast={toast}
              />
            )}
            {tab === 'nilai' && (
              <div className="om-stack">
                <div className="om-mode" data-tour="nilai-mode">
                  <div
                    className="om-seg"
                    role="radiogroup"
                    aria-label="Tampilan penilaian"
                  >
                    {[
                      ['berkas', 'Per berkas', 'clipboard'],
                      ['sheets', 'Sheets per divisi', 'table'],
                    ].map(([v, l, ic]) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={nilaiMode === v}
                        className={nilaiMode === v ? 'on' : ''}
                        onClick={() => setNilaiMode(v)}
                      >
                        <Icon name={ic} size={14} />
                        {l}
                      </button>
                    ))}
                  </div>
                  <span className="om-dim om-small">
                    {nilaiMode === 'berkas'
                      ? 'Baca satu berkas lengkap lalu isi rubriknya.'
                      : 'Semua pendaftar satu divisi, berdampingan per pilihan seperti sheet pendivisian.'}
                  </span>
                </div>
                {nilaiMode === 'berkas' ? (
                  <NilaiView
                    st={st}
                    role={role}
                    rows={rows}
                    counts={counts}
                    focusId={focusId}
                    setFocusId={setFocusId}
                    saveAssess={saveAssess}
                    reassign={reassign}
                    filters={filters}
                    setFilters={setFilters}
                  />
                ) : (
                  <SheetsView
                    st={st}
                    role={role}
                    act={act}
                    openNilai={openNilai}
                    unit={sheetsUnit}
                    setUnit={setSheetsUnit}
                    visUnits={visUnits}
                  />
                )}
              </div>
            )}
            {tab === 'penempatan' && (
              <PenempatanView
                st={st}
                role={role}
                place={place}
                advancePlacement={advancePlacement}
                act={act}
              />
            )}
            {tab === 'pengaturan' && (
              <PengaturanView
                st={st}
                role={role}
                update={update}
                setScheme={setScheme}
                autoAssignAll={autoAssignAll}
              />
            )}
          </div>
        </main>
      </div>

      {toastMsg && (
        <div className="om-toast" role="status" key={toastMsg.key}>
          <span>{toastMsg.text}</span>
          {toastMsg.undo && (
            <button type="button" onClick={toastMsg.undo}>
              Urungkan
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   CSS — token dari Anmategra-APP/tailwind.config.ts
   ===================================================================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
.om{
  --bg:#F8F9FA; --surface:#FFFFFF; --sunk:#F3F5F7;
  --ink:#141718; --body:#262B2D; --muted:#636A6D; --subtle:#768085;
  --line:#E9EDF1; --line-2:#C4CACE;
  --navy:#2B6282; --navy-h:#265673; --navy-50:#EAEFF2; --navy-100:#DFE7EC; --navy-200:#BDCED8; --navy-ink:#193A4D; --midnight:#2D4554; --dark:#0F222D;
  --teal:#00B7B7; --teal-50:#E6F8F8; --teal-100:#D9F4F4; --teal-ink:#006E6E;
  --green:#29BC5B; --green-50:#E7F7ED; --green-ink:#17793A;
  --red:#F16350; --red-50:#FDECEA; --red-ink:#B4382A;
  --amber:#F5CB69; --amber-50:#FDF5E1; --amber-ink:#7A560C;
  --ease:cubic-bezier(.16,1,.3,1);
  font-family:'Geist',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:14px; line-height:1.5; color:var(--body); background:var(--bg);
  min-height:100vh; color-scheme:light; -webkit-font-smoothing:antialiased;
  scrollbar-color:var(--line-2) transparent;
}
.om *{box-sizing:border-box}
.om ::selection{background:var(--navy-200);color:var(--ink)}
:where(.om) :is(h1,h2,h3,h4,p){margin:0}
:where(.om) :is(button,input,select,textarea){font:inherit;color:inherit}
:where(.om) button{cursor:pointer}
:where(.om) button:disabled{cursor:not-allowed}
:where(.om) :focus-visible{outline:2px solid var(--navy);outline-offset:2px;border-radius:6px}
:where(.om) input[type=checkbox]{accent-color:var(--navy);width:16px;height:16px;margin:0}
.om-num{font-variant-numeric:tabular-nums}
.om-dim{color:var(--muted)}
.om-small{font-size:13px}
.om-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.om-ico{flex:none}
.om-row{display:flex;gap:8px;align-items:center;justify-content:center}

/* demo strip */
.om-demo{position:sticky;top:0;z-index:40;display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;min-height:46px;padding:8px 24px;background:var(--dark);color:#DCE4E9;font-size:13px}
.om-demo-tag{font-weight:600;color:var(--dark);background:var(--amber);padding:1px 8px;border-radius:999px;font-size:12px}
.om-demo-text{color:#AEBBC4;margin-right:auto}
.om-demo-field{display:inline-flex;align-items:center;gap:8px;color:#AEBBC4}
.om-demo-field select{background:#1B3442;border:1px solid #33505F;color:#fff;border-radius:8px;padding:4px 8px;font-size:13px}
.om-demo-btn{background:transparent;border:1px solid #4A6A7B;color:#fff;border-radius:8px;padding:4px 12px;font-size:13px}
.om-demo-btn:hover:not(:disabled){background:#1B3442}
.om-demo-btn:disabled{opacity:.45}

/* shell */
.om-shell{display:flex;align-items:flex-start}
.om-side{position:sticky;top:var(--demo-h,46px);width:256px;flex:none;height:calc(100vh - var(--demo-h,46px));overflow-y:auto;background:var(--surface);border-right:1px solid var(--line);padding:24px;display:flex;flex-direction:column;gap:32px}
.om-brand{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:700;color:var(--navy);letter-spacing:-.02em}
.om-brand-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--navy);color:#fff;font-size:20px;line-height:1}
.om-side ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.om-side a{display:flex;align-items:center;gap:12px;height:48px;padding:0 16px;border-radius:8px;color:var(--muted);text-decoration:none;font-size:17px;transition:background .15s,color .15s}
.om-side a:hover,.om-side a.on{background:var(--navy-100);color:var(--navy)}
.om-side-foot{margin-top:auto;display:flex;gap:12px;align-items:center}
.om-side-foot strong{display:block;color:var(--ink);font-size:15px}
.om-side-foot small{color:var(--muted)}
.om-main{flex:1;min-width:0;padding:24px 40px 96px}

.om-crumbs{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);margin-bottom:12px;flex-wrap:wrap}
.om-crumbs a{color:var(--muted);text-decoration:none}
.om-crumbs a:hover{color:var(--navy);text-decoration:underline;text-underline-offset:3px}
.om-crumbs [aria-current]{color:var(--ink);font-weight:500}

/* header */
.om-head{display:flex;flex-direction:column;gap:16px;margin-bottom:20px}
.om-head-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 16px}
.om-head h1{font-size:32px;font-weight:600;color:var(--ink);letter-spacing:-.02em;line-height:1.15}
.om-head-meta{color:var(--muted);font-size:14px}
.om-steps{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 0;font-size:13px;color:var(--subtle)}
.om-steps li{display:flex;align-items:center;gap:8px;padding-right:12px}
.om-steps li+li::before{content:"";width:24px;height:1px;background:var(--line-2);margin-right:4px}
.om-steps-dot{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;border:1.5px solid var(--line-2);background:var(--surface)}
.om-steps li.done{color:var(--muted)}
.om-steps li.done .om-steps-dot{background:var(--navy);border-color:var(--navy);color:#fff}
.om-steps li.cur{color:var(--ink);font-weight:600}
.om-steps li.cur .om-steps-dot{border:5px solid var(--teal)}
.om-next{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;font-size:14px;color:var(--body);background:var(--navy-50);border-radius:10px;padding:10px 14px}
.om-next strong{color:var(--navy-ink)}

/* tabs */
.om-tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:20px;overflow-x:auto;scrollbar-width:none}
.om-tabs button{display:inline-flex;align-items:center;gap:8px;border:0;background:none;padding:10px 14px 12px;color:var(--muted);font-weight:500;font-size:15px;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;transition:color .15s}
.om-tabs button:hover{color:var(--ink)}
.om-tabs button.on{color:var(--navy);border-bottom-color:var(--navy);font-weight:600}
.om-tab-count{font-size:12px;font-weight:600;min-width:20px;padding:0 6px;height:20px;border-radius:999px;display:inline-grid;place-items:center;background:var(--navy-100);color:var(--navy)}
.om-tab-count.alert{background:var(--red-50);color:var(--red-ink)}

/* basics */
.om-stack{display:flex;flex-direction:column;gap:14px}
.om-stack.lg{gap:32px}
.om-panel{background:var(--surface);border:1px solid var(--line);border-radius:12px}
.om-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:38px;padding:0 16px;border-radius:12px;border:0;background:var(--navy);color:#fff;font-weight:500;font-size:14px;white-space:nowrap;transition:background .15s,border-color .15s,color .15s}
.om-btn:hover:not(:disabled){background:var(--navy-h)}
.om-btn:disabled{opacity:.5}
.om-btn.sm{height:32px;padding:0 12px;font-size:13px;border-radius:10px}
.om-btn.outline{background:var(--surface);color:var(--navy);border:1.5px solid var(--navy)}
.om-btn.outline:hover:not(:disabled){background:var(--navy-50)}
.om-btn.ghost{background:transparent;color:var(--muted)}
.om-btn.ghost:hover:not(:disabled){background:var(--sunk);color:var(--ink)}
.om-badge{min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--navy);color:#fff;font-size:11px;font-weight:600;display:inline-grid;place-items:center}
.om-icon-btn{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--body)}
.om-icon-btn:hover:not(:disabled){background:var(--sunk)}
.om-icon-btn:disabled{opacity:.4}
.om-icon-btn.on-dark{border-color:#4A6A7B;background:transparent;color:#fff}
.om-icon-btn.on-dark:hover{background:#1B3442}
.om-link{display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:0;color:var(--navy);font-weight:600;font-size:14px}
.om-link:hover{text-decoration:underline;text-underline-offset:3px}
.om-select{height:38px;border:1px solid var(--line-2);border-radius:10px;background:var(--surface);padding:0 10px;color:var(--ink);max-width:100%}
.om-select.sm{height:32px;font-size:13px}
.om-notice{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-radius:10px;font-size:14px}
.om-notice .om-ico{margin-top:3px}
.om-notice.t-navy{background:var(--navy-50);color:var(--navy-ink)}
.om-notice-body{flex:1}

/* pills */
.om-pill{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px;border-radius:999px;font-size:13px;font-weight:500;white-space:nowrap;border:1px solid transparent}
.om-pill.as-btn{transition:filter .15s}
.om-pill.as-btn:hover{filter:brightness(.96)}
.om-pill.as-btn .om-ico{opacity:.7}
.t-neutral{background:var(--sunk);color:var(--muted);border-color:var(--line)}
.t-navy{background:var(--navy-50);color:var(--navy)}
.t-navy-solid{background:var(--navy);color:#fff}
.t-teal{background:var(--teal-50);color:var(--teal-ink)}
.t-green{background:var(--green-50);color:var(--green-ink)}
.t-red{background:var(--red-50);color:var(--red-ink)}
.t-red-line{background:var(--surface);color:var(--red-ink);border-color:#F2B8AF}
.t-amber{background:var(--amber-50);color:var(--amber-ink)}
.t-amber-line{background:var(--surface);color:var(--amber-ink);border-color:var(--amber)}
.t-muted{background:transparent;color:var(--subtle);border-color:var(--line)}

/* queue chips + toolbar */
.om-queue{display:flex;gap:6px;flex-wrap:wrap}
.om-queue-btn{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--line-2);background:var(--surface);color:var(--body);font-weight:500;transition:background .15s,border-color .15s}
.om-queue-btn:hover{border-color:var(--navy)}
.om-queue-btn.on{background:var(--navy);border-color:var(--navy);color:#fff}
.om-count{font-size:12px;font-variant-numeric:tabular-nums;color:var(--muted)}
.om-queue-btn.on .om-count{color:#C9DBE6}
.om-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.om-search{flex:1 1 260px;display:flex;align-items:center;gap:10px;height:42px;padding:0 16px;border:1px solid var(--line-2);border-radius:16px;background:var(--surface);color:var(--muted)}
.om-search:focus-within{border-color:var(--navy);box-shadow:0 0 0 3px var(--navy-50)}
.om-search input{flex:1;min-width:0;border:0;outline:0;background:none;color:var(--ink);font-size:15px}
.om-search input::placeholder{color:var(--muted)}
.om-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.om-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;border:1px solid var(--navy-200);background:var(--navy-50);color:var(--navy-ink);font-size:13px}
.om-chip:hover{border-color:var(--navy)}

/* popover + menu */
.om-pop{position:fixed;z-index:70;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 2px 4px rgba(15,34,45,.06),0 12px 32px rgba(15,34,45,.14);padding:6px}
.om-menu{display:flex;flex-direction:column}
.om-menu-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:none;padding:9px 10px;border-radius:8px;color:var(--body);font-size:14px}
.om-menu-item .om-ico{color:var(--subtle)}
.om-menu-item:hover,.om-menu-item:focus-visible{background:var(--navy-50);color:var(--navy-ink);outline:0}
.om-menu-sep{height:1px;background:var(--line);margin:4px 6px}
.om-menu-sep:first-child,.om-menu-sep:last-child,.om-menu-sep+.om-menu-sep{display:none}
.om-menu-note{padding:8px 10px;color:var(--muted);font-size:13px}
.om-filter{display:flex;flex-direction:column;gap:14px;padding:8px}
.om-filter fieldset{border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.om-filter legend{font-weight:600;color:var(--ink);font-size:13px;margin-bottom:8px;padding:0}
.om-check-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}
.om-check{display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer}
.om-check input{margin-top:2px}
.om-filter-foot{display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:10px}

/* table */
.om-table-wrap{background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow-x:auto}
.om-table{width:100%;border-collapse:collapse;min-width:760px}
.om-table th{background:var(--sunk);text-align:left;font-weight:500;font-size:13px;color:var(--muted);padding:0 14px;height:44px;border-bottom:1px solid var(--line);white-space:nowrap}
.om-table td{padding:10px 14px;border-bottom:1px solid var(--line);vertical-align:middle}
.om-table tbody tr:last-child td{border-bottom:0}
.om-table tbody tr{transition:background .12s}
.om-table tbody tr:hover{background:#FAFBFC}
.om-table tbody tr.is-sel{background:var(--navy-50)}
.om-table .om-right{text-align:right}
.om-col-check{width:44px}
.om-th-btn{display:inline-flex;align-items:center;gap:4px;border:0;background:none;padding:0;color:inherit;font-weight:inherit}
.om-th-btn:hover{color:var(--ink)}
th.om-right .om-th-btn{flex-direction:row}
.om-who{display:flex;align-items:center;gap:12px;min-width:0}
.om-who>div{display:flex;flex-direction:column;min-width:0}
.om-who small{color:var(--muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.om-who strong{color:var(--ink);font-weight:600}
.om-who-name{border:0;background:none;padding:0;text-align:left;font-weight:600;color:var(--ink);font-size:14px}
.om-who-name:hover{color:var(--navy);text-decoration:underline;text-underline-offset:3px}
.om-avatar{width:34px;height:34px;flex:none;border-radius:50%;display:grid;place-items:center;background:var(--navy-100);color:var(--navy);font-size:12px;font-weight:600}
.om-avatar.masked{background:var(--sunk);color:var(--subtle)}
.om-choice{display:flex;flex-direction:column;color:var(--ink)}
.om-choice small{color:var(--muted);font-size:13px}
.om-score-cell{display:inline-flex;align-items:center;gap:8px;justify-content:flex-end}
.om-score{display:inline-flex;align-items:center;gap:8px}
.om-score-track{width:56px;height:6px;border-radius:999px;background:var(--line);overflow:hidden}
.om-score-track i{display:block;height:100%;background:var(--navy);border-radius:999px}
.om-score .om-num{width:24px;text-align:right;color:var(--ink);font-weight:500}
.om-gate{display:inline-grid;place-items:center;color:var(--red-ink)}
.om-row-link{display:inline-flex;align-items:center;gap:2px;border:0;background:none;color:var(--navy);font-weight:600;font-size:13px;padding:6px 4px;border-radius:8px}
.om-row-link:hover{background:var(--navy-50)}
.om-table-foot{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between;color:var(--muted);font-size:13px}
.om-empty{padding:48px 16px;text-align:center;color:var(--muted);display:flex;flex-direction:column;align-items:center;gap:12px}
.om-empty.big h3{color:var(--ink);font-size:18px;font-weight:600}
.om-empty.big .om-ico{color:var(--teal-ink)}

/* bulk bar — satu-satunya momen gerak yang disengaja */
.om-bulk{position:sticky;bottom:20px;z-index:20;align-self:center;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;background:var(--dark);color:#fff;border-radius:14px;padding:10px 10px 10px 18px;box-shadow:0 4px 8px rgba(15,34,45,.12),0 16px 40px rgba(15,34,45,.24);max-width:100%;animation:om-rise .32s var(--ease)}
/* Tanpa fill-mode: transform yang tertinggal membuat bilah ini jadi acuan posisi popover "fixed" di dalamnya. */
.om-bulk strong{font-weight:600}
.om-bulk-acts{display:flex;flex-wrap:wrap;gap:6px}
.om-bulk .om-btn{background:#fff;color:var(--dark)}
.om-bulk .om-btn:hover:not(:disabled){background:var(--navy-100)}
.om-bulk .om-btn.outline-light{background:transparent;color:#fff;border:1px solid #4A6A7B}
.om-bulk .om-btn.outline-light:hover{background:#1B3442}
.om-bulk-n{font-size:12px;opacity:.7;font-variant-numeric:tabular-nums}
.om-bulk-none{color:#AEBBC4;font-size:13px}
@keyframes om-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}

/* nilai */
.om-nilai{display:grid;grid-template-columns:240px minmax(0,1fr) 360px;gap:16px;align-items:start}
.om-nq{position:sticky;top:16px;display:flex;flex-direction:column;max-height:calc(100vh - 32px);overflow:hidden}
.om-nq-head{padding:10px;border-bottom:1px solid var(--line)}
.om-nq-head .om-select{width:100%}
.om-nq-list{overflow-y:auto;padding:4px}
.om-nq-item{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;text-align:left;padding:8px 10px;border-radius:8px}
.om-nq-item:hover{background:var(--sunk)}
.om-nq-item[aria-current=true]{background:var(--navy-50)}
.om-nq-item[aria-current=true] .om-nq-text>span{color:var(--navy-ink);font-weight:600}
.om-nq-dot{width:16px;height:16px;flex:none;border-radius:50%;border:1.5px solid var(--line-2);display:grid;place-items:center}
.om-nq-dot.done{background:var(--teal-ink);border-color:var(--teal-ink);color:#fff}
.om-nq-text{display:flex;flex-direction:column;min-width:0}
.om-nq-text>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink)}
.om-nq-text small{color:var(--muted);font-size:12px}
.om-answers{padding:20px 24px 28px;display:flex;flex-direction:column;gap:24px}
.om-ans-head{display:flex;flex-direction:column;gap:14px;padding-bottom:18px;border-bottom:1px solid var(--line)}
.om-ans-nav{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px}
.om-who.lg h2{font-size:22px;font-weight:600;color:var(--ink);letter-spacing:-.01em}
.om-who.lg .om-avatar{width:44px;height:44px;font-size:15px}
.om-choice-tags{display:flex;flex-wrap:wrap;gap:6px}
.om-tag{font-size:13px;padding:3px 10px;border-radius:999px;border:1px solid var(--line-2);color:var(--muted)}
.om-tag.on{background:var(--navy);border-color:var(--navy);color:#fff}
.om-qa-group{display:flex;flex-direction:column;gap:6px}
.om-qa-group h3{font-size:13px;font-weight:600;color:var(--muted);margin-bottom:4px}
.om-qa{padding:12px 14px;border-radius:10px;margin:0 -14px;transition:background .2s}
.om-qa.on{background:var(--teal-50)}
.om-q{font-size:13px;color:var(--muted);margin-bottom:4px}
.om-a{font-size:15px;color:var(--ink);max-width:68ch;line-height:1.6}
.om-rubric{position:sticky;top:16px;padding:18px;display:flex;flex-direction:column;gap:20px;max-height:calc(100vh - 32px);overflow-y:auto}
.om-rubric-empty{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;color:var(--muted);padding:24px 8px}
.om-rb-block{display:flex;flex-direction:column;gap:8px}
.om-rb-block+.om-rb-block{border-top:1px solid var(--line);padding-top:18px}
.om-rb-title h3{font-size:16px;font-weight:600;color:var(--ink)}
.om-rb-title p{font-size:13px;color:var(--muted);margin-top:2px}
.om-crit{display:flex;flex-direction:column;gap:8px;padding:10px;margin:0 -10px;border-radius:10px;transition:background .15s}
.om-crit.on{background:var(--navy-50)}
.om-crit-label{display:flex;align-items:center;gap:8px;font-weight:500;color:var(--ink)}
.om-req{font-size:12px;font-weight:500;color:var(--red-ink);background:var(--red-50);padding:1px 8px;border-radius:999px;white-space:nowrap}
.om-crit-help{color:var(--muted);font-size:12px}
.om-opts{display:flex;flex-wrap:wrap;gap:6px}
.om-opts button{min-width:40px;height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--line-2);background:var(--surface);color:var(--body);font-size:14px;transition:background .12s,border-color .12s}
.om-opts button:hover{border-color:var(--navy)}
.om-opts button[aria-pressed=true]{background:var(--navy);border-color:var(--navy);color:#fff}
.om-opts.scale{display:grid;grid-template-columns:repeat(5,1fr)}
.om-scale-ends{display:flex;justify-content:space-between;font-size:12px;color:var(--subtle);margin-top:4px}
.om-textarea{width:100%;min-height:64px;resize:vertical;border:1px solid var(--line-2);border-radius:10px;padding:8px 10px;background:var(--surface);color:var(--ink)}
.om-textarea:focus{outline:0;border-color:var(--navy);box-shadow:0 0 0 3px var(--navy-50)}
.om-others{display:flex;flex-direction:column;gap:4px;background:var(--sunk);border-radius:10px;padding:10px 12px;font-size:13px}
.om-others>span{font-weight:600;color:var(--ink)}
.om-others small{color:var(--muted)}
.om-others-row{display:flex;justify-content:space-between;gap:8px}
.om-locked{display:inline-flex;align-items:center;gap:6px}
.om-rb-foot{position:sticky;bottom:-18px;background:var(--surface);padding:12px 0 2px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
.om-rb-actions{display:flex;gap:8px}
.om-rb-actions .om-btn:first-child{flex:1}
.om-keys{font-size:12px;color:var(--muted);line-height:1.7}
.om-keys kbd{font-family:inherit;font-size:11px;border:1px solid var(--line-2);border-bottom-width:2px;border-radius:4px;padding:0 5px;background:var(--surface);color:var(--body)}
.om-unsaved{display:block;color:var(--amber-ink);font-weight:500}

/* penempatan */
.om-step{display:flex;flex-direction:column;gap:14px}
.om-step-head{display:flex;gap:14px;align-items:flex-start}
.om-step-head h2,.om-h2{font-size:18px;font-weight:600;color:var(--ink);letter-spacing:-.01em}
.om-step-head p{color:var(--muted);margin-top:2px}
.om-step-n{width:28px;height:28px;flex:none;border-radius:50%;display:grid;place-items:center;background:var(--navy-50);color:var(--navy);font-weight:600;font-size:14px}
.om-step-n.done{background:var(--teal-ink);color:#fff}
.om-list{display:flex;flex-direction:column}
.om-conf{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line)}
.om-conf:last-child{border-bottom:0}
.om-conf-opts{display:flex;flex-wrap:wrap;gap:8px}
.om-conf-opt{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;border:1px solid var(--line-2);background:var(--surface);border-radius:10px;padding:8px 14px;min-width:180px;transition:border-color .15s,background .15s}
.om-conf-opt:hover{border-color:var(--navy);background:var(--navy-50)}
.om-conf-opt.sug{border-color:var(--navy)}
.om-conf-main{font-weight:600;color:var(--ink)}
.om-conf-meta{font-size:12px;color:var(--muted)}
.om-sug{position:absolute;top:-9px;right:10px;font-size:11px;font-weight:600;background:var(--navy);color:#fff;border-radius:999px;padding:0 8px}
.om-send{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;justify-content:space-between;padding:16px 18px}
.om-send-text{display:flex;flex-direction:column;gap:4px}
.om-why{margin:4px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:2px}
.om-why b{font-variant-numeric:tabular-nums}
.om-assign-btn{display:flex;flex-direction:column;align-items:flex-start;gap:0;border:0;background:none;padding:4px 8px;margin:-4px -8px;border-radius:8px;text-align:left;color:var(--ink);font-size:14px;max-width:170px}
.om-assign-btn:hover{background:var(--navy-50)}
.om-assign-btn small{color:var(--muted);font-size:12px}
.om-unassigned{color:var(--amber-ink)!important;font-weight:500}
.om-assigned-else{display:flex;flex-direction:column;gap:6px;font-size:13px;background:var(--sunk);border-radius:10px;padding:10px 12px}
.om-assigned-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 10px;color:var(--body)}
.om-assigned-row strong{color:var(--ink);font-weight:600}
.om-assign-sum{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line);padding-top:14px}
.om-assign-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}
.om-assign-head h3{font-size:15px;font-weight:600;color:var(--ink)}
.om-assign-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px}
.om-preview{position:sticky;top:-18px;z-index:2;margin:-18px -18px 0;padding:16px 18px 14px;background:var(--surface);border-bottom:1px solid var(--line);border-radius:12px 12px 0 0;display:flex;flex-direction:column;gap:8px}
.om-preview-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.om-preview-label{font-size:13px;font-weight:600;color:var(--muted);display:flex;flex-direction:column}
.om-preview-label small{font-size:12px;font-weight:400;color:var(--subtle)}
.om-preview-score{display:flex;align-items:baseline;gap:8px}
.om-preview-score strong{font-size:28px;font-weight:600;color:var(--ink);line-height:1;letter-spacing:-.02em}
.om-preview-delta{font-size:12px;font-weight:500;color:var(--teal-ink)}
.om-preview-delta.down{color:var(--red-ink)}
.om-score-track.wide{width:100%;height:8px}
.om-preview-parts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;font-size:13px}
.om-preview-parts li{display:flex;justify-content:space-between;gap:8px;color:var(--body)}
.om-preview-parts li .om-num{color:var(--muted)}
.om-preview-note{display:flex;gap:6px;align-items:flex-start;font-size:12px;color:var(--muted)}
.om-preview-note.warn{color:var(--amber-ink)}
.om-preview-note .om-ico{margin-top:2px}
.om-crit-pts{margin-left:auto;font-size:12px;font-weight:500;color:var(--subtle);white-space:nowrap}
.om-crit-pts.on{color:var(--navy)}
.om-crit-pts .om-num{font-size:13px}
.om-crit-label .om-req{margin-left:auto}
.om-crit-label .om-req+.om-crit-pts{margin-left:0}
.om-held{margin:2px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:2px;font-size:13px;color:var(--muted)}
.om-unit-stage{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-top:-4px}
.om-unit-stage small{color:var(--muted);font-size:12px}
.om-warn.amber{color:var(--amber-ink)}
.om-status-cell{display:inline-flex;align-items:center;gap:6px}
.om-drift{display:inline-grid;place-items:center;color:var(--amber-ink)}
.om-steps-note{color:var(--muted);font-weight:400}
.om-send strong{color:var(--ink)}
.om-units{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.om-unit{padding:16px;display:flex;flex-direction:column;gap:12px}
.om-unit header{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.om-unit h3{font-size:15px;font-weight:600;color:var(--ink)}
.om-seats{display:flex;height:10px;border-radius:999px;background:var(--line);overflow:hidden}
.om-seats i{display:block;height:100%}
.om-seats .d,.sw.d{background:var(--midnight)}
.om-seats .j,.sw.j{background:var(--green)}
.om-seats .o,.sw.o{background:var(--navy-200)}
.sw.e{background:var(--line);border:1px solid var(--line-2)}
.om-kv{display:grid;grid-template-columns:1fr auto;gap:4px 12px;margin:0;font-size:13px}
.om-kv dt{color:var(--muted);display:flex;align-items:center;gap:8px}
.om-kv dd{margin:0;text-align:right;font-variant-numeric:tabular-nums;color:var(--ink);font-weight:500}
.sw{display:inline-block;width:10px;height:10px;border-radius:3px}
.om-warn{display:flex;gap:6px;align-items:flex-start;font-size:13px;color:var(--red-ink)}
.om-warn .om-ico{margin-top:2px}
.om-reserve{display:flex;flex-direction:column;gap:4px;font-size:13px;border-top:1px solid var(--line);padding-top:10px}
.om-reserve>span{font-weight:600;color:var(--ink)}
.om-reserve-row{display:flex;justify-content:space-between;gap:8px}
.om-placed{padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.om-placed h4{font-size:14px;font-weight:600;color:var(--ink);margin-bottom:6px}
.om-placed ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px;font-size:13px}
.om-placed li{display:flex;justify-content:space-between;gap:8px}
.om-log{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--muted)}

/* ringkasan */
.om-lede{font-size:17px;color:var(--ink);max-width:70ch;line-height:1.55}
.om-charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px;align-items:start}
.om-chart{padding:18px;display:flex;flex-direction:column;gap:12px}
.om-chart h3{font-size:16px;font-weight:600;color:var(--ink)}
.om-chart>p:not(.om-small){font-size:13px;color:var(--muted);margin-top:-6px}
.om-bars{display:flex;flex-direction:column;gap:10px}
.om-bar-row{display:grid;grid-template-columns:120px minmax(0,1fr) 52px;gap:12px;align-items:center;font-size:13px}
.om-bar-label{display:flex;flex-direction:column;color:var(--body);overflow:hidden;text-overflow:ellipsis}
.om-flag{color:var(--amber-ink);font-weight:500}
.om-bar-val{text-align:right;color:var(--ink);font-weight:500}
.om-bar-val.warn{color:var(--red-ink)}
.om-track{position:relative;height:14px;background:var(--sunk);border-radius:4px}
.om-track.thin{height:8px;border-radius:999px}
.om-track>i{position:absolute;left:0;top:0;bottom:0;background:var(--navy);border-radius:4px}
.om-track>i.lite{background:var(--navy-200)}
.om-track.thin>i{border-radius:999px}
.om-quota-line{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--ink);border-radius:1px}
.om-track.range{background:transparent;border-bottom:1px solid var(--line);border-radius:0}
.om-track.range>i.rng{background:var(--navy-200);top:4px;bottom:4px}
.om-track.range>i.dot{width:12px;height:12px;top:1px;margin-left:-6px;border-radius:50%;background:var(--navy);border:2px solid var(--surface)}
.om-track.range>i.dot.warn{background:var(--amber-ink)}
.om-mean{position:absolute;top:-4px;bottom:-4px;border-left:1px dashed var(--subtle)}

/* pengaturan */
.om-settings{display:flex;flex-direction:column;gap:36px;max-width:920px}
.om-set{display:grid;grid-template-columns:260px minmax(0,1fr);gap:16px 32px;align-items:start}
.om-set-head h2{font-size:17px;font-weight:600;color:var(--ink)}
.om-set-head p{font-size:13px;color:var(--muted);margin-top:4px}
.om-tree{padding:6px}
.om-unit-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;border-radius:8px}
.om-unit-row+.om-unit-row{border-top:1px solid var(--line)}
.om-unit-row.child{padding-left:32px}
.om-unit-row>div:first-child{display:flex;flex-direction:column}
.om-unit-name{color:var(--ink);font-weight:500}
.om-unit-row.closed .om-unit-name{color:var(--muted)}
.om-unit-row small{color:var(--muted);font-size:12px}
.om-stepper{display:inline-flex;align-items:center;border:1px solid var(--line-2);border-radius:10px;overflow:hidden}
.om-stepper button{width:32px;height:32px;border:0;background:var(--surface);display:grid;place-items:center;color:var(--body)}
.om-stepper button:hover:not(:disabled){background:var(--sunk)}
.om-stepper button:disabled{opacity:.4}
.om-stepper span{min-width:34px;text-align:center;font-weight:600;color:var(--ink)}
.om-form-set{padding:16px;display:flex;flex-direction:column;gap:16px}
.om-inline-field{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.om-form-preview{border:1px dashed var(--line-2);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--bg)}
.om-preview-label{font-size:12px;color:var(--muted);font-weight:500}
.om-preview-q{color:var(--ink);font-weight:500}
.om-preview-row{display:grid;grid-template-columns:90px minmax(0,1fr);gap:10px;align-items:center;font-size:13px}
.om-rubrics{padding:16px;display:flex;flex-direction:column;gap:18px}
.om-rtable{width:100%;border-collapse:collapse;font-size:13px}
.om-rtable caption{text-align:left;font-weight:600;color:var(--ink);padding-bottom:6px;font-size:14px}
.om-rtable th.om-right{text-align:right}
.om-rtable th{text-align:left;font-weight:500;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--line)}
.om-rtable td{padding:8px;border-bottom:1px solid var(--line);color:var(--body)}
.om-rtable tr:last-child td{border-bottom:0}
.om-rtable td:first-child{color:var(--ink);font-weight:500}
.om-vis{padding:16px;display:flex;flex-direction:column;gap:16px}
.om-radio-cards{display:flex;flex-direction:column;gap:8px}
.om-radio-card{display:flex;gap:12px;align-items:flex-start;text-align:left;border:1px solid var(--line-2);border-radius:10px;padding:12px 14px;background:var(--surface);transition:border-color .15s,background .15s}
.om-radio-card:hover:not(:disabled){border-color:var(--navy)}
.om-radio-card.on{border-color:var(--navy);background:var(--navy-50)}
.om-radio-card:disabled{opacity:.6}
.om-radio-card strong{display:block;color:var(--ink);font-weight:600}
.om-radio-card small{color:var(--muted);font-size:13px}
.om-radio-dot{width:18px;height:18px;flex:none;border-radius:50%;border:1.5px solid var(--line-2);margin-top:2px;background:var(--surface)}
.om-radio-card.on .om-radio-dot{border:5px solid var(--navy)}
.om-switches{display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--line);padding-top:10px}
.om-switch-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0;cursor:pointer}
.om-switch-row.is-disabled{opacity:.55;cursor:not-allowed}
.om-switch-text{display:flex;flex-direction:column}
.om-switch-text span{color:var(--ink);font-weight:500}
.om-switch-text small{color:var(--muted);font-size:13px}
.om-switch{width:40px;height:22px;flex:none;border-radius:999px;border:0;background:var(--line-2);position:relative;transition:background .2s}
.om-switch i{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s var(--ease)}
.om-switch[aria-checked=true]{background:var(--navy)}
.om-switch[aria-checked=true] i{transform:translateX(18px)}

/* sankey */
.om-chart.wide{grid-column:1 / -1}
.om-chart-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:10px 20px}
.om-chart-head p{font-size:13px;color:var(--muted);margin-top:4px;max-width:72ch}
.om-chart-tools{display:flex;justify-content:flex-end;margin-top:-4px}
.om-link.sm{font-size:13px}
.om-sankey{position:relative;overflow-x:auto}
.om-sankey svg{display:block;width:100%;min-width:720px;height:auto;overflow:visible}
.om-sk-link{fill-opacity:.28;transition:fill-opacity .15s}
.om-sk-link.on{fill-opacity:.55}
.om-sk-link.dim{fill-opacity:.1}
.om-sk-label{font-size:13px;fill:var(--ink);font-weight:500;paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round;pointer-events:none}
.om-sk-val{font-variant-numeric:tabular-nums;font-weight:600}
.om-sk-pct{fill:var(--muted);font-weight:400}
.om-tip{position:absolute;z-index:5;transform:translate(12px,12px);pointer-events:none;background:var(--dark);color:#fff;border-radius:8px;padding:8px 10px;font-size:13px;display:flex;flex-direction:column;gap:2px;max-width:260px;box-shadow:0 8px 24px rgba(15,34,45,.2)}
.om-tip span{color:#C9D5DC}
.om-legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--muted)}
.om-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.om-right{text-align:right}

/* editor kriteria */
.om-rubric-group{display:flex;flex-direction:column;gap:6px}
.om-rubric-group+.om-rubric-group{border-top:1px solid var(--line);padding-top:18px}
.om-rubric-group h3{font-size:15px;font-weight:600;color:var(--ink)}
.om-rubric-group>p,.om-rubric-group-head p{font-size:13px;color:var(--muted)}
.om-rubric-group-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:8px 16px}
.om-set-head p+p{margin-top:8px}
.om-crit-list{display:flex;flex-direction:column;gap:6px;margin-top:6px}
.om-crit-empty{padding:4px 0}
.om-crit-item{border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.om-crit-item.open{border-color:var(--navy-200);box-shadow:0 1px 2px rgba(15,34,45,.04),0 4px 12px rgba(15,34,45,.06)}
.om-crit-sum{display:flex;align-items:center;gap:6px;padding:4px 6px 4px 4px}
.om-crit-toggle{flex:1;min-width:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:0;background:none;text-align:left;padding:8px;border-radius:8px;color:var(--subtle)}
.om-crit-toggle:hover{background:var(--sunk)}
.om-crit-name{color:var(--ink);font-weight:500}
.om-crit-name em{color:var(--muted);font-style:normal}
.om-crit-meta{font-size:13px;color:var(--muted);flex-basis:100%;padding-left:22px}
.om-crit-acts{display:flex;gap:4px}
.om-icon-btn.sm{width:28px;height:28px;border-radius:8px}
.om-icon-btn.danger:hover:not(:disabled){background:var(--red-50);color:var(--red-ink);border-color:#F2B8AF}
.om-crit-form{border:0;margin:0;padding:6px 14px 16px 34px;display:flex;flex-direction:column;gap:14px;min-width:0}
.om-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.om-field>span{font-size:13px;font-weight:500;color:var(--ink)}
.om-field-row{display:flex;flex-wrap:wrap;gap:12px}
.om-input{height:36px;border:1px solid var(--line-2);border-radius:10px;padding:0 10px;background:var(--surface);color:var(--ink);width:100%;min-width:0}
.om-input:focus{outline:0;border-color:var(--navy);box-shadow:0 0 0 3px var(--navy-50)}
.om-input:disabled{background:var(--sunk);color:var(--muted)}
.om-input.xs{width:64px;height:30px;text-align:right;font-variant-numeric:tabular-nums}
.om-seg{display:inline-flex;flex-wrap:wrap;gap:2px;background:var(--sunk);border-radius:10px;padding:3px;align-self:flex-start}
.om-seg button{border:0;background:none;height:30px;padding:0 12px;border-radius:8px;color:var(--muted);font-weight:500;font-size:13px}
.om-seg button.on{background:var(--surface);color:var(--navy);box-shadow:0 1px 3px rgba(15,34,45,.12)}
.om-choice-list{display:flex;flex-direction:column;gap:6px}
.om-choice-opt{display:flex;gap:10px;align-items:flex-start;font-size:13px;cursor:pointer}
.om-choice-opt input{margin-top:3px;accent-color:var(--navy)}
.om-choice-opt strong{color:var(--ink);font-weight:500}
.om-choice-opt small{display:block;color:var(--muted)}
.om-inline-num{color:var(--body)}
.om-opt-list{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.om-opt-row{display:flex;gap:6px;align-items:center;width:100%;max-width:420px}
.om-crit-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-top:4px}

/* tim penilai */
.om-team{padding:6px 6px 10px}
.om-team-head,.om-team-row{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) 120px 32px;gap:12px;align-items:center;padding:8px 10px}
.om-team-head{font-size:12px;color:var(--muted);font-weight:500;padding-bottom:4px}
.om-team-row+.om-team-row{border-top:1px solid var(--line)}
.om-team-row .om-who{gap:10px}
.om-team-row .om-input{height:34px}
.om-team-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:10px 10px 2px;border-top:1px solid var(--line)}

/* toast */
.om-toast{position:fixed;right:24px;bottom:24px;z-index:15;display:flex;align-items:center;gap:16px;max-width:min(440px,calc(100vw - 32px));background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px 12px 16px;box-shadow:0 4px 8px rgba(15,34,45,.08),0 16px 40px rgba(15,34,45,.16);color:var(--ink);font-size:14px;animation:om-rise .28s var(--ease) both}
/* Saat bilah aksi massal tampil, toast naik supaya tidak menutupi tombolnya. z-index toast sengaja di bawah
   bilah (20): popover milik bilah itu berada di konteks tumpukannya dan harus tetap di atas toast. */
.om:has(.om-bulk) .om-toast{bottom:92px}
.om-toast button{border:1px solid var(--navy);background:none;color:var(--navy);font-weight:600;border-radius:8px;padding:4px 10px;font-size:13px;white-space:nowrap}
.om-toast button:hover{background:var(--navy-50)}

/* responsif */
@media (max-width:1279px){ .om-side{display:none} .om-main{padding:20px 24px 96px} }
@media (max-width:1180px){ .om-nilai{grid-template-columns:minmax(0,1fr) 340px} .om-nq{display:none} }
@media (max-width:900px){
  .om-nilai{grid-template-columns:minmax(0,1fr)}
  .om-rubric{position:static;max-height:none}
  .om-rb-foot{bottom:0}
  .om-set{grid-template-columns:minmax(0,1fr);gap:12px}
}
@media (max-width:640px){
  .om-team-head{display:none}
  .om-team-row{grid-template-columns:minmax(0,1fr) 32px}
  .om-team-row>.om-who{grid-column:1}
  .om-team-row>:nth-child(2),.om-team-row>:nth-child(3){grid-column:1}
  .om-team-row>:last-child{grid-column:2;grid-row:1}
  .om-crit-form{padding-left:14px}
  .om-main{padding:16px 16px 96px}
  .om-demo{padding:8px 16px}
  .om-demo-text{flex-basis:100%}
  .om-head h1{font-size:26px}
  .om-demo{position:static}
  .om-steps{gap:8px 14px}
  .om-steps li{padding-right:0}
  .om-steps li+li::before{display:none}
  .om-answers{padding:16px}
  .om-bar-row{grid-template-columns:88px minmax(0,1fr) 44px}
  .om-bulk{bottom:12px;padding:10px 10px 10px 14px}
  .om-toast{right:16px;left:16px;bottom:16px}
  .om:has(.om-bulk) .om-toast{bottom:auto;top:16px}
  .om-check-grid{grid-template-columns:1fr}
}
/* prototipe: tautan beranda */
.om-demo-home{display:inline-flex;align-items:center;gap:4px;color:#fff;text-decoration:none;font-weight:500;padding:3px 10px 3px 6px;border-radius:8px;border:1px solid #4A6A7B}
.om-demo-home:hover{background:#1B3442}

/* dasbor pilihan */
.nowrap{white-space:nowrap}
.om-sec-head{display:flex;flex-direction:column;gap:2px}
.om-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.om-kpi{display:flex;flex-direction:column;gap:2px;text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;color:var(--muted);font-size:13px}
.om-kpi strong{font-size:28px;font-weight:600;color:var(--ink);letter-spacing:-.02em;line-height:1.2}
.om-kpi small{font-size:12px;color:var(--subtle)}
.om-kpi.as-btn{transition:border-color .15s,box-shadow .15s}
.om-kpi.as-btn:hover{border-color:var(--navy-200);box-shadow:0 2px 8px rgba(15,34,45,.06)}
.om-matrix{min-width:820px}
.om-matrix tfoot td{padding:10px 14px;background:var(--sunk);font-weight:600;color:var(--ink);border-top:1px solid var(--line)}
.om-cell{position:relative;min-width:56px;height:32px;padding:0 10px;border-radius:8px;border:1px solid transparent;font-variant-numeric:tabular-nums;font-weight:600;color:var(--navy-ink);background:linear-gradient(90deg,var(--navy-100) var(--fill,0%),var(--sunk) var(--fill,0%))}
.om-cell.plain{background:none;color:var(--ink)}
.om-cell:hover{border-color:var(--navy-200)}
.om-cell.on{border-color:var(--navy);box-shadow:0 0 0 2px var(--navy-50)}
.om-ratio{font-variant-numeric:tabular-nums;font-weight:600;color:var(--body)}
.om-ratio.hot{color:var(--red-ink)}
.om-ratio.low{color:var(--amber-ink)}
.om-inline{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
.om-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.om-pill.sm{height:22px;padding:0 8px;font-size:12px}
.om-bad{color:var(--red-ink);font-weight:600}
.om-dash td{padding:8px 12px}
.om-dash .om-who strong{font-size:14px}
.om-dchip{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--ink);white-space:nowrap;padding:2px 8px 2px 6px;border-radius:999px}
.om-dchip i,.om-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--line-2);flex:none}
.om-dchip.go i,.om-dot.go{background:var(--teal)}
.om-dchip.done i,.om-dot.done{background:var(--green)}
.om-dchip.stop i,.om-dot.stop{background:var(--red)}
.om-dchip.stop{color:var(--muted);text-decoration:line-through;text-decoration-color:var(--line-2)}
.om-dchip.hl{background:var(--navy-50);font-weight:600}
.om-table-foot .om-legend{display:inline-flex;margin-left:12px;vertical-align:middle}
.om-table-foot .om-legend .om-dot{margin-right:4px;border-radius:50%;width:8px;height:8px}
.om-group-row td{background:var(--sunk);padding:0}
.om-table tbody tr.om-group-row:hover{background:var(--sunk)}
.om-group-btn{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;padding:8px 14px;text-align:left;color:var(--ink)}
.om-group-btn .om-count{margin-left:2px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:0 8px}

/* nilai: pilihan tampilan */
.om-mode{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}
.om-seg button{display:inline-flex;align-items:center;gap:6px}
.om-pagination{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.om-pagination .om-inline{gap:5px}
.om-settings-nav{margin-bottom:4px}
.om-settings[data-settings-tab="struktur"] [data-settings]:not([data-settings="struktur"]),.om-settings[data-settings-tab="penilaian"] [data-settings]:not([data-settings="penilaian"]),.om-settings[data-settings-tab="tim"] [data-settings]:not([data-settings="tim"]){display:none}

/* sheets */
.om-btn.xs{height:26px;padding:0 10px;font-size:12px;border-radius:8px}
.om-sheet-wrap{border:1px solid var(--line-2);border-radius:10px;background:var(--surface);overflow:auto;max-height:calc(100vh - 220px)}
.om-sheet-blocks{display:flex;align-items:flex-start;width:max-content}
.om-sheet{border-collapse:separate;border-spacing:0;font-size:13px}
.om-sheet + .om-sheet{border-left:3px solid var(--navy-200)}
.om-sheet th,.om-sheet td{border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:4px 8px;height:34px;text-align:left;vertical-align:middle}
.om-sheet thead th{position:sticky;background:#EEF2F5;color:var(--body);font-weight:600;z-index:2}
.om-sheet thead tr:first-child th{top:0;height:38px}
.om-sheet thead tr:nth-child(2) th{top:38px}
.om-sheet-title th{background:var(--navy)!important;color:#fff!important}
.om-sheet-title span{font-size:14px;margin-right:10px}
.om-sheet-title small{font-weight:400;color:#D5E1E8}
.om-sheet .num{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums;width:1%}
.om-sheet th.ans{min-width:220px;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.om-sheet th.gen{background:#F4F1E8}
.om-sheet td.ans{max-width:220px;min-width:220px;cursor:pointer;color:var(--body)}
.om-sheet td.ans div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.om-sheet tr.ex td.ans div{white-space:normal}
.om-sheet tr.ex td{vertical-align:top}
.om-sheet td.gen{background:#FCFBF7}
.om-sheet tbody tr:hover td{background:#F6F9FB}
.om-status-sel{height:26px;border-radius:6px;border:1px solid var(--line-2);font-size:12px;font-weight:600;padding:0 4px;background:var(--surface)}
.om-status-sel.pass{background:var(--green-50);border-color:#A8DDBA;color:var(--green-ink)}
.om-status-sel.fail{background:var(--red-50);border-color:#F3B6AD;color:var(--red-ink)}
.om-status-sel:disabled{opacity:.7}
@media (prefers-reduced-motion:reduce){ .om *{animation:none!important;transition:none!important} }
`;
