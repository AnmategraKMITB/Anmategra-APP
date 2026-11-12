'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { formatCsvAnswer } from '~/server/api/routers/form/csv';
import { api } from '~/trpc/react';

import { FileAnswer } from '../forms/responses-table';
import { richTextToPlain } from '../forms/rich-text';
import { FLAG_STYLE, StatusBadge } from './nilai/status';
import { waveTitle } from './status';

const GATE_LABEL: Record<string, string> = {
  memenuhi: 'Memenuhi',
  ditinjau: 'Ditinjau',
  tidak: 'Tidak memenuhi',
};

const when = (d: Date | null) =>
  d
    ? d.toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
      })
    : '—';

const LONG_TEXT = 240;
const isLong = (text: string) =>
  text.length > LONG_TEXT || text.split('\n').length > 4;
const isHttpUrl = (text: string) => /^https?:\/\/\S+$/i.test(text);

/** Teks panjang dipotong empat baris dengan "Baca selengkapnya". */
function ClampedText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = isLong(text);
  return (
    <div>
      <p
        className={`whitespace-pre-line break-words text-neutral-1000 ${long && !open ? 'line-clamp-4' : ''}`}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-sm font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          {open ? 'Tutup' : 'Baca selengkapnya'}
        </button>
      ) : null}
    </div>
  );
}

/** Berkas satu pendaftar: identitas, pilihan, dan jawaban formulir (baca-saja). */
export function ApplicantSheet({
  recruitmentId,
  applicationId,
  onClose,
}: {
  recruitmentId: string;
  applicationId: string | null;
  onClose: () => void;
}) {
  const detail = api.oprec.applicantDetail.useQuery(
    { recruitmentId, applicationId: applicationId ?? '' },
    { enabled: applicationId !== null },
  );
  const d = detail.data;

  return (
    <Sheet open={applicationId !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{d?.name ?? 'Berkas pendaftar'}</SheetTitle>
          <SheetDescription>
            {d
              ? [
                  d.nim ? `NIM ${d.nim}` : null,
                  d.prodi,
                  d.angkatan ? `Angkatan ${d.angkatan}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Memuat berkas…'}
          </SheetDescription>
        </SheetHeader>

        {detail.isError ? (
          <p
            role="alert"
            className="mt-6 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
          >
            Berkas belum bisa dimuat: {detail.error.message}
          </p>
        ) : null}

        {d ? (
          <div className="mt-6 grid gap-6">
            <p className="text-sm text-neutral-700">
              {d.waveLabel ? `${waveTitle(d.waveLabel)} · ` : ''}
              Dikirim {when(d.submittedAt)}
              {d.willingToMove ? ' · Bersedia dipindahkan' : ''}
            </p>

            <section aria-labelledby="sheet-pilihan">
              <h3
                id="sheet-pilihan"
                className="text-sm font-semibold text-neutral-1000"
              >
                Pilihan dan status
              </h3>
              <ol className="mt-2 grid gap-1.5">
                {d.choices.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl bg-neutral-100 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="block text-neutral-700">
                          {c.rank ? `Pilihan ${c.rank}` : 'Tambahan'}
                        </span>
                        <span className="break-words font-semibold text-neutral-1000">
                          {c.label}
                        </span>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-neutral-700">
                      {typeof c.score === 'number' ? (
                        <span>Skor {Math.round(c.score)}</span>
                      ) : null}
                      {c.overridden ? (
                        <span className="inline-flex items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-500">
                          diubah manual
                        </span>
                      ) : null}
                      {c.needsReview ? (
                        <span className="inline-flex items-center rounded-full bg-warning-light px-2.5 py-0.5 text-xs font-semibold text-neutral-1000">
                          perlu ditinjau ulang
                        </span>
                      ) : null}
                    </div>
                    {c.overridden && c.overrideReason ? (
                      <p className="mt-1 text-neutral-700">
                        Alasan: {c.overrideReason}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="sheet-penilaian">
              <h3
                id="sheet-penilaian"
                className="text-sm font-semibold text-neutral-1000"
              >
                Penilaian
              </h3>
              {d.assessments.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-700">
                  Belum ada penilaian.
                </p>
              ) : (
                <ul className="mt-2 grid gap-1.5">
                  {d.assessments.map((a) => {
                    const scopeLabel =
                      a.scope === 'umum'
                        ? 'Umum'
                        : (d.choices.find((c) => c.divisionId === a.scope)
                            ?.label ?? 'Pilihan');
                    const result =
                      typeof a.score === 'number'
                        ? `Skor ${Math.round(a.score)}`
                        : a.gate
                          ? (GATE_LABEL[a.gate] ?? a.gate)
                          : 'Belum cukup penilai';
                    return (
                      <li
                        key={`${a.scope}-${a.criterionId}`}
                        className="rounded-xl bg-neutral-100 px-3 py-2 text-sm"
                      >
                        <p className="font-semibold text-neutral-1000">
                          {a.name}
                        </p>
                        <p className="mt-0.5 text-neutral-700">
                          {scopeLabel} · {result} · {a.reviewers} penilai
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="sheet-flag">
              <h3
                id="sheet-flag"
                className="text-sm font-semibold text-neutral-1000"
              >
                Flag
              </h3>
              {d.flags.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-700">Tidak ada flag.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {d.flags.map((flag) => (
                    <li key={flag.labelId}>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${FLAG_STYLE[flag.color as keyof typeof FLAG_STYLE] ?? 'bg-neutral-100 text-neutral-700'}`}
                      >
                        {flag.name}
                        {flag.isSensitive ? ' · sensitif' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="sheet-jawaban">
              <h3
                id="sheet-jawaban"
                className="text-sm font-semibold text-neutral-1000"
              >
                Jawaban
              </h3>
              {d.columns.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-700">
                  Pendaftar ini tidak mengisi formulir.
                </p>
              ) : (
                <dl className="mt-2 grid gap-3">
                  {d.columns
                    .filter((c) => c.type !== 'unit_choice')
                    .map((c) => {
                      const value = d.answers[c.fieldId];
                      const text = formatCsvAnswer(c.type, value);
                      return (
                        <div
                          key={c.fieldId}
                          className="rounded-xl bg-neutral-100 px-3 py-2"
                        >
                          <dt className="text-sm text-neutral-700">
                            {richTextToPlain(c.label)}
                            {c.archived ? ' (diarsipkan)' : ''}
                          </dt>
                          <dd className="mt-0.5">
                            {c.type === 'file' ? (
                              <FileAnswer value={value} />
                            ) : text === '' ? (
                              '—'
                            ) : c.type === 'link' && isHttpUrl(text) ? (
                              <a
                                href={text}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="break-all font-medium text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                              >
                                {text}
                              </a>
                            ) : (
                              <ClampedText text={text} />
                            )}
                          </dd>
                        </div>
                      );
                    })}
                </dl>
              )}
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
