'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Loader2, Pencil } from 'lucide-react';
import Image from 'next/image';
import React, { useState } from 'react';
// Form Import
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
// Components Import
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';
import { UploadButton } from '~/utils/uploadthing';

const lembagaTypeOptions = ['Himpunan', 'UKM', 'Kepanitiaan'] as const;

const profileLembagaSchema = z.object({
  nama: z
    .string()
    .min(1, 'Nama wajib diisi')
    .max(255, 'Nama maksimal 255 karakter'),
  singkatan: z.string().max(50, 'Singkatan maksimal 50 karakter').optional(),
  tipe: z.enum(lembagaTypeOptions).optional(),
  deskripsi: z
    .string()
    .min(10, 'Deskripsi minimal 10 karakter')
    .max(500, 'Deskripsi maksimal 500 karakter'),
  gambar: z.string().url(),
});
type profileLembagaSchemaType = z.infer<typeof profileLembagaSchema>;

const EditProfileLembaga = ({
  lembagaData,
  isEdit,
  setIsEdit,
}: {
  lembagaData: {
    id: string;
    name: string;
    acronym?: string | null;
    description: string | null;
    type?: (typeof lembagaTypeOptions)[number] | null;
    users: {
      image: string | null;
    };
  };
  isEdit: boolean;
  setIsEdit: (isEdit: boolean) => void;
}) => {
  const mutation = api.lembaga.editProfil.useMutation();
  const toast = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const form = useForm<profileLembagaSchemaType>({
    resolver: zodResolver(profileLembagaSchema),
    defaultValues: {
      nama: lembagaData.name ?? '',
      singkatan: lembagaData.acronym ?? '',
      tipe: lembagaData.type ?? undefined,
      deskripsi: lembagaData.description ?? '',
      gambar: lembagaData.users.image ?? '',
    },
  });

  function onSubmit(values: profileLembagaSchemaType) {
    mutation.mutate(
      { ...values, lembagaId: lembagaData.id },
      {
        onSuccess: () => {
          toast.toast({
            variant: 'default',
            title: 'Berhasil mengubah profil',
          });
          window.location.reload();
        },
        onError: (error) => {
          toast.toast({
            variant: 'destructive',
            title: 'Gagal mengubah profil',
            description: error.message,
          });
        },
      },
    );
  }

  return (
    <div className="w-full px-6">
      {!isEdit && (
        <Button
          className="w-full space-x-3 rounded-2xl bg-secondary-500 px-6 py-3 text-sm text-white shadow-none hover:bg-secondary-600 hover:text-white sm:text-base md:text-lg"
          onClick={() => setIsEdit(true)}
        >
          <Pencil /> Edit Profile Lembaga
        </Button>
      )}
      {isEdit && (
        <div className="w-full items-center pb-2">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-600 sm:text-xl md:text-2xl">
              Edit Profile Lembaga
            </h2>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="w-full space-y-4"
            >
              <div className="flex flex-col items-center gap-x-8 sm:flex-row sm:items-start">
                <div className="flex flex-col items-start">
                  <FormField
                    control={form.control}
                    name="gambar"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="group relative h-24 w-24 cursor-pointer overflow-hidden rounded-full bg-gray-200 sm:h-32 sm:w-32 md:h-40 md:w-40">
                            {field.value ? (
                              <Image
                                src={field.value}
                                alt="Profile Picture Lembaga"
                                width={160}
                                height={160}
                                className="relative z-0 h-full w-full object-cover"
                              />
                            ) : (
                              <div className="relative z-0 flex h-full w-full flex-col items-center justify-center text-gray-400">
                                <Camera className="mb-2 h-6 w-6" />
                                <span className="text-center text-xs">
                                  Click to upload
                                </span>
                              </div>
                            )}

                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black bg-opacity-50 opacity-0 transition-opacity group-hover:opacity-100">
                              <Image
                                src={'/images/miscellaneous/photo-camera.svg'}
                                alt="Camera Icon"
                                height={20}
                                width={20}
                              />
                              <span className="mt-1 text-center text-xs font-semibold text-white">
                                {field.value ? 'Change photo' : 'Upload photo'}
                              </span>
                            </div>

                            {/* Loading Overlay */}
                            {isUploading && (
                              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black bg-opacity-60">
                                <Loader2 className="h-8 w-8 animate-spin text-white" />
                                <span className="mt-2 text-xs text-white">
                                  Uploading...
                                </span>
                              </div>
                            )}

                            <div className="absolute inset-0 z-20 opacity-0">
                              <UploadButton
                                endpoint="imageUploader"
                                onBeforeUploadBegin={(files) => {
                                  setIsUploading(true);
                                  return files;
                                }}
                                onClientUploadComplete={(res) => {
                                  if (res && res.length > 0 && res[0]) {
                                    field.onChange(res[0].url);
                                  }
                                  setIsUploading(false);
                                }}
                                onUploadError={(error: Error) => {
                                  setIsUploading(false);
                                  toast.toast({
                                    variant: 'destructive',
                                    title: 'Upload Gagal',
                                    description: error.message,
                                  });
                                }}
                                appearance={{
                                  button:
                                    'w-full h-full !bg-transparent border-none cursor-pointer p-0 m-0',
                                  container: 'w-full h-full',
                                  allowedContent: 'hidden',
                                }}
                                content={{
                                  button: () => (
                                    <div className="h-full w-full bg-transparent" />
                                  ),
                                }}
                              />
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="w-full flex-1 gap-3 space-y-4">
                  <FormField
                    control={form.control}
                    name="nama"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-normal text-neutral-1000 md:text-lg">
                          Nama Lembaga
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Masukkan nama lembaga"
                            {...field}
                            className="rounded-xl border border-neutral-400 bg-neutral-200 text-sm md:text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Nama Singkatan / Akronim */}
                  <FormField
                    control={form.control}
                    name="singkatan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-normal text-neutral-1000 md:text-lg">
                          Nama Singkatan
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Contoh: HMTG"
                            {...field}
                            className="rounded-xl border border-neutral-400 bg-neutral-200 text-sm md:text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Tipe Lembaga */}
                  <FormField
                    control={form.control}
                    name="tipe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-normal text-neutral-1000 md:text-lg">
                          Tipe Lembaga
                        </FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <SelectTrigger className="rounded-xl border border-neutral-400 bg-neutral-200 text-sm md:text-base">
                              <SelectValue placeholder="Pilih tipe lembaga" />
                            </SelectTrigger>
                            <SelectContent>
                              {lembagaTypeOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Deskripsi Lembaga */}
                  <FormField
                    control={form.control}
                    name="deskripsi"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-normal text-neutral-1000 md:text-lg">
                          Deskripsi Lembaga
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Masukkan deskripsi lembaga"
                            {...field}
                            className="min-h-32 resize-none rounded-xl border border-neutral-400 bg-neutral-200 text-sm sm:min-h-40 md:text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex w-full items-center justify-center gap-x-3 pt-2 sm:items-end sm:justify-end">
                <Button
                  variant={'outline'}
                  className="border-Blue-Dark text-Blue-Dark"
                  onClick={() => setIsEdit(false)}
                  type="button"
                >
                  Batal Edit
                </Button>
                <Button type="submit" className="bg-Blue-Dark text-white">
                  Simpan
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
};

export default EditProfileLembaga;
