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
      <main className="flex min-h-screen flex-col p-8">
        <h1 className="mb-2 text-[32px] font-semibold">Rapor Anggota</h1>
        <div className="flex h-64 items-center justify-center">
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
    <main className="flex min-h-screen flex-col p-4 sm:p-6 md:p-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold sm:text-3xl md:text-[32px]">
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
