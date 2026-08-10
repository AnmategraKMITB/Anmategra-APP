'use client';

// Library Import
import { zodResolver } from '@hookform/resolvers/zod';
// Icons Import
import { Check, ChevronsUpDown } from 'lucide-react';
import { type Session } from 'next-auth';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useDebounce } from '~/components/debounceHook';
import { Button } from '~/components/ui/button';
// Components Import
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { toast } from '~/hooks/use-toast';
// Utils Import
import { cn } from '~/lib/utils';
import { api } from '~/trpc/react';

const AnggotaSchema = z.object({
  user_id: z.string().min(1, 'Nama wajib diisi'),
  nim: z.string().min(1, 'NIM wajib diisi'),
  position: z.string().min(1, 'Posisi wajib diisi'),
  division: z.string().min(1, 'Divisi wajib diisi'),
});

type AnggotaSchemaType = z.infer<typeof AnggotaSchema>;

export type comboboxDataType = {
  value: string;
  label: string;
};

interface TambahEditAnggotaFormProps {
  session: Session | null;
  data: {
    posisi: comboboxDataType[];
    bidang: comboboxDataType[];
  };
  setIsOpen: (param: boolean) => void;
  manualMode: boolean;
  setManualMode: (param: boolean) => void;
  isKegiatan: boolean;
  eventId?: string;
  // Edit mode props
  isEditMode?: boolean;
  editData?: {
    userId: string;
    name: string;
    nim: string;
    position: string;
    division: string;
  };
  lembagaId?: string;
}

