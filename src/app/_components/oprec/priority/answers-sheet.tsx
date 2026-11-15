'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { api } from '~/trpc/react';

import { AnswerList } from '../nilai/answers';

/**
 * Jawaban satu pendaftar di papan prioritas: pertanyaan bagian divisi yang
 * sedang dibuka tampil dulu dan disorot, pertanyaan umum dilipat di bawahnya.
 */
export function PriorityAnswersSheet({
  recruitmentId,
  divisionId,
  divisionLabel,
  applicant,
  onClose,
}: {
  recruitmentId: string;
  divisionId: string;
  divisionLabel: string;
  applicant: {
    applicationId: string;
    name: string;
    /** NIM · prodi · angkatan; null bila disembunyikan (blind) atau kosong. */
    meta: string | null;
  } | null;
  onClose: () => void;
}) {
  const answers = api.oprec.priorityAnswers.useQuery(
    {
      recruitmentId,
      divisionId,
      applicationId: applicant?.applicationId ?? '',
    },
    { enabled: applicant !== null },
  );
  const data = answers.data;

  return (
    <Sheet open={applicant !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{applicant?.name ?? 'Jawaban pendaftar'}</SheetTitle>
          <SheetDescription>
            {applicant?.meta ?? divisionLabel}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          {answers.isError ? (
            <p role="alert" className="text-sm text-danger-dark">
              Jawaban tidak bisa dimuat: {answers.error.message}
            </p>
          ) : !data ? (
            <p className="text-sm text-neutral-700">Memuat jawaban…</p>
          ) : (
            <AnswerList
              columns={data.columns}
              answers={data.answers}
              linkedLabel={
                <>
                  Jawaban untuk divisi{' '}
                  <span className="font-semibold text-neutral-1000">
                    {divisionLabel}
                  </span>
                </>
              }
              linkedFieldIds={data.columns
                .filter((c) => c.forDivision)
                .map((c) => c.fieldId)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
