'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

import { ErrorNote, Loading, Modal, Notice } from '../placement/shared';
import { MatchingPanel } from './matching-panel';
import { PriorityBoard } from './priority-board';

/** Layar Prioritas: daftar prioritas per divisi dan penempatan otomatis. */
export function PriorityView({
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
  const overview = api.oprec.priorityOverview.useQuery(
    { recruitmentId },
    { retry: false },
  );
  const setMethod = api.oprec.prioritySetMethod.useMutation();
  const [picked, setPicked] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState('');
  const [confirmOn, setConfirmOn] = useState(false);

  const refresh = useCallback(() => {
    void utils.oprec.priorityOverview.invalidate({ recruitmentId });
    void utils.oprec.matchingPreview.invalidate({ recruitmentId });
  }, [utils, recruitmentId]);
  const announce = useCallback((message: string) => {
    setError('');
    setAnnouncement(message);
  }, []);

  const data = overview.data;
  const divisions = data?.divisions ?? [];
  const active =
    divisions.find((division) => division.id === picked) ??
    divisions[0] ??
    null;

  const turnOn = () => {
    setMethod.mutate(
      { recruitmentId, method: 'prioritas' },
      {
        onSuccess: () => {
          setConfirmOn(false);
          announce('Penempatan prioritas aktif.');
          refresh();
          void utils.oprec.priorityBoard.invalidate();
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

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
          Prioritas
        </h1>
        <p className="mt-1 text-sm text-neutral-700">
          {data?.name ?? 'Oprec'}
          {periodName ? ` · ${periodName}` : ''}. Urutkan pendaftar yang
          diinginkan tiap divisi; sistem menempatkan mereka sesuai pilihan dan
          kuota.
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
      ) : !data ? (
        <Loading label="Memuat prioritas…" />
      ) : data.method !== 'prioritas' ? (
        <div className="mt-6 grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-5">
          <h2 className="text-base font-semibold text-neutral-1000">
            Penempatan prioritas belum dipakai
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            <li>
              Tiap divisi mengurutkan pendaftar yang diinginkan (penilai divisi,
              penilai umum, Kadiv, dan pengelola), dengan keterangan opsional.
            </li>
            <li>
              Sistem menempatkan setiap pendaftar di pilihan tertinggi yang
              mengurutkannya, mengikuti kuota. Pendaftar yang bersedia
              dipindahkan ikut diproses sebagai pilihan terakhir.
            </li>
            <li>
              Nilai dan status lulus/tidak tetap berjalan: yang tidak lolos di
              sebuah divisi tidak bisa diurutkan di divisi itu, dan status tidak
              lagi dipotong kuota.
            </li>
            <li>
              Selama penempatan berjalan, terima/tolak manual dinonaktifkan.
              Keputusan yang sudah ada diganti saat penempatan diterapkan.
            </li>
          </ul>
          {data.isAdmin ? (
            data.state === 'berjalan' ? (
              <div>
                <Button variant="dark_blue" onClick={() => setConfirmOn(true)}>
                  Pakai penempatan prioritas
                </Button>
              </div>
            ) : (
              <Notice>
                Metode penempatan hanya bisa diganti selama penempatan berjalan.
              </Notice>
            )
          ) : null}
        </div>
      ) : (
        <>
          {data.isAdmin ? (
            <MatchingPanel
              recruitmentId={recruitmentId}
              overview={data}
              onChanged={refresh}
              announce={announce}
              onError={setError}
            />
          ) : null}

          {!data.registrationEnded ? (
            <div className="mt-4">
              <Notice>
                Pendaftaran masih berjalan. Daftar bisa disusun sekarang,
                tetapi baru bisa dikunci setelah pendaftaran berakhir supaya
                pendaftar baru tidak terlewat.
              </Notice>
            </div>
          ) : null}

          {active === null ? (
            <div className="mt-6">
              <Notice>
                Kamu belum menyusun daftar divisi mana pun pada oprec ini.
              </Notice>
            </div>
          ) : (
            <>
              <nav
                aria-label="Divisi"
                className="mt-6 flex flex-wrap gap-1"
              >
                {divisions.map((division) => {
                  const selected = division.id === active.id;
                  return (
                    <button
                      key={division.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setPicked(division.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                        selected
                          ? 'bg-primary-200 text-primary-400'
                          : 'border border-neutral-400 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      {division.lockedAt ? (
                        <Lock aria-label="terkunci" className="size-3.5" />
                      ) : null}
                      {division.label}
                      <span className="font-normal">
                        {division.ranked}/{division.rankable}
                      </span>
                    </button>
                  );
                })}
              </nav>
              <PriorityBoard
                key={active.id}
                recruitmentId={recruitmentId}
                divisionId={active.id}
                registrationEnded={data.registrationEnded}
                onChanged={refresh}
                announce={announce}
                onError={setError}
              />
            </>
          )}
        </>
      )}

      <Modal
        open={confirmOn}
        onOpenChange={setConfirmOn}
        title="Pakai penempatan prioritas?"
        description="Status lulus/tidak dihitung ulang tanpa pemotongan kuota. Terima/tolak manual dan Isi dari penilaian dinonaktifkan selama penempatan berjalan; keputusan yang ada baru diganti saat kamu menerapkan penempatan."
        footer={
          <>
            <Button
              variant="dark_blue_outline"
              onClick={() => setConfirmOn(false)}
            >
              Batal
            </Button>
            <Button
              variant="dark_blue"
              disabled={setMethod.isPending}
              onClick={turnOn}
            >
              Pakai prioritas
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Bisa dikembalikan ke manual selama penempatan masih berjalan.
        </p>
      </Modal>
    </div>
  );
}
