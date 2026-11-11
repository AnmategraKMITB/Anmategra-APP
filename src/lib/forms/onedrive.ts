import { type AccountInfo, PublicClientApplication } from '@azure/msal-browser';

import { type FileAnswerItem, mimeFromName } from './file-answer';

/**
 * Unggah berkas pengisi ke OneDrive mereka sendiri lewat Microsoft Graph.
 * Token delegasi `Files.ReadWrite` hanya hidup di memori browser dan tidak
 * pernah dikirim ke server Anmategra. Hanya dipanggil dari browser.
 */
const SCOPES = ['Files.ReadWrite'];
const GRAPH = 'https://graph.microsoft.com/v1.0';
const DAY_MS = 24 * 60 * 60 * 1000;
/** Halaman statis yang meneruskan hasil popup ke jendela utama. */
const REDIRECT_PATH = '/msal-redirect';

let app: PublicClientApplication | null = null;
let initialized: Promise<void> | null = null;
let account: AccountInfo | null = null;

export type OneDriveConfig = { clientId: string; tenantId: string };

/**
 * Menyiapkan MSAL sedini mungkin (saat komponen dipasang), supaya klik
 * "Hubungkan OneDrive" tidak perlu menunggu inisialisasi sebelum membuka popup.
 */
export function prepareOneDrive(config: OneDriveConfig): Promise<void> {
  if (!app) {
    app = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        // Otoritas tenant ITB, bukan /common: aplikasi bertipe multi-organisasi.
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        redirectUri: `${window.location.origin}${REDIRECT_PATH}`,
      },
      cache: { cacheLocation: 'memory' },
    });
    initialized = app.initialize();
  }
  return initialized ?? Promise.resolve();
}

function requireApp(config: OneDriveConfig): PublicClientApplication {
  if (!app) void prepareOneDrive(config);
  return app!;
}

export function hasOneDriveAccount(): boolean {
  return account !== null;
}

/**
 * Membuka popup masuk OneDrive. Panggil langsung dari penangan klik, sebelum
 * dialog berkas: popup yang dibuka setelah dialog ditutup (di luar aktivasi
 * pengguna) diblokir Safari dan Firefox.
 */
export async function connectOneDrive(config: OneDriveConfig) {
  const msal = requireApp(config);
  await (initialized ?? prepareOneDrive(config));
  const result = await msal.acquireTokenPopup({ scopes: SCOPES });
  account = result.account;
}

async function accessToken(config: OneDriveConfig): Promise<string> {
  const msal = requireApp(config);
  await (initialized ?? prepareOneDrive(config));
  if (!account) {
    throw new Error('Hubungkan OneDrive dulu sebelum memilih berkas.');
  }
  try {
    return (await msal.acquireTokenSilent({ scopes: SCOPES, account }))
      .accessToken;
  } catch {
    account = null;
    throw new Error('Sesi OneDrive berakhir. Klik "Hubungkan OneDrive" lagi.');
  }
}

async function graph(token: string, path: string, init: RequestInit) {
  return fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  });
}

const safe = (name: string) => {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '_')
    .trim()
    .slice(0, 80)
    // OneDrive menolak nama yang berakhir dengan titik, dan ".." berarti naik
    // satu folder — jangan sampai judul form mengubah tujuan unggahan.
    .replace(/^[.\s]+|[.\s]+$/g, '');
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : 'berkas';
};

type DriveItem = {
  id: string;
  name: string;
  size: number;
  eTag?: string;
  parentReference?: { driveId?: string };
  file?: { mimeType?: string };
};

/** Mengunggah satu berkas (maks. 16 MB: unggah sederhana) dan membuat tautan lihat. */
export async function uploadToOneDrive(options: {
  config: OneDriveConfig;
  file: File;
  folder: string;
  access: 'anyone' | 'organization';
  /** Tautan kedaluwarsa pada waktu ini (tenggat form + 30 hari); tanpa tenggat = tidak kedaluwarsa. */
  closesAt: Date | null;
}): Promise<FileAnswerItem> {
  const { config, file, folder, access, closesAt } = options;
  const token = await accessToken(config);
  // `file.type` sering kosong untuk .docx/.zip; kirim jenis dari ekstensi,
  // karena jenis yang sama juga yang dicatat di jawaban.
  const mime =
    file.type || mimeFromName(file.name) || 'application/octet-stream';

  const stamped = `${Date.now()}-${safe(file.name)}`;
  const put = await graph(
    token,
    `/me/drive/root:/Anmategra/${encodeURIComponent(safe(folder))}/${encodeURIComponent(stamped)}:/content`,
    {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body: file,
    },
  );
  if (!put.ok) throw new Error('Berkas belum bisa diunggah ke OneDrive.');
  const item = (await put.json()) as DriveItem;

  const expirationDateTime = closesAt
    ? new Date(closesAt.getTime() + 30 * DAY_MS).toISOString()
    : undefined;
  const createLink = async (
    scope: 'anonymous' | 'organization',
    expiry: string | undefined,
  ) => {
    const res = await graph(token, `/me/drive/items/${item.id}/createLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'view',
        scope,
        ...(expiry ? { expirationDateTime: expiry } : {}),
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { link?: { webUrl?: string } };
    return json.link?.webUrl ?? null;
  };
  const link = async (scope: 'anonymous' | 'organization') => {
    const withExpiry = await createLink(scope, expirationDateTime);
    if (withExpiry) return withExpiry;
    // Tautan `organization` belum tentu menerima masa kedaluwarsa; coba lagi
    // tanpa itu daripada menggagalkan seluruh unggahan.
    return scope === 'organization' && expirationDateTime
      ? createLink(scope, undefined)
      : null;
  };

  // Bawaan `anyone`; bila tenant menolak tautan anonim, turun ke `organization`
  // dan jawaban mencatat scope yang benar-benar diberikan.
  let scope: 'anyone' | 'organization' = access;
  let url = access === 'anyone' ? await link('anonymous') : null;
  if (!url) {
    scope = 'organization';
    url = await link('organization');
  }
  if (!url) throw new Error('Tautan berkas belum bisa dibuat.');

  const graphMime = item.file?.mimeType;
  return {
    itemId: item.id,
    driveId: item.parentReference?.driveId ?? 'me',
    name: item.name,
    size: item.size,
    // Graph kadang hanya melaporkan octet-stream; pakai jenis dari ekstensi.
    mime:
      graphMime && graphMime !== 'application/octet-stream' ? graphMime : mime,
    url,
    ...(item.eTag ? { eTag: item.eTag } : {}),
    scope,
  };
}
