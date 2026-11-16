'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React from 'react';
import { Button } from '~/components/ui/button';
import arrow from 'public/icons/call_made.svg'
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
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1.5fr] items-center gap-4 border-b border-[#E7E9EC] p-4 text-sm md:text-[18px] text-[#9DA4A8]">
            <div className="font-semibold">Nama</div>
            <div className="text-center font-semibold">Jumlah Permintaan</div>
            <div className="text-center font-semibold">Tujuan</div>
            <div className="text-center font-semibold">Aksi</div>
          </div>

          {data.map((item: PermintaanAsosiasi, index: number) => (
            <div key={index} className="border-b border-[#E7E9EC] p-3 md:p-4">
              {/* Mobile: stacked, Desktop: grid */}
              <div className="flex flex-col md:grid md:grid-cols-[2fr_1fr_1fr_1.5fr] md:items-center md:gap-4 gap-2">
                {/* Nama + Gambar */}
                <div className="flex items-center gap-3">
                  <div className="rounded-full overflow-hidden w-12 h-12 md:w-14 md:h-14 flex-shrink-0">
                    <Image
                      src={item.image ?? ''}
                      alt={item.nama}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-sm md:text-[18px] font-regular text-[#636A6D] line-clamp-2 flex-grow">
                    {item.nama}
                  </span>
                </div>

                {/* Jumlah Permintaan */}
                <div className="text-sm md:text-[18px] font-regular text-[#636A6D] md:text-center px-3 md:px-0">
                  <span className="md:hidden font-semibold">Jumlah: </span>
                  {item.jumlah}
                </div>

                {/* Tujuan */}
                <div className="text-sm md:text-[18px] font-regular text-[#636A6D] md:text-center px-3 md:px-0">
                  <span className="md:hidden font-semibold">Tujuan: </span>
                  {item.tujuan}
                </div>

                {/* Button */}
                <div className="flex md:justify-center px-3 md:px-0">
                  <Button
                    onClick={() => handleButtonClick(item.id)}
                    variant="outline"
                    className="border rounded-lg border-[#E0E5E8] px-3 py-1.5 md:py-2 bg-[#FAFAFA] text-xs md:text-sm text-[#636A6D] hover:bg-blue-50 w-full md:w-auto flex items-center justify-center gap-1"
                  >
                    <span>Lihat</span>
                    <Image
                      src={arrow}
                      alt="Arrow"
                      width={16}
                      height={16}
                    />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Image
              src="/images/miscellaneous/not-found-association.svg"
              alt="No Data"
              width={120}
              height={120}
              className="mb-6"
            />
            <div className="text-xl md:text-[32px] font-semibold text-[#768085] mb-2">
              Tidak ada permintaan asosiasi
            </div>
            <p className="text-sm md:text-[24px] text-[#C4CACE] max-w-xs md:max-w-md">
              Belum ada permintaan asosiasi yang masuk.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default RequestTableEventsEntries;
