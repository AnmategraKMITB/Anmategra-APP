'use client';

// Library Import
import { zodResolver } from '@hookform/resolvers/zod';
// Icons Import
import { Check, ChevronsUpDown } from 'lucide-react';
import { type Session } from 'next-auth';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { toast } from '~/hooks/use-toast';
// Utils Import
import { cn } from '~/lib/utils';
import { api } from '~/trpc/react';

// ✅ Schema Validasi dengan Zod
const AnggotaSchema = z.object({
  user_id: z.string().min(1, 'User ID wajib diisi'),
  position: z.string().min(1, 'Posisi wajib diisi'),
  division: z.string().min(1, 'Divisi wajib diisi'),
});

// ✅ Type inference dari schema
type AnggotaSchemaType = z.infer<typeof AnggotaSchema>;

export type comboboxDataType = {
  value: string;
  label: string;
};

const TambahAnggotaKegiatanForm = ({
  data,
  setIsOpen,
  pathname,
  lembagaId,
}: {
  session: Session | null;
  /** Lembaga yang dikelola. */
  lembagaId: string;
  data: {
    mahasiswa: comboboxDataType[];
    posisi: comboboxDataType[];
    bidang: comboboxDataType[];
  };
  setIsOpen: (param: boolean) => void;
  pathname: string;
}) => {
  const [open, setOpen] = useState(false);
  const [posisiOpen, setPosisiOpen] = useState(false);
  const [divisiOpen, setdivisiOpen] = useState(false);
  const mutation = api.event.addNewPanitia.useMutation({
    onError: (error) => {
      toast({
        title: 'Gagal',
        description: `Terjadi kesalahan: ${error.message}`,
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Berhasil',
        description: 'Anggota berhasil ditambahkan ke kegiatan.',
      });
    },
  });
  const form = useForm<AnggotaSchemaType>({
    resolver: zodResolver(AnggotaSchema),
    defaultValues: {
      user_id: '',
      position: '',
      division: '',
    },
  });
  const [mahasiswaList] = useState<comboboxDataType[]>(data.mahasiswa);
  const [posisiList] = useState<comboboxDataType[]>(data.posisi);
  const [divisiList] = useState<comboboxDataType[]>(data.bidang);
  const kegiatanId = pathname.split('/')[3];

  const onSubmit = (values: AnggotaSchemaType) => {
    const query = {
      ...values,
      lembagaId,
      event_id: kegiatanId ?? '',
    };
    setIsOpen(false);
    mutation.mutate(query, {
      onSuccess: () => {
        form.reset();
        location.reload();
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* User ID */}
        <FormField
          control={form.control}
          name="user_id"
          render={({ field }) => (
            <FormItem className="w-full flex flex-col">
              <FormLabel>Nama Mahasiswa</FormLabel>
              <FormControl>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      {field.value
                        ? mahasiswaList.find((m) => m.value === field.value)
                            ?.label
                        : 'Pilih Mahasiswa'}
                      <ChevronsUpDown className="opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 PopoverContent">
                    <Command>
                      <CommandInput placeholder="Cari Mahasiswa" />
                      <CommandList>
                        <CommandEmpty>Mahasiswa Tidak Ditemukan.</CommandEmpty>
                        <CommandGroup>
                          {mahasiswaList.map((m) => (
                            <CommandItem
                              key={m.label}
                              value={m.label}
                              onSelect={() => {
                                field.onChange(m.value);
                                setOpen(false);
                              }}
                            >
                              {m.label}
                              <Check
                                className={cn(
                                  'ml-auto',
                                  field.value === m.label
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
                      {field.value || 'Pilih Posisi'}
                      <ChevronsUpDown className="opacity-50" />
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
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="py-2 px-3 text-sm">
                            Tekan Enter untuk menggunakan:{' '}
                            <span className="font-semibold">{field.value}</span>
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {posisiList
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

        <FormField
          control={form.control}
          name="division"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Divisi</FormLabel>
              <FormControl>
                <Popover open={divisiOpen} onOpenChange={setdivisiOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      {field.value || 'Pilih divisi'}
                      <ChevronsUpDown className="opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 PopoverContent">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Cari atau ketik divisi baru"
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
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
                          {divisiList
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
                                  setdivisiOpen(false);
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

        {/* Tombol Submit */}
        <Button type="submit" className="w-full">
          Simpan Anggota
        </Button>
      </form>
    </Form>
  );
};

export default TambahAnggotaKegiatanForm;
