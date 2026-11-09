import { ApplicantsPage } from '~/app/_components/oprec/applicants-page';

const PendaftarPage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string; recruitmentId: string }>;
}) => {
  const { kegiatanId, recruitmentId } = await params;
  return (
    <ApplicantsPage
      kegiatanId={kegiatanId}
      recruitmentId={recruitmentId}
      basePath="/mahasiswa"
    />
  );
};

export default PendaftarPage;
