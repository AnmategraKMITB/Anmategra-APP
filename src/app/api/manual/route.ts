import { promises as fs } from 'fs';
import { NextResponse } from 'next/server';
import path from 'path';

import { getServerAuthSession } from '~/server/auth';

export async function GET() {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const filePath = path.join(process.cwd(), 'public', 'manual.pdf');
    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Manual_Anmategra.pdf"',
      },
    });
  } catch (error) {
    console.error('Error reading manual PDF:', error);
    return new NextResponse('Manual not found', { status: 404 });
  }
}
