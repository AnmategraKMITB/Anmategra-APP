import { eq } from 'drizzle-orm';
import { type FileRouter, createUploadthing } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { z } from 'zod';
import { loadManagedForm } from '~/app/_components/forms/access';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { form, formImage } from '~/server/db/schema';
import { isAcceptingResponses } from '~/server/api/routers/form/services';

const f = createUploadthing();
// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  imageUploader: f({
    image: {
      /**
       * For full list of options and defaults, see the File Route API reference
       * @see https://docs.uploadthing.com/file-routes#route-config
       */
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
  })
    // Set permissions and file types for this FileRoute
    .middleware(async () => {
      // This code runs on your server before upload
      const user = await getServerAuthSession();

      // If you throw, the user will not be able to upload
      if (!user) {
        throw new UploadThingError(
          'You must be logged in to upload images',
        ) as Error;
      }

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return { userId: user.user.id };
    })
    .onUploadComplete(async ({ metadata }) => {
      // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
      return { uploadedBy: metadata.userId };
    }),

  /**
   * Gambar dekoratif form (banner, logo, ilustrasi pertanyaan). Hanya PNG,
   * JPEG, dan WEBP (SVG ditolak karena bisa memuat skrip); pengunggah harus
   * boleh mengelola form itu.
   */
  formImage: f({
    'image/png': { maxFileSize: '4MB', maxFileCount: 1 },
    'image/jpeg': { maxFileSize: '4MB', maxFileCount: 1 },
    'image/webp': { maxFileSize: '4MB', maxFileCount: 1 },
  })
    .input(z.object({ formId: z.string().min(1).max(255) }))
    .middleware(async ({ input }) => {
      const managed = await loadManagedForm(input.formId);
      if (!managed) {
        throw new UploadThingError(
          'Kamu tidak boleh mengunggah gambar untuk form ini.',
        ) as Error;
      }
      // Jangan set `customId` ke formId: UploadThing mewajibkan customId unik
      // per file, sehingga gambar kedua untuk form yang sama ditolak 409.
      // Kepemilikan tetap dicatat di tabel `formImage` lewat onUploadComplete.
      return { formId: input.formId };
    })
    .onUploadComplete(async ({ file, metadata }) => {
      // Catat kepemilikan sebelum klien menyimpan URL-nya. Hanya kunci yang
      // tercatat di sini yang boleh dipakai atau dihapus lewat endpoint form.
      // Jangan telan galat: tanpa baris ini gambar tidak akan bisa disimpan,
      // jadi lebih baik unggahan dilaporkan gagal sekarang.
      const formId = metadata.formId;
      await db
        .insert(formImage)
        .values({
          key: file.key,
          formId,
          url: file.ufsUrl,
        })
        .onConflictDoNothing();
      return { url: file.ufsUrl, key: file.key };
    }),

  /**
   * Berkas jawaban pertanyaan `file`. Opsi A: public-read, jadi URL dapat
   * dibuka siapa pun yang memilikinya. Hanya boleh dipakai untuk berkas yang
   * memang boleh publik.
   */
  formFile: f(
    {
      pdf: { maxFileSize: '16MB', maxFileCount: 5 },
      'application/msword': { maxFileSize: '16MB', maxFileCount: 5 },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        maxFileSize: '16MB',
        maxFileCount: 5,
      },
      'application/vnd.ms-excel': { maxFileSize: '16MB', maxFileCount: 5 },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        maxFileSize: '16MB',
        maxFileCount: 5,
      },
      'application/vnd.ms-powerpoint': { maxFileSize: '16MB', maxFileCount: 5 },
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
        maxFileSize: '16MB',
        maxFileCount: 5,
      },
      'application/zip': { maxFileSize: '16MB', maxFileCount: 5 },
    },
  )
    .input(z.object({ formId: z.string().min(1).max(255) }))
    .middleware(async ({ input }) => {
      const session = await getServerAuthSession();
      if (!session) {
        throw new UploadThingError('Harus login untuk mengunggah berkas.') as Error;
      }
      const [row] = await db.select().from(form).where(eq(form.id, input.formId)).limit(1);
      if (!row) {
        throw new UploadThingError('Formulir tidak ditemukan.') as Error;
      }
      if (!isAcceptingResponses(row)) {
        throw new UploadThingError('Formulir sudah tidak menerima jawaban.') as Error;
      }
      // Sama seperti formImage: customId harus unik per file. Memakai formId
      // membuat unggahan kedua untuk form yang sama ditolak 409.
      return {
        formId: input.formId,
        userId: session.user.id,
      };
    })
    .onUploadComplete(async ({ file }) => {
      return {
        key: file.key,
        url: file.ufsUrl,
        name: file.name,
        size: file.size,
        mime: file.type,
        scope: 'anyone' as const,
      };
    }),

  reportAttachment: f({
    pdf: {
      maxFileSize: '16MB',
      maxFileCount: 1,
    },
    'application/zip': {
      maxFileSize: '32MB',
      maxFileCount: 1,
    },
    'application/x-7z-compressed': {
      maxFileSize: '32MB',
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const user = await getServerAuthSession();
      if (!user) {
        throw new UploadThingError(
          'You must be logged in to upload report attachments',
        ) as Error;
      }
      return { userId: user.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedBy: metadata.userId,
        fileUrl: file.url,
        fileName: file.name,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
