'use client';

import { useWindowRect } from '@dnd-kit/core/dist/hooks/utilities';
import {
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Paperclip,
  Plus,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';
import { useUploadThing } from '~/utils/uploadthing';

import { type Report } from '../board/report-card';

const fileSchema = z
  .string()
  .url({ message: 'URL file tidak valid' })
  .optional();

const laporanSchema = z.object({
  judul: z
    .string()
    .min(1, { message: 'Judul laporan wajib diisi' })
    .min(3, { message: 'Judul minimal 3 karakter' })
    .max(50, { message: 'Judul maksimal 50 karakter' }),
  deskripsi: z
    .string()
    .min(1, { message: 'Deskripsi laporan wajib diisi' })
    .min(10, { message: 'Deskripsi minimal 10 karakter' })
    .max(400, { message: 'Deskripsi maksimal 400 karakter' }),
  file: fileSchema.optional(),
  prioritas: z.enum(['Low', 'Medium', 'High'], {
    error: 'Prioritas urgensi wajib dipilih',
  }),
});

type LaporanSchema = z.infer<typeof laporanSchema>;

interface CustomFormFieldProps {
  error?: string;
  children: React.ReactNode;
  isPriority?: boolean;
}

const CustomFormField: React.FC<CustomFormFieldProps> = ({
  error,
  children,
  isPriority = false, // mengecek apakah bagian prioritas urgensi
}) => (
  <div className={isPriority ? 'relative' : 'space-y-2'}>
    {children}
    {error && (
      <p
        className={`text-red-600 ${isPriority ? 'absolute left-1/2 top-[45px] -translate-x-1/2 whitespace-nowrap text-[13px]' : 'ml-3 text-[16px]'}`}
      >
        {error}
      </p>
    )}
  </div>
);

interface CustomUploadButtonProps {
  onUploadSuccess: (url: string) => void;
  onError: (message: string) => void;
  isAdmin: boolean;
  isFormSubmitting: boolean;
}

const CustomUploadButton: React.FC<CustomUploadButtonProps> = ({
  onUploadSuccess,
  onError,
  isAdmin,
  isFormSubmitting,
}) => {
  const { startUpload, isUploading } = useUploadThing('reportAttachment', {
    onClientUploadComplete: (res) => {
      const uploadedUrl = res[0]?.url;
      if (uploadedUrl) {
        onUploadSuccess(uploadedUrl);
      } else {
        onError('URL file tidak ditemukan setelah upload selesai.');
      }
    },
    onUploadError: (error) => {
      onError(`Gagal mengunggah file: ${error.message}`);
    },
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileToUpload = files[0];
      const validTypes = [
        'application/pdf',
        'application/zip',
        'application/x-7z-compressed',
        'application/x-zip-compressed',
      ];
      if (fileToUpload && !validTypes.includes(fileToUpload.type)) {
        onError('Tipe file tidak didukung. Hanya PDF dan ZIP yang diizinkan.');
        e.target.value = '';
        return;
      }
      if (!fileToUpload) {
        onError('File tidak boleh kosong');
        return;
      }

      const maxSize =
        fileToUpload.type === 'application/pdf'
          ? 16 * 1024 * 1024
          : 32 * 1024 * 1024;
      if (fileToUpload && fileToUpload.size > maxSize) {
        onError(
          `Ukuran file terlalu besar. Maksimal ${
            fileToUpload.type === 'application/pdf' ? '16MB' : '32MB'
          }.`,
        );
        return;
      }
      void startUpload(Array.from(files));
      e.target.value = '';
    }
  };

  const isDisabled = isAdmin || isUploading || isFormSubmitting;

  return (
    <>
      {/* Input file tersembunyi yang akan dipicu oleh tombol */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept=".pdf,.zip"
        disabled={isDisabled}
      />

      {/* Tombol Paperclip Custom */}
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-2"
        onClick={handleClick}
        disabled={isDisabled}
      >
        {isUploading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
        ) : (
          <Paperclip className="!h-6 !w-6 rotate-45 text-gray-600" />
        )}
      </Button>
    </>
  );
};

interface LaporanFormDialogProps {
  isAdmin?: boolean;
  editMode?: boolean;
  reportToEdit?: Report;
  onEditComplete?: () => void;
}

const LaporanFormDialog: React.FC<LaporanFormDialogProps> = ({
  isAdmin,
  editMode = false,
  reportToEdit,
  onEditComplete,
}) => {
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(editMode);
  const [isMaximized, setIsMaximized] = useState(false);

  const [formData, setFormData] = useState<LaporanSchema>(() => {
    if (editMode && reportToEdit) {
      return {
        judul: reportToEdit.name,
        deskripsi: reportToEdit.description ?? '',
        file: reportToEdit.attachment ?? undefined,
        prioritas: reportToEdit.urgent as LaporanSchema['prioritas'],
      };
    }
    return {
      judul: '',
      deskripsi: '',
      file: undefined,
      prioritas: undefined as unknown as LaporanSchema['prioritas'],
    };
  });

  React.useEffect(() => {
    if (editMode && reportToEdit) {
      setFormData({
        judul: reportToEdit.name,
        deskripsi: reportToEdit.description ?? '',
        file: reportToEdit.attachment ?? undefined,
        prioritas: reportToEdit.urgent as LaporanSchema['prioritas'],
      });
      setIsOpen(true);
    }
  }, [editMode, reportToEdit]);

  const [showPrioritas, setShowPrioritas] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // tRPC mutations
  const createDraftMutation = api.users.createDraft.useMutation({
    onSuccess: () => {
      toast.toast({
        title: 'Draf laporan berhasil dibuat',
        description: 'Laporan draft telah disimpan.',
      });
    },
    onError: () => {
      toast.toast({
        title: 'Gagal membuat draf laporan',
        description: 'Coba lagi nanti.',
      });
    },
  });
  const editDraftMutation = api.users.editDraft.useMutation({
    onSuccess: () => {
      toast.toast({
        title: 'Draf laporan berhasil diperbarui',
        description: 'Laporan draft telah diperbarui.',
      });
    },
    onError: () => {
      toast.toast({
        title: 'Gagal memperbarui draf laporan',
        description: 'Coba lagi nanti.',
      });
    },
  });
  const isSubmitting =
    createDraftMutation.isPending || editDraftMutation.isPending;

  const getFieldError = (field: string): string | undefined => errors[field];

  const handleInputChange = (
    field: keyof LaporanSchema,
    value: string | undefined, // value can be string or undefined
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value as any }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const handleFileUploadSuccess = (url: string) => {
    handleInputChange('file', url);
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.file;
      return newErrors;
    });
  };

  const handleFileUploadError = (message: string) => {
    setErrors((prev) => ({
      ...prev,
      file: message,
    }));
  };

  const handleSubmit = async () => {
    const result = laporanSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    if (isAdmin) {
      return;
    }

    setErrors({});

    try {
      if (editMode && reportToEdit) {
        // Edit existing draft
        await editDraftMutation.mutateAsync({
          id: reportToEdit.id,
          subject: formData.judul,
          urgent: formData.prioritas,
          description: formData.deskripsi,
          attachment: formData.file,
        });
      } else {
        // Create new draft
        await createDraftMutation.mutateAsync({
          subject: formData.judul,
          urgent: formData.prioritas,
          description: formData.deskripsi,
          attachment: formData.file,
        });
      }

      // Reset form
      setFormData({
        judul: '',
        deskripsi: '',
        file: undefined,
        prioritas: undefined as any,
      });

      setIsOpen(false);
      window.location.reload();
      // Notify parent of edit completion
      if (editMode && onEditComplete) {
        onEditComplete();
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setErrors({
        general: editMode
          ? 'Gagal memperbarui draf laporan, coba lagi nanti.'
          : 'Gagal membuat draf laporan, coba lagi nanti.',
      });
    }
  };

  const handleClose = () => {
    setFormData({
      judul: '',
      deskripsi: '',
      file: undefined,
      prioritas: undefined as any,
    });
    setErrors({});
    setIsOpen(false);
    setIsMaximized(false);
    if (editMode && onEditComplete) {
      onEditComplete();
    }
  };

  const getFileNameFromUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    try {
      const urlObject = new URL(url);
      const pathname = urlObject.pathname;
      const parts = pathname.split('/');
      const fileName = parts[parts.length - 1];
      return fileName;
    } catch {
      return url;
    }
  };

  return (
    <div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {!editMode && (
          <DialogTrigger asChild>
            <Button
              variant="dark_blue"
              className="flex h-[50px] w-full items-center gap-2 rounded-xl border px-3 py-2 text-[18px] font-[600] font-semibold leading-[26px] lg:w-[201px]"
            >
              <Plus className="h-4 w-4" />
              Buat laporan
            </Button>
          </DialogTrigger>
        )}

        <DialogContent
          className={`max-h-[85vh] overflow-y-auto rounded-[20px] border bg-white p-0 [&>button]:hidden ${
            isMaximized
              ? 'left-1/2 top-1/2 h-[95vh] w-[95vw] max-w-none -translate-x-1/2 -translate-y-1/2'
              : 'left-1/2 top-1/2 w-[92vw] max-w-[460px] -translate-x-1/2 -translate-y-1/2 sm:w-[820px] sm:max-w-none'
          } `}
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            {editMode ? 'Edit Laporan' : 'Buat Laporan Baru'}
          </DialogTitle>
          <div className="flex flex-col gap-5 pb-4 pl-4 pr-4 pt-5 sm:gap-6 sm:pb-4 sm:pl-5 sm:pr-5 sm:pt-6">
            {/* Header */}
            <div className="flex w-full flex-col gap-4">
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex items-center gap-3">
                  <ChevronRight className="h-5 w-5 text-[#000000]" />
                  <span className="text-[16px] font-bold leading-[24px] text-[#636A6D]">
                    {editMode ? 'Edit Laporan' : 'Laporan draft baru'}
                  </span>
                </div>

                {/* Header Right Controls */}
                <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
                  {getFieldError('file') && (
                    <p className="order-2 max-w-[250px] text-sm leading-4 text-red-600 sm:order-none">
                      {getFieldError('file')}
                    </p>
                  )}

                  {!formData.file ? (
                    <CustomUploadButton
                      onUploadSuccess={handleFileUploadSuccess}
                      onError={handleFileUploadError}
                      isAdmin={!!isAdmin}
                      isFormSubmitting={isSubmitting}
                    />
                  ) : (
                    <div className="order-2 flex max-w-[200px] items-center gap-2 text-sm text-gray-600 sm:order-none">
                      <Paperclip className="!h-4 !w-4 rotate-45 text-gray-600" />
                      <span className="truncate">
                        {getFileNameFromUrl(formData.file) ?? 'File Terunggah'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1"
                        onClick={() => handleInputChange('file', undefined)}
                        disabled={isAdmin}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  )}

                  {/* Prioritas */}
                  <CustomFormField
                    error={getFieldError('prioritas')}
                    isPriority={true}
                  >
                    <div className="relative order-1 inline-block w-full sm:order-none sm:w-auto">
                      <Button
                        variant="outline"
                        onClick={() => setShowPrioritas(!showPrioritas)}
                        className="box-border h-auto w-full items-center gap-[3px] rounded-[12px] border border-neutral-700 px-3 py-2 text-[14px] font-bold text-neutral-700 sm:w-[172px]"
                        disabled={isAdmin}
                      >
                        {formData.prioritas
                          ? `Prioritas: ${
                              formData.prioritas.charAt(0).toUpperCase() +
                              formData.prioritas.slice(1)
                            }`
                          : 'Prioritas Urgensi'}
                        <ChevronDown className="!h-6 !w-5" />
                      </Button>

                      {showPrioritas && !isAdmin && (
                        <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-[12px] border border-neutral-700 bg-white shadow-lg sm:w-[172px]">
                          {[
                            {
                              label: 'Low',
                              value: 'Low',
                              color: 'bg-green-500',
                            },
                            {
                              label: 'Medium',
                              value: 'Medium',
                              color: 'bg-yellow-400',
                            },
                            {
                              label: 'High',
                              value: 'High',
                              color: 'bg-red-500',
                            },
                          ].map((option) => (
                            <div
                              key={option.value}
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  prioritas:
                                    option.value as LaporanSchema['prioritas'],
                                }));
                                setShowPrioritas(false);
                                setErrors((prev) => {
                                  const newErrors = { ...prev };
                                  delete newErrors.prioritas;
                                  return newErrors;
                                });
                              }}
                              className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:rounded-[12px] hover:bg-gray-100"
                            >
                              <span
                                className={`h-3 w-3 rounded-full ${option.color}`}
                              />
                              <span>{option.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CustomFormField>

                  {/* Simpan Draf */}
                  <Button
                    variant="outline"
                    className="box-border flex h-auto w-full items-center justify-center gap-[10px] rounded-[12px] border border-neutral-700 px-3 py-2 text-[14px] font-bold text-neutral-700 sm:w-auto"
                    disabled={true}
                  >
                    Draf
                  </Button>

                  {/* Maximize & Close */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="order-3 h-auto p-1 sm:order-none"
                  >
                    {isMaximized ? (
                      <Minimize2 className="!h-5 !w-5 text-gray-600" />
                    ) : (
                      <Maximize2 className="!h-5 !w-5 text-gray-600" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="h-auto p-1"
                  >
                    <X className="!h-6 !w-6 text-gray-600" />
                  </Button>
                </div>
              </div>

              {/* Form Content */}
              <div className="flex h-full w-full flex-col justify-between">
                <CustomFormField error={getFieldError('judul')}>
                  <Input
                    type="text"
                    value={formData.judul}
                    onChange={(e) => handleInputChange('judul', e.target.value)}
                    placeholder="Judul Laporan"
                    maxLength={50}
                    disabled={isAdmin}
                    className="h-[52px] w-full border-none p-[10px] text-[18px] font-bold leading-[26px] text-gray-700 shadow-none focus-visible:ring-0 sm:h-[56px] sm:text-[28px] sm:leading-[36px]"
                  />{' '}
                  {/*text-[#9DA4A8] awalnya*/}
                </CustomFormField>

                <CustomFormField error={getFieldError('deskripsi')}>
                  <Textarea
                    value={formData.deskripsi}
                    onChange={(e) =>
                      handleInputChange('deskripsi', e.target.value)
                    }
                    placeholder="Deskripsi"
                    maxLength={400}
                    rows={isMaximized ? 12 : 6}
                    disabled={isAdmin}
                    className={`w-full resize-none border-none p-[10px] !text-[15px] !font-[400] !leading-[22px] text-gray-600 shadow-none focus-visible:ring-0 sm:!text-[20px] sm:!leading-[28px] ${isMaximized ? 'min-h-[180px]' : 'min-h-[120px]'}`}
                  />
                </CustomFormField>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-2 flex w-full items-center justify-end sm:mt-0">
              <Button
                onClick={handleSubmit}
                variant="dark_blue"
                disabled={isAdmin ?? isSubmitting}
                className="h-[45px] w-full rounded-[12px] px-6 py-3 text-[17px] font-bold sm:w-[200px]"
              >
                {isSubmitting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Menyimpan...
                  </>
                ) : editMode ? (
                  'Update Draft'
                ) : (
                  'Buat draft laporan'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LaporanFormDialog;
