import { env } from '~/env';

import type { FileAnswerItem } from './file-answer';
import type { FileUploadContext } from './file-provider';
import { googlePopupErrorMessage } from './google-popup-error';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type GoogleOAuth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string }) => void;
  }) => TokenClient;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GoogleOAuth2;
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;
let tokenCache: { value: string; expiresAt: number } | null = null;

function loadScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    const script = existing ?? document.createElement('script');
    const onLoad = () => resolve();
    const onError = () => reject(new Error('Google Identity gagal dimuat.'));
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
}

/** Muat skrip Google lebih awal supaya klik "Hubungkan" tidak perlu menunggu. */
export function prepareGoogleDrive(): void {
  void loadScript().catch(() => undefined);
}

export function hasGoogleDriveToken(): boolean {
  return Boolean(tokenCache && tokenCache.expiresAt > Date.now() + 60_000);
}

/**
 * Minta izin lewat popup. Harus dipanggil tanpa `await` sebelumnya dari
 * penangan klik: browser HP memblokir popup yang tidak berasal langsung dari
 * klik pengguna, dan tanpa `error_callback` unggahan akan menggantung.
 */
function requestToken(clientId: string): Promise<string> {
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    return Promise.reject(
      new Error('Google belum siap. Tunggu sebentar lalu coba lagi.'),
    );
  }

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      error_callback: (error) =>
        reject(new Error(googlePopupErrorMessage(error.type))),
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description ??
                response.error ??
                'Izin Google Drive ditolak.',
            ),
          );
          return;
        }
        tokenCache = {
          value: response.access_token,
          expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
        };
        resolve(response.access_token);
      },
    });
    // Tanpa `prompt: 'consent'`: Google hanya menampilkan layar izin bila
    // pengisi belum pernah menyetujui scope ini, bukan setiap kali unggah.
    client.requestAccessToken();
  });
}

async function getAccessToken(clientId: string): Promise<string> {
  if (hasGoogleDriveToken()) return tokenCache!.value;
  await loadScript();
  return requestToken(clientId);
}

/**
 * Hubungkan Google Drive pengisi. Panggil langsung dari penangan klik
 * (tanpa `await` sebelumnya) agar popup izin tidak diblokir.
 */
export function connectGoogleDrive(): Promise<void> {
  const clientId = env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
  if (!clientId) {
    return Promise.reject(
      new Error('Google Drive Client ID belum dikonfigurasi.'),
    );
  }
  if (hasGoogleDriveToken()) return Promise.resolve();
  return requestToken(clientId).then(() => undefined);
}

const API_TIMEOUT_MS = 30_000;
/** Unggah berkas besar lewat jaringan HP bisa lama; tetap beri batas akhir. */
const UPLOAD_TIMEOUT_MS = 5 * 60_000;

/** `fetch` dengan batas waktu, supaya unggahan tidak menggantung tanpa pesan. */
async function fetchTimed(
  url: string,
  init: RequestInit,
  ms: number = API_TIMEOUT_MS,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error(
        'Koneksi ke Google Drive terlalu lama. Periksa jaringan lalu coba lagi.',
      );
    }
    throw error;
  }
}

async function responseError(response: Response): Promise<Error> {
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 500);
  } catch {
    // Biarkan pesan generik bila body tidak bisa dibaca.
  }
  if (detail.includes('storageQuotaExceeded')) {
    return new Error(
      'Penyimpanan Google Drive kamu penuh. Kosongkan Drive lalu coba unggah lagi.',
    );
  }
  return new Error(
    `Google Drive menolak permintaan (${response.status})${
      detail ? `: ${detail}` : ''
    }`,
  );
}

/**
 * Token tanpa interaksi. Dipakai untuk aksi latar seperti menghapus berkas:
 * bila pengisi sudah tidak punya sesi izin, lebih baik dilewati diam-diam
 * daripada memunculkan popup akun saat mereka menekan tombol hapus.
 */
async function getSilentToken(clientId: string): Promise<string | null> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.value;
  }
  try {
    await loadScript();
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) return null;
    return await new Promise<string | null>((resolve) => {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (response) =>
          resolve(
            response.error || !response.access_token
              ? null
              : response.access_token,
          ),
      });
      client.requestAccessToken({ prompt: 'none' });
    });
  } catch {
    return null;
  }
}

