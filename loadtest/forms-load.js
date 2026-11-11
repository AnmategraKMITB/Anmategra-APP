// Load test k6: N mahasiswa membuka & mengisi formulir (form.getPublic -> form.submit /
// form.updateSubmission) bercampur dengan penjelajahan halaman biasa.
// Lihat loadtest/README.md ("Load test Formulir") untuk cara menjalankan.
//
// Env:
//   BASE_URL   server yang diuji (default http://localhost:3000)
//   USERS      jumlah pengguna bersamaan (default 600; 300–900 untuk target kita)
//   STEPS      daftar langkah beban, mis. "300,600,900": naik bertahap, tiap langkah ditahan
//              STEP_HOLD. Kalau diisi, USERS/RAMP/HOLD diabaikan.
//   STEP_RAMP  lama naik ke tiap langkah (default 1m)
//   STEP_HOLD  lama bertahan di tiap langkah (default 3m)
//   RAMP/HOLD  untuk mode USERS tunggal (default 2m / 5m)
//   MODE       steady   = isi form 20–60 dtk, jeda 10–30 dtk
//              deadline = stres: isi form 3–10 dtk, jeda 2–5 dtk
//   FORM_SHARE porsi iterasi yang mengisi formulir, sisanya hanya menjelajah (default 0.6)
//   FORM_IDS   id form dipisah koma (default: targets.forms dari make-sessions.mjs)
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { Counter } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const USERS = Number(__ENV.USERS || 600);
const MODE = __ENV.MODE || 'steady';
const FORM_SHARE = Number(__ENV.FORM_SHARE || 0.6);
const COOKIE = BASE.startsWith('https')
  ? '__Secure-next-auth.session-token'
  : 'next-auth.session-token';

const THINK = {
  steady: { fill: [20, 60], between: [10, 30], browse: [3, 10] },
  deadline: { fill: [3, 10], between: [2, 5], browse: [1, 3] },
}[MODE];
if (!THINK) throw new Error(`MODE tidak dikenal: ${MODE}`);

