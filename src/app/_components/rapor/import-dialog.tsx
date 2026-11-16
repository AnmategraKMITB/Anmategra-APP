'use client';

import { Upload } from 'lucide-react';
import { type Session } from 'next-auth';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import CsvFormContent from '~/app/_components/csv-form/csv-form';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { toast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

export function ImportDialog({
  session,
  lembagaId,
  isLembaga,
}: {
  session: Session | null;
  /** Lembaga yang dikelola; bawaan: lembaga milik sesi (Owner). */
  lembagaId?: string;
  isLembaga?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const utils = api.useUtils();

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant={'dark_blue_outline'}
        className="flex items-center gap-2 cursor-pointer"
      >
        <Upload size={16} />
        Unggah Excel
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-full max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-center text-[#00B7B7]">
              Upload Excel Rapor
            </DialogTitle>
            <DialogDescription className="sr-only">
              Form untuk mengunggah data rapor
            </DialogDescription>
          </DialogHeader>

          <div>
            <CsvFormContent
              importType={isLembaga ? 'lembaga-nilai' : 'kegiatan-nilai'}
              entityId={
                isLembaga
                  ? (lembagaId ?? session?.user.lembagaId ?? '')
                  : (pathname.split('/')[3] ?? '')
              }
              onImportSuccess={() => {
                toast({
                  title: 'Import Berhasil',
                  description: 'Data rapor berhasil diimpor.',
                });
                if (isLembaga) {
                  void utils.rapor.getAllNilaiProfilLembaga.invalidate();
                } else {
                  void utils.rapor.getAllNilaiProfilKegiatan.invalidate();
                }
                setIsOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
