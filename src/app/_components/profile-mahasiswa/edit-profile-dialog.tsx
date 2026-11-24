'use client';

// Library
import { zodResolver } from '@hookform/resolvers/zod';
// Icon Import
import { Camera, Loader2, Pencil } from 'lucide-react';
import Image from 'next/image';
import LineIcon from 'public/icons/line-icon-2.png';
import WhatsappIcon from 'public/icons/wa-icon.png';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
// Components Import
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { Switch } from '~/components/ui/switch';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';
// Upload Thing Import
import { UploadButton } from '~/utils/uploadthing';

const mahasiswaProfilSchema = z.object({
  fotoProfil: z.string().url().optional(),
  nama: z.string().min(1, 'Nama tidak boleh kosong'),
  nim: z.string(),
  jurusanAngkatan: z.string().min(1, 'Jurusan dan Angkatan tidak boleh kosong'),
  idLine: z
    .string()
    .optional()
    .refine((val) => !val || (val.length >= 3 && val.length <= 30), {
      message: 'ID Line harus antara 3 hingga 30 karakter',
    }),
  noWhatsapp: z
    .string()
    .optional()
    .refine((val) => !val || /^0\d{10,12}$/.test(val), {
      message: 'Nomor WhatsApp harus 11-13 digit dan dimulai dengan 0',
    }),
  showWhatsapp: z.boolean(),
  showLine: z.boolean(),
  showEmail: z.boolean(),
});

type mahasiswaProfilSchemaType = z.infer<typeof mahasiswaProfilSchema>;

