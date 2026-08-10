import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { keanggotaan, mahasiswa, users } from '~/server/db/schema';
import { apiError } from '~/utils/api-error';

export async function GET(
  request: Request,
  { params }: { params: { event_id: string } },
) {
  // --- Auth check ---
  const session = await getServerAuthSession();
  if (!session) {
    return apiError(401, 'Unauthorized', 'UNAUTHORIZED');
  }
  if (session.user.role !== 'lembaga') {
    return apiError(403, 'Forbidden Resource', 'FORBIDDEN');
  }

  const { event_id } = params;
  if (!event_id) {
    return apiError(400, 'Missing event_id', 'BAD_REQUEST');
  }

  // --- Validate lembaga ownership ---
  const userLembaga = await db.query.lembaga.findFirst({
    where: (l, { eq }) => eq(l.userId, session.user.id),
  });
  if (!userLembaga) {
    return apiError(404, 'Lembaga not found', 'NOT_FOUND');
  }

  // --- Validate event ---
  const kegiatan = await db.query.events.findFirst({
    where: (e, { eq }) => eq(e.id, event_id),
  });
  if (!kegiatan) {
    return apiError(404, 'Event not found', 'NOT_FOUND');
  }
  if (kegiatan.org_id !== userLembaga.id) {
    return apiError(403, 'Forbidden Resource', 'FORBIDDEN');
  }

  // --- Fetch panitia data ---
  const panitiaKegiatan = await db
    .select()
    .from(keanggotaan)
    .leftJoin(users, eq(keanggotaan.user_id, users.id))
    .leftJoin(mahasiswa, eq(keanggotaan.user_id, mahasiswa.userId))
    .where(eq(keanggotaan.event_id, event_id))
    .orderBy(
      keanggotaan.index,
      keanggotaan.division,
      keanggotaan.position,
      mahasiswa.nim,
      users.name,
    );

  // --- Build Excel workbook ---
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Anggota Kegiatan');

  // --- Add headers ---
  const headers = ['Nama', 'NIM', 'Divisi', 'Posisi'];
  const headerRow = sheet.addRow(headers);

  // --- Style headers ---
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // --- Add data rows ---
  panitiaKegiatan.forEach((panitia) => {
    const row = sheet.addRow([
      panitia.user?.name ?? '',
      panitia.mahasiswa?.nim ?? '',
      panitia.keanggotaan.division ?? '',
      panitia.keanggotaan.position ?? 'Anggota',
    ]);

    // --- Add borders to data rows ---
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // --- Auto-adjust column widths ---
  sheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value =
        typeof cell.value === 'object' && cell.value !== null
          ? JSON.stringify(cell.value)
          : (cell.value ?? '');
      const columnLength = value.toString().length || 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = maxLength < 10 ? 10 : maxLength + 2;
  });

  // --- Write buffer ---
  const buffer = await workbook.xlsx.writeBuffer();

  // --- Return file response ---
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=anggota-${kegiatan.name || event_id}.xlsx`,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: { event_id: string } },
) {
  // --- Auth check ---
  const session = await getServerAuthSession();
  if (!session) {
    return apiError(401, 'Unauthorized', 'UNAUTHORIZED');
  }
  if (session.user.role !== 'lembaga') {
    return apiError(403, 'Forbidden Resource', 'FORBIDDEN');
  }

  const { event_id } = params;
  if (!event_id) {
    return apiError(400, 'Missing event_id', 'BAD_REQUEST');
  }

  // --- Validate lembaga ownership ---
  const userLembaga = await db.query.lembaga.findFirst({
    where: (l, { eq }) => eq(l.userId, session.user.id),
  });
  if (!userLembaga) {
    return apiError(404, 'Lembaga not found', 'NOT_FOUND');
  }

  // --- Validate event ---
  const kegiatan = await db.query.events.findFirst({
    where: (e, { eq }) => eq(e.id, event_id),
  });
  if (!kegiatan) {
    return apiError(404, 'Event not found', 'NOT_FOUND');
  }
  if (kegiatan.org_id !== userLembaga.id) {
    return apiError(403, 'Forbidden Resource', 'FORBIDDEN');
  }

  try {
    // --- Parse form data to get the Excel file ---
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return apiError(400, 'No file provided', 'BAD_REQUEST');
    }

    if (!/\.(xlsx|xls)$/.exec(file.name)) {
      return apiError(
        400,
        'Invalid file format. Please upload Excel file (.xlsx or .xls)',
        'BAD_REQUEST',
      );
    }

    // --- Read Excel file ---
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // --- Get worksheet ---
    const sheet = workbook.getWorksheet();

    if (!sheet) {
      return apiError(400, 'Worksheet not found', 'BAD_REQUEST');
    }

    // --- Process sheet data ---
    const anggotaData: Array<{
      userId: string;
      divisi: string;
      posisi: string;
      index: number;
    }> = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);

      const nama = row.getCell(1).text?.trim();
      const nim = row.getCell(2).text?.trim();
      const divisi = row.getCell(3).text?.trim();
      const posisi = row.getCell(4).text?.trim();

      // Skip empty rows
      if (!nama && !nim && !divisi && !posisi) continue;

      if (!nama || !nim || !divisi || !posisi) {
        return apiError(
          400,
          `Row ${rowNumber}: Missing required data (Nama, NIM, Divisi, Posisi)`,
          'VALIDATION_ERROR',
        );
      }
      // Find mahasiswa by NIM
      const mahasiswaRecord = await db.query.mahasiswa.findFirst({
        where: eq(mahasiswa.nim, parseInt(nim)),
        with: {
          users: true,
        },
      });

      if (!mahasiswaRecord) {
        return apiError(
          400,
          `Student with NIM ${nim} not found in database. Please contact admin if this is an error.`,
          'VALIDATION_ERROR',
        );
      }
      const mahasiswaUser = mahasiswaRecord.users as { name: string | null };
      const expectedName = mahasiswaUser.name?.toLocaleLowerCase();
      const actualName = nama.toLocaleLowerCase();
      if (expectedName !== actualName) {
        return apiError(
          400,
          `Name mismatch for NIM ${nim}: expected ${mahasiswaUser.name}, got ${nama}.\n Please contact admin if this is an error.`,
          'VALIDATION_ERROR',
        );
      }

      if (anggotaData.some((a) => a.userId === mahasiswaRecord.userId)) {
        return apiError(
          400,
          `Duplicate entry for NIM ${nim} in Excel file.`,
          'VALIDATION_ERROR',
        );
      }

      anggotaData.push({ userId: mahasiswaRecord.userId, divisi, posisi, index: rowNumber - 2 });
    }

    if (anggotaData.length === 0) {
      return apiError(400, 'No member data found in Excel file', 'VALIDATION_ERROR');
    }

    // --- Find users and insert keanggotaan ---
    let insertedCount = 0;

    await db.transaction(async (tx) => {
      // --- Delete existing data for this event ---
      await tx.delete(keanggotaan).where(eq(keanggotaan.event_id, event_id));
      for (const anggota of anggotaData) {
        // Insert keanggotaan
        const keanggotaanId = crypto.randomUUID();
        await tx.insert(keanggotaan).values({
          id: keanggotaanId,
          event_id: event_id,
          user_id: anggota.userId,
          position: anggota.posisi,
          division: anggota.divisi,
          description: null,
          index: anggota.index,
        });

        insertedCount++;
      }
    });

    return Response.json(
      {
        success: true,
        message: `Successfully imported ${insertedCount} members`,
        data: {
          membersImported: insertedCount,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error importing Excel data:', error);
    return apiError(
      500,
      'Failed to import Excel data',
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
