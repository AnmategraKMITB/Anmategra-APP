import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { keanggotaan, mahasiswa, users } from '~/server/db/schema';

export async function GET(
  request: Request,
  { params }: { params: { event_id: string } },
) {
  // --- Auth check ---
  const session = await getServerAuthSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'lembaga') {
    return Response.json({ error: 'Forbidden Resource' }, { status: 403 });
  }

  const { event_id } = params;
  if (!event_id) {
    return Response.json({ error: 'Missing event_id' }, { status: 400 });
  }

  // --- Validate lembaga ownership ---
  const userLembaga = await db.query.lembaga.findFirst({
    where: (l, { eq }) => eq(l.userId, session.user.id),
  });
  if (!userLembaga) {
    return Response.json({ error: 'Lembaga not found' }, { status: 404 });
  }

  // --- Validate event ---
  const kegiatan = await db.query.events.findFirst({
    where: (e, { eq }) => eq(e.id, event_id),
  });
  if (!kegiatan) {
    return Response.json({ error: 'Event not found' }, { status: 404 });
  }
  if (kegiatan.org_id !== userLembaga.id) {
    return Response.json({ error: 'Forbidden Resource' }, { status: 403 });
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
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'lembaga') {
    return Response.json({ error: 'Forbidden Resource' }, { status: 403 });
  }

  const { event_id } = params;
  if (!event_id) {
    return Response.json({ error: 'Missing event_id' }, { status: 400 });
  }

  // --- Validate lembaga ownership ---
  const userLembaga = await db.query.lembaga.findFirst({
    where: (l, { eq }) => eq(l.userId, session.user.id),
  });
  if (!userLembaga) {
    return Response.json({ error: 'Lembaga not found' }, { status: 404 });
  }

  // --- Validate event ---
  const kegiatan = await db.query.events.findFirst({
    where: (e, { eq }) => eq(e.id, event_id),
  });
  if (!kegiatan) {
    return Response.json({ error: 'Event not found' }, { status: 404 });
  }
  if (kegiatan.org_id !== userLembaga.id) {
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
    return Response.json(
      {
        error: 'Failed to import Excel data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
