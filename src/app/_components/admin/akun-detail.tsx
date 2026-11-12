'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';
import { UploadButton } from '~/utils/uploadthing';

import { AdminEditPanel } from './admin-edit-panel';
import { AdminEntitySearch } from './admin-entity-search';
import { AdminPageHeader } from './admin-page-header';

type FormState = {
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  role: 'admin' | 'lembaga' | 'mahasiswa';
  hidden: boolean;
  isDemo: boolean;
  nim: string;
  nimTpb: string;
  namaMahasiswa: string;
  jurusan: string;
  angkatan: string;
  lineId: string;
  whatsapp: string;
  raporVisible: boolean;
  status: 'aktif' | 'alumni';
};

export function AkunDetail({ userId }: { userId: string }) {
  const utils = api.useUtils();
  const detail = api.adminConsole.userDetail.useQuery({ userId });
  const permissions = api.adminConsole.myAdminPermissions.useQuery();
  const perms = permissions.data?.permissions ?? [];
  const canWrite = perms.includes('*') || perms.includes('accounts.write');
  const canRoles = perms.includes('*') || perms.includes('accounts.roles');

  const [form, setForm] = useState<FormState | null>(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [membershipLembagaId, setMembershipLembagaId] = useState('');
  const [cohortYear, setCohortYear] = useState('');
  const [cohortLabel, setCohortLabel] = useState('');
  const [positionId, setPositionId] = useState('');
  const [positionLabel, setPositionLabel] = useState('');

  useEffect(() => {
    if (!detail.data) return;
    const u = detail.data.user;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: u.name ?? '',
      email: u.email,
      image: u.image ?? null,
      emailVerified: Boolean(u.emailVerified),
      role: u.role,
      hidden: Boolean(u.hiddenAt),
      isDemo: u.isDemo,
      nim: u.nim?.toString() ?? '',
      nimTpb: u.nimTpb?.toString() ?? '',
      namaMahasiswa: u.namaMahasiswa ?? '',
      jurusan: u.jurusan ?? '',
      angkatan: u.angkatan?.toString() ?? '',
      lineId: u.lineId ?? '',
      whatsapp: u.whatsapp ?? '',
      raporVisible: u.raporVisible ?? true,
      status: u.status ?? 'aktif',
    });
  }, [detail.data]);

  const update = api.adminConsole.userUpdate.useMutation({
    onSuccess: () => {
      setConfirmEmail('');
      void utils.adminConsole.userDetail.invalidate({ userId });
    },
  });
  const membership = api.adminConsole.membershipUpsert.useMutation({
    onSuccess: () => void utils.adminConsole.userDetail.invalidate({ userId }),
  });
  const membershipRemove = api.adminConsole.membershipRemove.useMutation({
    onSuccess: () => void utils.adminConsole.userDetail.invalidate({ userId }),
  });
  const placementAdd = api.adminConsole.placementAdd.useMutation({
    onSuccess: () => void utils.adminConsole.userDetail.invalidate({ userId }),
  });
  const placementRemove = api.adminConsole.placementRemove.useMutation({
    onSuccess: () => void utils.adminConsole.userDetail.invalidate({ userId }),
  });
  const revokeGrant = api.adminConsole.grantRevokeById.useMutation({
    onSuccess: () => void utils.adminConsole.userDetail.invalidate({ userId }),
  });

  if (detail.isLoading) return <p className="text-sm text-neutral-700">Memuat akun…</p>;
  if (detail.isError) return <p className="text-sm text-danger-dark">{detail.error.message}</p>;
  if (!detail.data || !form) return null;

  const data = detail.data;
  const hasMahasiswa = data.user.nim !== null || data.user.nimTpb !== null;

  const save = () => {
    update.mutate({
      userId,
      name: form.name,
      image: form.image,
      isDemo: form.isDemo,
      hidden: form.hidden,
      ...(canRoles
        ? {
            email: form.email,
            role: form.role,
            confirmEmail: confirmEmail || undefined,
            emailVerified: form.emailVerified,
          }
        : {}),
      ...(hasMahasiswa
        ? {
            mahasiswa: {
              nim: form.nim || undefined,
              nimTpb: form.nimTpb || null,
              nama: form.namaMahasiswa || undefined,
              jurusan: form.jurusan || undefined,
              angkatan: form.angkatan ? Number(form.angkatan) : undefined,
              lineId: form.lineId || null,
              whatsapp: form.whatsapp || null,
              raporVisible: form.raporVisible,
              status: form.status,
            },
          }
        : {}),
    });
  };

  return (
    <div className="grid gap-4">
      <AdminPageHeader
        title={data.user.name ?? 'Akun'}
        description={data.user.email}
        actions={
          <Link
            href="/admin/akun"
            className="text-sm font-semibold text-primary-400 underline-offset-2 hover:underline"
          >
            Kembali ke daftar
          </Link>
        }
      />

      <AdminEditPanel
        title="Identitas akun"
        description="Ubah data akun dan profil dasar."
        error={update.error?.message ?? null}
        footer={
          canWrite ? (
            <Button type="button" variant="dark_blue" disabled={update.isPending} onClick={save}>
              {update.isPending ? 'Menyimpan…' : 'Simpan perubahan'}
            </Button>
          ) : (
            <p className="text-sm text-neutral-700">Hanya bisa dilihat.</p>
          )
        }
      >
        <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
          <div className="grid content-start gap-2">
            <div className="relative h-32 w-32 overflow-hidden rounded-full bg-neutral-200">
              {form.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full place-items-center text-xs text-neutral-700">Tanpa foto</span>
              )}
            </div>
            {canWrite ? (
              <UploadButton
                endpoint="imageUploader"
                onClientUploadComplete={(res) => {
                  if (res[0]) setForm({ ...form, image: res[0].url });
                }}
                onUploadError={(error) => window.alert(error.message)}
                appearance={{ button: 'text-xs' }}
              />
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="sm:col-span-2 text-xs text-neutral-700">
              Perubahan email atau role baru berlaku di sesi user setelah login ulang.
            </p>
            <Field label="Nama">
              <Input
                value={form.name}
                disabled={!canWrite}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                disabled={!canWrite || !canRoles || data.user.role === 'admin'}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </Field>
            <Field label="Role">
              <select
                className="h-10 rounded-md border border-neutral-400 bg-neutral-50 px-3 text-sm"
                value={form.role}
                disabled={!canWrite || !canRoles || data.user.role === 'admin'}
                onChange={(event) => setForm({ ...form, role: event.target.value as FormState['role'] })}
              >
                <option value="mahasiswa">mahasiswa</option>
                <option value="lembaga">lembaga</option>
                {data.user.role === 'admin' ? <option value="admin">admin</option> : null}
              </select>
            </Field>
            {data.user.role === 'admin' ? (
              <p className="sm:col-span-2 text-xs text-neutral-700">
                Akun ini Superadmin. Email dan role-nya hanya dapat diubah lewat menu Superadmin.
              </p>
            ) : null}
            {form.role !== data.user.role ? (
              <Field label="Konfirmasi: ketik ulang email akun ini">
                <Input
                  value={confirmEmail}
                  placeholder={data.user.email}
                  onChange={(event) => setConfirmEmail(event.target.value)}
                />
              </Field>
            ) : null}
            <div className="flex flex-wrap items-end gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.emailVerified}
                  disabled={!canWrite || !canRoles}
                  onChange={(event) => setForm({ ...form, emailVerified: event.target.checked })}
                />
                Email terverifikasi
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.hidden}
                  disabled={!canWrite}
                  onChange={(event) => setForm({ ...form, hidden: event.target.checked })}
                />
                Disembunyikan
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isDemo}
                  disabled={!canWrite}
                  onChange={(event) => setForm({ ...form, isDemo: event.target.checked })}
                />
                Demo
              </label>
            </div>
          </div>
        </div>
      </AdminEditPanel>

      {hasMahasiswa ? (
        <section className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
          <h2 className="text-lg font-semibold text-neutral-1000">Profil mahasiswa</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="NIM">
              <Input value={form.nim} disabled={!canWrite} onChange={(e) => setForm({ ...form, nim: e.target.value })} />
            </Field>
            <Field label="NIM TPB">
              <Input value={form.nimTpb} disabled={!canWrite} onChange={(e) => setForm({ ...form, nimTpb: e.target.value })} />
            </Field>
            <Field label="Nama di profil">
              <Input value={form.namaMahasiswa} disabled={!canWrite} onChange={(e) => setForm({ ...form, namaMahasiswa: e.target.value })} />
            </Field>
            <Field label="Jurusan">
              <Input value={form.jurusan} disabled={!canWrite} onChange={(e) => setForm({ ...form, jurusan: e.target.value })} />
            </Field>
            <Field label="Angkatan">
              <Input value={form.angkatan} disabled={!canWrite} onChange={(e) => setForm({ ...form, angkatan: e.target.value })} />
            </Field>
            <Field label="Status">
              <select
                className="h-10 rounded-md border border-neutral-400 bg-neutral-50 px-3 text-sm"
                value={form.status}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })}
              >
                <option value="aktif">aktif</option>
                <option value="alumni">alumni</option>
              </select>
            </Field>
            <Field label="LINE">
              <Input value={form.lineId} disabled={!canWrite} onChange={(e) => setForm({ ...form, lineId: e.target.value })} />
            </Field>
            <Field label="WhatsApp">
              <Input value={form.whatsapp} disabled={!canWrite} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </Field>
            <label className="flex items-end gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.raporVisible}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, raporVisible: e.target.checked })}
              />
              Rapor terlihat publik
            </label>
          </div>
          {canWrite ? (
            <div>
              <Button type="button" variant="dark_blue" disabled={update.isPending} onClick={save}>
                Simpan profil mahasiswa
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
        <h2 className="text-lg font-semibold text-neutral-1000">Afiliasi lembaga</h2>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px_180px_auto] sm:items-end">
          <div className="grid gap-1 text-sm font-semibold text-neutral-700">
            Lembaga
            <AdminEntitySearch
              kind="lembaga"
              value={membershipLembagaId}
              placeholder="Cari lembaga…"
              onSelect={(id) => setMembershipLembagaId(id)}
            />
          </div>
          <Field label="Angkatan">
            <Input value={cohortYear} onChange={(e) => setCohortYear(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Label">
            <Input value={cohortLabel} onChange={(e) => setCohortLabel(e.target.value)} />
          </Field>
          <Button
            type="button"
            variant="dark_blue"
            disabled={!canWrite || !membershipLembagaId || membership.isPending}
            onClick={() =>
              membership.mutate({
                userId,
                lembagaId: membershipLembagaId,
                cohortYear: cohortYear ? Number(cohortYear) : null,
                cohortLabel: cohortLabel || null,
                status: 'aktif',
              })
            }
          >
            Tambah/ubah
          </Button>
        </div>
        <ul className="grid gap-2">
          {data.memberships.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
              <span>
                <strong>{row.lembagaName ?? row.lembagaId}</strong>
                {row.cohortYear ? ` · ${row.cohortYear}` : ''}
                {row.cohortLabel ? ` · ${row.cohortLabel}` : ''} · {row.status}
              </span>
              {canWrite ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={membershipRemove.isPending}
                  onClick={() => membershipRemove.mutate({ membershipId: row.id })}
                >
                  Hapus
                </Button>
              ) : null}
            </li>
          ))}
          {data.memberships.length === 0 ? <li className="text-sm text-neutral-700">Belum ada keanggotaan.</li> : null}
        </ul>
      </section>

      <section className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
        <h2 className="text-lg font-semibold text-neutral-1000">Penempatan organogram</h2>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="grid gap-1 text-sm font-semibold text-neutral-700">
            Jabatan
            <AdminEntitySearch
              kind="position"
              value={positionId}
              placeholder={positionLabel || 'Cari jabatan, unit, atau lembaga…'}
              disabled={!canWrite}
              onSelect={(id, label) => {
                setPositionId(id);
                setPositionLabel(label);
              }}
            />
          </div>
          <Button
            type="button"
            variant="dark_blue"
            disabled={!canWrite || !positionId || placementAdd.isPending}
            onClick={() => placementAdd.mutate({ userId, positionId, source: 'manual' })}
          >
            Tempatkan
          </Button>
        </div>
        <ul className="grid gap-2">
          {data.placements.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
              <span>
                <strong>{row.positionTitle}</strong> · {row.unitName} · {row.structureName}
                {row.lembagaName ? ` · ${row.lembagaName}` : ''}
                {row.periodName ? ` · ${row.periodName}` : ''}
              </span>
              {canWrite ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={placementRemove.isPending}
                  onClick={() => placementRemove.mutate({ placementId: row.id })}
                >
                  Hapus
                </Button>
              ) : null}
            </li>
          ))}
          {data.placements.length === 0 ? <li className="text-sm text-neutral-700">Belum ada penempatan.</li> : null}
        </ul>
      </section>

      <section className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
        <h2 className="text-lg font-semibold text-neutral-1000">Akses</h2>
        <ul className="grid gap-2">
          {data.grants.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
              <span>
                {row.lembagaName ? `Lembaga · ${row.lembagaName}` : `Kegiatan · ${row.periodName ?? ''}`}
                {' · '}
                {row.features.join(', ')}
                {row.propagate ? ' · propagate' : ''}
              </span>
              {canWrite ? (
                <Button size="sm" variant="ghost" onClick={() => revokeGrant.mutate({ grantId: row.id })}>
                  Cabut
                </Button>
              ) : null}
            </li>
          ))}
          {data.grants.length === 0 ? <li className="text-sm text-neutral-700">Belum ada akses.</li> : null}
        </ul>
      </section>

      <section className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
        <h2 className="text-lg font-semibold text-neutral-1000">Riwayat (read-only)</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <History title="Best staff kegiatan" rows={data.bestStaff.kegiatan.map((r) => `${r.eventName ?? r.eventId} · ${r.division}`)} />
          <History title="Best staff lembaga" rows={data.bestStaff.lembaga.map((r) => `${r.lembagaName ?? r.lembagaId} · ${r.division}`)} />
          <History title="Riwayat organisasi" rows={data.riwayat.organisasi.map((r) => `${r.lembagaNama} · ${r.division} · ${r.position}`)} />
          <History title="Riwayat kepanitiaan" rows={data.riwayat.kepanitiaan.map((r) => `${r.eventNama} · ${r.division} · ${r.position}`)} />
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-neutral-700">
      {label}
      {children}
    </label>
  );
}

function History({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-1000">{title}</h3>
      <ul className="mt-1 grid gap-1 text-sm text-neutral-700">
        {rows.length === 0 ? <li>—</li> : rows.map((row, index) => <li key={`${row}-${index}`}>{row}</li>)}
      </ul>
    </div>
  );
}
