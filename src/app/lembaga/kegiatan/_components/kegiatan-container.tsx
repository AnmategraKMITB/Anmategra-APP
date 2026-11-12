'use client';

// Library Import
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { format } from 'date-fns';
// Icons Import
import {
  ArrowUpRight,
  Circle,
  MoreVertical,
  Pencil,
  Pin,
  Plus,
  Trash,
} from 'lucide-react';
// Auth Import
import { type Session } from 'next-auth';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import FilterDropdown, {
  type FilterOption,
} from '~/app/_components/filter/filter-dropdown';
import DeleteProfilDialog from '~/app/_components/rapor/delete-profil-dialog';
import TambahEditKegiatanForm from '~/app/lembaga/kegiatan/_components/form/tambah-edit-kegiatan-form';
// Components Import
import { useDebounce } from '~/components/debounceHook';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Input } from '~/components/ui/input';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

export interface Event {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | undefined;
  participant_count: number | null;
  status: 'Coming Soon' | 'On going' | 'Ended';
  thumbnail: string | null;
  background_image: string | null;
  oprec_link: string | null;
  location: string | null;
  participant_limit: number | null;
  is_highlighted: boolean;
  is_organogram: boolean;
  organogram_image: string | null;
  rapor_visible: boolean;
}

interface EventListProps {
  propEvents: Event[];
  session: Session | null;
  /** Lembaga yang dikelola; bawaan: lembaga milik sesi. */
  lembagaId?: string;
  /** Awalan rute kegiatan (panitia, rapor); bawaan halaman Owner. */
  kegiatanBasePath?: string;
}

