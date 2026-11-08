'use client';

import { Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { Button } from '~/components/ui/button';
import { type RouterOutputs, api } from '~/trpc/react';

import { AutofillDialog } from './placement/autofill-dialog';
import { CloserecPanel } from './placement/closerec-panel';
import { DecisionTable } from './placement/decision-table';
import { OtherDivisions } from './placement/other-divisions';
import {
  Chip,
  ErrorNote,
  Field,
  Loading,
  Modal,
  Notice,
  inputClass,
  selectClass,
  textareaClass,
} from './placement/shared';
import { StateBar } from './placement/state-bar';
import { TransferInbox } from './placement/transfer-inbox';
import { VisibilityPanel } from './placement/visibility-panel';

type Overview = RouterOutputs['oprec']['placementOverview'];
type Row = RouterOutputs['oprec']['placementRows']['rows'][number];
type Choice = Row['choices'][number];
type Division = Overview['divisions'][number];

const PAGE_SIZE = 25;

/** Layar Penempatan: keadaan, keputusan per divisi, banding, dan closerec. */
export function PlacementView({
  recruitmentId,
  periodName,
  backHref,
  tabs,
}: {
  recruitmentId: string;
  periodName: string;
  backHref?: string;
  tabs?: React.ReactNode;
}) {
  const utils = api.useUtils();
  const overview = api.oprec.placementOverview.useQuery(
    { recruitmentId },
    { retry: false },
  );

  const [pickedDivision, setPickedDivision] = useState('');
  const [rankState, setRankState] = useState<{
    key: string;
    rank: number | null;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [pageState, setPageState] = useState({ key: '', page: 1 });
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState('');

  const divisions = overview.data?.divisions ?? [];
  const activeDivision: Division | null =
    divisions.find((division) => division.id === pickedDivision) ??
    divisions[0] ??
    null;
  const divisionKey = activeDivision?.id ?? '';
  const rank = rankState?.key === divisionKey ? rankState.rank : null;

  const deferredSearch = useDeferredValue(search.trim());
  const filterKey = JSON.stringify({
    division: divisionKey,
    rank,
    search: deferredSearch,
  });
  const page = pageState.key === filterKey ? pageState.page : 1;

  const rows = api.oprec.placementRows.useQuery(
    {
      recruitmentId,
      divisionId: divisionKey,
      rank: rank ?? undefined,
      search: deferredSearch || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
    { enabled: activeDivision !== null, placeholderData: (prev) => prev },
  );

  const refresh = () => {
    void utils.oprec.placementOverview.invalidate({ recruitmentId });
    void utils.oprec.placementRows.invalidate();
    void utils.oprec.transferInbox.invalidate({ recruitmentId });
    void utils.oprec.closerecList.invalidate({ recruitmentId });
    void utils.oprec.placementAccepted.invalidate();
  };

  const announce = (message: string) => {
    setError('');
    setAnnouncement(message);
  };

  const isAdmin = overview.data?.isAdmin ?? false;
  const state = overview.data?.state ?? 'berjalan';
  const isFinal = state === 'final';

  const decide = api.oprec.decide.useMutation();
  const [quotaDecide, setQuotaDecide] = useState<{
    choiceId: string;
    decision: 'terima' | 'tolak';
    accepted: number;
    quota: number;
  } | null>(null);

  const appeal = api.oprec.appealAccept.useMutation();
  const [appealChoice, setAppealChoice] = useState<Choice | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [quotaAppeal, setQuotaAppeal] = useState<{
    choiceId: string;
    reason: string;
    accepted: number;
    quota: number;
  } | null>(null);

  const move = api.oprec.directMove.useMutation();
  const transfer = api.oprec.transferRequest.useMutation();
  const [actionRow, setActionRow] = useState<
    { row: Row; kind: 'move' | 'transfer' } | null
  >(null);
  const [actionDivision, setActionDivision] = useState('');
  const [actionReason, setActionReason] = useState('');

  const [autofillOpen, setAutofillOpen] = useState(false);

  const sendDecision = (
    choiceId: string,
    decision: 'terima' | 'tolak',
    confirmOverQuota: boolean,
  ) => {
    decide.mutate(
      { recruitmentId, choiceId, decision, confirmOverQuota },
      {
        onSuccess: (result) => {
          if (result.needsQuotaConfirm) {
            setQuotaDecide({
              choiceId,
              decision,
              accepted: result.accepted,
              quota: result.quota,
            });
            return;
          }
          setQuotaDecide(null);
          announce('Keputusan disimpan.');
          refresh();
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  const onDecide = (choice: Choice, decision: 'terima' | 'tolak') =>
    sendDecision(choice.id, decision, false);

  const submitAppeal = (
    choiceId: string,
    reason: string,
    confirmOverQuota: boolean,
  ) => {
    appeal.mutate(
      { recruitmentId, choiceId, reason, confirmOverQuota },
      {
        onSuccess: (result) => {
          if (result.needsQuotaConfirm) {
            setAppealChoice(null);
            setQuotaAppeal({
              choiceId,
              reason,
              accepted: result.accepted,
              quota: result.quota,
            });
            return;
          }
          setQuotaAppeal(null);
          setAppealChoice(null);
          setAppealReason('');
          announce('Penerimaan lewat banding disimpan.');
          refresh();
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  const submitMove = () => {
    if (!actionRow) return;
    const args = {
      recruitmentId,
      applicationId: actionRow.row.id,
      toDivisionId: actionDivision,
      reason: actionReason.trim(),
    };
    const finish = () => {
      setActionRow(null);
      setActionDivision('');
      setActionReason('');
      announce(
        actionRow.kind === 'move'
          ? 'Pendaftar dipindahkan.'
          : 'Permintaan pindah dikirim.',
      );
      refresh();
    };
    if (actionRow.kind === 'move') {
      move.mutate(args, {
        onSuccess: finish,
        onError: (mutationError) => setError(mutationError.message),
      });
    } else {
      transfer.mutate(args, {
        onSuccess: finish,
        onError: (mutationError) => setError(mutationError.message),
      });
    }
  };

  const divisionOptions = overview.data?.divisionOptions ?? [];
  const visibleTargets =
    overview.data?.visibility?.visibleTargetIds
      .filter((target) => !divisions.some((division) => division.id === target))
      .map((target) => ({
        id: target,
        label:
          divisionOptions.find((division) => division.id === target)?.label ??
          target,
      })) ?? [];

  const acceptedDivisionOf = (row: Row) =>
    row.choices.find((choice) => choice.decision === 'terima')?.divisionId ?? '';

  return (
    <div className="py-6 sm:py-8">
      <header>
        {backHref ? (
          <Link
            href={backHref}
            className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            ← Kembali ke oprec
          </Link>
        ) : null}
        <h1 className="mt-2 break-words text-2xl font-semibold text-neutral-1000 sm:text-[32px]">
          Penempatan
        </h1>
        <p className="mt-1 text-sm text-neutral-700">
          {overview.data?.name ?? 'Oprec'}
          {periodName ? ` · ${periodName}` : ''}. Putuskan tiap pilihan dan
          pantau kuota divisi.
        </p>
      </header>

      {tabs}

      <div role="status" className="sr-only">
        {announcement}
      </div>
      {error ? (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      {overview.isError ? (
        <div className="mt-6">
          <ErrorNote message={overview.error.message} />
        </div>
      ) : overview.isLoading || !overview.data ? (
        <Loading label="Memuat penempatan…" />
      ) : (
        <>
          <StateBar
            recruitmentId={recruitmentId}
            overview={overview.data}
            onChanged={refresh}
            announce={announce}
            onError={setError}
          />

          {activeDivision === null ? (
            <div className="mt-6">
              <Notice>
                Belum ada divisi tujuan. Tambahkan divisi lewat pengaturan
                oprec.
              </Notice>
            </div>
          ) : (
            <>
              <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
                <nav aria-label="Divisi" className="flex flex-wrap gap-1">
                  {divisions.map((division) => {
                    const active = division.id === activeDivision.id;
                    return (
                      <button
                        key={division.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setPickedDivision(division.id);
                          setSearch('');
                        }}
                        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                          active
                            ? 'bg-primary-200 text-primary-400'
                            : 'border border-neutral-400 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        {division.label}
                      </button>
                    );
                  })}
                </nav>
                <Button
                  size="sm"
                  variant="dark_blue_outline"
                  disabled={isFinal}
                  onClick={() => setAutofillOpen(true)}
                >
                  <Sparkles /> Isi dari penilaian
                </Button>
              </div>

              <div className="mt-4 grid gap-2 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
                    Kuota
                  </p>
                  <p className="text-lg font-semibold text-neutral-1000">
                    {activeDivision.quota === 0
                      ? 'Tanpa batas'
                      : activeDivision.quota}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
                    Diterima
                  </p>
                  <p className="text-lg font-semibold text-neutral-1000">
                    {activeDivision.accepted}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
                    Sisa
                  </p>
                  <p className="text-lg font-semibold text-neutral-1000">
                    {activeDivision.remaining === null
                      ? 'Tanpa batas'
                      : Math.max(0, activeDivision.remaining)}
                  </p>
                </div>
                {activeDivision.overQuota ? (
                  <p className="sm:col-span-3 rounded-xl bg-warning-light px-3 py-2 text-sm text-neutral-1000">
                    Diterima melebihi kuota ({activeDivision.accepted} dari{' '}
                    {activeDivision.quota}). Penerimaan tetap sah, tetapi perlu
                    ditinjau.
                  </p>
                ) : null}
                <p className="sm:col-span-3 text-sm text-neutral-700">
                  {activeDivision.pending} pilihan aktif belum diputuskan ·{' '}
                  {activeDivision.waiting} menunggu pilihan sebelumnya.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  aria-pressed={rank === null}
                  onClick={() => setRankState({ key: divisionKey, rank: null })}
                  className={`rounded-full px-3 py-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                    rank === null
                      ? 'bg-primary-200 text-primary-400'
                      : 'border border-neutral-400 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  Semua
                </button>
                {activeDivision.ranks.map((row) => (
                  <button
                    key={row.rank}
                    type="button"
                    aria-pressed={rank === row.rank}
                    onClick={() =>
                      setRankState({ key: divisionKey, rank: row.rank })
                    }
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                      rank === row.rank
                        ? 'bg-primary-200 text-primary-400'
                        : 'border border-neutral-400 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    Pilihan {row.rank}
                    {row.pending > 0 ? (
                      <Chip tone="warning">{row.pending}</Chip>
                    ) : row.done === row.total && row.total > 0 ? (
                      <span aria-label="selesai" className="text-success-dark">
                        ✓
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <div className="relative">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari nama atau NIM"
                    aria-label="Cari nama atau NIM"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>

              <div className="mt-4" role="region" aria-label="Daftar pendaftar divisi">
                {rows.isError ? (
                  <ErrorNote message={rows.error.message} />
                ) : rows.isLoading || !rows.data ? (
                  <Loading label="Memuat pendaftar…" />
                ) : rows.data.total === 0 ? (
                  <Notice>
                    Tidak ada pendaftar yang cocok di divisi dan pilihan ini.
                  </Notice>
                ) : (
                  <DecisionTable
                    recruitmentId={recruitmentId}
                    data={rows.data}
                    division={{
                      id: activeDivision.id,
                      label: activeDivision.label,
                      quota: activeDivision.quota,
                    }}
                    state={state}
                    isAdmin={isAdmin}
                    page={page}
                    onPage={(next) => setPageState({ key: filterKey, page: next })}
                    loading={rows.isFetching}
                    onDecide={onDecide}
                    onAppeal={(choice) => {
                      setAppealReason('');
                      setAppealChoice(choice);
                    }}
                    onMove={(row) => {
                      setActionDivision('');
                      setActionReason('');
                      setActionRow({ row, kind: 'move' });
                    }}
                    onRequestTransfer={(row) => {
                      setActionDivision('');
                      setActionReason('');
                      setActionRow({ row, kind: 'transfer' });
                    }}
                  />
                )}
              </div>
            </>
          )}

          {!isAdmin ? (
            <OtherDivisions
              recruitmentId={recruitmentId}
              divisions={visibleTargets}
            />
          ) : null}

          {state === 'masa_banding' ? (
            <section aria-label="Permintaan pindah" className="mt-8 grid gap-2">
              <h2 className="text-lg font-semibold text-neutral-1000">
                Permintaan pindah
              </h2>
              <TransferInbox
                recruitmentId={recruitmentId}
                announce={announce}
                onError={setError}
                onChanged={refresh}
              />
            </section>
          ) : null}

          {isAdmin ? (
            <details className="mt-8 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
              <summary className="cursor-pointer text-lg font-semibold text-neutral-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
                Closerec
              </summary>
              <div className="mt-3">
                <CloserecPanel
                  recruitmentId={recruitmentId}
                  divisions={divisionOptions}
                  lock={isFinal}
                  announce={announce}
                  onError={setError}
                  onChanged={refresh}
                />
              </div>
            </details>
          ) : null}

          {isAdmin ? (
            <details className="mt-4 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
              <summary className="cursor-pointer text-lg font-semibold text-neutral-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
                Visibilitas antar divisi
              </summary>
              <div className="mt-3">
                <VisibilityPanel
                  recruitmentId={recruitmentId}
                  announce={announce}
                  onError={setError}
                  onChanged={refresh}
                />
              </div>
            </details>
          ) : null}
        </>
      )}

      <AutofillDialog
        recruitmentId={recruitmentId}
        open={autofillOpen}
        onOpenChange={setAutofillOpen}
        onDone={refresh}
        announce={announce}
        onError={setError}
      />

      <Modal
        open={quotaDecide !== null}
        onOpenChange={(open) => {
          if (!open) setQuotaDecide(null);
        }}
        title="Kuota divisi sudah terisi"
        description={`Kuota ${quotaDecide?.quota ?? 0} sudah terisi ${quotaDecide?.accepted ?? 0}. Tetap terima pendaftar ini?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setQuotaDecide(null)}>
              Batal
            </Button>
            <Button
              disabled={decide.isPending}
              onClick={() => {
                if (!quotaDecide) return;
                sendDecision(
                  quotaDecide.choiceId,
                  quotaDecide.decision,
                  true,
                );
              }}
            >
              Tetap terima
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Penerimaan di atas kuota tercatat dan ditandai untuk ditinjau.
        </p>
      </Modal>

      <Modal
        open={appealChoice !== null}
        onOpenChange={(open) => {
          if (!open) setAppealChoice(null);
        }}
        title="Terima lewat banding"
        description={
          appealChoice
            ? `${appealChoice.label} untuk pendaftar ini sudah ditolak. Alasan wajib diisi.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setAppealChoice(null)}>
              Batal
            </Button>
            <Button
              disabled={appeal.isPending || appealReason.trim() === ''}
              onClick={() => {
                if (appealChoice) {
                  submitAppeal(
                    appealChoice.id,
                    appealReason.trim(),
                    false,
                  );
                }
              }}
            >
              {appeal.isPending ? 'Menyimpan…' : 'Terima'}
            </Button>
          </>
        }
      >
        <Field label="Alasan">
          <textarea
            className={textareaClass}
            value={appealReason}
            onChange={(event) => setAppealReason(event.target.value)}
            maxLength={2000}
          />
        </Field>
      </Modal>

      <Modal
        open={quotaAppeal !== null}
        onOpenChange={(open) => {
          if (!open) setQuotaAppeal(null);
        }}
        title="Kuota divisi sudah terisi"
        description={`Kuota ${quotaAppeal?.quota ?? 0} sudah terisi ${quotaAppeal?.accepted ?? 0}. Tetap terima lewat banding?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setQuotaAppeal(null)}>
              Batal
            </Button>
            <Button
              disabled={appeal.isPending}
              onClick={() => {
                if (quotaAppeal) {
                  submitAppeal(
                    quotaAppeal.choiceId,
                    quotaAppeal.reason,
                    true,
                  );
                }
              }}
            >
              Tetap terima
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Alasan banding tetap tersimpan dan penerimaan melewati kuota
          ditandai.
        </p>
      </Modal>

      <Modal
        open={actionRow !== null}
        onOpenChange={(open) => {
          if (!open) setActionRow(null);
        }}
        title={
          actionRow?.kind === 'move'
            ? 'Pindahkan pendaftar'
            : 'Minta pindah pendaftar'
        }
        description={
          actionRow
            ? `${actionRow.row.name ?? 'Pendaftar'} sudah diterima di ${divisionOptions.find((division) => division.id === acceptedDivisionOf(actionRow.row))?.label ?? 'divisinya'}.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setActionRow(null)}>
              Batal
            </Button>
            <Button
              disabled={
                (actionRow?.kind === 'move'
                  ? move.isPending
                  : transfer.isPending) ||
                actionDivision === '' ||
                actionReason.trim() === ''
              }
              onClick={submitMove}
            >
              {actionRow?.kind === 'move' ? 'Pindahkan' : 'Kirim permintaan'}
            </Button>
          </>
        }
      >
        <Field label="Divisi tujuan">
          <select
            className={selectClass}
            value={actionDivision}
            onChange={(event) => setActionDivision(event.target.value)}
          >
            <option value="">Pilih divisi</option>
            {divisionOptions
              .filter(
                (division) =>
                  actionRow === null ||
                  division.id !== acceptedDivisionOf(actionRow.row),
              )
              .map((division) => (
                <option key={division.id} value={division.id}>
                  {division.label}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Alasan">
          <textarea
            className={textareaClass}
            value={actionReason}
            onChange={(event) => setActionReason(event.target.value)}
            maxLength={2000}
          />
        </Field>
        {actionRow?.kind === 'transfer' ? (
          <p className="text-sm text-neutral-700">
            Permintaan akan muncul di kotak masuk Kadiv divisi tujuan.
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
