import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { kehimpunan, mahasiswa, users } from '~/server/db/schema';

export async function GET(
  request: Request,
  { params }: { params: { lembaga_id: string } },
) {
  // --- Auth check ---
  const session = await getServerAuthSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'lembaga') {
    return Response.json({ error: 'Forbidden Resource' }, { status: 403 });
  }

  const { lembaga_id } = params;
  if (!lembaga_id) {
    return Response.json({ error: 'Missing lembaga_id' }, { status: 400 });
  }

  // --- Validate lembaga ownership ---
  const userLembaga = await db.query.lembaga.findFirst({
    where: (l, { eq }) => eq(l.userId, session.user.id),
  });
  if (!userLembaga) {
    return Response.json({ error: 'Lembaga not found' }, { status: 404 });
  }

  // --- Validate lembaga_id matches user's lembaga ---
  if (userLembaga.id !== lembaga_id) {
    return Response.json({ error: 'Forbidden Resource' }, { status: 403 });
  }

  // --- Fetch lembaga member data ---
  const anggotaLembaga = await db
    .select()
    .from(kehimpunan)
    .leftJoin(users, eq(kehimpunan.userId, users.id))
    .leftJoin(mahasiswa, eq(kehimpunan.userId, mahasiswa.userId))
    .where(eq(kehimpunan.lembagaId, lembaga_id))
    .orderBy(
      kehimpunan.index,
      kehimpunan.division,
      kehimpunan.position,
      mahasiswa.nim,
      users.name,
    );

  // --- Build Excel workbook ---
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Anggota Lembaga');

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
  anggotaLembaga.forEach((anggota) => {
    const row = sheet.addRow([
      anggota.user?.name ?? '',
      anggota.mahasiswa?.nim ?? '',
      anggota.kehimpunan.division ?? '',
      anggota.kehimpunan.position ?? 'Anggota',
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
      'Content-Disposition': `attachment; filename=anggota-${userLembaga.name || lembaga_id}.xlsx`,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: { lembaga_id: string } },
) {
  // --- Auth check ---
  const session = await getServerAuthSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'lembaga') {
    return Response.json({ error: 'Forbidden Resource' }, { status: 403 });
  }

  const { lembaga_id } = params;
  if (!lembaga_id) {
    return Response.json({ error: 'Missing lembaga_id' }, { status: 400 });
  }

  // --- Validate lembaga ownership ---
  const userLembaga = await db.query.lembaga.findFirst({
    where: (l, { eq }) => eq(l.userId, session.user.id),
  });
  if (!userLembaga) {
    return Response.json({ error: 'Lembaga not found' }, { status: 404 });
  }

  // --- Validate lembaga_id matches user's lembaga ---
  if (userLembaga.id !== lembaga_id) {
    return Response.json({ error: 'Forbidden Resource' }, { status: 403 });
  }

  try {
    // --- Parse form data to get the Excel file ---
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!/\.(xlsx|xls)$/.exec(file.name)) {
      return Response.json(
        {
          error:
            'Invalid file format. Please upload Excel file (.xlsx or .xls)',
        },
        { status: 400 },
      );
    }

    // --- Read Excel file ---
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // --- Get worksheet ---
    const sheet = workbook.getWorksheet();

    if (!sheet) {
      return Response.json(
        { error: 'Worksheet not found' },
        { status: 400 },
      );
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
        return Response.json(
          {
            error: `Row ${rowNumber}: Missing required data (Nama, NIM, Divisi, Posisi)`,
          },
          { status: 400 },
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
        return Response.json(
          {
            error: `Student with NIM ${nim} not found in database. Please contact admin if this is an error.`,
          },
          { status: 400 },
        );
      }

      const mahasiswaUser = mahasiswaRecord.users as { name: string | null };
      const expectedName = mahasiswaUser.name?.toLocaleLowerCase();
      const actualName = nama.toLocaleLowerCase();
      if (expectedName !== actualName) {
        return Response.json(
          {
            error: `Name mismatch for NIM ${nim}: expected ${mahasiswaUser.name}, got ${nama}.\n Please contact admin if this is an error.`,
          },
          { status: 400 },
        );
      }

      if (anggotaData.some((a) => a.userId === mahasiswaRecord.userId)) {
        return Response.json(
          {
            error: `Duplicate entry for NIM ${nim} in Excel file.`,
          },
          { status: 400 },
        );
      }

      anggotaData.push({ userId: mahasiswaRecord.userId, divisi, posisi, index: rowNumber - 2 });
    }

    if (anggotaData.length === 0) {
      return Response.json(
        { error: 'No member data found in Excel file' },
        { status: 400 },
      );
    }
    // --- Find users and insert kehimpunan ---
    let insertedCount = 0;
    await db.transaction(async (tx) => {
      // --- Delete existing data for this lembaga ---
      await tx.delete(kehimpunan).where(eq(kehimpunan.lembagaId, lembaga_id));

      for (const anggota of anggotaData) {
        // Insert kehimpunan
        await tx.insert(kehimpunan).values({
          // id: kehimpunanId,
          lembagaId: lembaga_id,
          userId: anggota.userId,
          position: anggota.posisi,
          division: anggota.divisi,
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
    return Response.json(
      {
        error: 'Failed to import Excel data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
