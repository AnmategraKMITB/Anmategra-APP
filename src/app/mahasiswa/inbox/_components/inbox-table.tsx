'use client';

import { Pencil, Trash } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

import { DeleteAssociationDialog } from './delete-association-dialog';
import { EditAssociationDialog } from './edit-association';

type AssociationRequest = {
  id: string;
  event_id?: string | null;
  event_name?: string | null;
  lembaga_id?: string | null;
  lembaga_name?: string | null;
  position: string;
  division: string;
  status: 'Pending' | 'Accepted' | 'Declined';
  image?: string | null;
};

type InboxTableProps = {
  eventRequests: AssociationRequest[];
  lembagaRequests: AssociationRequest[];
};

const statusConfig = {
  Pending: {
    label: 'REQUESTED',
    className:
      'border-2 border-[#F5CB69] text-[#F5CB69] bg-transparent hover:bg-[#F5CB69] hover:text-white',
  },
  Accepted: {
    label: 'ACCEPTED',
    className:
      'border-2 border-[#29BC5B] text-[#29BC5B] bg-transparent hover:bg-[#29BC5B] hover:text-white',
  },
  Declined: {
    label: 'DECLINED',
    className:
      'border-2 border-[#F16350] text-[#F16350] bg-transparent hover:bg-[#F16350] hover:text-white',
  },
};

