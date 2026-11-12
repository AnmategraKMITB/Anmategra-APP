// Library Impoty
import {api} from "~/trpc/server";
// Icons Import
import EventList from "~/app/lembaga/kegiatan/_components/kegiatan-container";
import { getServerAuthSession } from "~/server/auth";

export default async function Home() {

  // Get activities from API
  const events = await api.kegiatan.getAllByLembaga({
    lembagaId: (await getServerAuthSession())?.user.lembagaId ?? '',
    kind: 'kegiatan',
  });
  const formattedActivities = events.map((event) => ({
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

  const session = await getServerAuthSession();

  return (
      <main className="flex flex-row bg-[#FAFAFA] w-full">
        <EventList propEvents={formattedActivities} session={session}/>
      </main>
  );
}
