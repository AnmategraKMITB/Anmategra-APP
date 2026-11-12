'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { api } from '~/trpc/react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '~/lib/utils';
import { useToast } from '~/hooks/use-toast';

const AjuanAsosiasiSchema = z.object({
  posisi: z.string().min(1, 'Posisi harus dipilih'),
  divisi: z.string().min(1, 'Divisi harus dipilih'),
});

type AjuanAsosiasiSchemaType = z.infer<typeof AjuanAsosiasiSchema>;

interface AjuanAsosiasiFormProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  eventId: string;
  lembagaId: string;
  eventName: string;
  eventLogo: string;
  organizationName: string;
  onSubmissionSuccess?: () => void;
  resetTrigger?: number;
}

const AjuanAsosiasiForm = ({
  isOpen,
  setIsOpen,
  eventId,
  lembagaId,
  eventName,
  eventLogo,
  organizationName,
  onSubmissionSuccess,
  resetTrigger,
}: AjuanAsosiasiFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const utils = api.useUtils();
  const toast = useToast();
  const [posisiOpen, setPosisiOpen] = useState(false);
  const [divisiOpen, setDivisiOpen] = useState(false);
  const [posisiOptions, setPosisiOptions] = useState<{ value: string; label: string }[]>([]);
  const [divisiOptions, setDivisiOptions] = useState<{ value: string; label: string }[]>([]);

  const { data: kegiatanOptions } = api.users.getTambahAnggotaKegiatanOptions.useQuery(
    { lembagaId, kegiatanId: eventId },
    { enabled: Boolean(eventId) },
  );

  const form = useForm<AjuanAsosiasiSchemaType>({
    resolver: zodResolver(AjuanAsosiasiSchema),
    mode: 'onChange',
    defaultValues: {
      posisi: '',
      divisi: '',
    },
  });

  const resetForm = useCallback(() => {
    form.reset();
  }, [form]);

  useEffect(() => {
    if (resetTrigger && resetTrigger > 0) {
      resetForm();
    }
  }, [resetTrigger, resetForm]);

  useEffect(() => {
    if (kegiatanOptions) {
      setPosisiOptions(kegiatanOptions.posisi ?? []);
      setDivisiOptions(kegiatanOptions.bidang ?? []);
    }
  }, [kegiatanOptions]);

  const requestAssociationMutation = api.users.requestAssociation.useMutation({
    onSuccess: () => {
      onSubmissionSuccess?.();
      setIsOpen(false);
      form.reset();
      void utils.users.getMyRequestAssociation.invalidate();
      toast.toast({
        title: 'Pengajuan berhasil dikirim',
        description: 'Permintaan asosiasi sudah tercatat.',
      });
    },
    onError: (err) => {
      toast.toast({
        title: 'Gagal mengirim pengajuan',
        description: err.message || 'Coba lagi nanti.',
        variant: 'destructive',
      });
    },
    onSettled: () => setIsSubmitting(false),
  });

  const onSubmit = (values: AjuanAsosiasiSchemaType) => {
    try {
      if (!eventId) {
        toast.toast({
          title: 'Event tidak tersedia',
          description: 'ID event tidak ditemukan.',
          variant: 'destructive',
        });
        return;
      }
      setIsSubmitting(true);
      requestAssociationMutation.mutate({
        event_id: eventId,
        division: values.divisi,
        position: values.posisi,
      });
    } catch (err) {
      console.error('Submit error:', err);
      setIsSubmitting(false);
      toast.toast({
        title: 'Gagal mengirim',
        description: 'Terjadi error saat pengiriman.',
        variant: 'destructive',
      });
    }
  };

  const isValid = form.formState.isValid;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="w-4/5 lg:w-[880px] h-fit max-w-none mx-auto p-0 bg-white rounded-xl overflow-hidden [&>button]:right-6 [&>button]:top-7"
        aria-describedby={undefined}
      >
        {/* Header */}
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Pengajuan Asosiasi
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Event Info */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-center gap-4">
            <div className="relative w-20 h-20 md:w-32 md:h-32 rounded-full overflow-hidden aspect-square flex-shrink-0 self-center md:self-auto">
              <Image
                src={eventLogo}
                alt={eventName}
                fill
                className="rounded-full object-cover"
                sizes='sizes="(max-width: 640px) 80px, 128px'
              />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-semibold text-gray-700">
                {eventName}
              </h3>
              <p className="text-gray-400 text-lg md:text-xl">{organizationName}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Posisi Field */}
              <FormField
                control={form.control}
                name="posisi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-900 text-lg font-medium">
                      Posisi
                    </FormLabel>
                    <Popover open={posisiOpen} onOpenChange={setPosisiOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span className={cn(!field.value && 'text-[#98A2B3]')}>
                            {field.value || 'Masukkan posisi...'}
                          </span>
                          <ChevronsUpDown className={cn('h-4 w-4', !field.value && 'text-[#636A6D]')} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Cari atau ketik posisi baru..."
                            value={field.value}
                            onValueChange={(val) => field.onChange(val)}
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
                              {(posisiOptions ?? [])
                                .filter((p) =>
                                  p.label.toLowerCase().includes((field.value || '').toLowerCase()),
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
                                        field.value === p.value ? 'opacity-100' : 'opacity-0',
                                      )}
                                    />
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Divisi Field */}
              <FormField
                control={form.control}
                name="divisi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-900 text-lg font-medium">
                      Divisi
                    </FormLabel>
                    <Popover open={divisiOpen} onOpenChange={setDivisiOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span className={cn(!field.value && 'text-[#98A2B3]')}>
                            {field.value || 'Masukkan divisi...'}
                          </span>
                          <ChevronsUpDown className={cn('h-4 w-4', !field.value && 'text-[#636A6D]')} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Cari atau ketik divisi baru..."
                            value={field.value}
                            onValueChange={(val) => field.onChange(val)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && field.value) {
                                e.preventDefault();
                                setDivisiOpen(false);
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
                              {(divisiOptions ?? [])
                                .filter((d) =>
                                  d.label.toLowerCase().includes((field.value || '').toLowerCase()),
                                )
                                .map((d) => (
                                  <CommandItem
                                    key={d.value}
                                    value={d.value}
                                    onSelect={() => {
                                      field.onChange(d.value);
                                      setDivisiOpen(false);
                                    }}
                                  >
                                    {d.label}
                                    <Check
                                      className={cn(
                                        'ml-auto',
                                        field.value === d.value ? 'opacity-100' : 'opacity-0',
                                      )}
                                    />
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <div className="pt-4 flex justify-center">
                <Button
                  type="submit"
                  disabled={!isValid || isSubmitting}
                  className="w-32 h-10 font-medium rounded-xl transition-colors duration-200 bg-[#2B6282] hover:bg-[#2B6282] text-white"
                >
                  KIRIM
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AjuanAsosiasiForm;
