'use client';

// Library Import
// Icons Import
import { CalendarIcon, PersonIcon } from '@radix-ui/react-icons';
import dayjs from 'dayjs';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
// Components Import
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
// Utils Import
import { cn } from '~/lib/utils';
// Types Import
import type { Kepanitiaan } from '~/types/kepanitiaan';

interface KepanitiaanCardProps {
  kepanitiaan: Kepanitiaan;
  orientation?: 'vertical' | 'horizontal';
  showRaporLink?: boolean;
  mahasiswaId?: string;
  raporVisible?: boolean;
}

export const KepanitiaanCard = ({
  kepanitiaan,
  orientation = 'vertical',
  showRaporLink = false,
  mahasiswaId,
  raporVisible = false,
}: KepanitiaanCardProps) => {
  const router = useRouter();

  return (
    <Card
      className={cn(
        'flex h-[350px] w-full cursor-pointer overflow-hidden transition-shadow ease-out hover:shadow-md',
        orientation === 'vertical' && 'flex-col',
        orientation === 'horizontal' && 'flex-row',
      )}
    >
      <div
        className={cn(
          'relative h-[250px] w-full overflow-hidden',
          orientation === 'vertical' && 'aspect-[2.35]',
          orientation === 'horizontal' && 'aspect-square max-w-52',
        )}
      >
        <Image
          src={
            kepanitiaan.image ?? '/images/placeholder/profile-lembaga-kegiatan.png'
          }
          alt={kepanitiaan.lembaga.name}
          className="object-cover object-top"
          fill
          sizes="(max-width: 768px) 100vw, 250px"
        />
      </div>
      <div className="relative flex h-full w-full flex-col gap-[0.6rem] px-6 py-5">
        <div className="flex w-fit items-center gap-2 rounded-full bg-primary-400 px-3 py-1 text-[0.7rem] text-white">
          <Avatar className="size-4 bg-white">
            <AvatarImage
              className="object-cover"
              src={
                kepanitiaan.lembaga.profilePicture ??
                '/images/placeholder/profile-lembaga-kegiatan.png'
              }
              alt={kepanitiaan.lembaga.name}
            />
            <AvatarFallback>
              {kepanitiaan.lembaga.name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <span className="line-clamp-1 font-semibold">
            {kepanitiaan.lembaga.name}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="line-clamp-2 text-lg font-semibold leading-tight text-primary-400">
            {kepanitiaan.name}
          </span>
          <div className="flex items-center gap-1 text-sm text-Regent-Gray">
            <PersonIcon />
            {kepanitiaan.anggotaCount <= 0 ? '0' : kepanitiaan.anggotaCount}
          </div>
        </div>
        <p className="line-clamp-2 text-sm leading-tight xl:line-clamp-3">
          {kepanitiaan.description}
        </p>
        <p className="line-clamp-1 text-sm font-medium text-primary-400">
          {kepanitiaan.position && kepanitiaan.division && (
            <span className="font-semibold">
              {kepanitiaan.position} | {kepanitiaan.division}
            </span>
          )}
        </p>
        <div className="mt-auto flex items-center gap-1 text-sm text-Regent-Gray">
          <CalendarIcon />
          <span className="line-clamp-1">
            {kepanitiaan.startDate
              ? dayjs(kepanitiaan.startDate).format('MMM YYYY')
              : '—'}{' '}
            -{' '}
            {kepanitiaan.endDate
              ? dayjs(kepanitiaan.endDate).format('MMM YYYY')
              : 'Sekarang'}
          </span>
        </div>
        {showRaporLink && raporVisible && mahasiswaId && (
          <Button
            variant="link"
            className="text-sm font-semibold text-emerald-600 hover:underline p-0 justify-start"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              router.push(`/profile-kegiatan/${kepanitiaan.id}/rapor/${mahasiswaId}`);
            }}
          >
            Lihat Rapor →
          </Button>
        )}
      </div>
    </Card>
  );
};
