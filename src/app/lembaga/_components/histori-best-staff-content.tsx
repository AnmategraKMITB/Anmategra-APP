'use client';

import { Pencil, Trash2 } from 'lucide-react';
import React from 'react';
import CarouselBestStaff from '~/app/_components/carousel/carousel-best-staff';
import BestStaffForm from './best-staff-form';
import { Button } from '~/components/ui/button';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';

interface BestStaffPeriode {
  start_date: string;
  end_date: string;
  best_staff_list: Array<{
    user_id: string;
    name: string;
    image: string | null;
    nim: string;
    jurusan: string;
    division: string;
  }>;
}

interface HistoriBestStaffContentProps {
  isKegiatan?: boolean;
  lembagaId?: string;
  kegiatanId?: string;
  initialData: {
    periode: BestStaffPeriode[];
  };
  showAddButton?: boolean;
  isReadOnly?: boolean;
}

export default function HistoriBestStaffContent({
  isKegiatan = false,
  lembagaId,
  kegiatanId,
  initialData,
  showAddButton = false,
  isReadOnly = false,
}: HistoriBestStaffContentProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedPeriodeIndex, setSelectedPeriodeIndex] = React.useState<number | null>(null);
  const utils = api.useUtils();

  const deleteMutation = api.lembaga.deleteBestStaffPeriode.useMutation({
    onSuccess: async () => {
      toast({
        variant: 'default',
        title: 'Berhasil!',
        description: 'Periode Best Staff berhasil dihapus.',
      });
      if (isKegiatan && kegiatanId) {
        await utils.lembaga.getAllHistoryBestStaffKegiatan.invalidate();
      } else if (lembagaId) {
        await utils.lembaga.getAllHistoryBestStaffLembaga.invalidate();
      }
      setDeleteDialogOpen(false);
    },
    onError: (err) => {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Gagal menghapus',
        description: 'Terjadi kesalahan saat menghapus periode Best Staff.',
      });
    },
  });

  const handleDelete = (index: number) => {
    setSelectedPeriodeIndex(index);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedPeriodeIndex === null) return;
    
    const periode = initialData.periode[selectedPeriodeIndex];
    if (!periode) return;

    if (isKegiatan && kegiatanId) {
      deleteMutation.mutate({
        lembagaId: lembagaId ?? '',
        event_id: kegiatanId,
        start_date: periode.start_date,
        end_date: periode.end_date,
      });
    } else if (lembagaId) {
      deleteMutation.mutate({
        lembagaId,
        start_date: periode.start_date,
        end_date: periode.end_date,
      });
    }
  };

  return (
    <>
      <div
        className="flex flex-col max-h-[70vh] overflow-y-auto scroll-smooth gap-[50px]
        [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
          {initialData.periode.length > 0 ? (
            initialData.periode.map((periode, id) => {
              const startDate = new Date(periode.start_date).toLocaleDateString('id-ID', {
                month: 'long',
                year: 'numeric',
              });
              const endDate = new Date(periode.end_date).toLocaleDateString('id-ID', {
                month: 'long',
                year: 'numeric',
              });
              return (
                <div key={id} className="flex flex-col gap-3">
                  <div className="flex flex-row justify-between items-center">
                    <h2 className="text-2xl font-semibold">
                      Best Staff Periode {startDate}–{endDate}
                    </h2>
                    {!isReadOnly && (
                      <div className="flex gap-2">
                        <BestStaffForm
                          mode="edit"
                          lembagaId={lembagaId}
                          eventId={kegiatanId}
                          existingPeriode={{
                            start_date: periode.start_date,
                            end_date: periode.end_date,
                            best_staff_list: periode.best_staff_list,
                          }}
                          trigger={
                            <Button
                              variant="dark_blue"
                              className="rounded-xl gap-2 p-3"
                            >
                              <Pencil className="w-6 h-6" />
                              <h3 className="font-semibold text-[18px]">Edit</h3>
                            </Button>
                          }
                        />
                        <Button
                          variant="warning"
                          className="rounded-xl gap-2 p-3"
                          onClick={() => handleDelete(id)}
                        >
                          <Trash2 className="w-6 h-6" />
                          <h3 className="font-semibold text-[18px]">Hapus</h3>
                        </Button>
                      </div>
                    )}
                  </div>

                  <CarouselBestStaff
                    bestStaffList={periode.best_staff_list.map(staff => ({
                      user_id: staff.user_id,
                      name: staff.name,
                      image: staff.image,
                      nim: staff.nim,
                      jurusan: staff.jurusan,
                      division: staff.division,
                    }))}
                    isLembaga={!isKegiatan}
                  />
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-[50vh]">
              <h2 className="text-2xl font-semibold mb-4">
                Belum ada histori Best Staff
              </h2>
            </div>
          )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus periode Best Staff ini? 
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="outline">Batal</Button>
            </DialogClose>
            <Button
              onClick={confirmDelete}
              variant="warning"
            >
              Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
