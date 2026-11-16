'use client';

import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

/**
 * Tombol menuju halaman Kelola Admin. Hanya tampil untuk Owner dan Admin
 * Lembaga; anggota biasa dan Admin Kepanitiaan tidak melihatnya.
 */
export default function KelolaAdminButton({
  href,
  lembagaId,
  eventId,
}: {
  href: string;
  lembagaId?: string;
  eventId?: string;
}) {
  const { data: access } = api.adminGrant.getKelolaAdminAccess.useQuery({
    lembagaId,
    eventId,
  });
  if (!access) return null;
  return (
    <Button asChild variant="outline" className="w-fit gap-2">
      <Link href={href}>
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Kelola Admin
      </Link>
    </Button>
  );
}
