'use client';

// Library Import
import { type Session } from 'next-auth';
import * as React from 'react';
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
  DialogTrigger,
} from '~/components/ui/dialog';
import { toast } from '~/hooks/use-toast';
// TRPC Import
import { api } from '~/trpc/react';

export type Member = {
  id: string;
  nama: string;
  nim: string;
  divisi: string;
  posisi: string;
};

interface ActionCellProps {
  member: Member;
  lembagaId?: string;
  eventId?: string;
  session: Session | null;
  posisiBidangData: { posisi: comboboxDataType[]; bidang: comboboxDataType[] };
  isKegiatan?: boolean;
}

export function ActionCell({
  member,
  lembagaId,
  eventId,
  session,
  posisiBidangData,
  isKegiatan = false,
}: ActionCellProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [manualMode, setManualMode] = React.useState(false);
  const lembagaMutation = api.lembaga.removeAnggota.useMutation();
  const eventMutation = api.event.removePanitia.useMutation();

  const onDelete = (id: string) => {
    if (isKegiatan && eventId) {
      eventMutation.mutate(
        { id, event_id: eventId },
        {
          onSuccess: () => {
            eventMutation.reset();
            window.location.reload();
            toast({
              title: 'Berhasil menghapus panitia',
              description: 'Data panitia telah dihapus.',
            });
          },
          onError: (error) => {
            toast({
              title: 'Gagal menghapus panitia',
              description: error.message,
              variant: 'destructive',
            });
          },
        },
      );
    } else {
      lembagaMutation.mutate(
        { user_id: id },
        {
          onSuccess: () => {
            lembagaMutation.reset();
            window.location.reload();
            toast({
              title: 'Berhasil menghapus anggota',
              description: 'Data anggota telah dihapus.',
            });
          },
          onError: (error) => {
            toast({
              title: 'Gagal menghapus anggota',
              description: error.message,
              variant: 'destructive',
            });
          },
        },
      );
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setEditOpen(true)}
        className="border-blue-400 text-blue-400 hover:border-blue-500 hover:text-blue-500"
      >
        Edit
      </Button>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-full max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-center text-[#00B7B7]">
              {isKegiatan ? 'Edit Panitia' : 'Edit Anggota'}
            </DialogTitle>
            <DialogDescription className="text-center text-[#98A2B3]">
              {isKegiatan
                ? 'Ubah posisi atau bidang panitia'
                : 'Ubah posisi atau bidang anggota'}
            </DialogDescription>
          </DialogHeader>
          <TambahEditAnggotaForm
            session={session}
            data={posisiBidangData}
            setIsOpen={setEditOpen}
            manualMode={manualMode}
            setManualMode={setManualMode}
            isKegiatan={isKegiatan}
            isEditMode={true}
            editData={{
              userId: member.id,
              name: member.nama,
              nim: member.nim,
              position: member.posisi,
              division: member.divisi,
            }}
            lembagaId={lembagaId}
            eventId={eventId}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="border-red-400 text-red-400 hover:border-red-500 hover:text-red-500"
          >
            Hapus
          </Button>
        </DialogTrigger>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {isKegiatan ? 'Hapus Panitia' : 'Hapus Anggota'}
            </DialogTitle>
            <DialogDescription>
              {isKegiatan
                ? 'Apakah kamu yakin ingin menghapus panitia ini?'
                : 'Apakah kamu yakin ingin menghapus anggota ini?'}
            </DialogDescription>
          </DialogHeader>
          <div className="w-full flex items-center justify-center gap-x-4">
            <Button onClick={() => setDeleteOpen(false)}>
              Tidak, Batalkan
            </Button>
            <Button
              onClick={() => {
                onDelete(member.id);
                setDeleteOpen(false);
              }}
              variant="warning"
            >
              Ya, Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
