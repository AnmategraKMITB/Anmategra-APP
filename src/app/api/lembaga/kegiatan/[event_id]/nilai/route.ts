import { eq, inArray } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import {
  keanggotaan,
  mahasiswa,
  nilaiProfilKegiatan,
  profilKegiatan,
  users,
} from '~/server/db/schema';
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

  // --- Fetch profil kegiatan data ---
  const profilKegiatanList = await db.query.profilKegiatan.findMany({
    where: (p, { eq }) => eq(p.eventId, event_id),
  });

  if (profilKegiatanList.length === 0) {
    return apiError(404, 'No profile criteria found for this event', 'NOT_FOUND');
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

  // --- Fetch nilai profil data for all members ---
  const nilaiProfilData = await db.query.nilaiProfilKegiatan.findMany({
    where: (n, { inArray }) =>
      inArray(
        n.profilId,
        profilKegiatanList.map((p) => p.id),
      ),
    with: {
      mahasiswa: {
        with: {
          users: true,
        },
      },
      profilKegiatan: true,
    },
  });

  // --- Build Excel workbook ---
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Nilai Profil Kegiatan');

  // --- Create dynamic headers: Nama, NIM, then all profil names ---
  const headers = ['Nama', 'NIM', ...profilKegiatanList.map((p) => p.name)];
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

  // --- Get unique members from panitia kegiatan ---
  const uniqueMembers = panitiaKegiatan.reduce(
    (acc, panitia) => {
      const userId = panitia.user?.id;
      if (userId && !acc.some((member) => member.user?.id === userId)) {
        acc.push(panitia);
      }
      return acc;
    },
    [] as typeof panitiaKegiatan,
  );

  // --- Add data rows ---
  uniqueMembers.forEach((member) => {
    if (!member.user || !member.mahasiswa) return;

    const rowData = [
      member.user.name ?? '',
      member.mahasiswa.nim ?? '',
    ];

    // --- Add nilai for each profil ---
    profilKegiatanList.forEach((profil) => {
      const nilai = nilaiProfilData.find((n) => {
        const m = n.mahasiswa as { userId: string };
        const p = n.profilKegiatan as { id: string };
        return m.userId === member.user?.id && p.id === profil.id;
      });
      rowData.push(nilai?.nilai ?? 0);
    });

    const row = sheet.addRow(rowData);

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
      'Content-Disposition': `attachment; filename=nilai-profil-${kegiatan.name || event_id}.xlsx`,
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

    // --- Get profil kegiatan for this event ---
    const profilKegiatanList = await db.query.profilKegiatan.findMany({
      where: eq(profilKegiatan.eventId, event_id),
    });

    if (profilKegiatanList.length === 0) {
      return apiError(404, 'No profile criteria found for this event', 'NOT_FOUND');
    }

    // --- Get header row to map profil columns ---
    const headerRow = sheet.getRow(1);
    const profilColumnMap: Record<string, number> = {};

    headerRow.eachCell((cell, colNumber) => {
      const cellText = cell.text?.trim();
      if (cellText && colNumber > 2) {
        // Skip Nama and NIM columns
        const matchingProfil = profilKegiatanList.find(
          (p) => p.name === cellText,
        );
        if (matchingProfil) {
          profilColumnMap[matchingProfil.id] = colNumber;
        }
      }
    });

    const mahasiswaIds: string[] = [];
    // --- Get list of keanggotaan for this event to validate NIMs ---
    const keanggotaanList = await db
      .select()
      .from(keanggotaan)
      .leftJoin(mahasiswa, eq(keanggotaan.user_id, mahasiswa.userId))
      .where(eq(keanggotaan.event_id, event_id));

    // --- Process data rows ---

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);

      const nama = row.getCell(1).text?.trim();
      const nim = row.getCell(2).text?.trim();

      // Skip empty rows
      if (!nama && !nim) continue;

      if (!nim || !nama) {
        return apiError(
          400,
          `Row ${rowNumber}: Missing NIM or Nama`,
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

      if (mahasiswaIds.some((a) => a === mahasiswaRecord.userId)) {
        return apiError(
          400,
          `Duplicate entry for NIM ${nim} in Excel file.`,
          'VALIDATION_ERROR',
        );
      }

      // Find corresponding member from keanggotaan
      const member = keanggotaanList.find(
        (k) => k.mahasiswa?.nim?.toString() === nim,
      );
      if (!member?.keanggotaan) {
        return apiError(
          400,
          `Row ${rowNumber}: NIM ${nim} not found in event members`,
          'VALIDATION_ERROR',
        );
      }
      mahasiswaIds.push(mahasiswaRecord.userId);
    }

    let processedCount = 0;

    await db.transaction(async (tx) => {
      // --- Delete existing nilai profil data for this event ---
      await tx.delete(nilaiProfilKegiatan).where(
        inArray(
          nilaiProfilKegiatan.profilId,
          profilKegiatanList.map((p) => p.id),
        ),
      );
      for (
        let rowNumber = 2;
        rowNumber <= sheet.rowCount && rowNumber - 2 < mahasiswaIds.length;
        rowNumber++
      ) {
        const row = sheet.getRow(rowNumber);
        // Insert nilai for each profil
        for (const profil of profilKegiatanList) {
          const colNumber = profilColumnMap[profil.id];
          if (colNumber) {
            const nilaiText = row.getCell(colNumber).text?.trim();
            const nilaiValue = nilaiText ? parseInt(nilaiText) : 0;

            const mahasiswaId = mahasiswaIds[rowNumber - 2];
            if (!isNaN(nilaiValue) && mahasiswaId) {
              await tx.insert(nilaiProfilKegiatan).values({
                profilId: profil.id,
                mahasiswaId: mahasiswaId,
                nilai: nilaiValue < 0 ? 0 : nilaiValue > 100 ? 100 : nilaiValue,
              });
              processedCount++;
            }
          }
        }
      }
    });

    return Response.json(
      {
        success: true,
        message: `Successfully imported ${processedCount} profile scores`,
        data: {
          scoresImported: processedCount,
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
