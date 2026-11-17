'use client';

import { Fragment, useState } from 'react';
import { Button } from '~/components/ui/button';
import { type RouterOutputs, api } from '~/trpc/react';

import {
  Chip,
  ErrorNote,
  Field,
  Modal,
  Notice,
  inputClass,
  selectClass,
  when,
} from '../placement/shared';

type Division = RouterOutputs['oprec']['offerOverview']['divisions'][number];

const DAY_MS = 86_400_000;
/** Sama dengan batas server (MAX_OFFER_DAYS di offer.ts). */
const MAX_OFFER_DAYS = 30;

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → isian `datetime-local` dalam waktu lokal browser, mis. "2026-11-18T09:30". */
function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Isian `datetime-local` → Date menurut waktu lokal browser. Diurai manual
 * supaya tidak bergantung pada cara browser membaca string tanpa zona waktu.
 */
function fromLocalInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [year = NaN, month = NaN, day = NaN, hour = NaN, minute = NaN] = match
    .slice(1)
    .map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "267/350", atau "12/tanpa batas" bila kuota 0. */
function fillText(division: Division) {
  return `${division.filled}/${division.quota === 0 ? 'tanpa batas' : division.quota}`;
}

/** Divisi dikelompokkan per bidang untuk `<optgroup>`, urutan tetap. */
function groupByField(divisions: Division[]) {
  const groups = new Map<string | null, Division[]>();
  for (const division of divisions) {
    const key = division.groupLabel;
    groups.set(key, [...(groups.get(key) ?? []), division]);
  }
  return [...groups.entries()];
}

/**
 * Panel admin: membuka tawaran tempat sebuah divisi yang masih kurang orang
 * bagi pendaftar yang belum diterima di divisi mana pun.
 */
