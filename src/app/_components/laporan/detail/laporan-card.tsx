'use client';

import Image from 'next/image';
import PDFIcon from 'public/images/laporan/pdf.png';
import { Card, CardContent, CardHeader } from '~/components/ui/card';

import { type Report } from '../board/report-card';
import { type ColumnType, getTypeImage } from '../board/report-column';

export interface LaporanDetailProps extends Omit<Report, 'attachment'> {
  status: ColumnType;
  content: string;
  attachment?: Attachment[];
}

export interface Attachment {
  name: string;
  //TODO: Add name in here maybe
}

export const LaporanCard = (Laporan: LaporanDetailProps) => {
  return (
    <Card className="mt-4 rounded-2xl border-neutral-400 bg-transparent sm:mt-0">
      <CardHeader>
        {
          <div className="flex w-full flex-col gap-4 text-black md:flex-row md:justify-between md:gap-2">
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="break-words text-2xl font-semibold md:text-[32px]">
                {Laporan.name}
              </h1>
              <h3 className="break-words text-base text-[#636A6D] md:text-[18px]">
                {Laporan.date}
              </h3>
              <span className="border-gray-[#636A6D] justify-content-center w-fit rounded-full border px-4 py-2 text-[14px] text-[#636A6D] md:text-[16px]">
                {Laporan.category}
              </span>
            </div>
            <div className="flex h-fit flex-row items-center gap-2 text-[16px] font-semibold md:text-[18px]">
              <Image
                src={getTypeImage(Laporan.status)}
                alt={Laporan.status + ' Icon'}
              />
              <h4 className="break-words">{Laporan.status}</h4>
            </div>
          </div>
        }
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <>
          <div className="h-fit whitespace-pre-wrap break-words text-justify text-[16px] md:text-[20px]">
            {Laporan.content}
          </div>
          {Laporan.attachment && Laporan?.attachment.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[16px] md:text-[20px]">Attachment: </span>
              <div className="inline">
                {Laporan.attachment.map((attch, index) => (
                  <a
                    key={index}
                    href={attch.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full cursor-pointer flex-row items-center gap-2 rounded-3xl border border-neutral-400 bg-white px-4 py-2 transition-colors hover:bg-neutral-100 sm:w-fit sm:px-[24px]"
                  >
                    <Image
                      className="h-5 w-5"
                      src={PDFIcon}
                      alt={'Attachment Icon'}
                    />
                    <h1 className="max-w-full truncate text-[14px] sm:max-w-[400px] md:text-[18px]">
                      {attch.name}
                    </h1>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      </CardContent>
    </Card>
  );
};
