'use client';

import { type Session } from 'next-auth';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Plus from '~/../public/icons/plus.svg';
import CsvFormContent from '~/app/_components/csv-form/csv-form';
import TambahEditAnggotaForm, {
  type comboboxDataType,
} from '~/app/_components/form/tambah-edit-anggota-form';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { toast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

type DialogMode = 'manual' | 'csv';

interface TambahAnggotaDialogProps {
  session: Session | null;
  dataPosisiBidang: {
    posisi: comboboxDataType[];
    bidang: comboboxDataType[];
  };
  pageAnggota?: boolean;
  /** Lembaga yang dikelola; bila kosong dipakai lembaga dari sesi (Owner). */
  lembagaId?: string;
}

export function TambahAnggotaDialog({
  session,
  dataPosisiBidang,
  pageAnggota,
  lembagaId,
}: TambahAnggotaDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('manual');
  const pathname = usePathname();
  const isAnggota = pageAnggota ?? false;
  const eventId = !isAnggota ? pathname.split('/')[3] : undefined;
  const utils = api.useUtils();
  const activeLembagaId = lembagaId ?? session?.user.lembagaId ?? undefined;

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    setManualMode(false);
    if (open) {
      setDialogMode('manual');
    }
  };

  const handleModeSelection = (mode: DialogMode) => {
    setDialogMode(mode);
    setIsOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="light_blue"
            className="rounded-[16px] px-3 shadow-none flex items-center gap-2"
          >
            <Image src={Plus} alt="Tambah Anggota" width={24} height={24} />
            Tambah Anggota Baru
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuItem
            onClick={() => handleModeSelection('manual')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Image
              src="/images/miscellaneous/new.svg"
              alt="Manual"
              width={16}
              height={16}
              className="text-[#00B7B7]"
            />
            Tambah Manual
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleModeSelection('csv')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Image
              src="/images/miscellaneous/add-csv-hover.svg"
              alt="Excel"
              width={16}
              height={16}
              className="text-[#00B7B7]"
            />
            Unggah Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className={`w-full ${dialogMode === 'csv' ? 'max-w-4xl' : 'max-w-xl'}`}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-center text-[#00B7B7]">
              {dialogMode === 'manual' && 'Tambah Anggota Manual'}
              {dialogMode === 'csv' && 'Upload Excel Anggota'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Form untuk menambahkan anggota
            </DialogDescription>
          </DialogHeader>

          {dialogMode === 'manual' ? (
            <div>
              <TambahEditAnggotaForm
                session={session}
                data={dataPosisiBidang}
                setIsOpen={setIsOpen}
                manualMode={manualMode}
                setManualMode={setManualMode}
                isKegiatan={!isAnggota}
                eventId={eventId}
                lembagaId={activeLembagaId}
              />
            </div>
          ) : (
            <div>
              <CsvFormContent
                importType={isAnggota ? 'lembaga-anggota' : 'kegiatan-anggota'}
                entityId={
                  isAnggota ? (activeLembagaId ?? '') : (eventId ?? '')
                }
                onImportSuccess={() => {
                  toast({
                    title: 'Import Berhasil',
                    description: 'Data anggota berhasil diimpor.',
                  });
                  if (isAnggota) {
                    void utils.lembaga.getAllAnggota.invalidate();
                  } else {
                    void utils.event.getAllAnggota.invalidate();
                  }
                  window.location.reload();
                  setIsOpen(false);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