export function OfferPanel({
  recruitmentId,
  announce,
  onError,
}: {
  recruitmentId: string;
  announce: (message: string) => void;
  onError: (message: string) => void;
}) {
  const utils = api.useUtils();
  const overview = api.oprec.offerOverview.useQuery(
    { recruitmentId },
    { retry: false },
  );
  const openMutation = api.oprec.offerOpen.useMutation();
  const closeMutation = api.oprec.offerClose.useMutation();
  const [picked, setPicked] = useState('');
  const [deadline, setDeadline] = useState(() =>
    toLocalInput(new Date(Date.now() + DAY_MS)),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, setClosing] = useState<Division | null>(null);

  if (overview.isError) {
    return (
      <section
        aria-label="Tawaran tempat"
        className="mt-6 grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
      >
        <ErrorNote message={overview.error.message} />
      </section>
    );
  }
  const data = overview.data;
  if (!data) return null;

  const divisions = data.divisions;
  const selected =
    divisions.find((d) => d.id === picked) ??
    divisions.find((d) => d.quota > 0 && d.filled < d.quota) ??
    divisions[0] ??
    null;
  const offered = divisions.filter((d) => d.offerClosesAt !== null);
  const closesAt = fromLocalInput(deadline);
  const now = new Date();
  const blocked = data.problem !== null;
  const busy = openMutation.isPending || closeMutation.isPending;
  const verb = selected?.offerOpen ? 'Perpanjang' : 'Buka';

  const open = () => {
    if (!selected || !closesAt) return;
    openMutation.mutate(
      { recruitmentId, divisionId: selected.id, closesAt },
      {
        onSuccess: (result) => {
          setConfirmOpen(false);
          void utils.oprec.offerOverview.invalidate({ recruitmentId });
          void utils.oprec.priorityBoard.invalidate();
          announce(`Tawaran dibuka. ${result.notified} pendaftar diberi tahu.`);
        },
        onError: (error) => {
          setConfirmOpen(false);
          onError(error.message);
        },
      },
    );
  };

  const close = () => {
    if (!closing) return;
    const label = closing.label;
    closeMutation.mutate(
      { recruitmentId, divisionId: closing.id },
      {
        onSuccess: () => {
          setClosing(null);
          void utils.oprec.offerOverview.invalidate({ recruitmentId });
          announce(`Tawaran ${label} ditutup.`);
        },
        onError: (error) => {
          setClosing(null);
          onError(error.message);
        },
      },
    );
  };

  return (
    <section
      aria-label="Tawaran tempat"
      className="mt-6 grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-neutral-1000">
          Tawaran tempat untuk yang belum dapat divisi
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          {data.unplaced} pendaftar belum diterima di divisi mana pun. Saat
          tawaran dibuka, mereka mendapat pemberitahuan dan tombol “Saya
          bersedia” di halaman pendaftarannya. Yang bersedia otomatis masuk di
          akhir urutan divisi tawaran. Setelah batas waktu, jalankan Pratinjau
          penempatan lalu Terapkan.
        </p>
      </div>

      {data.problem ? <Notice>{data.problem}</Notice> : null}

      {offered.length > 0 ? (
        <>
          <ul className="grid gap-2" aria-label="Tawaran per divisi">
            {offered.map((division) => (
              <li
                key={division.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-400 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-neutral-1000">
                    {division.label}
                    {division.groupLabel ? (
                      <span className="font-normal text-neutral-700">
                        {' '}
                        · {division.groupLabel}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-neutral-700">
                    {fillText(division)} · {division.offerAccepted} bersedia ·{' '}
                    {division.offerOpen
                      ? `dibuka sampai ${when(division.offerClosesAt)}`
                      : `ditutup ${when(division.offerClosesAt)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {division.offerOpen ? (
                    <>
                      <Chip tone="success">Dibuka</Chip>
                      <Button
                        size="sm"
                        variant="dark_blue_outline"
                        disabled={busy}
                        onClick={() => setClosing(division)}
                      >
                        Tutup sekarang
                      </Button>
                    </>
                  ) : (
                    <Chip tone="muted">Ditutup</Chip>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-700">
            Setelah ada yang bersedia, buka Pratinjau penempatan untuk melihat
            siapa yang masuk, lalu Terapkan.
          </p>
        </>
      ) : null}

      {divisions.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Field label="Divisi tawaran">
              <select
                className={selectClass}
                value={selected?.id ?? ''}
                disabled={blocked || busy}
                onChange={(event) => setPicked(event.target.value)}
              >
                {groupByField(divisions).map(([group, items]) => {
                  const options = items.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.label} ({fillText(division)})
                    </option>
                  ));
                  return group === null ? (
                    <Fragment key="__tanpa_bidang__">{options}</Fragment>
                  ) : (
                    <optgroup key={group} label={group}>
                      {options}
                    </optgroup>
                  );
                })}
              </select>
            </Field>
          </div>
          <div className="min-w-48 flex-1">
            <Field label="Batas waktu">
              <input
                type="datetime-local"
                className={inputClass}
                value={deadline}
                min={toLocalInput(now)}
                max={toLocalInput(
                  new Date(now.getTime() + MAX_OFFER_DAYS * DAY_MS),
                )}
                disabled={blocked || busy}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </Field>
          </div>
          <Button
            variant="dark_blue"
            disabled={blocked || busy || !selected || !closesAt}
            onClick={() => setConfirmOpen(true)}
          >
            {verb} tawaran
          </Button>
        </div>
      ) : null}

      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          selected && closesAt
            ? `${verb} tawaran ${selected.label} sampai ${when(closesAt)}?`
            : `${verb} tawaran?`
        }
        description={`${data.unplaced} pendaftar yang belum dapat divisi akan melihat tombol bersedia di halaman pendaftarannya. Pemberitahuan Inbox hanya dikirim sekali per oprec.`}
        footer={
          <>
            <Button
              variant="dark_blue_outline"
              onClick={() => setConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="dark_blue"
              disabled={openMutation.isPending || !selected || !closesAt}
              onClick={open}
            >
              {openMutation.isPending ? 'Membuka…' : `${verb} tawaran`}
            </Button>
          </>
        }
      >
        {selected ? (
          <p className="text-sm text-neutral-700">
            Saat ini {selected.label} terisi {fillText(selected)}. Penempatan
            baru berubah setelah kamu menjalankan Pratinjau penempatan lalu
            Terapkan.
          </p>
        ) : null}
      </Modal>

      <Modal
        open={closing !== null}
        onOpenChange={(value) => {
          if (!value) setClosing(null);
        }}
        title={
          closing
            ? `Tutup tawaran ${closing.label} sekarang?`
            : 'Tutup tawaran sekarang?'
        }
        description="Pendaftar tidak bisa lagi menyatakan bersedia. Yang sudah bersedia tetap ada di urutan divisi ini."
        footer={
          <>
            <Button
              variant="dark_blue_outline"
              onClick={() => setClosing(null)}
            >
              Batal
            </Button>
            <Button
              variant="warning"
              disabled={closeMutation.isPending}
              onClick={close}
            >
              {closeMutation.isPending ? 'Menutup…' : 'Tutup tawaran'}
            </Button>
          </>
        }
      >
        {closing ? (
          <p className="text-sm text-neutral-700">
            {closing.offerAccepted} pendaftar sudah bersedia. Tawaran bisa
            dibuka lagi dengan batas waktu baru.
          </p>
        ) : null}
      </Modal>
    </section>
  );
}
