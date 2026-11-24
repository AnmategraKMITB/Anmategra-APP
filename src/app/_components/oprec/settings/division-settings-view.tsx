'use client';

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { Button } from '~/components/ui/button';
import { type RouterOutputs, api } from '~/trpc/react';

import { CriterionDialog } from '../../forms/penilaian/criterion-dialog';
import {
  Chip,
  ErrorNote,
  Loading,
  Modal,
  Notice,
  inputClass,
} from '../placement/shared';

type Criteria = RouterOutputs['oprec']['criteriaList'];
type Slot = Criteria['slots'][number];
type CriterionItem = Slot['criteria'][number];

const KIND_LABEL: Record<string, string> = {
  skor: 'Skor',
  gugur_otomatis: 'Gugur otomatis',
  gugur_manual: 'Gugur manual',
};

const STATUS_METHOD_LABEL: Record<string, string> = {
  ambang: 'Ambang nilai',
  peringkat_kuota: 'Peringkat dalam kuota',
  peringkat_kuota_minimum: 'Peringkat dalam kuota dengan nilai minimum',
};

const iconButton =
  'inline-flex size-8 items-center justify-center rounded-md text-neutral-700 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:pointer-events-none disabled:opacity-40';

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
        {label}
      </p>
      <p className="font-semibold text-neutral-1000">{value}</p>
    </div>
  );
}

