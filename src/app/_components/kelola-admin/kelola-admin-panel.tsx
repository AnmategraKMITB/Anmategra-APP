'use client';

import { Lock, Trash2, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';

// Hanya fitur yang benar-benar ditegakkan backend (forms/events disembunyikan).
const FEATURES = ['admin', 'oprec', 'organization'] as const;
type Feature = (typeof FEATURES)[number];
const LABEL: Record<Feature, string> = {
  admin: 'Semua akses',
  oprec: 'Oprec',
  organization: 'Organisasi',
};

type Tab = 'lembaga' | 'kegiatan';

type Entry = {
  userId: string;
  name: string | null;
  email: string;
  nim: number | null;
  features: string[];
  origin: 'lembaga' | 'diwarisi';
  sourceLembagaName: string | null;
  propagate: boolean;
};

const chip = (on: boolean) =>
  `rounded-full border px-2.5 py-0.5 text-xs ${
    on
      ? 'border-slate-700 bg-slate-700 text-white'
      : 'border-slate-300 text-slate-600'
  }`;

/** "Semua akses" menyalakan/mematikan seluruh chip lain. */
function toggleFeature(current: Feature[], f: Feature): Feature[] {
  if (f === 'admin') {
    return current.includes('admin') ? [] : [...FEATURES];
  }
  const next = current.includes(f)
    ? current.filter((x) => x !== f && x !== 'admin')
    : [...current, f];
  const others = FEATURES.filter((x) => x !== 'admin');
  return others.every((x) => next.includes(x))
    ? [...FEATURES]
    : next.filter((x) => x !== 'admin');
}

const toApiFeatures = (v: Feature[]): Feature[] =>
  v.includes('admin') ? ['admin'] : v;

function FeatureChips({
  value,
  onChange,
}: {
  value: Feature[];
  onChange: (v: Feature[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FEATURES.map((f) => (
        <button
          key={f}
          type="button"
          className={chip(value.includes(f))}
          onClick={() => onChange(toggleFeature(value, f))}
        >
          {LABEL[f]}
        </button>
      ))}
    </div>
  );
}

export default function KelolaAdminPanel({
  mode,
  lembagaId,
  eventId,
  access,
}: {
  mode: 'lembaga' | 'kegiatan';
  lembagaId: string;
  /** Wajib pada mode `kegiatan`. */
  eventId?: string;
  access: 'owner' | 'admin';
}) {
  const [tab, setTab] = useState<Tab>(mode === 'kegiatan' ? 'kegiatan' : 'lembaga');
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>(eventId);
  const [addOpen, setAddOpen] = useState(false);
  const [target, setTarget] = useState<Entry | null>(null);
  const [filterOrigin, setFilterOrigin] = useState<'semua' | 'lembaga' | 'diwarisi'>('semua');
  const [filterFeature, setFilterFeature] = useState<'semua' | Feature>('semua');

  const utils = api.useUtils();
  const isOwner = access === 'owner';
  const canEdit = tab === 'kegiatan' || isOwner;

  const events = api.adminGrant.listLembagaEvents.useQuery(
    { lembagaId },
    { enabled: mode === 'lembaga' },
  );
  const lembagaAdmins = api.adminGrant.listLembagaAdmins.useQuery(
    { lembagaId },
    { enabled: tab === 'lembaga' },
  );
  const eventAdmins = api.adminGrant.listEventAdmins.useQuery(
    { eventId: selectedEvent ?? '' },
    { enabled: tab === 'kegiatan' && !!selectedEvent },
  );

  const rows: Entry[] = useMemo(() => {
    const data = tab === 'lembaga' ? lembagaAdmins.data : eventAdmins.data;
    return (data ?? []) as Entry[];
  }, [tab, lembagaAdmins.data, eventAdmins.data]);

  const filtered = rows.filter(
    (r) =>
      (filterOrigin === 'semua' || r.origin === filterOrigin) &&
      (filterFeature === 'semua' ||
        r.features.includes('admin') ||
        r.features.includes(filterFeature)),
  );

  const refresh = () => {
    void utils.adminGrant.listLembagaAdmins.invalidate();
    void utils.adminGrant.listEventAdmins.invalidate();
  };
  const onError = (e: { message: string }) => toast.error(e.message);

  const revokeLembaga = api.adminGrant.revokeLembagaAdmin.useMutation({
    onSuccess: () => {
      toast.success('Akses dicabut.');
      setTarget(null);
      refresh();
    },
    onError,
  });
  const revokeEvent = api.adminGrant.revokeEventAdmin.useMutation({
    onSuccess: () => {
      toast.success('Akses dicabut.');
      setTarget(null);
      refresh();
    },
    onError,
  });

  const confirmRevoke = () => {
    if (!target) return;
    if (tab === 'lembaga') {
      revokeLembaga.mutate({ lembagaId, userId: target.userId });
    } else if (selectedEvent) {
      revokeEvent.mutate({ lembagaId, eventId: selectedEvent, userId: target.userId });
    }
  };

  return (
    <section className="w-full rounded-lg border bg-white">
      <div className="flex flex-wrap items-center border-b">
        {mode === 'lembaga' && (
          <>
            {(['lembaga', 'kegiatan'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm ${
                  tab === t
                    ? 'border-b-2 border-slate-800 font-semibold'
                    : 'text-slate-500'
                }`}
              >
                {t === 'lembaga' ? 'Admin Lembaga' : 'Admin Kepanitiaan'}
              </button>
            ))}
          </>
        )}
        {mode === 'kegiatan' && (
          <span className="px-5 py-3 text-sm font-semibold">Admin Kepanitiaan</span>
        )}
        {canEdit && (tab === 'lembaga' || selectedEvent) && (
          <Button size="sm" className="m-2 ml-auto gap-1" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" /> Tambah admin
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b bg-slate-50 p-3 text-sm">
        {mode === 'lembaga' && tab === 'kegiatan' && (
          <select
            className="rounded border px-2 py-1"
            value={selectedEvent ?? ''}
            onChange={(e) => setSelectedEvent(e.target.value || undefined)}
          >
            <option value="">Pilih kegiatan…</option>
            {(events.data ?? []).map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        )}
        {tab === 'lembaga' && (
          <select
            className="rounded border px-2 py-1"
            value={filterOrigin}
            onChange={(e) => setFilterOrigin(e.target.value as typeof filterOrigin)}
          >
            <option value="semua">Semua asal</option>
            <option value="lembaga">Lembaga ini</option>
            <option value="diwarisi">Diwarisi dari induk</option>
          </select>
        )}
        <select
          className="rounded border px-2 py-1"
          value={filterFeature}
          onChange={(e) => setFilterFeature(e.target.value as typeof filterFeature)}
        >
          <option value="semua">Semua jenis akses</option>
          {FEATURES.map((f) => (
            <option key={f} value={f}>
              {LABEL[f]}
            </option>
          ))}
        </select>
        {tab === 'lembaga' && !isOwner && (
          <span className="text-xs text-slate-500">
            Hanya Owner yang dapat mengubah Admin Lembaga.
          </span>
        )}
      </div>

      {tab === 'kegiatan' && !selectedEvent ? (
        <p className="p-6 text-sm text-slate-500">Pilih kegiatan terlebih dahulu.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="p-3">Penerima</th>
              <th>Akses</th>
              <th>Asal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-slate-400">
                  Belum ada admin.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={`${r.origin}-${r.userId}`} className="border-t">
                <td className="p-3">
                  <div className="font-medium text-slate-800">{r.name ?? r.email}</div>
                  <div className="text-xs text-slate-500">
                    {r.nim ?? '-'} · {r.email}
                  </div>
                </td>
                <td>
                  {r.features.includes('admin')
                    ? LABEL.admin
                    : r.features.map((f) => LABEL[f as Feature] ?? f).join(', ')}
                </td>
                <td className="text-xs text-slate-500">
                  {r.origin === 'diwarisi' ? (
                    <span className="inline-flex items-center gap-1">
                      <Lock size={12} /> Diwarisi dari {r.sourceLembagaName}
                    </span>
                  ) : tab === 'kegiatan' ? (
                    'Kegiatan'
                  ) : r.propagate ? (
                    'Termasuk sub-lembaga'
                  ) : (
                    'Lembaga ini'
                  )}
                </td>
                <td className="pr-3 text-right">
                  {r.origin === 'lembaga' && canEdit && (
                    <button
                      type="button"
                      aria-label={`Cabut akses ${r.name ?? r.email}`}
                      onClick={() => setTarget(r)}
                      className="text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cabut akses {target?.name ?? target?.email}?</DialogTitle>
            <DialogDescription>
              Akun ini langsung kehilangan aksesnya.
              {target?.propagate && ' Akses di semua sub-lembaga ikut hilang.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Batal
            </Button>
            <Button
              variant="warning"
              disabled={revokeLembaga.isPending || revokeEvent.isPending}
              onClick={confirmRevoke}
            >
              Cabut
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {addOpen && (
        <AddDialog
          tab={tab}
          lembagaId={lembagaId}
          eventId={selectedEvent}
          isOwner={isOwner}
          onClose={() => setAddOpen(false)}
          onDone={() => {
            setAddOpen(false);
            refresh();
          }}
        />
      )}
    </section>
  );
}

function AddDialog({
  tab,
  lembagaId,
  eventId,
  isOwner,
  onClose,
  onDone,
}: {
  tab: Tab;
  lembagaId: string;
  eventId?: string;
  isOwner: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [features, setFeatures] = useState<Feature[]>(['admin']);
  const [propagate, setPropagate] = useState(false);

  const onSuccess = () => {
    toast.success('Akses diberikan.');
    onDone();
  };
  const onError = (e: { message: string }) => toast.error(e.message);
  const grantLembaga = api.adminGrant.grantLembagaAdmin.useMutation({ onSuccess, onError });
  const grantEvent = api.adminGrant.grantEventAdmin.useMutation({ onSuccess, onError });
  const pending = grantLembaga.isPending || grantEvent.isPending;

  const submit = () => {
    const id = identifier.trim();
    if (!id) return toast.error('Isi NIM atau email persis.');
    if (features.length === 0) return toast.error('Pilih minimal satu akses.');
    const f = toApiFeatures(features);
    if (tab === 'lembaga') {
      grantLembaga.mutate({ lembagaId, identifier: id, features: f, propagate: isOwner && propagate });
    } else if (eventId) {
      grantEvent.mutate({ lembagaId, eventId, identifier: id, features: f });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Tambah {tab === 'lembaga' ? 'Admin Lembaga' : 'Admin Kepanitiaan'}
          </DialogTitle>
          <DialogDescription>
            Cari akun terdaftar dengan NIM atau email persis.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            placeholder="NIM atau email persis"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <FeatureChips value={features} onChange={setFeatures} />
          {tab === 'lembaga' && isOwner && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={propagate}
                onChange={(e) => setPropagate(e.target.checked)}
              />
              Berlaku juga di sub-lembaga
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={pending} onClick={submit}>
            Tambah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