const STEPS = (__ENV.STEPS || '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0);
const PEAK = STEPS.length ? Math.max(...STEPS) : USERS;

const targets = new SharedArray('targets', () => [
  JSON.parse(open('./.data/targets.json')),
])[0];
const FORMS = __ENV.FORM_IDS ? __ENV.FORM_IDS.split(',') : targets.forms || [];
if (FORMS.length === 0) {
  throw new Error(
    'Tidak ada form. Jalankan make-sessions.mjs (butuh form Published) atau set FORM_IDS.',
  );
}
if (targets.sessions.length < PEAK) {
  throw new Error(
    `targets.json hanya punya ${targets.sessions.length} sesi untuk ${PEAK} pengguna. Jalankan ulang make-sessions.mjs ${PEAK}.`,
  );
}

const submitted = new Counter('forms_submitted');
const edited = new Counter('forms_edited');
const alreadySubmitted = new Counter('forms_already_submitted');
const invalid = new Counter('forms_submit_invalid');

function buildStages() {
  if (!STEPS.length) {
    return [
      { duration: __ENV.RAMP || '2m', target: USERS },
      { duration: __ENV.HOLD || '5m', target: USERS },
      { duration: '30s', target: 0 },
    ];
  }
  const stages = [];
  STEPS.forEach((n) => {
    stages.push({ duration: __ENV.STEP_RAMP || '1m', target: n });
    stages.push({ duration: __ENV.STEP_HOLD || '3m', target: n });
  });
  stages.push({ duration: '30s', target: 0 });
  return stages;
}

export const options = {
  scenarios: {
    forms: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: buildStages(),
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:page}': ['p(95)<2000'],
    'http_req_duration{kind:query}': ['p(95)<1000'],
    'http_req_duration{kind:submit}': ['p(95)<1500'],
    // Jawaban yang ditolak validasi berarti generator jawaban tidak cocok dengan form uji.
    forms_submit_invalid: ['count<1'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const between = ([min, max]) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

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

// Mutasi form boleh membalas 400/409 (sudah mengirim, jawaban ditolak) tanpa dihitung sebagai
// error HTTP; hasilnya diklasifikasi dari isi respons. 5xx tetap dihitung gagal.
function trpcMutation(session, name, json) {
  return http.post(
    `${BASE}/api/trpc/${name}?batch=1`,
    JSON.stringify({ 0: { json } }),
    {
      headers: { ...session.headers, 'Content-Type': 'application/json' },
      tags: { kind: 'submit', name: `trpc ${name}` },
      responseCallback: http.expectedStatuses(200, 400, 403, 409),
    },
  );
}

function trpcData(res) {
  if (res.status !== 200) return null;
  try {
    const body = res.json();
    return body[0]?.result?.data?.json ?? null;
  } catch (e) {
    return null;
  }
}

function trpcError(res) {
  try {
    const body = res.json();
    const err = body[0]?.error?.json;
    return err
      ? { code: err.data?.code, message: String(err.message || '') }
      : null;
  } catch (e) {
    return null;
  }
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

// Jawaban valid menurut tipe pertanyaan (lihat komentar AnswerValueSchema di form.type.ts).
// Pertanyaan berkas dilewati: butuh tautan OneDrive/SharePoint sungguhan, jadi form uji tidak
// boleh mewajibkannya.
function answerFor(field) {
  const cfg = field.config || {};
  const options = (field.options || []).map((o) => o.id);
  switch (field.type) {
    case 'short_text':
      return 'Load test';
    case 'long_text':
      return 'Jawaban load test. '.repeat(5).trim();
    case 'number': {
      const min = typeof cfg.min === 'number' ? cfg.min : 1;
      const max = typeof cfg.max === 'number' ? cfg.max : min + 10;
      return Math.min(max, Math.max(min, 1));
    }
    case 'date':
      return '2026-01-15';
    case 'single_choice':
      return options.length ? pick(options) : null;
    case 'multiple_choice':
      return options.length ? [pick(options)] : null;
    case 'checkbox':
      return true;
    case 'link':
      return 'https://contoh.id/loadtest';
    case 'scale': {
      const min = cfg.min ?? 1;
      const max = cfg.max ?? 5;
      return min + Math.floor(Math.random() * (max - min + 1));
    }
    case 'matrix': {
      const value = {};
      (cfg.rows || []).forEach((row) => {
        const col = pick(cfg.columns || []);
        if (row.id && col && col.id) value[row.id] = cfg.multiple ? [col.id] : col.id;
      });
      return value;
    }
    default:
      return null; // text_block, file
  }
}

function buildAnswers(fields) {
  const answers = [];
  fields.forEach((field) => {
    const value = answerFor(field);
    if (value !== null && value !== undefined) {
      answers.push({ fieldId: field.id, value });
    }
  });
  return answers;
}

function warnOnce(session, msg) {
  if ((session.warned = (session.warned || 0) + 1) <= 3) console.warn(msg);
}

function openAndFillForm(session) {
  const formId = pick(FORMS);
  const me = ['users.getMahasiswaById', { userId: session.userId }];
  let pub = null;
  let mine = null;

  group('buka form', () => {
    loadPage(session, `/mahasiswa/forms/${formId}`, 'page /mahasiswa/forms/[id]');
    const res = trpcQuery(session, [
      me,
      ['form.getPublic', { formId }],
      ['form.getMySubmission', { formId }],
    ]);
    try {
      const body = res.json();
      pub = body[1]?.result?.data?.json ?? null;
      mine = body[2]?.result?.data?.json ?? null;
    } catch (e) {
      pub = null;
    }
  });

  if (!pub) {
    warnOnce(session, `form ${formId} tidak bisa dibuka (Draft / tidak ada?)`);
    return;
  }

  sleep(between(THINK.fill)); // mengisi form

  const settings = pub;
  const canSubmit = pub.isAcceptingResponses && !pub.isFull;
  if (!canSubmit) return;

  group('kirim form', () => {
    const answers = buildAnswers(pub.fields || []);
    const hasSubmitted = !!mine;
    // Satu respons per akun: pengiriman ulang hanya lewat edit (kalau diizinkan).
    const useEdit =
      hasSubmitted &&
      !settings.allowMultipleSubmissions &&
      settings.allowEditAfterSubmit;
    if (hasSubmitted && !settings.allowMultipleSubmissions && !useEdit) {
      alreadySubmitted.add(1);
      return;
    }
    const proc = useEdit ? 'form.updateSubmission' : 'form.submit';
    const res = trpcMutation(session, proc, { formId, answers });
    if (res.status === 200 && trpcData(res)) {
      (useEdit ? edited : submitted).add(1);
      check(res, { [`${proc} ok`]: () => true });
      return;
    }
    const err = trpcError(res);
    if (err && /sudah|already|conflict/i.test(`${err.code} ${err.message}`)) {
      alreadySubmitted.add(1);
    } else if (err && err.code === 'BAD_REQUEST') {
      invalid.add(1);
      warnOnce(session, `jawaban ditolak ${formId}: ${err.message}`);
    } else {
      noteFailure(res, `trpc ${proc}`);
    }
    trpcQuery(session, [['form.getMySubmission', { formId }]]);
  });
}

function browse(session) {
  const eventId = pick(targets.events);
  const me = ['users.getMahasiswaById', { userId: session.userId }];
  const pages = [
    () => {
      loadPage(session, '/mahasiswa', 'page /mahasiswa');
      trpcQuery(session, [me]);
    },
    () => {
      loadPage(session, '/mahasiswa/kegiatan', 'page /mahasiswa/kegiatan');
      trpcQuery(session, [
        me,
        ['landing.getAllEvents', { limit: 8, status: [], sort: 'newest' }],
      ]);
    },
    () => {
      loadPage(
        session,
        `/mahasiswa/profile-kegiatan/${eventId}`,
        'page /mahasiswa/profile-kegiatan/[id]',
      );
      trpcQuery(session, [me, ['users.getMyRequestAssociation', null]]);
    },
  ];
  const visits = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < visits; i++) {
    group('jelajah halaman', () => pick(pages)());
    sleep(between(THINK.browse));
  }
}

let session;

export default function formsJourney() {
  if (!session) {
    const s = targets.sessions[(__VU - 1) % targets.sessions.length];
    session = {
      userId: s.userId,
      headers: { Cookie: `${COOKIE}=${s.token}` },
      cache: new Set(),
    };
  }

  if (Math.random() < FORM_SHARE) openAndFillForm(session);
  else browse(session);

  sleep(between(THINK.between));
}
