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
    mutation.mutate(values, {
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
    });
  }

  return (
    <div className="w-full px-6">
      {!isEdit && (
        <Button
          className="w-full bg-secondary-500 hover:bg-secondary-600 space-x-3 px-6 py-3 text-sm sm:text-base md:text-lg rounded-2xl text-white hover:text-white shadow-none"
          onClick={() => setIsEdit(true)}
        >
          <Pencil /> Edit Profile Lembaga
        </Button>
      )}
      {isEdit && (
        <div className="w-full items-center pb-2">
          <div className="mb-4">
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600">
              Edit Profile Lembaga
            </h2>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 w-full"
            >
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-x-8">
                <div className="flex flex-col items-start">
                  <FormField
                    control={form.control}
                    name="gambar"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full overflow-hidden bg-gray-200 cursor-pointer group">
                            {field.value ? (
                              <Image
                                src={field.value}
                                alt="Profile Picture Lembaga"
                                width={160}
                                height={160}
                                className="w-full h-full object-cover relative z-0"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 relative z-0">
                                <Camera className="w-6 h-6 mb-2" />
                                <span className="text-xs text-center">
                                  Click to upload
                                </span>
                              </div>
                            )}

                            <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <Image
                                src={'/images/miscellaneous/photo-camera.svg'}
                                alt="Camera Icon"
                                height={20}
                                width={20}
                              />
                              <span className="text-white text-xs text-center font-semibold mt-1">
                                {field.value ? 'Change photo' : 'Upload photo'}
                              </span>
                            </div>

                            {/* Loading Overlay */}
                            {isUploading && (
                              <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-30">
                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                                <span className="text-white text-xs mt-2">
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
                                    <div className="w-full h-full bg-transparent" />
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

                <div className="flex-1 space-y-4 gap-3 w-full">
                  <FormField
                    control={form.control}
                    name="nama"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-normal text-neutral-1000 text-sm md:text-lg">
                          Nama Lembaga
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Masukkan nama lembaga"
                            {...field}
                            className="border rounded-xl border-neutral-400 bg-neutral-200 text-sm md:text-base"
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
                        <FormLabel className="font-normal text-neutral-1000 text-sm md:text-lg">
                          Nama Singkatan
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Contoh: HMTG"
                            {...field}
                            className="border rounded-xl border-neutral-400 bg-neutral-200 text-sm md:text-base"
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
                        <FormLabel className="font-normal text-neutral-1000 text-sm md:text-lg">
                          Tipe Lembaga
                        </FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <SelectTrigger className="border rounded-xl border-neutral-400 bg-neutral-200 text-sm md:text-base">
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
                        <FormLabel className="font-normal text-neutral-1000 text-sm md:text-lg">
                          Deskripsi Lembaga
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Masukkan deskripsi lembaga"
                            {...field}
                            className="border rounded-xl border-neutral-400 bg-neutral-200 text-sm resize-none md:text-base min-h-32 sm:min-h-40"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="w-full gap-x-3 flex justify-center items-center sm:justify-end sm:items-end pt-2">
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
