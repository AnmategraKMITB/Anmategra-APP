'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Event } from '~/app/lembaga/kegiatan/_components/kegiatan-container';
import TambahEditKegiatanForm from '~/app/lembaga/kegiatan/_components/form/tambah-edit-kegiatan-form';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';
import { UploadButton } from '~/utils/uploadthing';

import { AdminEditPanel } from './admin-edit-panel';
import { AdminEntitySearch } from './admin-entity-search';
import { AdminPageHeader } from './admin-page-header';

const TYPES = [
  'Himpunan',
  'UKM',
  'Kepanitiaan',
  'BSO',
  'Badan',
  'Pusat',
  'Organisasi',
] as const;

type Tab = 'kegiatan' | 'kepengurusan' | 'organogram' | 'anggota';

type FormState = {
  name: string;
  acronym: string;
  type: (typeof TYPES)[number];
  description: string;
  parentId: string;
  foundingDate: string;
  endingDate: string;
  major: string;
  field: string;
  memberCount: string;
  raporVisible: boolean;
  image: string | null;
};

function toDateInput(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function LembagaDetail({ lembagaId }: { lembagaId: string }) {
  const utils = api.useUtils();
  const detail = api.adminConsole.lembagaDetail.useQuery({ lembagaId });
  const permissions = api.adminConsole.myAdminPermissions.useQuery();
  const perms = permissions.data?.permissions ?? [];
  const canWrite = perms.includes('*') || perms.includes('lembaga.write');
  const canEvents = perms.includes('*') || perms.includes('lembaga.events');
  const canOrg = perms.includes('*') || perms.includes('lembaga.organization');

  const [tab, setTab] = useState<Tab>('kegiatan');
  const [form, setForm] = useState<FormState | null>(null);
  const [parentLabel, setParentLabel] = useState('');
  const [editingPeriod, setEditingPeriod] = useState<{ kind: 'kegiatan' | 'kepengurusan'; event: Event | null } | null>(null);
  const [profileForm, setProfileForm] = useState<{ id?: string; name: string; description: string } | null>(null);

  useEffect(() => {
    if (!detail.data) return;
    const l = detail.data.lembaga;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: l.name,
      acronym: l.acronym ?? '',
      type: l.type ?? 'Organisasi',
      description: l.description ?? '',
      parentId: l.parentId ?? '',
      foundingDate: toDateInput(l.foundingDate),
      endingDate: toDateInput(l.endingDate),
      major: l.major ?? '',
      field: l.field ?? '',
      memberCount: l.memberCount?.toString() ?? '',
      raporVisible: l.raporVisible,
      image: l.image ?? null,
    });
    setParentLabel('');
  }, [detail.data]);

  const update = api.adminConsole.lembagaUpdate.useMutation({
    onSuccess: () => void utils.adminConsole.lembagaDetail.invalidate({ lembagaId }),
  });
  const removeEvent = api.adminConsole.eventDelete.useMutation({
    onSuccess: () => void utils.adminConsole.lembagaDetail.invalidate({ lembagaId }),
  });
  const upsertProfile = api.adminConsole.lembagaProfileUpsert.useMutation({
    onSuccess: () => {
      setProfileForm(null);
      void utils.adminConsole.lembagaDetail.invalidate({ lembagaId });
    },
  });
  const deleteProfile = api.adminConsole.lembagaProfileDelete.useMutation({
    onSuccess: () => void utils.adminConsole.lembagaDetail.invalidate({ lembagaId }),
  });

  if (detail.isLoading) return <p className="text-sm text-neutral-700">Memuat lembaga…</p>;
  if (detail.isError) return <p className="text-sm text-danger-dark">{detail.error.message}</p>;
  if (!detail.data || !form) return null;

  const data = detail.data;
  const currentPeriods =
    tab === 'kegiatan'
      ? data.periods.filter((period) => period.kind === 'kegiatan')
      : data.periods.filter((period) => period.kind === 'kepengurusan');

  const save = () => {
    update.mutate({
      lembagaId,
      name: form.name,
      acronym: form.acronym.trim() || null,
      type: form.type,
      description: form.description || null,
      parentId: form.parentId || null,
      foundingDate: form.foundingDate ? new Date(form.foundingDate) : null,
      endingDate: form.endingDate ? new Date(form.endingDate) : null,
      major: form.major || null,
      field: form.field || null,
      memberCount: form.memberCount ? Number(form.memberCount) : null,
      raporVisible: form.raporVisible,
      image: form.image,
    });
  };

  const openCreate = (kind: 'kegiatan' | 'kepengurusan') => {
    setEditingPeriod({ kind, event: null });
  };
  const openEdit = (period: (typeof data.periods)[number]) => {
    setEditingPeriod({
      kind: period.kind === 'kepengurusan' ? 'kepengurusan' : 'kegiatan',
      event: periodToEvent(period),
    });
  };

  return (
    <div className="grid gap-4">
      <AdminPageHeader
        title={data.lembaga.name}
        description={`${data.lembaga.type ?? 'Lembaga'}${data.lembaga.acronym ? ` · ${data.lembaga.acronym}` : ''} · ${data.memberCount} anggota aktif`}
        actions={
          <Link href="/admin/lembaga" className="text-sm font-semibold text-primary-400 underline-offset-2 hover:underline">
            Kembali ke daftar
          </Link>
        }
      />

      <AdminEditPanel
        title="Profil lembaga"
        description="Ubah identitas, deskripsi, hierarki, dan foto lembaga."
        error={update.error?.message ?? null}
        footer={
          canWrite ? (
            <Button type="button" variant="dark_blue" disabled={update.isPending} onClick={save}>
              {update.isPending ? 'Menyimpan…' : 'Simpan profil'}
            </Button>
          ) : (
            <p className="text-sm text-neutral-700">Hanya bisa dilihat.</p>
          )
        }
      >
        <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
          <div className="grid content-start gap-2">
            <div className="relative h-32 w-32 overflow-hidden rounded-2xl bg-neutral-200">
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
              />
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nama">
              <Input value={form.name} disabled={!canWrite} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Singkatan">
              <Input value={form.acronym} disabled={!canWrite} onChange={(e) => setForm({ ...form, acronym: e.target.value })} />
            </Field>
            <Field label="Jenis">
              <select
                className="h-10 rounded-md border border-neutral-400 bg-neutral-50 px-3 text-sm"
                value={form.type}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, type: e.target.value as FormState['type'] })}
              >
                {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>
            <div className="grid gap-1 text-sm font-semibold text-neutral-700">
              Induk/badan
              <AdminEntitySearch
                kind="lembaga"
                value={form.parentId}
                placeholder={parentLabel || 'Tidak ada induk'}
                disabled={!canWrite}
                onSelect={(id, label) => {
                  setForm({ ...form, parentId: id });
                  setParentLabel(label);
                }}
              />
            </div>
            <Field label="Berdiri">
              <Input type="date" value={form.foundingDate} disabled={!canWrite} onChange={(e) => setForm({ ...form, foundingDate: e.target.value })} />
            </Field>
            <Field label="Berakhir">
              <Input type="date" value={form.endingDate} disabled={!canWrite} onChange={(e) => setForm({ ...form, endingDate: e.target.value })} />
            </Field>
            <Field label="Major">
              <Input value={form.major} disabled={!canWrite} onChange={(e) => setForm({ ...form, major: e.target.value })} />
            </Field>
            <Field label="Field">
              <Input value={form.field} disabled={!canWrite} onChange={(e) => setForm({ ...form, field: e.target.value })} />
            </Field>
            <Field label="Jumlah anggota">
              <Input value={form.memberCount} disabled={!canWrite} onChange={(e) => setForm({ ...form, memberCount: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="grid gap-3">
          <Field label="Deskripsi">
            <textarea
              className="min-h-28 rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm"
              value={form.description}
              disabled={!canWrite}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.raporVisible}
              disabled={!canWrite}
              onChange={(e) => setForm({ ...form, raporVisible: e.target.checked })}
            />
            Rapor terlihat publik
          </label>
        </div>
      </AdminEditPanel>

      <section className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-neutral-1000">Blok profil lembaga</h2>
            <p className="text-sm text-neutral-700">Visi, misi, dan blok profil lain yang tampil di halaman lembaga.</p>
          </div>
          {canWrite ? (
            <Button
              type="button"
              variant="dark_blue"
              onClick={() => setProfileForm({ name: '', description: '' })}
            >
              Tambah blok
            </Button>
          ) : null}
        </div>
        {profileForm ? (
          <div className="grid gap-3 rounded-lg border border-neutral-300 bg-white p-3">
            <Field label="Nama blok">
              <Input
                value={profileForm.name}
                onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
              />
            </Field>
            <Field label="Isi">
              <textarea
                className="min-h-28 rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm"
                value={profileForm.description}
                onChange={(event) => setProfileForm({ ...profileForm, description: event.target.value })}
              />
            </Field>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="dark_blue"
                disabled={upsertProfile.isPending || !profileForm.name.trim() || !profileForm.description.trim()}
                onClick={() =>
                  upsertProfile.mutate({
                    lembagaId,
                    profilId: profileForm.id,
                    name: profileForm.name.trim(),
                    description: profileForm.description.trim(),
                  })
                }
              >
                {upsertProfile.isPending ? 'Menyimpan…' : 'Simpan blok'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setProfileForm(null)}>Batal</Button>
            </div>
          </div>
        ) : null}
        <ul className="grid gap-2">
          {data.profiles.map((profile) => (
            <li key={profile.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
              <span className="min-w-0">
                <strong>{profile.name}</strong>
                <span className="mt-1 block whitespace-pre-wrap text-neutral-700">{profile.description}</span>
              </span>
              {canWrite ? (
                <span className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setProfileForm({ id: profile.id, name: profile.name, description: profile.description })}
                  >
                    Ubah
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={deleteProfile.isPending}
                    onClick={() => deleteProfile.mutate({ profilId: profile.id })}
                  >
                    Hapus
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
          {data.profiles.length === 0 ? <li className="text-sm text-neutral-700">Belum ada blok profil.</li> : null}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2">
        {([
          ['kegiatan', 'Kegiatan'],
          ['kepengurusan', 'Kepengurusan'],
          ['organogram', 'Organogram/Badan'],
          ['anggota', 'Anggota'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={
              tab === value
                ? 'rounded-full bg-primary-200 px-3 py-1 text-sm font-semibold text-primary-400'
                : 'rounded-full border border-neutral-400 px-3 py-1 text-sm text-neutral-700'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'kegiatan' || tab === 'kepengurusan' ? (
        <section className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-1000">
              {tab === 'kegiatan' ? 'Kegiatan' : 'Kepengurusan'}
            </h2>
            {canEvents ? (
              <Button type="button" variant="dark_blue" onClick={() => openCreate(tab)}>
                Tambah {tab === 'kegiatan' ? 'kegiatan' : 'kepengurusan'}
              </Button>
            ) : null}
          </div>
          <ul className="grid gap-2">
            {currentPeriods.map((period) => (
              <li key={period.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
                <span>
                  <strong>{period.name}</strong>
                  {period.label ? ` · ${period.label}` : ''} · {period.status}
                  {period.startDate ? ` · ${new Date(period.startDate).toLocaleDateString('id-ID')}` : ''}
                </span>
                <span className="flex gap-1">
                  {canEvents ? (
                    <Button size="sm" variant="ghost" onClick={() => openEdit(period)}>Ubah</Button>
                  ) : null}
                  {canEvents ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={removeEvent.isPending}
                      onClick={() => {
                        if (window.confirm(`Hapus ${period.name}?`)) {
                          removeEvent.mutate({ id: period.id, lembagaId });
                        }
                      }}
                    >
                      Hapus
                    </Button>
                  ) : null}
                  <Link
                    href={`/admin/lembaga/${lembagaId}/organogram/${period.id}`}
                    className="inline-flex items-center px-3 py-1 text-sm font-semibold text-primary-400 underline-offset-2 hover:underline"
                  >
                    Organogram
                  </Link>
                </span>
              </li>
            ))}
            {currentPeriods.length === 0 ? <li className="text-sm text-neutral-700">Belum ada data.</li> : null}
          </ul>
        </section>
      ) : null}

      {tab === 'organogram' ? (
        <section className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
          <h2 className="text-lg font-semibold text-neutral-1000">Struktur organogram</h2>
          <ul className="grid gap-2">
            {data.structures.map((structure) => (
              <li key={structure.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
                <span>
                  <strong>{structure.name}</strong>
                  {structure.editLocked ? ' · terkunci' : ''}
                  {structure.isActive ? '' : ' · tidak aktif'}
                </span>
                {structure.eventId && canOrg ? (
                  <Link
                    href={`/admin/lembaga/${lembagaId}/organogram/${structure.eventId}`}
                    className="text-sm font-semibold text-primary-400 underline-offset-2 hover:underline"
                  >
                    Buka editor
                  </Link>
                ) : null}
              </li>
            ))}
            {data.structures.length === 0 ? <li className="text-sm text-neutral-700">Belum ada struktur.</li> : null}
          </ul>
        </section>
      ) : null}

      {tab === 'anggota' ? (
        <section className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
          <h2 className="text-lg font-semibold text-neutral-1000">Anggota</h2>
          <p className="text-sm text-neutral-700">
            {data.memberCount} anggota aktif. Kelola keanggotaan dari halaman akun mahasiswa.
          </p>
        </section>
      ) : null}

      <Dialog open={editingPeriod !== null} onOpenChange={(open) => { if (!open) setEditingPeriod(null); }}>
        <DialogContent className="min-w-[800px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {editingPeriod?.event ? 'Ubah' : 'Tambah'} {editingPeriod?.kind === 'kepengurusan' ? 'kepengurusan' : 'kegiatan'}
            </DialogTitle>
          </DialogHeader>
          {editingPeriod ? (
            <TambahEditKegiatanForm
              setIsOpen={(open) => { if (!open) setEditingPeriod(null); }}
              kegiatan={editingPeriod.event}
              admin={{ lembagaId, kind: editingPeriod.kind }}
              onDone={() => {
                setEditingPeriod(null);
                void utils.adminConsole.lembagaDetail.invalidate({ lembagaId });
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function periodToEvent(period: {
  id: string;
  name: string;
  label: string | null;
  description: string | null;
  image: string | null;
  backgroundImage: string | null;
  startDate: Date | string;
  endDate: Date | string | null;
  status: 'Coming Soon' | 'On going' | 'Ended';
  oprecLink: string | null;
  location: string | null;
  isHighlighted: boolean;
  isOrganogram: boolean;
  organogramImage: string | null;
  raporVisible: boolean;
  participantLimit: number;
  participantCount: number;
}): Event & { label?: string | null } {
  return {
    id: period.id,
    label: period.label,
    name: period.name,
    description: period.description,
    start_date: new Date(period.startDate).toISOString(),
    end_date: period.endDate ? new Date(period.endDate).toISOString() : undefined,
    participant_count: period.participantCount,
    status: period.status,
    thumbnail: period.image,
    background_image: period.backgroundImage,
    oprec_link: period.oprecLink,
    location: period.location,
    participant_limit: period.participantLimit,
    is_highlighted: period.isHighlighted,
    is_organogram: period.isOrganogram,
    organogram_image: period.organogramImage,
    rapor_visible: period.raporVisible,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-neutral-700">
      {label}
      {children}
    </label>
  );
}