const EditProfileDialog = ({
  image,
  nama,
  nim,
  jurusan,
  angkatan,
  line,
  whatsapp,
  showWhatsapp,
  showLine,
  showEmail,
  isEdit,
  setIsEdit,
}: {
  image: string | null | undefined;
  nama: string;
  nim: string;
  jurusan: string;
  angkatan: string;
  line: string;
  whatsapp: string;
  showWhatsapp: boolean;
  showLine: boolean;
  showEmail: boolean;
  isEdit: boolean;
  setIsEdit: (value: boolean) => void;
}) => {
  const toast = useToast();
  const [isUploading, setIsUploading] = React.useState(false);

  const mutation = api.users.editProfilMahasiswa.useMutation();
  const form = useForm<mahasiswaProfilSchemaType>({
    resolver: zodResolver(mahasiswaProfilSchema),
    defaultValues: {
      fotoProfil: image ?? undefined,
      nama: nama ?? '',
      nim: nim ?? '',
      jurusanAngkatan: `${jurusan ?? ''}'${angkatan ?? ''}`,
      idLine: line ?? '',
      noWhatsapp: whatsapp ?? '',
      showWhatsapp,
      showLine,
      showEmail,
    },
  });

  // dummy
  const setIsOpen = (value: boolean) => {
    if (!value) {
      form.reset();
    }
    setIsEdit(value);
  };
  async function onSubmit(values: mahasiswaProfilSchemaType) {
    // Split jurusanAngkatan back into separate fields
    // const [jurusan, angkatan] = values.jurusanAngkatan.split("'");

    mutation.mutate(
      {
        image: values.fotoProfil,
        idLine: values.idLine,
        noWhatsapp: values.noWhatsapp,
        showWhatsapp: values.showWhatsapp,
        showLine: values.showLine,
        showEmail: values.showEmail,
      },
      {
        onSuccess: () => {
          form.reset();
          setIsOpen(false);
          location.reload();
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
          className="w-full space-x-3 rounded-2xl bg-secondary-400 px-6 py-3 text-sm hover:bg-secondary-500 sm:text-base md:text-lg"
          onClick={() => setIsEdit(true)}
        >
          <Pencil /> Edit Profile Info
        </Button>
      )}
      {isEdit && (
        <div className="w-full items-center pb-2">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-neutral-1000 sm:text-xl md:text-2xl">
              Edit Profile
            </h2>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="w-full space-y-4"
            >
              {/* Profile Section with Avatar and Personal Info */}
              <div className="flex flex-col items-center gap-x-8 sm:flex-row sm:items-start">
                {/* Avatar with Upload Button */}
                <div className="flex flex-col items-start">
                  <FormField
                    control={form.control}
                    name="fotoProfil"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="group relative h-24 w-24 cursor-pointer overflow-hidden rounded-full bg-gray-200 sm:h-32 sm:w-32 md:h-40 md:w-40">
                            {/* Display the image */}
                            {field.value ? (
                              <Image
                                src={field.value}
                                alt="Profile Picture"
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

                            {/* Hover overlay */}
                            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-black bg-opacity-50 opacity-0 transition-opacity group-hover:opacity-100">
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

                            {/* Hidden upload button that covers the entire area */}
                            <div className="absolute inset-0 z-20 opacity-0">
                              <UploadButton
                                endpoint="imageUploader"
                                onBeforeUploadBegin={(files) => {
                                  setIsUploading(true);
                                  return files;
                                }}
                                onClientUploadComplete={(res) => {
                                  if (res && res.length > 0) {
                                    // @ts-expect-error URL is a valid string
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

                {/* Personal Information */}
                <div className="w-full flex-1 gap-3 space-y-4">
                  {/* Nama */}
                  <FormField
                    control={form.control}
                    name="nama"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-normal text-neutral-1000 md:text-lg">
                          Nama
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Masukkan nama lengkap"
                            {...field}
                            disabled
                            className="rounded-xl border border-neutral-400 bg-neutral-200 text-sm md:text-lg"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* NIM - Read Only */}
                  <FormField
                    control={form.control}
                    name="nim"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-normal text-neutral-1000 md:text-lg">
                          NIM
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="NIM"
                            {...field}
                            readOnly
                            disabled
                            className="cursor-not-allowed bg-gray-100 text-sm text-gray-600 md:text-lg"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Jurusan'Angkatan in one field */}
                  <FormField
                    control={form.control}
                    name="jurusanAngkatan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-normal text-neutral-1000 md:text-lg">
                          Jurusan&apos;Angkatan
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Teknik Informatika'2022"
                            {...field}
                            disabled
                            className="border border-neutral-400 bg-neutral-200 text-sm md:text-lg"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-neutral-1000 sm:text-xl md:text-2xl">
                  Contact Info
                </h3>
                <div className="flex flex-col gap-x-4 gap-y-4 sm:flex-row">
                  {/* ID Line */}
                  <FormField
                    control={form.control}
                    name="idLine"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className="flex flex-row items-center space-x-3">
                          <Image
                            src={LineIcon}
                            alt="Line Icon"
                            width={20}
                            height={20}
                          />
                          <p className="sm:text-md text-sm font-normal md:text-xl">
                            ID Line
                          </p>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. @johndoe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* WhatsApp */}
                  <FormField
                    control={form.control}
                    name="noWhatsapp"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className="flex flex-row items-center space-x-3">
                          <Image
                            src={WhatsappIcon}
                            alt="Whatsapp Icon"
                            width={20}
                            height={20}
                          />
                          <p className="sm:text-md text-sm font-normal md:text-xl">
                            Nomor WhatsApp
                          </p>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 08123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Visibilitas Kontak */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-1000 sm:text-xl md:text-2xl">
                    Visibilitas Kontak
                  </h3>
                  <p className="text-sm text-neutral-600">
                    Atur kontak yang dapat dilihat mahasiswa lain. Owner dan
                    Admin lembaga atau kegiatan tempat kamu terlibat, serta
                    admin sistem, tetap dapat melihat kontakmu.
                  </p>
                </div>
                {(
                  [
                    ['showWhatsapp', 'Tampilkan nomor WhatsApp'],
                    ['showLine', 'Tampilkan ID Line'],
                    ['showEmail', 'Tampilkan email'],
                  ] as const
                ).map(([name, label]) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-xl border px-4 py-3">
                        <FormLabel className="text-sm font-normal sm:text-base">
                          {label}
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-label={label}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
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

export default EditProfileDialog;
