import EventList from '~/app/lembaga/kegiatan/_components/kegiatan-container';
import { api } from '~/trpc/server';

import { requireManagedLembaga } from '../../_lib/require-lembaga';

const ManageKegiatanPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string }>;
}) => {
  const { lembagaId } = await params;
  const { session } = await requireManagedLembaga(lembagaId);
  const events = await api.kegiatan.getAllByLembaga({
    lembagaId,
    kind: 'kegiatan',
  });

  const propEvents = events.map((event) => ({
    id: event.id,
    name: event.name,
    description: event.description,
    start_date: event.start_date.toISOString(),
    end_date: event.end_date?.toISOString(),
    participant_count: event.participant_count,
    status: event.status,
    thumbnail: event.image,
    oprec_link: event.oprec_link,
    location: event.location,
    participant_limit: event.participant_limit,
    is_highlighted: event.is_highlighted,
    is_organogram: event.is_organogram,
    organogram_image: event.organogram_image,
    background_image: event.background_image,
    rapor_visible: event.rapor_visible,
  }));

  return (
    <main className="flex w-full flex-row bg-[#FAFAFA]">
      <EventList
        propEvents={propEvents}
        session={session}
        lembagaId={lembagaId}
        kegiatanBasePath={`/manage/${lembagaId}`}
      />
    </main>
  );
};

export default ManageKegiatanPage;
