'use client';

import { env } from '~/env';
import type { FileAnswerItem } from '~/lib/forms/file-answer';
import {
  FILE_PROVIDER_LABELS,
  resolveFileProvider,
  type FileUploadContext,
} from '~/lib/forms/file-provider';
import {
  connectGoogleDrive,
  deleteFromGoogleDrive,
  hasGoogleDriveToken,
  prepareGoogleDrive,
  uploadToGoogleDrive,
} from '~/lib/forms/google-drive';
import { useUploadThing } from '~/utils/uploadthing';

/**
 * Titik masuk tunggal untuk upload jawaban berkas. Komponen form tidak perlu
 * tahu apakah file disimpan di UploadThing atau Google Drive.
 */
export function useFormFileUpload(): {
  providerId: 'uploadthing' | 'google-drive' | 'onedrive';
  providerLabel: string;
  upload: (
    file: File,
    context: FileUploadContext,
  ) => Promise<FileAnswerItem>;
  remove: (item: FileAnswerItem) => Promise<void>;
  /**
   * Penyedia yang butuh izin lewat popup (Google Drive). `connect` harus
   * dipanggil langsung dari penangan klik agar popup tidak diblokir browser.
   */
  needsConnect: boolean;
  isConnected: () => boolean;
  prepare: () => void;
  connect: () => Promise<void>;
} {
  const providerId = resolveFileProvider(env.NEXT_PUBLIC_FORM_FILE_PROVIDER);
  const { startUpload } = useUploadThing('formFile');

  const upload = async (file: File, context: FileUploadContext) => {
    if (providerId === 'google-drive') {
      return uploadToGoogleDrive(file, context);
    }
    if (providerId === 'onedrive') {
      throw new Error(
        'Provider OneDrive tidak lagi dipakai. Pilih uploadthing atau google-drive.',
      );
    }

    const uploaded = await startUpload([file], { formId: context.formId });
    const result = uploaded?.[0];
    if (!result) throw new Error('Berkas belum bisa diunggah. Coba lagi.');

    return {
      itemId: result.key,
      driveId: 'uploadthing',
      name: result.name,
      size: result.size,
      mime: result.type || file.type || 'application/octet-stream',
      url: result.ufsUrl,
      scope: 'anyone',
      provider: 'uploadthing',
    } satisfies FileAnswerItem;
  };

  /**
   * Hapus objek berkas di penyimpanan, sebisanya. Drive bisa dihapus dari
   * sisi pengisi; UploadThing butuh token server sehingga hanya referensinya
   * yang dilepas di sini. Pemanggil tetap menghapus item dari jawaban.
   */
  const remove = async (item: FileAnswerItem) => {
    if (item.provider === 'google-drive' && item.driveId === 'google-drive') {
      await deleteFromGoogleDrive(item.itemId);
    }
  };

  const needsConnect = providerId === 'google-drive';

  return {
    providerId,
    providerLabel: FILE_PROVIDER_LABELS[providerId],
    upload,
    remove,
    needsConnect,
    isConnected: () => !needsConnect || hasGoogleDriveToken(),
    prepare: () => {
      if (needsConnect) prepareGoogleDrive();
    },
    connect: () => (needsConnect ? connectGoogleDrive() : Promise.resolve()),
  };
}
