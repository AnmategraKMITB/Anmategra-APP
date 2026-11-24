'use client';

// import { useSession } from 'next-auth/react';
import InboxTable from '~/app/mahasiswa/inbox/_components/inbox-table';
import ResultNotifications from '~/app/mahasiswa/inbox/_components/result-notifications';
import { api } from '~/trpc/react';

export default function MahasiswaInboxPage() {
  // const { data: session } = useSession();

  const { data: eventRequests, isLoading: isLoadingEvents } =
    api.users.getMyRequestAssociation.useQuery(undefined, {
      // enabled: !!session,
    });

  const { data: lembagaRequests, isLoading: isLoadingLembaga } =
    api.users.getMyRequestAssociationLembaga.useQuery(undefined, {
      // enabled: !!session,
    });

  const isLoading = isLoadingEvents || isLoadingLembaga;

  return (
    <main className="flex min-h-screen flex-col bg-[#FAFAFA] px-4 sm:px-8">
      <ResultNotifications />
      <h1 className="mb-6 text-[28px] font-semibold sm:text-[32px]">
        Pengajuan Asosiasi
      </h1>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-lg text-neutral-500">Loading...</div>
        </div>
      ) : (
        <InboxTable
          eventRequests={eventRequests ?? []}
          lembagaRequests={lembagaRequests ?? []}
        />
      )}
    </main>
  );
}
