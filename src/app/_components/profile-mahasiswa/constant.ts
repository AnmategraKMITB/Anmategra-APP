import { type Session } from 'next-auth';
import { type z } from 'zod';
import { type GetAllHistoryBestStaffMahasiswaOutputSchema } from '~/server/api/types/lembaga.type';
import { type GetMahasiswaOutputSchema } from '~/server/api/types/profile.type';
import { type Kepanitiaan } from '~/types/kepanitiaan';

type GetMahasiswaOutput = z.infer<typeof GetMahasiswaOutputSchema>;
type BestStaffHistoryOutput = z.infer<
  typeof GetAllHistoryBestStaffMahasiswaOutputSchema
>;

interface ProfileMahasiswaContentProps {
  session: Session | null;
  userId: string;
  mahasiswaData: GetMahasiswaOutput['mahasiswaData'];
  newestEvent: Kepanitiaan[] | null;
  memberLembaga?: GetMahasiswaOutput['memberLembaga'];
  isLembagaView: boolean;
  bestStaffData?: BestStaffHistoryOutput | null;
}

export type { ProfileMahasiswaContentProps };
