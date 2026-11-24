import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import RaporTable from '~/app/_components/rapor/rapor-table';
import RaporVisibilitySwitch from '~/app/_components/rapor/rapor-visibility-switch';
import { api } from '~/trpc/server';

import { requireManagedLembaga } from '../../../_lib/require-lembaga';

const ManageRaporPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string }>;
}) => {
  const { lembagaId } = await params;
  const { session } = await requireManagedLembaga(lembagaId);
  const base = `/manage/${lembagaId}`;

  const [profilKMData, info] = await Promise.all([
    api.profil.getAllProfilKM(),
    api.lembaga.getInfo({ lembagaId }),
  ]);
  const selectOptions = profilKMData.profil_km.map((profil) => ({
    value: profil.id,
    label: profil.description,
  }));

  return (
    <main className="flex min-h-screen flex-col p-4 sm:p-6 md:p-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold sm:text-3xl md:text-[32px]">
          Rapor Anggota {info?.nama ?? ''}
        </h1>
        <RaporVisibilitySwitch
          type="lembaga"
          id={lembagaId}
          initialValue={info?.raporVisible ?? false}
        />
      </div>
      <RaporBreadcrumb
        items={[
          { label: 'Anggota', href: `${base}/anggota` },
          { label: 'Rapor', href: `${base}/anggota/rapor` },
        ]}
      />
      <RaporTable
        session={session}
        lembaga_id={lembagaId}
        profilHref={`${base}/profil`}
        type="lembaga"
        selectOptions={selectOptions}
      />
    </main>
  );
};

export default ManageRaporPage;
