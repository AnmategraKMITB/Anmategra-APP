'use client';

// Library Import
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
// Icon Import
import { CalendarIcon, Trash2 } from 'lucide-react';
import type { Session } from 'next-auth';
import Image from 'next/image';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { z } from 'zod';
// Type Import
import { type Event } from '~/app/lembaga/kegiatan/_components/kegiatan-container';
import { Button } from '~/components/ui/button';
import { Calendar } from '~/components/ui/calendar';
import { Checkbox } from '~/components/ui/checkbox';
// Components Import
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { toast } from '~/hooks/use-toast';
// Utils Import
import { cn } from '~/lib/utils';
// TRPC Import
import { api } from '~/trpc/react';

import CustomDropzone from './dropzone';

// ✅ Schema dengan Zod
const EventInputSchema = z
  .object({
    name: z.string().min(1, 'Nama kegiatan wajib diisi'),
    label: z.string().max(255).optional(),
    description: z
      .string()
      .min(10, 'Deskripsi minimal 10 karakter')
      .max(100, 'Deskripsi maksimal 100 karakter'),
    image: z.string().url(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime().nullable().optional(),
    status: z.enum(['Coming Soon', 'On going', 'Ended']),
    oprec_link: z
      .string()
      .url('Harus berupa URL yang valid')
      .or(z.literal(''))
      .optional(),
    location: z.string().optional(),
    is_highlighted: z.boolean().optional(),
    is_organogram: z.boolean().optional(),
    background_image: z.string().url().optional(),
    organogram_image: z.string().url().or(z.literal('')).optional(),
    rapor_visible: z.boolean().optional(),
});

// ✅ Type inference dari schema
type EventInputSchemaType = z.infer<typeof EventInputSchema>;

const TambahEditKegiatanForm = ({
  setIsOpen,
  kegiatan,
  admin,
  lembagaId,
  onDone,
}: {
  session?: Session | null;
  /** Lembaga yang dikelola. */
  lembagaId?: string;
  setIsOpen: (param: boolean) => void;
  setEventList?: (param: Event[]) => void;
  kegiatan?: Event | null;
  admin?: { lembagaId: string; kind: 'kegiatan' | 'kepengurusan' };
  onDone?: () => void;
}) => {
  const isEditMode = !!kegiatan;

  // ✅ useForm hook
  const form = useForm<EventInputSchemaType>({
    resolver: zodResolver(EventInputSchema),
    mode: 'onChange',
    defaultValues: isEditMode
      ? {
          name: kegiatan.name,
          label: (kegiatan as Event & { label?: string | null }).label ?? '',
          description: kegiatan.description ?? '',
          image: kegiatan.thumbnail ?? '',
          start_date:
            kegiatan.start_date && !isNaN(Date.parse(kegiatan.start_date))
              ? new Date(kegiatan.start_date).toISOString()
              : new Date().toISOString(),
          end_date:
            kegiatan.end_date &&
            kegiatan.end_date !== '' &&
            !isNaN(Date.parse(kegiatan.end_date))
              ? new Date(kegiatan.end_date).toISOString()
              : undefined,
          status: kegiatan.status,
          oprec_link: kegiatan.oprec_link ?? '',
          location: kegiatan.location ?? '',
          is_highlighted: kegiatan.is_highlighted ?? false,
          is_organogram: kegiatan.is_organogram ?? false,
          background_image: kegiatan.background_image ?? '',
          organogram_image: kegiatan.organogram_image ?? '',
          rapor_visible: kegiatan.rapor_visible ?? false,
        }
      : {
          name: '',
          label: '',
          description: '',
          image: undefined,
          start_date: new Date().toISOString(),
          end_date: undefined,
          status: 'Coming Soon',
          oprec_link: undefined,
          location: undefined,
          is_highlighted: false,
          is_organogram: false,
          background_image: undefined,
          organogram_image: undefined,
          rapor_visible: false,
        },
  });

  const finish = () => {
    setIsOpen(false);
    if (onDone) onDone();
    else location.reload();
  };

  const adminCreate = api.adminConsole.eventCreate.useMutation({
    onSuccess: () => {
      finish();
      toast({ title: 'Kegiatan berhasil dibuat' });
    },
    onError: (error) => {
      toast({ title: 'Gagal membuat kegiatan', description: error.message, variant: 'destructive' });
    },
  });

  const adminUpdate = api.adminConsole.eventUpdate.useMutation({
    onSuccess: () => {
      finish();
      toast({ title: 'Kegiatan berhasil diubah' });
    },
    onError: (error) => {
      toast({ title: 'Gagal mengubah kegiatan', description: error.message, variant: 'destructive' });
    },
  });

  const createMutation = api.event.create.useMutation({
    onSuccess: () => {
      finish();
      toast({
        title: 'Kegiatan berhasil dibuat',
      })
    },
    onError: (error) => {
      toast({
        title: 'Gagal membuat kegiatan',
        description: error.message,
        variant: 'destructive',
      });
      console.error('Error creating event:', error);
    },
  });

  const updateMutation = api.event.update.useMutation({
    onSuccess: () => {
      finish();
      toast({
        title: 'Kegiatan berhasil diubah',
      })
    },
    onError: (error) => {
      toast({
        title: 'Gagal mengubah kegiatan',
        description: error.message,
        variant: 'destructive',
      });
      console.error('Error updating event:', error);
    },
  });

  // Function submit
  const onSubmit = (values: EventInputSchemaType) => {
    const query = {
      ...values,
      is_organogram: values.is_organogram ?? false,
      is_highlighted: values.is_highlighted ?? false,
    };

    if (admin) {
      if (isEditMode) {
        adminUpdate.mutate({
          ...query,
          id: kegiatan.id,
          lembagaId: admin.lembagaId,
          kind: admin.kind,
          label: values.label ?? null,
        });
      } else {
        adminCreate.mutate({
          ...query,
          lembagaId: admin.lembagaId,
          kind: admin.kind,
          label: values.label ?? null,
        });
      }
      return;
    }

    const scopeId = lembagaId ?? '';
    if (isEditMode) {
      updateMutation.mutate({ ...query, lembagaId: scopeId, id: kegiatan.id });
    } else {
      createMutation.mutate({ ...query, lembagaId: scopeId });
    }
  };

  const isValid = form.formState.isValid;

  const startDate = useWatch({ control: form.control, name: 'start_date' });
  const organogramImage = useWatch({
    control: form.control,
    name: 'organogram_image',
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const handleDeleteOrganogram = () => {
    form.setValue('organogram_image', '');
    form.setValue('is_organogram', false);
    setDeleteDialogOpen(false);
    // toast({
    //   title: 'Organogram dihapus',
    //   description: 'Organogram berhasil dihapus dari kegiatan',
    // });
  };

  return (
    <Form {...form}>
      <div className="w-full h-[60vh] sm:h-[70vh] md:h-[75vh] lg:h-[80vh] overflow-y-auto">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 w-full px-4 py-4"
        >
          {admin?.kind === 'kepengurusan' ? (
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label periode</FormLabel>
                  <FormControl className="p-2">
                    <Input className="rounded-lg" placeholder="Contoh: 2026/2027" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          {/* Nama Kegiatan */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Nama Kegiatan<span className="text-red-500 ml-1">*</span>
                </FormLabel>
                <FormControl className="p-2">
                  <Input
                    className="rounded-lg"
                    placeholder="Masukkan nama kegiatan"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Deskripsi */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Deskripsi<span className="text-red-500 ml-1">*</span>
                </FormLabel>
                <FormControl className="p-2">
                  <Textarea
                    className="rounded-lg"
                    placeholder="Jelaskan tentang kegiatan ini..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Layout: Tanggal Mulai & Selesai */}
          <div className="flex space-x-4 pt-2">
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem className="flex-1 flex flex-col gap-y-[2px]">
                  <FormLabel>
                    Tanggal Mulai<span className="text-red-500 ml-1">*</span>
                  </FormLabel>
                  <Popover modal={true}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-between text-left font-normal rounded-lg',
                            !field.value && 'text-muted-foreground',
                          )}
                        >
                          {field.value ? (
                            format(new Date(field.value), 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="mr-2 h-4 w-4" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 !z-[9999]"
                      style={{ zIndex: 9999 }}
                    >
                      <Calendar
                        mode="single"
                        selected={
                          field.value ? new Date(field.value) : undefined
                        }
                        onSelect={(date) => field.onChange(date?.toISOString())}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem className="flex-1 flex flex-col gap-y-[2px]">
                  <FormLabel>Tanggal Selesai</FormLabel>
                  <Popover modal={true}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-between text-left font-normal rounded-lg',
                            !field.value && 'text-muted-foreground',
                          )}
                        >
                          {field.value ? (
                            format(new Date(field.value), 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="mr-2 h-4 w-4" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 !z-[9999]"
                      style={{ zIndex: 9999 }}
                    >
                      <Calendar
                        mode="single"
                        selected={
                          field.value ? new Date(field.value) : undefined
                        }
                        onSelect={(date) => field.onChange(date?.toISOString())}
                        initialFocus
                        disabled={(date) =>
                          startDate
                            ? new Date(date) < new Date(startDate)
                            : false
                        }
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Layout: Status, Lokasi, dan Link Pendaftaran */}
          <div className="flex space-x-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>
                    Status Kegiatan<span className="text-red-500 ml-1">*</span>
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Pilih Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Coming Soon">
                        Segera Dimulai
                      </SelectItem>
                      <SelectItem value="On going">
                        Sedang Berlangsung
                      </SelectItem>
                      <SelectItem value="Ended">Selesai</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Lokasi Kegiatan</FormLabel>
                  <FormControl className="p-2">
                    <Input
                      className="rounded-lg "
                      placeholder="Masukkan lokasi"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="oprec_link"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Link Pendaftaran</FormLabel>
                  <FormControl className="p-2">
                    <Input
                      className="rounded-lg "
                      type="url"
                      placeholder="https://contoh.com/daftar"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Layout: Batas & Jumlah Peserta */}
          <div className="flex space-x-4">
            {/* <FormField
              control={form.control}
              name="participant_limit"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>
                    Batas Peserta<span className="text-red-500 ml-1">*</span>
                  </FormLabel>
                  <FormControl className="p-2">
                    <div className="relative">
                      <Input
                        type="number"
                        className="rounded-lg pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="Masukkan jumlah maksimal peserta"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                        <button
                          type="button"
                          className="w-5 h-4 flex items-end justify-center rounded transition-colors"
                          onClick={() => field.onChange((field.value || 0) + 1)}
                        >
                          <Image
                            src="/icons/increase.svg"
                            alt="Increase icon"
                            width={12}
                            height={12}
                          />
                        </button>
                        <button
                          type="button"
                          className="w-5 h-4 flex items-start justify-center rounded transition-colors"
                          onClick={() =>
                            field.onChange(Math.max(1, (field.value || 0) - 1))
                          }
                        >
                          <Image
                            src="/icons/decrease.svg"
                            alt="Increase icon"
                            width={12}
                            height={12}
                          />
                        </button>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="participant_count"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>
                    Jumlah Peserta Saat Ini
                    <span className="text-red-500 ml-1">*</span>
                  </FormLabel>
                  <FormControl className="p-2">
                    <div className="relative">
                      <Input
                        type="number"
                        className="rounded-lg pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="Masukkan jumlah peserta saat ini"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                        <button
                          type="button"
                          className="w-5 h-4 flex items-end justify-center rounded transition-colors"
                          onClick={() => field.onChange((field.value || 0) + 1)}
                        >
                          <Image
                            src="/icons/increase.svg"
                            alt="Increase icon"
                            width={12}
                            height={12}
                          />
                        </button>
                        <button
                          type="button"
                          className="w-5 h-4 flex items-start justify-center rounded transition-colors"
                          onClick={() =>
                            field.onChange(Math.max(0, (field.value || 0) - 1))
                          }
                        >
                          <Image
                            src="/icons/decrease.svg"
                            alt="Increase icon"
                            width={12}
                            height={12}
                          />
                        </button>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            /> */}
            <FormField
              control={form.control}
              name="rapor_visible"
              render={({ field }) => (
                <FormItem className="flex-1 flex flex-row self-end space-x-3 items-center justify-center space-y-0">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <FormLabel
                    className="font-normal cursor-pointer"
                    onClick={() => field.onChange(!field.value)}
                  >
                    Rapor Terlihat Publik
                  </FormLabel>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Upload Gambar<span className="text-red-500 ml-1">*</span>
                </FormLabel>
                <FormControl>
                  <CustomDropzone
                    label="Upload Gambar"
                    onFileChange={field.onChange}
                    initialValue={field.value}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="background_image"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Upload Banner <span className="text-red-500 ml-1">*</span>
                </FormLabel>
                <FormControl>
                  <CustomDropzone
                    label="Upload Banner"
                    onFileChange={field.onChange}
                    initialValue={field.value}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="organogram_image"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>
                    Upload Organogram
                    <span className="text-gray-500 ml-1">(Opsional)</span>
                  </FormLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={!field.value}
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <FormControl>
                  <CustomDropzone
                    key={field.value || 'empty'}
                    label="Upload Organogram"
                    onFileChange={(value) => {
                      field.onChange(value);
                      if (value) {
                        form.setValue('is_organogram', true);
                      }
                    }}
                    initialValue={field.value}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Tombol Submit */}
          <div className="flex justify-center w-full">
            <Button type="submit" className="bg-primary-400">
              SIMPAN
            </Button>
          </div>
        </form>
      </div>

      {/* Pop-up Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus organogram ini? 
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="outline">Batal</Button>
            </DialogClose>
            <Button
              onClick={handleDeleteOrganogram}
              variant="warning"
            >
              Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Form>
  );
};

export default TambahEditKegiatanForm;