function CriteriaSection({
  recruitmentId,
  divisionId,
  divisionLabel,
  assessedCount,
  onChanged,
}: {
  recruitmentId: string;
  divisionId: string;
  divisionLabel: string;
  assessedCount: number;
  onChanged: () => void;
}) {
  const utils = api.useUtils();
  const list = api.oprec.criteriaList.useQuery({ recruitmentId });
  const remove = api.oprec.criterionDelete.useMutation();
  const reorder = api.oprec.criteriaReorder.useMutation();
  const [editing, setEditing] = useState<CriterionItem | 'baru' | null>(null);
  const [deleting, setDeleting] = useState<CriterionItem | null>(null);

  const refresh = useCallback(() => {
    void utils.oprec.criteriaList.invalidate({ recruitmentId });
    onChanged();
  }, [onChanged, recruitmentId, utils]);
  const { mutate: removeCriterion } = remove;
  const onEditorOpenChange = useCallback((open: boolean) => {
    if (!open) setEditing(null);
  }, []);
  const onSaved = useCallback(() => {
    setEditing(null);
    refresh();
  }, [refresh]);
  const onDeleteOpenChange = useCallback((open: boolean) => {
    if (!open) setDeleting(null);
  }, []);
  const cancelDelete = useCallback(() => setDeleting(null), []);
  const confirmDelete = useCallback(() => {
    if (!deleting) return;
    removeCriterion(
      { recruitmentId, criterionId: deleting.id },
      {
        onSuccess: () => {
          setDeleting(null);
          refresh();
        },
      },
    );
  }, [deleting, recruitmentId, refresh, removeCriterion]);

  const data = list.data;
  const slot = data?.slots.find((s) => s.scope === divisionId);
  const general = data?.slots.find((s) => s.scope === 'umum');
  // Pertanyaan bagian Umum dan bagian divisi ini; bagian divisi lain disembunyikan.
  const fields = useMemo(() => {
    if (!data) return [];
    const sectionOk = new Map(
      data.sections.map((section) => [
        section.id,
        section.divisionIds.length === 0 ||
          section.divisionIds.includes(divisionId),
      ]),
    );
    return data.fields.filter(
      (field) => sectionOk.get(field.sectionId) === true,
    );
  }, [data, divisionId]);
  const criteria = useMemo(() => slot?.criteria ?? [], [slot]);
  const editable = slot?.editable ?? false;
  const scoreCriteria = criteria.filter((c) => c.kind === 'skor');

  const { mutate: reorderCriteria } = reorder;
  const onMove = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const index = Number(event.currentTarget.dataset.index);
      const target = index + Number(event.currentTarget.dataset.step);
      const ids = criteria.map((c) => c.id);
      if (target < 0 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target]!, ids[index]!];
      reorderCriteria(
        { recruitmentId, scope: divisionId, criterionIds: ids },
        { onSuccess: refresh },
      );
    },
    [criteria, divisionId, recruitmentId, refresh, reorderCriteria],
  );
  const itemOf = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      criteria.find((c) => c.id === event.currentTarget.dataset.criterionId),
    [criteria],
  );
  const onEdit = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => setEditing(itemOf(event) ?? null),
    [itemOf],
  );
  const onDelete = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      setDeleting(itemOf(event) ?? null),
    [itemOf],
  );
  const startNew = useCallback(() => setEditing('baru'), []);

  if (list.isError) return <ErrorNote message={list.error.message} />;
  if (!data) return <Loading label="Memuat kriteria…" />;

  const changeNote =
    assessedCount > 0
      ? `${assessedCount} pendaftar sudah dinilai di ${divisionLabel}. Mengubah atau menghapus kriteria menghitung ulang skor dan status mereka; kriteria baru perlu dinilai dulu sebelum nilai mereka lengkap.`
      : null;

  return (
    <section aria-labelledby="kriteria-divisi" className="mt-8 grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="kriteria-divisi"
            className="text-lg font-semibold text-neutral-1000"
          >
            Kriteria {divisionLabel}
          </h2>
          {scoreCriteria.length > 0 ? (
            <p
              className={`text-sm ${
                slot?.weightSum === 100
                  ? 'text-neutral-700'
                  : 'font-semibold text-warning-dark'
              }`}
            >
              Total bobot {slot?.weightSum ?? 0}%
              {slot?.weightSum === 100 ? '' : ' (sebaiknya 100%)'}
            </p>
          ) : null}
        </div>
        {editable ? (
          <Button size="sm" variant="dark_blue" onClick={startNew}>
            <Plus /> Tambah kriteria
          </Button>
        ) : null}
      </div>

      {changeNote ? (
        <p
          role="note"
          className="rounded-xl bg-warning-light px-4 py-3 text-sm text-neutral-1000"
        >
          {changeNote}
        </p>
      ) : null}

      {criteria.length === 0 ? (
        <Notice>Belum ada kriteria untuk divisi ini.</Notice>
      ) : (
        <ol className="grid gap-2">
          {criteria.map((item, index) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-neutral-1000">{item.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Chip tone={item.kind === 'skor' ? 'primary' : 'danger'}>
                    {KIND_LABEL[item.kind] ?? item.kind}
                  </Chip>
                  {item.kind === 'skor' ? (
                    <span className="text-sm text-neutral-700">
                      Bobot {item.weight ?? 0}%
                    </span>
                  ) : null}
                  <span className="text-sm text-neutral-700">
                    · {item.fieldIds.length} pertanyaan terkait
                  </span>
                </div>
                {item.expectation ? (
                  <p className="mt-1 text-sm text-neutral-700">
                    {item.expectation}
                  </p>
                ) : null}
              </div>
              {editable ? (
                <div className="flex shrink-0">
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`Naikkan ${item.name}`}
                    disabled={index === 0 || reorder.isPending}
                    data-index={index}
                    data-step={-1}
                    onClick={onMove}
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`Turunkan ${item.name}`}
                    disabled={
                      index === criteria.length - 1 || reorder.isPending
                    }
                    data-index={index}
                    data-step={1}
                    onClick={onMove}
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`Ubah ${item.name}`}
                    data-criterion-id={item.id}
                    onClick={onEdit}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`Hapus ${item.name}`}
                    data-criterion-id={item.id}
                    onClick={onDelete}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {reorder.isError ? <ErrorNote message={reorder.error.message} /> : null}

      {general && general.criteria.length > 0 ? (
        <details className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-neutral-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
            Kriteria umum ({general.criteria.length}), diatur pengelola oprec
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-700">
            {general.criteria.map((item) => (
              <li key={item.id}>
                {item.name} · {KIND_LABEL[item.kind] ?? item.kind}
                {item.kind === 'skor' ? `, bobot ${item.weight ?? 0}%` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <CriterionDialog
        recruitmentId={recruitmentId}
        scope={divisionId}
        scopeLabel={divisionLabel}
        criterion={editing === 'baru' ? null : editing}
        fields={fields}
        open={editing !== null}
        onOpenChange={onEditorOpenChange}
        onSaved={onSaved}
      />

      <Modal
        open={deleting !== null}
        onOpenChange={onDeleteOpenChange}
        title={`Hapus kriteria "${deleting?.name ?? ''}"?`}
        description="Nilai yang sudah diisi untuk kriteria ini ikut terhapus."
        footer={
          <>
            <Button variant="dark_blue_outline" onClick={cancelDelete}>
              Batal
            </Button>
            <Button
              variant="dark_blue"
              disabled={remove.isPending}
              onClick={confirmDelete}
            >
              {remove.isPending ? 'Menghapus…' : 'Hapus'}
            </Button>
          </>
        }
      >
        {changeNote ? (
          <p className="text-sm text-neutral-1000">{changeNote}</p>
        ) : (
          <p className="text-sm text-neutral-700">Belum ada yang dinilai.</p>
        )}
        {remove.isError ? <ErrorNote message={remove.error.message} /> : null}
      </Modal>
    </section>
  );
}

function AssessorSection({
  recruitmentId,
  divisionId,
  divisionLabel,
}: {
  recruitmentId: string;
  divisionId: string;
  divisionLabel: string;
}) {
  const utils = api.useUtils();
  const list = api.oprec.assessorList.useQuery({ recruitmentId });
  const refresh = () => utils.oprec.assessorList.invalidate({ recruitmentId });
  const [identifier, setIdentifier] = useState('');
  const add = api.oprec.assessorAdd.useMutation({
    onSuccess: async () => {
      setIdentifier('');
      await refresh();
    },
  });
  const remove = api.oprec.assessorRemove.useMutation({ onSuccess: refresh });
  const { mutate: addAssessor } = add;
  const { mutate: removeAssessor } = remove;
  const onRemove = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const assessorId = event.currentTarget.dataset.assessorId;
      if (assessorId) removeAssessor({ recruitmentId, assessorId });
    },
    [recruitmentId, removeAssessor],
  );
  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = identifier.trim();
      if (!value) return;
      addAssessor({ recruitmentId, identifier: value, divisionId });
    },
    [addAssessor, divisionId, identifier, recruitmentId],
  );
  const onIdentifierChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setIdentifier(event.target.value),
    [],
  );
  const assessors = (list.data ?? []).filter(
    (row) => row.divisionId === divisionId,
  );

  return (
    <section aria-labelledby="penilai-divisi" className="mt-8 grid gap-3">
      <div>
        <h2
          id="penilai-divisi"
          className="text-lg font-semibold text-neutral-1000"
        >
          Penilai tambahan {divisionLabel}
        </h2>
        <p className="text-sm text-neutral-700">
          Ikut menilai divisi ini, tetapi tidak memutuskan penerimaan.
        </p>
      </div>

      {assessors.length === 0 ? (
        <Notice>
          {list.isLoading ? 'Memuat…' : 'Belum ada penilai tambahan.'}
        </Notice>
      ) : (
        <ul className="grid gap-2">
          {assessors.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 px-4 py-3 text-sm"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-neutral-1000">
                  {row.name ?? row.email}
                </span>
                <span className="text-neutral-700">{row.nim ?? row.email}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Hapus ${row.name ?? row.email} dari penilai`}
                disabled={remove.isPending}
                data-assessor-id={row.id}
                onClick={onRemove}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form className="flex flex-wrap items-end gap-2" onSubmit={onSubmit}>
        <label className="grid min-w-56 flex-1 gap-1 text-sm font-semibold text-neutral-1000">
          Email atau NIM
          <input
            className={inputClass}
            value={identifier}
            placeholder="mis. 13523001"
            onChange={onIdentifierChange}
          />
        </label>
        <Button
          type="submit"
          variant="dark_blue_outline"
          disabled={add.isPending || !identifier.trim()}
        >
          <Plus /> {add.isPending ? 'Menambah…' : 'Tambah penilai'}
        </Button>
      </form>
      {(add.error ?? remove.error) ? (
        <ErrorNote message={(add.error ?? remove.error)!.message} />
      ) : null}
    </section>
  );
}

/**
 * Pengaturan divisi untuk pengurus divisi: kriteria dan penilai tambahan
 * divisi yang ia pegang. Kriteria boleh diubah kapan saja, termasuk
 * di tengah penilaian; skor dihitung ulang dan pengurus diberi tahu dulu.
 */
export function DivisionSettingsView({
  recruitmentId,
  periodName,
  children,
}: {
  recruitmentId: string;
  periodName: string;
  /** Sub-navigasi oprec (`OprecTabs`). */
  children?: React.ReactNode;
}) {
  const overview = api.oprec.divisionSettings.useQuery(
    { recruitmentId },
    { retry: false },
  );
  const [picked, setPicked] = useState('');
  const { refetch } = overview;
  const onPick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    setPicked(event.currentTarget.dataset.divisionId ?? '');
  }, []);
  const onChanged = useCallback(() => void refetch(), [refetch]);

  const data = overview.data;
  const divisions = data?.divisions ?? [];
  const active =
    divisions.find((division) => division.id === picked) ??
    divisions[0] ??
    null;

  return (
    <div className="py-6 sm:py-8">
      <header>
        <h1 className="break-words text-2xl font-semibold text-neutral-1000 sm:text-[32px]">
          Pengaturan divisi
        </h1>
        <p className="mt-1 text-sm text-neutral-700">
          {data?.name ?? 'Oprec'}
          {periodName ? ` · ${periodName}` : ''}. Atur kriteria dan penilai
          tambahan divisi yang kamu pegang. Pengaturan lain dipegang pengelola
          oprec.
        </p>
      </header>

      {children}

      {overview.isError ? (
        <div className="mt-6">
          <ErrorNote message={overview.error.message} />
        </div>
      ) : !data ? (
        <Loading label="Memuat pengaturan divisi…" />
      ) : active === null ? (
        <div className="mt-6">
          <Notice>Tidak ada divisi yang kamu pegang di oprec ini.</Notice>
        </div>
      ) : (
        <>
          {divisions.length > 1 ? (
            <nav aria-label="Divisi" className="mt-6 flex flex-wrap gap-1">
              {divisions.map((division) => {
                const current = division.id === active.id;
                return (
                  <button
                    key={division.id}
                    type="button"
                    aria-pressed={current}
                    data-division-id={division.id}
                    onClick={onPick}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                      current
                        ? 'bg-primary-200 text-primary-400'
                        : 'border border-neutral-400 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    {division.label}
                  </button>
                );
              })}
            </nav>
          ) : null}

          <section
            aria-label="Diatur pengelola oprec"
            className="mt-6 grid gap-2 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 text-sm sm:grid-cols-3"
          >
            <ReadOnly
              label="Kuota"
              value={active.quota === 0 ? 'Tanpa batas' : String(active.quota)}
            />
            <ReadOnly
              label="Status otomatis"
              value={
                data.scoringMode === 'skor'
                  ? (STATUS_METHOD_LABEL[data.statusMethod] ??
                    data.statusMethod)
                  : 'Diputuskan langsung'
              }
            />
            <ReadOnly
              label="Penempatan"
              value={
                data.placementMethod === 'prioritas' ? 'Prioritas' : 'Manual'
              }
            />
            <p className="text-xs text-neutral-700 sm:col-span-3">
              Diatur pengelola oprec. Hubungi mereka bila perlu diubah.
            </p>
          </section>

          <CriteriaSection
            key={`kriteria-${active.id}`}
            recruitmentId={recruitmentId}
            divisionId={active.id}
            divisionLabel={active.label}
            assessedCount={active.assessedCount}
            onChanged={onChanged}
          />

          <AssessorSection
            key={`penilai-${active.id}`}
            recruitmentId={recruitmentId}
            divisionId={active.id}
            divisionLabel={active.label}
          />
        </>
      )}
    </div>
  );
}
