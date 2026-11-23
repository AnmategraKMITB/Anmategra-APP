'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React from 'react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

type PermintaanAsosiasiUser = {
  // id: string;
  image?: string | null;
  user_id: string;
  mahasiswa_name: string;
  division: string;
  position: string;
};

const RequestTableAssociationsEntries: React.FC<{
  id: string;
  data: PermintaanAsosiasiUser[];
  /** Lembaga yang dikelola. */
  lembagaId: string;
  /** Rute inbox tempat komponen dipasang. */
  basePath?: string;
}> = ({ id, data, lembagaId, basePath = '/lembaga/inbox' }) => {
  const router = useRouter();
  const utils = api.useUtils();

  // penggunaan mutation baru untuk acc / decline lembaga
  // pengecekan cuma bawa ke page lain, nanti implementasi kalau backend sudah integrasi menyeluruh
  const acceptLembagaMutation =
    api.lembaga.acceptRequestAssociationLembaga.useMutation({
      onSuccess: () => {
        void utils.lembaga.getAllRequestAssociation.invalidate();
        void utils.lembaga.getAllRequestAssociationLembaga.invalidate();
        void utils.lembaga.getAllRequestAssociationSummary.invalidate();
        router.push(basePath);
        router.refresh();
      },
      onError: () => {
        router.push(basePath);
        router.refresh();
      },
    });
  const handleAcceptLembaga = (
    user_id: string,
    divisi: string,
    posisi: string,
  ) => {
    const query = {
      lembagaId,
      user_id: user_id,
      division: divisi,
      position: posisi,
    };
    acceptLembagaMutation.mutate(query);
  };

  const declineLembagaMutation =
    api.lembaga.declineRequestAssociationLembaga.useMutation({
      onSuccess: () => {
        void utils.lembaga.getAllRequestAssociation.invalidate();
        void utils.lembaga.getAllRequestAssociationLembaga.invalidate();
        void utils.lembaga.getAllRequestAssociationSummary.invalidate();
        router.push(basePath);
        router.refresh();
      },
      onError: () => {
        router.push(basePath);
        router.refresh();
      },
    });
  const handleDeclineLembaga = (
    user_id: string,
    divisi: string,
    posisi: string,
  ) => {
    const query = {
      lembagaId,
      user_id: user_id,
      division: divisi,
      position: posisi,
    };
    declineLembagaMutation.mutate(query);
  };

  const acceptEventMutation = api.lembaga.acceptRequestAssociation.useMutation({
    onSuccess: () => {
      void utils.lembaga.getAllRequestAssociation.invalidate();
      void utils.lembaga.getAllRequestAssociationSummary.invalidate();
      router.push(basePath);
      router.refresh();
    },
    onError: () => {
      router.push(basePath);
      router.refresh();
    },
  });
  const handleAcceptEvent = (
    user_id: string,
    event_id: string,
    divisi: string,
    posisi: string,
  ) => {
    const query = {
      lembagaId,
      user_id: user_id,
      event_id: event_id,
      division: divisi,
      position: posisi,
    };
    acceptEventMutation.mutate(query);
  };

  const declineEventMutation =
    api.lembaga.declineRequestAssociation.useMutation({
      onSuccess: () => {
        void utils.lembaga.getAllRequestAssociation.invalidate();
        void utils.lembaga.getAllRequestAssociationSummary.invalidate();
        router.push(basePath);
        router.refresh();
      },
      onError: () => {
        router.push(basePath);
        router.refresh();
      },
    });
  const handleDeclineEvent = (
    user_id: string,
    event_id: string,
    divisi: string,
    posisi: string,
  ) => {
    const query = {
      lembagaId,
      user_id: user_id,
      event_id: event_id,
      division: divisi,
      position: posisi,
    };
    declineEventMutation.mutate(query);
  };

  return (
    <div className="flex flex-col rounded-xl font-sans">
      {Array.isArray(data) && data.length > 0 ? (
        <>
          {/* Header: hidden on small screens, visible on md+ */}
          <div className="hidden grid-cols-[2fr_1fr_1fr_1.5fr] items-center gap-4 border-b border-[#E7E9EC] p-4 text-sm text-[#9DA4A8] md:grid md:text-[18px]">
            <div className="font-semibold">Nama</div>
            <div className="text-center font-semibold">Posisi</div>
            <div className="text-center font-semibold">Divisi</div>
            <div className="text-center font-semibold">Aksi</div>
          </div>

          {/* Rows */}
          {data.map((item, index) => (
            <div key={index} className="border-b border-[#E7E9EC] p-3 md:p-4">
              {/* Mobile: stacked, Desktop: grid */}
              <div className="flex flex-col gap-2 md:grid md:grid-cols-[2fr_1fr_1fr_1.5fr] md:items-center md:gap-4">
                {/* Nama + Avatar */}
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full md:h-14 md:w-14">
                    <Image
                      src={
                        item?.image ??
                        '/images/miscellaneous/empty-profile-picture.svg'
                      }
                      alt="Profile Picture"
                      width={56}
                      height={56}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="font-regular line-clamp-2 flex-grow text-sm text-[#636A6D] md:text-[18px]">
                    {item?.mahasiswa_name ?? '-'}
                  </span>
                </div>

                {/* Posisi */}
                <div className="font-regular px-3 text-sm text-[#636A6D] md:px-0 md:text-center md:text-[18px]">
                  <span className="font-semibold md:hidden">Posisi: </span>
                  {item?.position ?? '-'}
                </div>

                {/* Divisi */}
                <div className="font-regular px-3 text-sm text-[#636A6D] md:px-0 md:text-center md:text-[18px]">
                  <span className="font-semibold md:hidden">Divisi: </span>
                  {item?.division ?? '-'}
                </div>

                {/* Buttons */}
                <div className="mt-2 flex items-center justify-between gap-2 px-3 md:mt-0 md:justify-center md:px-0">
                  <Button
                    onClick={() => {
                      if (id === lembagaId) {
                        handleDeclineLembaga(
                          item.user_id,
                          item.division,
                          item.position,
                        );
                      } else {
                        handleDeclineEvent(
                          item.user_id,
                          id,
                          item.division,
                          item.position,
                        );
                      }
                    }}
                    className="flex-1 border-none bg-[#FAFAFA] px-3 py-1.5 text-xs text-[#FF0000] hover:bg-[#FF0000] hover:text-white active:bg-[#FF0000] active:text-white md:flex-none md:py-2 md:text-sm"
                  >
                    DECLINE
                  </Button>

                  <Button
                    onClick={() => {
                      if (id === lembagaId) {
                        handleAcceptLembaga(
                          item.user_id,
                          item.division,
                          item.position,
                        );
                      } else {
                        handleAcceptEvent(
                          item.user_id,
                          id,
                          item.division,
                          item.position,
                        );
                      }
                    }}
                    variant="outline"
                    className="flex-1 border-[2px] border-[#29BC5B] bg-[#FAFAFA] px-3 py-1.5 text-xs text-[#29BC5B] hover:bg-[#29BC5B] hover:text-white md:flex-none md:py-2 md:text-sm"
                  >
                    ACCEPT
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <Image
              src="/images/miscellaneous/not-found-association.svg"
              alt="No Data"
              width={120}
              height={120}
              className="mb-6"
            />
            <div className="mb-2 text-xl font-semibold text-[#768085] md:text-[32px]">
              Tidak ada permintaan asosiasi
            </div>
            <p className="max-w-xs text-sm text-[#C4CACE] md:max-w-md md:text-[24px]">
              Maaf, belum ada permintaan asosiasi yang masuk
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default RequestTableAssociationsEntries;
