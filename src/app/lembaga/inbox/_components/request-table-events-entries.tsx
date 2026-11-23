'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import arrow from 'public/icons/call_made.svg';
import React from 'react';
import { Button } from '~/components/ui/button';

type PermintaanAsosiasi = {
  id: string;
  image: string | null;
  nama: string;
  jumlah: string;
  tujuan: string;
};

const RequestTableEventsEntries: React.FC<{
  data: PermintaanAsosiasi[];
  basePath?: string;
}> = ({ data, basePath = '/lembaga/inbox' }) => {
  const router = useRouter();

  const handleButtonClick = (id: string) => {
    router.push(`${basePath}/${id}`);
  };

  return (
    <div className="flex flex-col rounded-xl font-sans">
      {Array.isArray(data) && data.length > 0 ? (
        <>
          {/* Header: hidden on mobile, visible on md+ */}
          <div className="hidden grid-cols-[2fr_1fr_1fr_1.5fr] items-center gap-4 border-b border-[#E7E9EC] p-4 text-sm text-[#9DA4A8] md:grid md:text-[18px]">
            <div className="font-semibold">Nama</div>
            <div className="text-center font-semibold">Jumlah Permintaan</div>
            <div className="text-center font-semibold">Tujuan</div>
            <div className="text-center font-semibold">Aksi</div>
          </div>

          {data.map((item: PermintaanAsosiasi, index: number) => (
            <div key={index} className="border-b border-[#E7E9EC] p-3 md:p-4">
              {/* Mobile: stacked, Desktop: grid */}
              <div className="flex flex-col gap-2 md:grid md:grid-cols-[2fr_1fr_1fr_1.5fr] md:items-center md:gap-4">
                {/* Nama + Gambar */}
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full md:h-14 md:w-14">
                    <Image
                      src={item.image ?? ''}
                      alt={item.nama}
                      width={56}
                      height={56}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="font-regular line-clamp-2 flex-grow text-sm text-[#636A6D] md:text-[18px]">
                    {item.nama}
                  </span>
                </div>

                {/* Jumlah Permintaan */}
                <div className="font-regular px-3 text-sm text-[#636A6D] md:px-0 md:text-center md:text-[18px]">
                  <span className="font-semibold md:hidden">Jumlah: </span>
                  {item.jumlah}
                </div>

                {/* Tujuan */}
                <div className="font-regular px-3 text-sm text-[#636A6D] md:px-0 md:text-center md:text-[18px]">
                  <span className="font-semibold md:hidden">Tujuan: </span>
                  {item.tujuan}
                </div>

                {/* Button */}
                <div className="flex px-3 md:justify-center md:px-0">
                  <Button
                    onClick={() => handleButtonClick(item.id)}
                    variant="outline"
                    className="flex w-full items-center justify-center gap-1 rounded-lg border border-[#E0E5E8] bg-[#FAFAFA] px-3 py-1.5 text-xs text-[#636A6D] hover:bg-blue-50 md:w-auto md:py-2 md:text-sm"
                  >
                    <span>Lihat</span>
                    <Image src={arrow} alt="Arrow" width={16} height={16} />
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
              Belum ada permintaan asosiasi yang masuk.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default RequestTableEventsEntries;
