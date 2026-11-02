import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import RaporTable from '~/app/_components/rapor/rapor-table';
import RaporVisibilitySwitch from '~/app/_components/rapor/rapor-visibility-switch';
import { getServerAuthSession } from '~/server/auth';
import { api } from '~/trpc/server';

interface RaporPageProps {
  params: Promise<{
    kegiatanId: string;
  }>;
}

export default async function RaporPage(props: RaporPageProps) {
  const params = await props.params;
  const session = await getServerAuthSession();
  const event_id = params.kegiatanId;

  if (!session || !event_id) {
    return (
      <main className="flex flex-col p-8 min-h-screen">
        <h1 className="text-[32px] font-semibold mb-2">Rapor Panitia</h1>
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

  const event = await api.event.getByID({ id: event_id });

  return (
    <main className="flex flex-col p-8 min-h-screen">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-[32px] font-semibold">
          Rapor Panitia {event?.name ?? ''}
        </h1>
        <RaporVisibilitySwitch
          type="event"
          id={event_id}
          initialValue={event?.rapor_visible ?? false}
        />
      </div>
      <RaporBreadcrumb
        items={[
          { label: 'Kegiatan', href: `/kegiatan/${event_id}/panitia` },
          { label: 'Rapor', href: `/kegiatan/${event_id}/rapor` },
        ]}
      />

      <RaporTable
        session={session}
        event_id={event_id}
        type="event"
        selectOptions={selectOptions}
      />
    </main>
  );
}
