import type { Lembaga } from './lembaga';

export interface Kepanitiaan {
  lembaga: Lembaga;
  id?: string;
  name: string;
  image: string | null;
  description: string | null;
  anggotaCount: number;
  startDate: Date | null;
  endDate: Date | null;
  position?: string;
  division?: string;
  raporVisible?: boolean;
}
