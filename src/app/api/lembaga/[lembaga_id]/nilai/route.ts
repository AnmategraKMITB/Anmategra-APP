import { eq, inArray } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import {
  kehimpunan,
  mahasiswa,
  nilaiProfilLembaga,
  profilLembaga,
  users,
} from '~/server/db/schema';

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

  // --- Fetch profil lembaga data ---
  const profilLembagaList = await db.query.profilLembaga.findMany({
    where: (p, { eq }) => eq(p.lembagaId, lembaga_id),
  });

  if (profilLembagaList.length === 0) {
    return Response.json(
      { error: 'No profile criteria found for this organization' },
      { status: 404 },
    );
  }

  // --- Fetch anggota lembaga data ---
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

  // --- Fetch nilai profil data for all members ---
  const nilaiProfilData = await db.query.nilaiProfilLembaga.findMany({
    where: (n, { inArray }) =>
      inArray(
        n.profilId,
        profilLembagaList.map((p) => p.id),
      ),
    with: {
      mahasiswa: {
        with: {
          users: true,
        },
      },
      profilLembaga: true,
    },
  });

  // --- Build Excel workbook ---
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Nilai Profil Lembaga');

  // --- Create dynamic headers: Nama, NIM, then all profil names ---
  const headers = ['Nama', 'NIM', ...profilLembagaList.map((p) => p.name)];
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

  // --- Get unique members from anggota lembaga ---
  const uniqueMembers = anggotaLembaga.reduce(
    (acc, anggota) => {
      const userId = anggota.user?.id;
      if (userId && !acc.some((member) => member.user?.id === userId)) {
        acc.push(anggota);
      }
      return acc;
    },
    [] as typeof anggotaLembaga,
  );

  // --- Add data rows ---
  uniqueMembers.forEach((member) => {
    if (!member.user || !member.mahasiswa) return;

    const rowData = [
      member.user.name ?? '',
      member.mahasiswa.nim ?? '',
    ];

    // --- Add nilai for each profil ---
    profilLembagaList.forEach((profil) => {
      const nilai = nilaiProfilData.find((n) => {
        const m = n.mahasiswa as { userId: string };
        const p = n.profilLembaga as { id: string };
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
      'Content-Disposition': `attachment; filename=nilai-profil-${userLembaga.name || lembaga_id}.xlsx`,
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
      return Response.json({ error: 'Worksheet not found' }, { status: 400 });
    }

    // --- Get profil lembaga for this organization ---
    const profilLembagaList = await db.query.profilLembaga.findMany({
      where: eq(profilLembaga.lembagaId, lembaga_id),
    });

    if (profilLembagaList.length === 0) {
      return Response.json(
        { error: 'No profile criteria found for this organization' },
        { status: 404 },
      );
    }

    // --- Get header row to map profil columns ---
    const headerRow = sheet.getRow(1);
    const profilColumnMap: Record<string, number> = {};

    headerRow.eachCell((cell, colNumber) => {
      const cellText = cell.text?.trim();
      if (cellText && colNumber > 2) {
        // Skip Nama and NIM columns
        const matchingProfil = profilLembagaList.find(
          (p) => p.name === cellText,
        );
        if (matchingProfil) {
          profilColumnMap[matchingProfil.id] = colNumber;
        }
      }
    });

    // --- Get list of kehimpunan for this lembaga to validate NIMs ---
    const kehimpunanList = await db
      .select()
      .from(kehimpunan)
      .leftJoin(mahasiswa, eq(kehimpunan.userId, mahasiswa.userId))
      .where(eq(kehimpunan.lembagaId, lembaga_id));

    // --- Process data rows ---
    const mahasiswaIds: string[] = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);

      const nama = row.getCell(1).text?.trim();
      const nim = row.getCell(2).text?.trim();

      // Skip empty rows
      if (!nama && !nim) continue;

      if (!nim || !nama) {
        return Response.json(
          { error: `Row ${rowNumber}: Missing NIM or Nama` },
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
      if (mahasiswaUser.name !== nama) {
        return Response.json(
          {
            error: `Name mismatch for NIM ${nim}: expected ${mahasiswaUser.name}, got ${nama}.\n Please contact admin if this is an error.`,
          },
          { status: 400 },
        );
      }

      if (mahasiswaIds.some((a) => a === mahasiswaRecord.userId)) {
        return Response.json(
          {
            error: `Duplicate entry for NIM ${nim} in Excel file.`,
          },
          { status: 400 },
        );
      }

      // Find corresponding member from kehimpunan
      const member = kehimpunanList.find(
        (k) => k.mahasiswa?.nim?.toString() === nim,
      );
      if (!member?.kehimpunan) {
        return Response.json(
          {
            error: `Member with NIM ${nim} is not registered in this organization.`,
          },
          { status: 400 },
        );
      }
      mahasiswaIds.push(mahasiswaRecord.userId);
    }

    let processedCount = 0;

    await db.transaction(async (tx) => {
      // --- Delete existing nilai profil data for this lembaga ---
      await tx.delete(nilaiProfilLembaga).where(
        inArray(
          nilaiProfilLembaga.profilId,
          profilLembagaList.map((p) => p.id),
        ),
      );
      for (
        let rowNumber = 2;
        rowNumber <= sheet.rowCount && rowNumber - 2 < mahasiswaIds.length;
        rowNumber++
      ) {
        const row = sheet.getRow(rowNumber);
        // Insert nilai for each profil
        for (const profil of profilLembagaList) {
          const colNumber = profilColumnMap[profil.id];
          if (colNumber) {
            const nilaiText = row.getCell(colNumber).text?.trim();
            const nilaiValue = nilaiText ? parseInt(nilaiText) : 0;
            const mahasiswaId = mahasiswaIds[rowNumber - 2];

            if (!isNaN(nilaiValue) && mahasiswaId) {
              await tx.insert(nilaiProfilLembaga).values({
                id: crypto.randomUUID(),
                profilId: profil.id,
                mahasiswaId: mahasiswaId,
                nilai:  nilaiValue < 0 ? 0 : nilaiValue > 100 ? 100 : nilaiValue,
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
    return Response.json(
      {
        error: 'Failed to import Excel data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