const TambahEditAnggotaForm = ({
  session,
  data,
  setIsOpen,
  manualMode,
  setManualMode,
  isKegiatan,
  eventId,
  isEditMode = false,
  editData,
  lembagaId,
}: TambahEditAnggotaFormProps) => {
  const [mahasiswaOpen, setMahasiswaOpen] = useState(false);
  const [nimOpen, setNimOpen] = useState(false);
  const [posisiOpen, setPosisiOpen] = useState(false);
  const [bidangOpen, setBidangOpen] = useState(false);
  const [mahasiswaSearch, setMahasiswaSearch] = useState('');
  const [nimSearch, setNimSearch] = useState('');
  const [selectedMahasiswaData, setSelectedMahasiswaData] = useState<{
    userId: string;
    name: string;
    nim: string;
  } | null>(null);
  const debouncedMahasiswaSearch = useDebounce(mahasiswaSearch, 300);
  const debouncedNimSearch = useDebounce(nimSearch, 300);

  const mutationOptions = {
    onSuccess: () => {
      toast({
        title: isEditMode
          ? 'Berhasil mengedit anggota'
          : 'Berhasil menambahkan anggota',
        description: isEditMode
          ? 'Data anggota telah diperbarui.'
          : 'Anggota baru telah ditambahkan ke lembaga.',
      });
      form.reset();
      window.location.reload();
    },
    onError: (error) => {
      toast({
        title: isEditMode
          ? 'Gagal mengedit anggota'
          : 'Gagal menambahkan anggota',
        description:
          error instanceof Error
            ? error.message
            : isEditMode
              ? 'Terjadi kesalahan saat mengedit anggota.'
              : 'Terjadi kesalahan saat menambahkan anggota.',
        variant: 'destructive',
      });
    },
  };

  const eventMutation = api.event.addNewPanitia.useMutation(mutationOptions);
  const lembagaMutation = api.lembaga.addAnggota.useMutation(mutationOptions);
  const addManualEventMutation =
    api.event.addNewPanitiaManual.useMutation(mutationOptions);
  const addManualLembagaMutation =
    api.lembaga.addAnggotaManual.useMutation(mutationOptions);

  const editLembagaMutation =
    api.lembaga.editAnggota.useMutation(mutationOptions);
  const editEventMutation = api.event.editPanitia.useMutation(mutationOptions);
  const form = useForm<AnggotaSchemaType>({
    resolver: zodResolver(AnggotaSchema),
    defaultValues: {
      user_id: isEditMode && editData ? editData.userId : '',
      nim: isEditMode && editData ? editData.nim : '',
      position: isEditMode && editData ? editData.position : '',
      division: isEditMode && editData ? editData.division : '',
    },
  });
  const [posisiList] = useState<comboboxDataType[]>(data.posisi);
  const [bidangList] = useState<comboboxDataType[]>(data.bidang);

  // Set initial selected mahasiswa data in edit mode
  useEffect(() => {
    if (isEditMode && editData) {
      setSelectedMahasiswaData({
        userId: editData.userId,
        name: editData.name,
        nim: editData.nim,
      });
    }
  }, [isEditMode, editData]);

  // Server-side search for mahasiswa by name
  const { data: mahasiswaSearchResults, isLoading: isMahasiswaSearchLoading } = api.users.searchMahasiswa.useQuery(
    {
      query: debouncedMahasiswaSearch,
      lembagaId: !isKegiatan ? session?.user.lembagaId : undefined,
      eventId: isKegiatan ? eventId : undefined,
      isKegiatan,
      limit: 10,
    },
    {
      enabled: !manualMode && debouncedMahasiswaSearch.length > 0,
    },
  );

  // Server-side search for mahasiswa by NIM
  const { data: nimSearchResults, isLoading: isNimSearchLoading } = api.users.searchMahasiswa.useQuery(
    {
      query: debouncedNimSearch,
      lembagaId: !isKegiatan ? session?.user.lembagaId : undefined,
      eventId: isKegiatan ? eventId : undefined,
      isKegiatan,
      limit: 10,
    },
    {
      enabled: !manualMode && debouncedNimSearch.length > 0,
    },
  );

  // Watch form values
  const userId = form.watch('user_id');
  const nim = form.watch('nim');

  // Auto-select NIM when nama is selected
  useEffect(() => {
    const selectedMahasiswa = mahasiswaSearchResults?.results.find(
      (m) => m.userId === userId,
    );
    if (selectedMahasiswa?.nim) {
      form.setValue('nim', selectedMahasiswa.nim);
      setSelectedMahasiswaData(selectedMahasiswa);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mahasiswaSearchResults]);

  // Auto-select nama when NIM is selected
  useEffect(() => {
    const selectedByNim = nimSearchResults?.results.find((m) => m.nim === nim);
    if (selectedByNim?.userId) {
      form.setValue('user_id', selectedByNim.userId);
      setSelectedMahasiswaData(selectedByNim);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nim, nimSearchResults]);

  const onSubmit = (values: AnggotaSchemaType) => {

    if (isEditMode) {
      // Edit mode - only update position and division
      if (isKegiatan && eventId) {
        editEventMutation.mutate(
          {
            user_id: values.user_id,
            event_id: eventId,
            position: values.position,
            division: values.division,
          },
        );
      } else {
        editLembagaMutation.mutate(
          {
            user_id: values.user_id,
            position: values.position,
            division: values.division,
          },
        );
      }
    } else {
      // Add mode
      const lembagaQuery = {
        ...values,
        lembagaId: session?.user.id ?? '',
      };
      const eventQuery = {
        ...values,
        event_id: eventId ?? '',
      };

      if (isKegiatan) {
        if (manualMode) {
          const addManualQuery = {
            event_id: eventQuery.event_id,
            name: eventQuery.user_id, // In manual mode, user_id field contains the name :)
            nim: eventQuery.nim,
            position: eventQuery.position,
            division: eventQuery.division,
          };
          addManualEventMutation.mutate(addManualQuery);
        } else {
          eventMutation.mutate(eventQuery);
        }
      } else {
        if (manualMode) {
          const addManualQuery = {
            name: lembagaQuery.user_id, // In manual mode, user_id field contains the name :)
            nim: lembagaQuery.nim,
            position: lembagaQuery.position,
            division: lembagaQuery.division,
          };
          addManualLembagaMutation.mutate(addManualQuery);
        } else {
          lembagaMutation.mutate(lembagaQuery);
        }
      }
    }

    setIsOpen(false);
  };

  const manualInputClass =
    'h-10 w-full rounded-[5px] border-[#DDE3EA] placeholder:text-[#98A2B3]';

  return (
    <Form {...form}>
      {manualMode && (
        <p className="text-base text-center text-[#98A2B3] -mt-4 mb-4">
          Masukkan informasi anggota baru untuk kegiatan
        </p>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full">
        {/* User ID */}
        <FormField
          control={form.control}
          name="user_id"
          render={({ field }) => {
            return (
              <FormItem className="w-full flex flex-col">
                <FormLabel>Nama Mahasiswa</FormLabel>
                <FormControl>
                  {manualMode ? (
                    <Input
                      className={manualInputClass}
                      placeholder="Masukkan nama lengkap mahasiswa..."
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      disabled={isEditMode}
                    />
                  ) : (
                    <Popover
                      open={mahasiswaOpen}
                      onOpenChange={setMahasiswaOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                          disabled={isEditMode}
                        >
                          <span
                            className={cn(!field.value && 'text-[#98A2B3]')}
                          >
                            {field.value && selectedMahasiswaData
                              ? selectedMahasiswaData.name
                              : 'Masukkan nama lengkap mahasiswa...'}
                          </span>
                          <ChevronsUpDown
                            className={cn(!field.value && 'text-[#636A6D]')}
                          />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 PopoverContent">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Cari Mahasiswa"
                            value={mahasiswaSearch}
                            onValueChange={setMahasiswaSearch}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {isMahasiswaSearchLoading
                                ? 'Loading...'
                                : debouncedMahasiswaSearch.length > 0
                                  ? 'Mahasiswa tidak ditemukan'
                                  : 'Ketik untuk mencari mahasiswa'}
                            </CommandEmpty>
                            <CommandGroup>
                              {(mahasiswaSearchResults?.results ?? []).map(
                                (m) => (
                                  <CommandItem
                                    key={m.userId}
                                    value={m.userId}
                                    onSelect={() => {
                                      field.onChange(m.userId);
                                      form.setValue('nim', m.nim);
                                      setSelectedMahasiswaData(m);
                                      setMahasiswaOpen(false);
                                      setMahasiswaSearch('');
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span>{m.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {m.nim}
                                      </span>
                                    </div>
                                    <Check
                                      className={cn(
                                        'ml-auto',
                                        field.value === m.userId
                                          ? 'opacity-100'
                                          : 'opacity-0',
                                      )}
                                    />
                                  </CommandItem>
                                ),
                              )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        {/* NIM */}
        <FormField
          control={form.control}
          name="nim"
          render={({ field }) => {
            return (
              <FormItem className="w-full flex flex-col">
                <FormLabel>NIM</FormLabel>
                <FormControl>
                  {manualMode ? (
                    <Input
                      className={manualInputClass}
                      placeholder="Masukkan NIM..."
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      inputMode="numeric"
                      disabled={isEditMode}
                    />
                  ) : (
                    <Popover open={nimOpen} onOpenChange={setNimOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                          disabled={isEditMode}
                        >
                          <span
                            className={cn(!field.value && 'text-[#98A2B3]')}
                          >
                            {field.value && selectedMahasiswaData
                              ? selectedMahasiswaData.nim
                              : 'Masukkan NIM...'}
                          </span>
                          <ChevronsUpDown
                            className={cn(!field.value && 'text-[#636A6D]')}
                          />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 PopoverContent">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Cari NIM"
                            value={nimSearch}
                            onValueChange={setNimSearch}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {isNimSearchLoading
                                ? 'Loading...'
                                : debouncedNimSearch.length > 0
                                  ? 'NIM tidak ditemukan'
                                  : 'Ketik untuk mencari NIM'}
                            </CommandEmpty>
                            <CommandGroup>
                              {(nimSearchResults?.results ?? []).map((n) => (
                                <CommandItem
                                  key={n.userId}
                                  value={n.nim}
                                  onSelect={() => {
                                    field.onChange(n.nim);
                                    form.setValue('user_id', n.userId);
                                    setSelectedMahasiswaData(n);
                                    setNimOpen(false);
                                    setNimSearch('');
                                  }}
                                >
                                  <div className="flex flex-col">
                                    <span>{n.nim}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {n.name}
                                    </span>
                                  </div>
                                  <Check
                                    className={cn(
                                      'ml-auto',
                                      field.value === n.nim
                                        ? 'opacity-100'
                                        : 'opacity-0',
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        {/* Bidang */}
        <FormField
          control={form.control}
          name="division"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Divisi</FormLabel>
              <FormControl>
                <Popover open={bidangOpen} onOpenChange={setBidangOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <span className={cn(!field.value && 'text-[#98A2B3]')}>
                        {field.value || 'Masukkan bidang...'}
                      </span>
                      <ChevronsUpDown
                        className={cn(!field.value && 'text-[#636A6D]')}
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 PopoverContent">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Cari atau ketik bidang baru"
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && field.value) {
                            e.preventDefault();
                            setBidangOpen(false);
                          }
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="py-2 px-3 text-sm">
                            Tekan Enter untuk menggunakan:{' '}
                            <span className="font-semibold">{field.value}</span>
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {bidangList
                            .filter((b) =>
                              b.label
                                .toLowerCase()
                                .includes(field.value.toLowerCase()),
                            )
                            .map((b) => (
                              <CommandItem
                                key={b.value}
                                value={b.value}
                                onSelect={() => {
                                  field.onChange(b.value);
                                  setBidangOpen(false);
                                }}
                              >
                                {b.label}
                                <Check
                                  className={cn(
                                    'ml-auto',
                                    field.value === b.value
                                      ? 'opacity-100'
                                      : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Posisi Anggota */}
        <FormField
          control={form.control}
          name="position"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Posisi</FormLabel>
              <FormControl>
                <Popover open={posisiOpen} onOpenChange={setPosisiOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <span className={cn(!field.value && 'text-[#98A2B3]')}>
                        {field.value || 'Masukkan posisi...'}
                      </span>
                      <ChevronsUpDown
                        className={cn(!field.value && 'text-[#636A6D]')}
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 PopoverContent">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Cari atau ketik posisi baru"
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && field.value) {
                            e.preventDefault();
                            setPosisiOpen(false);
                          }
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="py-2 px-3 text-sm">
                            Tekan Enter untuk menggunakan:{' '}
                            <span className="font-semibold">{field.value}</span>
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {(posisiList ?? [])
                            .filter((p) =>
                              p.label
                                .toLowerCase()
                                .includes(field.value.toLowerCase()),
                            )
                            .map((p) => (
                              <CommandItem
                                key={p.value}
                                value={p.value}
                                onSelect={() => {
                                  field.onChange(p.value);
                                  setPosisiOpen(false);
                                }}
                              >
                                {p.label}
                                <Check
                                  className={cn(
                                    'ml-auto',
                                    field.value === p.value
                                      ? 'opacity-100'
                                      : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Tombol Submit */}
        <Button
          type="submit"
          className="w-full bg-[#00B7B7] hover:bg-[#00B7B7]/85 text-white text-base font-semibold
                     rounded-[10px] border border-[#636A6D] shadow-none items-center h-12"
        >
          {isEditMode ? 'Simpan Perubahan' : 'Simpan Anggota'}
        </Button>

        {!manualMode && !isEditMode && (
          <div className="mt-3">
            {/* Separator */}
            <div className="flex items-center gap-4 text-[#B1B4B6]">
              <div className="h-px flex-1 bg-[#E6E9ED]" />
              <span className="text-sm font-light text-[#B1B4B6]">atau</span>
              <div className="h-px flex-1 bg-[#E6E9ED]" />
            </div>

            {/* Manual Option */}
            <div className="mt-3 flex w-full text-sm justify-between flex-nowrap gap-3">
              <span className="text-black/80 font-light whitespace-nowrap">
                Nama mahasiswa tidak ada dalam daftar?
              </span>
              <button
                type="button"
                className="text-[#00B7B7] font-semibold hover:underline whitespace-nowrap"
                onClick={() => {
                  setManualMode(true);
                  setSelectedMahasiswaData(null);
                  form.reset({
                    user_id: '',
                    nim: '',
                    position: '',
                    division: '',
                  });
                }}
              >
                Tambah Anggota Secara Manual
              </button>
            </div>
          </div>
        )}
      </form>
    </Form>
  );
};

export default TambahEditAnggotaForm;
