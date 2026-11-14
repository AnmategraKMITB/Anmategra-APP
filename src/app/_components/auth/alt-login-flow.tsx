'use client';

import { type Session } from 'next-auth';
import { getSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { env } from '~/env';
import { pickFormsCallback } from '~/lib/forms-path';
import {
  connectGoogleDrive,
  prepareGoogleDrive,
  uploadToGoogleDrive,
} from '~/lib/forms/google-drive';
import { api } from '~/trpc/react';

const KTM_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const KTM_MAX_BYTES = 10 * 1024 * 1024;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Pengganti login Microsoft sementara: isi email kontak, NIM, dan foto KTM,
 * lalu dapat akses 6 jam khusus untuk mengisi form.
 */
export function AltLoginFlow() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [nim, setNim] = useState('');
  const [ktm, setKtm] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [declared, setDeclared] = useState(false);
  const claim = api.altLogin.claim.useMutation();

  useEffect(() => {
    prepareGoogleDrive();
    void getSession().then(setSession);
  }, []);

  const alt = session?.user.alt;
  const driveReady = Boolean(env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID);

  // Klaim sudah aktif dan ada tautan form tujuan: langsung ke sana.
  useEffect(() => {
    if (alt !== 'claim') return;
    const target = pickFormsCallback(window.location.search);
    if (target) window.location.assign(target);
  }, [alt]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ktm) return;
    if (!/^\d{8}$/.test(nim)) {
      setError('NIM harus 8 digit angka.');
      return;
    }
    if (ktm.size > KTM_MAX_BYTES) {
      setError('Ukuran foto KTM maksimal 10 MB.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Popup izin Google (untuk mengunggah KTM) harus dibuka langsung dari klik ini.
      await connectGoogleDrive();
      const uploaded = await uploadToGoogleDrive(ktm, {
        formId: 'alt-login-ktm',
        fieldId: 'ktm',
      });
      const created = await claim.mutateAsync({
        email,
        nim,
        ktm: uploaded,
        declaration: true,
      });
      const result = await signIn('alt-claim', {
        claimId: created.claimId,
        secret: created.secret,
        redirect: false,
      });
      if (result?.error) {
        throw new Error('Pengajuan tersimpan tetapi gagal masuk. Coba ajukan lagi.');
      }
      setSession(await getSession());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const message =
    `[Anmategra Request] Halo Kak, kenalin aku <nama panggilanmu> ` +
    `(NIM ${/^\d{8}$/.test(nim) ? nim : '<NIM kamu>'}) dari <Sekolah/Fakultasmu>, ` +
    `akun email ITB-ku (@mahasiswa.itb.ac.id) lagi bermasalah jadi aku tadi ` +
    `request login pake email ${email === '' ? (session?.user.email ?? '<email kamu>') : email}. Mohon di-approve ya. :D`;

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setError('Pesan tidak bisa disalin otomatis. Salin manual dari kotak di atas.');
    }
  };

  const pending = alt === 'guest' && Boolean(session?.user.altPending);

  return (
    <Card className="w-full max-w-[450px]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl sm:text-2xl">
          Akun ITB bermasalah?
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Akses sementara 6 jam, hanya untuk mengisi form (misalnya open
          recruitment). Setelah akun ITB-mu pulih, masuk seperti biasa dan
          akses ini otomatis dicabut.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {session === undefined ? (
          <p className="text-sm text-slate-500">Memuat…</p>
        ) : !driveReady ? (
          <p className="text-sm text-danger-dark">
            Akses alternatif belum diaktifkan di server ini.
          </p>
        ) : alt === 'claim' ? (
          <div className="grid gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-slate-700">
            <p className="font-semibold">Akses aktif</p>
            <p>
              Berlaku sampai{' '}
              <strong>
                {session?.user.altExpiresAt
                  ? formatTime(session.user.altExpiresAt)
                  : '—'}
              </strong>
              . Buka tautan form dari panitia untuk mengisi. Setelah habis,
              ajukan lagi dari halaman ini.
            </p>
            <p className="text-xs text-slate-500">
              Akses ini tercatat atas namamu. Jangan dibagikan ke orang lain.
            </p>
          </div>
        ) : pending ? (
          <div className="grid gap-2 rounded-lg bg-amber-50 p-3 text-sm text-slate-700">
            <p className="font-semibold">Menunggu persetujuan admin</p>
            <p>
              NIM ini juga diajukan lebih dari sekali dalam 24 jam terakhir,
              jadi admin perlu memeriksanya dulu. Segera hubungi narahubung
              Anmategra lewat LINE dengan pesan di bawah supaya diproses. Muat
              ulang halaman ini setelah disetujui.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-3">
            {alt === 'guest' ? (
              <p className="text-sm text-slate-600">
                Akses sebelumnya sudah berakhir atau dicabut. Ajukan lagi di
                bawah ini.
              </p>
            ) : null}
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Email
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email aktif kamu"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              NIM
              <Input
                inputMode="numeric"
                maxLength={8}
                value={nim}
                onChange={(e) => setNim(e.target.value.replace(/\D/g, ''))}
                placeholder="8 digit NIM"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Foto KTM
              <Input
                type="file"
                accept={KTM_ACCEPT}
                onChange={(e) => setKtm(e.target.files?.[0] ?? null)}
                required
              />
            </label>
            <p className="text-xs text-slate-500">
              KTM diunggah ke Google Drive-mu lewat popup izin Google (akun
              Google-nya boleh berbeda dengan email di atas). Tautannya hanya
              terlihat oleh admin Anmategra dan dihapus otomatis setelah 7 hari.
            </p>
            <div
              role="note"
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-slate-700"
            >
              <p className="font-semibold">Gunakan hanya untuk akunmu sendiri.</p>
              <p className="mt-1">
                Memakai NIM atau KTM orang lain adalah pelanggaran. Setiap
                pengajuan tercatat lengkap (email, NIM, alamat IP, dan foto
                KTM), dapat ditelusuri admin, dan akses bisa dicabut kapan
                saja. Pelanggaran dapat dilaporkan kepada pihak yang berwenang.
              </p>
            </div>
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={declared}
                onChange={(e) => setDeclared(e.target.checked)}
              />
              <span>
                Saya menyatakan bahwa NIM dan KTM ini milik saya sendiri, dan
                akses ini hanya saya pakai untuk mengisi form.
              </span>
            </label>
            <Button
              type="submit"
              variant="dark_blue"
              disabled={busy || !ktm || !declared}
            >
              {busy ? 'Memproses…' : 'Aktifkan akses 6 jam'}
            </Button>
          </form>
        )}

        {error ? (
          <p role="alert" className="text-sm text-danger-dark">
            {error}
          </p>
        ) : null}

        {pending || alt === 'claim' ? (
          <details
            className="rounded-lg border border-slate-200 p-3 text-sm"
            open={pending}
          >
            <summary className="cursor-pointer font-semibold text-slate-700">
              Bermasalah atau NIM-mu ditolak?
            </summary>
            <div className="mt-2 grid gap-2">
              <p className="text-xs text-slate-500">
                Kirim pesan ini ke narahubung Anmategra lewat LINE.
              </p>
              <p className="rounded bg-slate-50 p-2 text-xs text-slate-700">
                {message}
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={copyMessage}>
                  {copied ? 'Tersalin' : 'Salin pesan'}
                </Button>
              </div>
            </div>
          </details>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            alt
              ? void signOut({ callbackUrl: '/authentication' })
              : window.location.assign('/authentication')
          }
        >
          {alt ? 'Keluar' : 'Kembali ke halaman login'}
        </Button>
      </CardContent>
    </Card>
  );
}
