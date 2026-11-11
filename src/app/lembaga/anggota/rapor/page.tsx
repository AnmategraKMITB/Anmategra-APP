import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import RaporTable from '~/app/_components/rapor/rapor-table';
import RaporVisibilitySwitch from '~/app/_components/rapor/rapor-visibility-switch';
import { getServerAuthSession } from '~/server/auth';
import { api } from '~/trpc/server';

export default async function RaporPage() {
  const session = await getServerAuthSession();
  const lembaga_id = session?.user?.lembagaId ?? '';

  if (!session || !lembaga_id) {
    return (
      <main className="flex flex-col p-8 min-h-screen">
        <h1 className="text-[32px] font-semibold mb-2">Rapor Anggota</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </main>
    );
  }

  const profilKMData = await api.profil.getAllProfilKM();

  const selectOptions =
    profilKMData?.profil_km.map((profil) => ({
      value: profil.id,
      label: profil.description,
    })) ?? [];

  const lembaga = await api.lembaga.getInfo({
    lembagaId: lembaga_id,
  });

  return (
    <main className="flex flex-col p-4 sm:p-6 md:p-8 min-h-screen">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl sm:text-3xl md:text-[32px] font-semibold">
          Rapor Anggota {lembaga?.nama ?? ''}
        </h1>
        <RaporVisibilitySwitch
          type="lembaga"
          id={lembaga_id}
          initialValue={lembaga?.raporVisible ?? false}
        />
      </div>
      <RaporBreadcrumb
        items={[
          { label: 'Anggota', href: '/anggota' },
          { label: 'Rapor', href: '/anggota/rapor' },
        ]}
      />

      <RaporTable
        session={session}
        lembaga_id={lembaga_id}
        type="lembaga"
        selectOptions={selectOptions}
      />
    </main>
  );
}