export default function EventList({
  propEvents,
  session,
  lembagaId: lembagaIdProp,
  kegiatanBasePath = '',
}: EventListProps) {
  const lembagaId = lembagaIdProp ?? session?.user.lembagaId ?? '';
  const { toast } = useToast();
  const [activities, setActivities] = useState<Event[]>(propEvents);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [updatingHighlightId, setUpdatingHighlightId] = useState<string | null>(
    null,
  );
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const filterOptions: FilterOption[] = useMemo(() => {
    const uniqueStatuses = Array.from(
      new Set(propEvents.map((activity) => activity.status)),
    ).filter(Boolean);
    return uniqueStatuses.map((status) => ({
      id: status,
      label: status,
      value: status,
    }));
  }, [propEvents]);

  const handleFilterChange = useCallback((filters: string[]) => {
    setSelectedFilters(filters);
  }, []);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);

  const deleteMutation = api.event.delete.useMutation({
    onSuccess: (data) => {
      setActivities((prev) => prev.filter((a) => a.id !== data.id));
      setDeleteConfirmOpen(false);
      setDeletingEvent(null);
      toast({
        title: 'Kegiatan berhasil dihapus',
        description: 'Kegiatan telah dihapus dari database',
      });
    },
    onError: (error) => {
      toast({
        title: 'Gagal menghapus kegiatan',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getStatusColors = (status: string) => {
    switch (status) {
      case 'Coming Soon':
        return { fill: '#F5CB69', stroke: '#F5CB69' };
      case 'On going':
        return { fill: '#29BC5B', stroke: '#29BC5B' };
      case 'Ended':
        return { fill: '#F16350', stroke: '#F16350' };
      default:
        return { fill: '#9CA3AF', stroke: '#9CA3AF' };
    }
  };

  const toggleHighlightMutation = api.event.toggleHighlight.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Berhasil mengubah status highlight',
        description: data.is_highlighted
          ? 'Kegiatan telah di-highlight'
          : 'Kegiatan tidak lagi di-highlight',
      });
    },
    onError: (error, variables) => {
      setActivities((prevActivities) =>
        prevActivities
          .map((activity) =>
            activity.id === variables.id
              ? { ...activity, is_highlighted: !variables.is_highlighted }
              : activity,
          )
          .sort((a, b) => {
            if (a.is_highlighted && !b.is_highlighted) return -1;
            if (!a.is_highlighted && b.is_highlighted) return 1;
            return (
              new Date(b.start_date).getTime() -
              new Date(a.start_date).getTime()
            );
          }),
      );
      toast({
        title: 'Gagal mengubah status highlight',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setUpdatingHighlightId(null);
    },
  });

  const toggleHighlight = async (
    activityId: string,
    currentStatus: boolean,
  ) => {
    if (session === null) return;
    setUpdatingHighlightId(activityId);

    setActivities((prevActivities) =>
      prevActivities
        .map((activity) =>
          activity.id === activityId
            ? { ...activity, is_highlighted: !currentStatus }
            : activity,
        )
        .sort((a, b) => {
          if (a.is_highlighted && !b.is_highlighted) return -1;
          if (!a.is_highlighted && b.is_highlighted) return 1;
          return (
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
          );
        }),
    );

    toggleHighlightMutation.mutate({
      lembagaId,
      id: activityId,
      is_highlighted: !currentStatus,
    });
  };

  useEffect(() => {
    const getActivities = async () => {
      setIsLoading(true);
      const filteredActivities = propEvents
        .filter((activity) => {
          const matchesSearch = activity.name
            .toLowerCase()
            .includes(debouncedSearchQuery.toLowerCase());
          const matchesFilter =
            selectedFilters.length === 0 ||
            selectedFilters.includes(activity.status);
          return matchesSearch && matchesFilter;
        })
        .sort((a, b) => {
          if (a.is_highlighted && !b.is_highlighted) return -1;
          if (!a.is_highlighted && b.is_highlighted) return 1;
          return (
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
          );
        });
      setActivities(filteredActivities);
      setIsLoading(false);
    };
    getActivities()
      .then((r) => r)
      .catch((e) => e);
  }, [debouncedSearchQuery, propEvents, selectedFilters]);

  const handleDeleteClick = (activity: Event) => {
    setDeletingEvent(activity);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingEvent) {
      deleteMutation.mutate({ lembagaId, id: deletingEvent.id });
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
    setDeletingEvent(null);
  };

  return (
    <div className="flex w-full flex-col gap-4 pt-[24px] pl-[42px] pr-[36px]">
      {/* Title and Search */}
      <div className="flex flex-col gap-4">
        <h1 className="text-[32px] font-semibold text-[#141718]">Kegiatan</h1>
        <Input
          placeholder="Cari kegiatan"
          className="rounded-2xl bg-white placeholder:text-neutral-700 focus-visible:ring-transparent"
          startAdornment={
            <MagnifyingGlassIcon className="size-4 text-gray-500" />
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mt-2">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="light_blue">
              <Plus className="h-6 w-6" />
              Tambah Kegiatan Baru
            </Button>
          </DialogTrigger>
          <DialogContent className="min-w-[800px]" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Tambah Kegiatan</DialogTitle>
            </DialogHeader>
            <TambahEditKegiatanForm
              session={session}
              lembagaId={lembagaId}
              setIsOpen={setIsOpen}
              setEventList={setActivities}
            />
          </DialogContent>
        </Dialog>
        <FilterDropdown
          filterTitle="Status"
          filterOptions={filterOptions}
          selectedFilters={selectedFilters}
          onFilterChange={handleFilterChange}
        />
      </div>

      <div className="bg-white rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="flex items-center gap-3 p-3 bg-gray-50 text-lg font-medium text-gray-500">
              <div className="w-[25px] flex-shrink-0"></div>
              <div className="w-[130px] flex-shrink-0">Thumbnail</div>
              <div className="flex-1 min-w-[200px]">Judul</div>
              <div className="w-[131px] flex-shrink-0">Tanggal</div>
              <div className="w-[110px] flex-shrink-0">Panitia</div>
              <div className="w-[141px] flex-shrink-0">Status</div>
              <div className="w-[94px] flex-shrink-0">Rapor</div>
              <div className="w-[24px] flex-shrink-0"></div>
            </div>

            <div className="divide-y divide-gray-200">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-[25px] rounded flex items-center justify-center flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-auto w-auto hover:bg-transparent"
                      onClick={() =>
                        toggleHighlight(activity.id, activity.is_highlighted)
                      }
                      disabled={updatingHighlightId === activity.id}
                    >
                      <Pin
                        style={{ width: '25px', height: '25px' }}
                        fill={activity.is_highlighted ? '#141718' : 'none'}
                        stroke={activity.is_highlighted ? '#141718' : '#141718'}
                      />
                    </Button>
                  </div>
                  <Link href={`/profile-kegiatan/${activity.id}`} className="w-[130px] h-[90px] bg-gray-200 rounded overflow-hidden relative flex-shrink-0">
                    {activity.thumbnail && (
                      <Image
                        src={activity.thumbnail || '/placeholder.svg'}
                        alt=""
                        className="w-full h-full object-cover"
                        height={90}
                        width={130}
                      />
                    )}
                  </Link>
                  <Link href={`/profile-kegiatan/${activity.id}`} className="flex-1 min-w-[200px]">
                    <p className="text-lg text-gray-500">{activity.name}</p>
                    {activity.description && (
                      <p className="text-base text-gray-500 truncate">
                        {activity.description.length > 39
                          ? activity.description.slice(0, 36) + '...'
                          : activity.description}
                      </p>
                    )}
                  </Link>
                  <div className="w-[131px] flex-shrink-0 text-base text-gray-500">
                    {activity.start_date
                      ? format(new Date(activity.start_date), 'dd/MM/yyyy')
                      : '-'}
                  </div>
                  <div className="w-[110px] flex-shrink-0 flex items-center justify-center text-gray-500">
                    <Link href={`${kegiatanBasePath}/kegiatan/${activity.id}/panitia`}>
                      <Button
                        variant={'outline'}
                        className="rounded-lg text-base"
                      >
                        Panitia
                        <ArrowUpRight />
                      </Button>
                    </Link>
                  </div>
                  <div className="w-[141px] flex-shrink-0 flex items-center justify-start">
                    <span className="inline-flex items-center text-base font-medium text-gray-700">
                      <Circle
                        className="h-3 w-3 mr-2"
                        fill={getStatusColors(activity.status).fill}
                        stroke={getStatusColors(activity.status).stroke}
                      />
                      {activity.status}
                    </span>
                  </div>
                  <div className="w-[94px] flex-shrink-0 flex items-center justify-center text-gray-500">
                    <Link href={`${kegiatanBasePath}/kegiatan/${activity.id}/rapor`}>
                      <Button
                        variant={'outline'}
                        className="rounded-lg text-base"
                      >
                        Lihat
                        <ArrowUpRight />
                      </Button>
                    </Link>
                  </div>
                  <div className="w-[24px] flex-shrink-0 flex justify-center">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="lg" className="p-1">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="rounded-xl min-w-[120px] p-0 overflow-hidden"
                      >
                        <DropdownMenuItem
                          onSelect={() => setEditingEvent(activity)}
                          className="w-full rounded-none cursor-pointer flex items-center gap-3 px-3 py-2 hover:bg-gray-100 focus:bg-gray-100"
                        >
                          <Pencil className="text-[#00B7B7] h-4 w-4" />
                          <span className="text-sm">Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="mx-0 my-0 h-px bg-gray-200" />
                        <DropdownMenuItem
                          onSelect={() => handleDeleteClick(activity)}
                          className="w-full rounded-none cursor-pointer flex items-center gap-3 px-3 py-2 hover:bg-gray-100 focus:bg-gray-100"
                        >
                          <Trash className="text-[#F16350] h-4 w-4" />
                          <span className="text-sm">Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>

            {isLoading && (
              <div className="p-4 text-center text-gray-500">
                Loading activities...
              </div>
            )}

            {!isLoading && activities.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                Aktivitas tidak ditemukan
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={editingEvent !== null}
        onOpenChange={(open) => {
          if (!open) setEditingEvent(null);
        }}
      >
        <DialogContent className="min-w-[800px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Edit Kegiatan</DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <TambahEditKegiatanForm
              session={session}
              lembagaId={lembagaId}
              setIsOpen={() => setEditingEvent(null)}
              setEventList={setActivities}
              kegiatan={editingEvent}
            />
          )}
        </DialogContent>
      </Dialog>

      <DeleteProfilDialog
        open={deleteConfirmOpen}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title={`Apakah Anda yakin ingin menghapus kegiatan "${deletingEvent?.name}"?`}
        cancelButtonText="Batal"
        confirmButtonText="Hapus"
      />
    </div>
  );
}