export default function InboxTable({
  eventRequests,
  lembagaRequests,
}: InboxTableProps) {
  const { toast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<AssociationRequest | null>(null);
  const [editDivision, setEditDivision] = useState('');
  const [editPosition, setEditPosition] = useState('');

  const utils = api.useUtils();

  // Combine all requests
  const allRequests = [
    ...eventRequests.map((req) => ({ ...req, type: 'event' as const })),
    ...lembagaRequests.map((req) => ({ ...req, type: 'lembaga' as const })),
  ];

  // Edit mutations
  const editEventMutation = api.users.editRequestAssociation.useMutation({
    onSuccess: () => {
      toast({
        title: 'Berhasil',
        description: 'Permintaan berhasil diubah',
      });
      setEditDialogOpen(false);
      void utils.users.getMyRequestAssociation.invalidate();
    },
    onError: (error) => {
      toast({
        title: 'Gagal',
        description: error.message || 'Gagal mengubah permintaan',
        variant: 'destructive',
      });
    },
  });

  const editLembagaMutation =
    api.users.editRequestAssociationLembaga.useMutation({
      onSuccess: () => {
        toast({
          title: 'Berhasil',
          description: 'Permintaan berhasil diubah',
        });
        setEditDialogOpen(false);
        void utils.users.getMyRequestAssociationLembaga.invalidate();
      },
      onError: (error) => {
        toast({
          title: 'Gagal',
          description: error.message || 'Gagal mengubah permintaan',
          variant: 'destructive',
        });
      },
    });

  // Delete mutations
  const deleteEventMutation = api.users.deleteRequestAssociation.useMutation({
    onSuccess: () => {
      toast({
        title: 'Berhasil',
        description: 'Permintaan berhasil dihapus',
      });
      setDeleteDialogOpen(false);
      void utils.users.getMyRequestAssociation.invalidate();
    },
    onError: (error) => {
      toast({
        title: 'Gagal',
        description: error.message || 'Gagal menghapus permintaan',
        variant: 'destructive',
      });
    },
  });

  const deleteLembagaMutation =
    api.users.deleteRequestAssociationLembaga.useMutation({
      onSuccess: () => {
        toast({
          title: 'Berhasil',
          description: 'Permintaan berhasil dihapus',
        });
        setDeleteDialogOpen(false);
        void utils.users.getMyRequestAssociationLembaga.invalidate();
      },
      onError: (error) => {
        toast({
          title: 'Gagal',
          description: error.message || 'Gagal menghapus permintaan',
          variant: 'destructive',
        });
      },
    });

  const handleEdit = (
    request: AssociationRequest & { type: 'event' | 'lembaga' },
  ) => {
    setSelectedRequest(request);
    setEditDivision(request.division);
    setEditPosition(request.position);
    setEditDialogOpen(true);
  };

  const handleDelete = (
    request: AssociationRequest & { type: 'event' | 'lembaga' },
  ) => {
    setSelectedRequest(request);
    setDeleteDialogOpen(true);
  };

  const confirmEdit = () => {
    if (!selectedRequest) return;

    if (
      'type' in selectedRequest &&
      selectedRequest.type === 'event' &&
      selectedRequest.event_id
    ) {
      editEventMutation.mutate({
        event_id: selectedRequest.event_id,
        division: editDivision,
        position: editPosition,
      });
    } else if (
      'type' in selectedRequest &&
      selectedRequest.type === 'lembaga' &&
      selectedRequest.lembaga_id
    ) {
      editLembagaMutation.mutate({
        lembaga_id: selectedRequest.lembaga_id,
        division: editDivision,
        position: editPosition,
      });
    }
    window.location.reload();
  };

  const confirmDelete = () => {
    if (!selectedRequest) return;

    if (
      'type' in selectedRequest &&
      selectedRequest.type === 'event' &&
      selectedRequest.event_id
    ) {
      deleteEventMutation.mutate({ event_id: selectedRequest.event_id });
    } else if (
      'type' in selectedRequest &&
      selectedRequest.type === 'lembaga' &&
      selectedRequest.lembaga_id
    ) {
      deleteLembagaMutation.mutate({ lembaga_id: selectedRequest.lembaga_id });
    }
    window.location.reload();
  };

  const getInitials = (name: string) => {
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0]?.[0] ?? '') + (words[1]?.[0] ?? '');
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      <div className="flex flex-col gap-2 rounded-xl font-sans sm:gap-0">
        {allRequests.length > 0 ? (
          <>
            {/* Header: hidden on small screens, visible on md+ */}
            <div className="hidden grid-cols-[0.5fr_2fr_1fr_1fr_1fr_1fr_0.5fr] items-center gap-4 border-b border-[#E7E9EC] p-4 text-sm text-[#9DA4A8] md:grid md:text-[18px]">
              <div></div>
              <div>Nama</div>
              <div className="text-center">Lembaga</div>
              <div className="text-center">Divisi</div>
              <div className="text-center">Posisi</div>
              <div className="text-center">Status</div>
              <div></div>
            </div>

            {/* Rows */}
            {allRequests.map((item) => {
              const displayName = item.event_name ?? item.lembaga_name ?? '-';
              const isPending = item.status === 'Pending';

              return (
                <div
                  key={item.id}
                  className="border-b border-[#E7E9EC] px-2 py-4 md:p-4"
                >
                  {/* Mobile: stacked, Desktop: grid */}
                  <div className="flex flex-col gap-2 md:grid md:grid-cols-[0.5fr_2fr_1fr_1fr_1fr_1fr_0.5fr] md:items-center md:gap-4">
                    {/* Avatar */}
                    <div className="flex items-center justify-center">
                      <Avatar className="h-12 w-12 md:h-14 md:w-14">
                        <AvatarImage
                          src={
                            item.image ??
                            '/images/miscellaneous/empty-profile-picture.svg'
                          }
                          alt={displayName}
                        />
                        <AvatarFallback className="bg-[#00B7B7] text-lg font-semibold text-white">
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {/* Nama */}
                    <div className="font-regular px-1 text-sm text-[#636A6D] md:px-0 md:text-[18px]">
                      <span className="font-semibold md:hidden">Nama: </span>
                      {displayName}
                    </div>

                    {/* Lembaga */}
                    <div className="font-regular px-1 text-sm text-[#636A6D] md:px-0 md:text-center md:text-[18px]">
                      <span className="font-semibold md:hidden">Lembaga: </span>
                      {item.event_id ? 'Kegiatan' : 'Lembaga'}
                    </div>

                    {/* Divisi */}
                    <div className="font-regular px-1 text-sm text-[#636A6D] md:px-0 md:text-center md:text-[18px]">
                      <span className="font-semibold md:hidden">Divisi: </span>
                      {item.division}
                    </div>

                    {/* Posisi */}
                    <div className="font-regular px-1 text-sm text-[#636A6D] md:px-0 md:text-center md:text-[18px]">
                      <span className="font-semibold md:hidden">Posisi: </span>
                      {item.position}
                    </div>

                    {/* Status */}
                    <div className="mt-2 flex items-center justify-center px-1 md:mt-0 md:px-0">
                      <Button
                        className={`rounded-lg px-4 py-2 text-xs font-semibold md:text-sm ${
                          statusConfig[item.status].className
                        }`}
                        disabled
                      >
                        {statusConfig[item.status].label}
                      </Button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-center">
                      {isPending && (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-1">
                              <p className="text-bold text-2xl">...</p>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="min-w-[120px] overflow-hidden rounded-xl p-0"
                          >
                            <DropdownMenuItem
                              onSelect={() => handleEdit(item)}
                              className="flex w-full cursor-pointer items-center gap-3 rounded-none px-3 py-2 hover:bg-gray-100 focus:bg-gray-100"
                            >
                              <Pencil className="h-4 w-4 text-[#00B7B7]" />
                              <span className="text-sm">Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="mx-0 my-0 h-px bg-gray-200" />
                            <DropdownMenuItem
                              onSelect={() => handleDelete(item)}
                              className="flex w-full cursor-pointer items-center gap-3 rounded-none px-3 py-2 hover:bg-gray-100 focus:bg-gray-100"
                            >
                              <Trash className="h-4 w-4 text-[#F16350]" />
                              <span className="text-sm">Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
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
              Belum ada permintaan asosiasi yang Anda ajukan
            </p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <EditAssociationDialog
        editDialogOpen={editDialogOpen}
        setEditDialogOpen={setEditDialogOpen}
        editDivision={editDivision}
        setEditDivision={setEditDivision}
        editPosition={editPosition}
        setEditPosition={setEditPosition}
        editEventMutation={editEventMutation}
        editLembagaMutation={editLembagaMutation}
        confirmEdit={confirmEdit}
      />

      {/* Delete Dialog */}
      <DeleteAssociationDialog
        deleteDialogOpen={deleteDialogOpen}
        setDeleteDialogOpen={setDeleteDialogOpen}
        name={selectedRequest?.event_name ?? selectedRequest?.lembaga_name}
        deleteEventMutation={deleteEventMutation}
        deleteLembagaMutation={deleteLembagaMutation}
        confirmDelete={confirmDelete}
      />
    </>
  );
}
