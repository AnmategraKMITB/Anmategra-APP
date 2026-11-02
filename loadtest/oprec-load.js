// Load test k6: N mahasiswa yang login bersamaan membuka kegiatan, mengisi formulir, lalu
// mengirim lamaran (users.requestAssociation), mirip pola open recruitment.
// Lihat loadtest/README.md untuk cara menjalankan.
//
// Env:
//   BASE_URL  server yang diuji (default http://localhost:3000)
//   USERS     jumlah pengguna bersamaan (default 600)
//   MODE      steady   = pola puncak realistis (isi formulir 30–90 dtk)
//             deadline = stres: semua orang submit tiap 5–15 dtk
//   RAMP      lama naik ke USERS (default 2m)
//   HOLD      lama bertahan di USERS (default 5m)
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { Counter } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const USERS = Number(__ENV.USERS || 600);
const MODE = __ENV.MODE || 'steady';
const COOKIE = BASE.startsWith('https')
  ? '__Secure-next-auth.session-token'
  : 'next-auth.session-token';

const THINK = {
  steady: { fill: [30, 90], between: [10, 30] },
  deadline: { fill: [5, 15], between: [2, 5] },
}[MODE];
if (!THINK) throw new Error(`MODE tidak dikenal: ${MODE}`);

const targets = new SharedArray('targets', () => [
  JSON.parse(open('./.data/targets.json')),
])[0];
if (targets.sessions.length < USERS) {
  throw new Error(
    `targets.json hanya punya ${targets.sessions.length} sesi untuk ${USERS} pengguna. Jalankan ulang make-sessions.mjs.`,
  );
}

const submitted = new Counter('applications_submitted');

export const options = {
  scenarios: {
    oprec: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '2m', target: USERS },
        { duration: __ENV.HOLD || '5m', target: USERS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:page}': ['p(95)<2000'],
    'http_req_duration{kind:query}': ['p(95)<1000'],
    'http_req_duration{kind:submit}': ['p(95)<1000'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const between = ([min, max]) => min + Math.random() * (max - min);

// Catat setiap respons non-200 (endpoint + status) supaya penyebab error bisa dihitung dari
// output k6, misalnya: grep '^.*gagal' | sort | uniq -c.
function noteFailure(res, name) {
  if (res.status !== 200) {
    console.warn(
      `gagal ${name} -> ${res.status || res.error_code || res.error}`,
    );
  }
  return res;
}

// Format yang sama dengan unstable_httpBatchStreamLink di src/trpc/react.tsx (tanpa streaming).
function trpcQuery(session, calls) {
  const input = {};
  calls.forEach(([, json], i) => (input[i] = { json }));
  const path = calls.map(([name]) => name).join(',');
  return noteFailure(
    http.get(
      `${BASE}/api/trpc/${path}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
      {
        headers: session.headers,
        tags: { kind: 'query', name: `trpc ${path}` },
      },
    ),
    `trpc ${path}`,
  );
}

function trpcMutation(session, name, json) {
  return noteFailure(
    http.post(
      `${BASE}/api/trpc/${name}?batch=1`,
      JSON.stringify({ 0: { json } }),
      {
        headers: { ...session.headers, 'Content-Type': 'application/json' },
        tags: { kind: 'submit', name: `trpc ${name}` },
      },
    ),
    `trpc ${name}`,
  );
}

// Browser hanya mengunduh JS/CSS sekali; setelah itu dari cache.
function loadPage(session, path, name) {
  const res = http.get(`${BASE}${path}`, {
    headers: session.headers,
    redirects: 0,
    tags: { kind: 'page', name },
  });
  noteFailure(res, name);
  check(res, { [`${name} 200`]: (r) => r.status === 200 });
  if (res.status === 200 && typeof res.body === 'string') {
    const assets =
      res.body.match(/\/_next\/static\/[^"'\s)]+\.(?:js|css)/g) ?? [];
    const fresh = [...new Set(assets)].filter((a) => !session.cache.has(a));
    fresh.forEach((a) => session.cache.add(a));
    if (fresh.length) {
      const responses = http.batch(
        fresh.map((a) => [
          'GET',
          `${BASE}${a}`,
          null,
          {
            tags: { kind: 'static', name: 'static asset' },
            responseType: 'none',
          },
        ]),
      );
      responses.forEach((r) => noteFailure(r, 'static asset'));
    }
  }
}

let session;

export default function oprecJourney() {
  if (!session) {
    const s = targets.sessions[(__VU - 1) % targets.sessions.length];
    session = {
      userId: s.userId,
      headers: { Cookie: `${COOKIE}=${s.token}` },
      cache: new Set(),
    };
  }
  const eventId =
    targets.events[Math.floor(Math.random() * targets.events.length)];
  const me = ['users.getMahasiswaById', { userId: session.userId }];

  group('buka daftar kegiatan', () => {
    loadPage(session, '/mahasiswa/kegiatan', 'page /mahasiswa/kegiatan');
    trpcQuery(session, [
      me,
      ['landing.getAllEvents', { limit: 8, status: [], sort: 'newest' }],
    ]);
  });

  group('buka halaman kegiatan', () => {
    loadPage(
      session,
      `/mahasiswa/profile-kegiatan/${eventId}`,
      'page /mahasiswa/profile-kegiatan/[id]',
    );
    trpcQuery(session, [me, ['users.getMyRequestAssociation', null]]);
  });

  sleep(between(THINK.fill)); // mengisi formulir

  group('kirim lamaran', () => {
    const res = trpcMutation(session, 'users.requestAssociation', {
      event_id: eventId,
      division: 'LOADTEST',
      position: 'Staf',
    });
    if (check(res, { 'lamaran terkirim': (r) => r.status === 200 }))
      submitted.add(1);
    trpcQuery(session, [['users.getMyRequestAssociation', null]]);
    // Tarik lagi supaya database kembali seperti semula dan iterasi berikutnya bisa melamar ulang.
    trpcMutation(session, 'users.deleteRequestAssociation', {
      event_id: eventId,
    });
  });

  sleep(between(THINK.between));
}
