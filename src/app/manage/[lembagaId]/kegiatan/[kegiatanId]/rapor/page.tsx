import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import RaporTable from '~/app/_components/rapor/rapor-table';
import RaporVisibilitySwitch from '~/app/_components/rapor/rapor-visibility-switch';
import { api } from '~/trpc/server';

import { requireManagedKegiatan } from '../../../../_lib/require-kegiatan';

const ManageKegiatanRaporPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string; kegiatanId: string }>;
}) => {
  const { lembagaId, kegiatanId } = await params;
  const { session, event } = await requireManagedKegiatan(
    lembagaId,
    kegiatanId,
  );
  const base = `/manage/${lembagaId}/kegiatan/${kegiatanId}`;

  const profilKMData = await api.profil.getAllProfilKM();
  const selectOptions = profilKMData.profil_km.map((profil) => ({
    value: profil.id,
    label: profil.description,
  }));

  return (
    <main className="flex flex-col p-8 min-h-screen">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-[32px] font-semibold">
          Rapor Panitia {event.name}
        </h1>
        <RaporVisibilitySwitch
          type="event"
          id={kegiatanId}
          lembagaId={lembagaId}
          initialValue={event.rapor_visible ?? false}
        />
      </div>
      <RaporBreadcrumb
        items={[
          { label: 'Kegiatan', href: `${base}/panitia` },
          { label: 'Rapor', href: `${base}/rapor` },
        ]}
      />
      <RaporTable
        session={session}
        event_id={kegiatanId}
        lembaga_id={lembagaId}
        profilHref={`${base}/profil`}
        type="event"
        selectOptions={selectOptions}
      />
    </main>
  );
};

export default ManageKegiatanRaporPage;