/**
 * Tolak lebih awal bila kuota Drive pengisi tidak cukup. Kegagalan pemeriksaan
 * (mis. `limit` tidak tersedia untuk Drive tak terbatas) tidak memblokir unggah;
 * Drive tetap jadi penentu akhir.
 */
async function assertDriveSpace(size: number, token: string): Promise<void> {
  try {
    const res = await fetchTimed(
      `${DRIVE_API}/about?fields=storageQuota`,
      { headers: { Authorization: `Bearer ${token}` } },
      10_000,
    );
    if (!res.ok) return;
    const { storageQuota } = (await res.json()) as {
      storageQuota?: { limit?: string; usage?: string };
    };
    const limit = Number(storageQuota?.limit ?? 0);
    const usage = Number(storageQuota?.usage ?? 0);
    if (!limit) return;
    if (usage + size > limit) {
      throw new Error(
        'Penyimpanan Google Drive kamu tidak cukup untuk berkas ini. Kosongkan Drive lalu coba lagi.',
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Penyimpanan'))
      throw error;
  }
}

/**
 * Upload jawaban berkas ke Drive pengisi, lalu buka akses "siapa saja yang
 * memiliki link" (Viewer) otomatis. Aplikasi hanya menyimpan tautannya.
 * Bila kebijakan Workspace menolak, berkas tetap dipakai dan pengisi
 * diingatkan mengatur akses sendiri.
 */
export async function uploadToGoogleDrive(
  file: File,
  context: FileUploadContext,
): Promise<FileAnswerItem> {
  const clientId = env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google Drive Client ID belum dikonfigurasi.');
  }
  const mime = file.type || 'application/octet-stream';
  const token = await getAccessToken(clientId);
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  await assertDriveSpace(file.size, token);

  const start = await fetchTimed(
    `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,name,size,webViewLink,mimeType`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mime,
        'X-Upload-Content-Length': String(file.size),
      },
      body: JSON.stringify({
        name: file.name,
        mimeType: mime,
        description: `Anmategra form ${context.formId}`,
      }),
    },
  );
  if (!start.ok) throw await responseError(start);

  const location = start.headers.get('Location');
  if (!location) throw new Error('Google Drive tidak memberi upload URL.');

  const put = await fetchTimed(
    location,
    {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body: file,
    },
    UPLOAD_TIMEOUT_MS,
  );
  if (!put.ok) throw await responseError(put);

  const uploaded = (await put.json()) as {
    id?: string;
    name?: string;
    size?: string;
    mimeType?: string;
    webViewLink?: string;
  };
  if (!uploaded.id)
    throw new Error('Google Drive tidak mengembalikan file ID.');

  // ponytail: kegagalan izin (mis. dibatasi Workspace) diabaikan; pengisi
  // diingatkan di form dan pengelola mendapat petunjuk di tabel respons.
  await fetchTimed(
    `${DRIVE_API}/files/${encodeURIComponent(uploaded.id)}/permissions?fields=id`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    },
  ).catch(() => undefined);

  return {
    itemId: uploaded.id,
    driveId: 'google-drive',
    name: uploaded.name ?? file.name,
    size: Number(uploaded.size ?? file.size),
    mime: uploaded.mimeType ?? mime,
    url:
      uploaded.webViewLink ??
      `https://drive.google.com/file/d/${uploaded.id}/view`,
    scope: 'anyone',
    provider: 'google-drive',
  };
}

/**
 * Hapus berkas yang dibuat aplikasi ini dari Drive pengisi. Hanya berhasil
 * selama sesi izin pengisi masih aktif; kalau tidak, file dibiarkan dan
 * pemilik harus menghapusnya manual. Best-effort, tidak pernah melempar.
 */
export async function deleteFromGoogleDrive(itemId: string): Promise<boolean> {
  const clientId = env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
  if (!clientId || !itemId) return false;
  try {
    const token = await getSilentToken(clientId);
    if (!token) return false;
    const res = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(itemId)}?fields=id`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
