'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { type RouterOutputs, api } from '~/trpc/react';

import { ErrorNote, Modal, when } from '../oprec/placement/shared';

type MyResult = NonNullable<RouterOutputs['oprec']['myResult']>;
type MyOffer = NonNullable<RouterOutputs['oprec']['myOffer']>;
type OpenOffer = MyOffer['offers'][number];

/**
 * Hasil pendaftaran untuk pendaftar sendiri. Tidak pernah menampilkan nilai,
 * alasan, atau perbandingan; disembunyikan bila pengguna bukan pendaftar.
 * Tawaran tempat tampil terpisah dari hasil, hanya bila ada.
 */
export function ApplicantResultCard({
  recruitmentId,
}: {
  recruitmentId: string | null;
}) {
  const input = { recruitmentId: recruitmentId ?? '' };
  const enabled = recruitmentId !== null;
  const result = api.oprec.myResult.useQuery(input, { enabled, retry: false });
  const offer = api.oprec.myOffer.useQuery(input, { enabled, retry: false });

  if (!recruitmentId) return null;

  const resultData = !result.isError ? result.data : undefined;
  const offerData = !offer.isError ? offer.data : undefined;
  if (!resultData && !offerData) return null;

  return (
    <div className="grid gap-3">
      {resultData ? <ResultSection result={resultData} /> : null}
      {offerData ? (
        <OfferSection recruitmentId={recruitmentId} offer={offerData} />
      ) : null}
    </div>
  );
}

function ResultSection({ result }: { result: MyResult }) {
  if (!result.released) {
    return (
      <section
        aria-label="Hasil pendaftaran"
        className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
      >
        <h2 className="text-base font-semibold text-neutral-1000">
          Pendaftaranmu sudah kami terima
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          Hasil akan diumumkan oleh panitia. Pantau halaman ini lagi nanti.
        </p>
      </section>
    );
  }

  if (result.accepted) {
    return (
      <section
        aria-label="Hasil pendaftaran"
        role="status"
        className="rounded-[20px] border border-success-dark bg-success-light p-4"
      >
        <h2 className="text-base font-semibold text-success-dark">
          Selamat, kamu diterima!
        </h2>
        <p className="mt-1 text-sm text-success-dark">
          Diterima di <strong>{result.divisionLabel ?? 'divisi tujuan'}</strong>
          .
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Hasil pendaftaran"
      role="status"
      className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
    >
      <h2 className="text-base font-semibold text-neutral-1000">
        Belum diterima
      </h2>
      <p className="mt-1 text-sm text-neutral-700">
        Terima kasih sudah mendaftar. Kamu belum diterima di oprec ini.
      </p>
    </section>
  );
}

/**
 * Tawaran tempat bagi pendaftar yang belum mendapat tempat. Menyatakan
 * bersedia hanya menambahkan pendaftar di akhir urutan divisi itu; panitia
 * yang menempatkan sesuai kuota dan urutan.
 */
function OfferSection({
  recruitmentId,
  offer,
}: {
  recruitmentId: string;
  offer: MyOffer;
}) {
  const utils = api.useUtils();
  // Tawaran yang sedang dikonfirmasi tetap disimpan saat dialog menutup agar
  // judulnya tidak berubah selama animasi tutup.
  const [target, setTarget] = useState<OpenOffer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const accept = api.oprec.offerAccept.useMutation({
    // Tombol tetap nonaktif sampai data tawaran dimuat ulang.
    onSuccess: async () => {
      setDialogOpen(false);
      await utils.oprec.myOffer.invalidate({ recruitmentId });
    },
  });

  if (offer.accepted) {
    return (
      <section
        aria-label="Tawaran tempat"
        role="status"
        className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
      >
        <h2 className="text-base font-semibold text-neutral-1000">
          Kesediaanmu sudah tercatat
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          Kamu sudah menyatakan bersedia ditempatkan di{' '}
          <strong className="text-neutral-1000">
            {offer.accepted.divisionLabel}
          </strong>{' '}
          pada {when(offer.accepted.acceptedAt)} WIB. Hasil akhirnya akan
          diumumkan panitia.
        </p>
      </section>
    );
  }

  if (offer.offers.length === 0) return null;

  const closeDialog = (open: boolean) => {
    if (open || accept.isPending) return;
    // Setelah gagal (mis. tawaran sudah ditutup), muat ulang agar halaman
    // mengikuti keadaan terbaru.
    if (accept.isError) void utils.oprec.myOffer.invalidate({ recruitmentId });
    accept.reset();
    setDialogOpen(false);
  };

  return (
    <>
      {offer.offers.map((item) => (
        <section
          key={item.divisionId}
          aria-label={`Tawaran tempat di ${item.divisionLabel}`}
          className="rounded-[20px] border border-primary-400 bg-primary-100 p-4"
        >
          <h2 className="text-base font-semibold text-primary-500">
            Ada tawaran tempat untukmu
          </h2>
          <p className="mt-1 text-sm text-neutral-1000">
            Kamu belum mendapat tempat di pilihanmu. Panitia membuka tempat di{' '}
            <strong>{item.divisionLabel}</strong> sampai {when(item.closesAt)}{' '}
            WIB. Kalau bersedia, klik tombol di bawah. Tempatnya terbatas:
            panitia menempatkan yang bersedia sesuai urutan dan kuota, lalu
            mengumumkan hasilnya.
          </p>
          <Button
            className="mt-3 h-auto min-h-9 whitespace-normal text-left focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
            disabled={accept.isPending}
            onClick={() => {
              accept.reset();
              setTarget(item);
              setDialogOpen(true);
            }}
          >
            Saya bersedia ditempatkan di {item.divisionLabel}
          </Button>
        </section>
      ))}

      <Modal
        open={dialogOpen}
        onOpenChange={closeDialog}
        title={`Kamu yakin bersedia ditempatkan di ${target?.divisionLabel ?? 'divisi ini'}?`}
        description="Pilihan ini tidak bisa dibatalkan dari halaman ini."
        footer={
          <>
            <Button
              variant="ghost"
              disabled={accept.isPending}
              onClick={() => closeDialog(false)}
            >
              Batal
            </Button>
            <Button
              className="focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
              disabled={accept.isPending || target === null}
              onClick={() => {
                if (!target) return;
                accept.mutate({ recruitmentId, divisionId: target.divisionId });
              }}
            >
              {accept.isPending ? 'Menyimpan…' : 'Ya, saya bersedia'}
            </Button>
          </>
        }
      >
        {accept.isError ? <ErrorNote message={accept.error.message} /> : null}
      </Modal>
    </>
  );
}
