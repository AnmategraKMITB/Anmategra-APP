import { CalendarIcon, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import DummyFotoEvent from 'public/images/placeholder/profile-lembaga-kegiatan.png';
import DummyFotoLembaga from 'public/images/placeholder/profile-lembaga-kegiatan.png';
import { type FC } from 'react';
import { Badge } from '~/components/ui/badge';
import { Card } from '~/components/ui/card';

interface HighlightedEvent {
  id: string;
  name: string;
  image?: string | null;
  description?: string | null;
  start_date: Date;
  end_date?: Date | null;
  status: 'Coming Soon' | 'On going' | 'Ended';
  oprec_link?: string | null;
  background_image?: string | null;
  location?: string | null;
  participant_limit?: number;
  participant_count?: number;
  is_highlighted?: boolean;
  is_organogram?: boolean;
}

interface HighlightedEventCardProps {
  event: HighlightedEvent;
  lembagaData: {
    users: {
      id: string;
      image: string | null;
    };
    id: string;
    name: string;
    type: string | null;
    description: string | null;
    foundingDate: Date | null;
    endingDate: Date | null;
    memberCount: number | null;
  };
}

const HighlightedEventCard: FC<HighlightedEventCardProps> = ({
  event,
  lembagaData,
}) => {
  return (
    <Link href={`/lembaga/profile-kegiatan/${event.id}`}>
      <Card className="flex min-h-[180px] w-full max-w-7xl flex-col items-start overflow-hidden rounded-[16px] border-[0.86px] border-[#C4CACE] bg-white transition-all hover:shadow-md md:min-h-[180px] md:flex-row md:items-center md:rounded-[28px]">
        {/* Event Image */}
        <div className="relative h-[160px] w-full flex-shrink-0 md:h-[210px] md:w-[245px]">
          <Image
            src={event.image ?? DummyFotoEvent}
            alt="Poster Event Highlight"
            fill
            className="rounded-t-[16px] object-cover opacity-100 md:rounded-l-[28px] md:rounded-t-none"
            sizes="(max-width: 768px) 100vw, 245px"
          />
        </div>

        {/* Info Content */}
        <div className="flex min-h-[120px] flex-1 flex-col items-start justify-center gap-3 bg-white p-4 md:h-[122.4px] md:gap-[10.32px] md:px-[30.96px]">
          {/* Badge & Participant */}
          <div className="flex w-full flex-col items-start justify-between gap-2 md:flex-row md:items-center md:gap-0">
            <Badge className="flex flex-row items-center gap-2 rounded-xl bg-[#2B6282] px-3 py-2 md:gap-[6.88px] md:rounded-[13.76px] md:px-[10.32px] md:py-[3.44px]">
              <Image
                src={lembagaData?.users.image ?? DummyFotoLembaga}
                alt="Logo Lembaga"
                width={18}
                height={18}
                className="rounded-full object-cover md:h-[21px] md:w-[21px]"
              />
              <p className="text-xs font-bold leading-4 text-white md:text-[12px] md:leading-[16px]">
                {lembagaData?.name}
              </p>
            </Badge>

            <div className="flex flex-row items-center gap-2 text-sm leading-5 text-[#768085] md:gap-[6.88px] md:text-[14px] md:leading-[20px]">
              <Users
                width={18}
                height={18}
                className="fill-current text-[#768085] md:h-[21px] md:w-[21px]"
              />
              <p className="font-normal">{event.participant_count}</p>
            </div>
          </div>

          {/* Title & Description */}
          <div className="flex w-full flex-col gap-2 md:gap-[6.88px]">
            <p className="line-clamp-2 text-base font-bold leading-6 text-[#2B6282] md:line-clamp-1 md:text-[18px] md:leading-[26px]">
              {event.name}
            </p>
            {event.description && (
              <p className="line-clamp-2 text-sm leading-5 text-[#1E1E1E] md:line-clamp-1 md:text-[14px] md:leading-[20px]">
                {event.description}
              </p>
            )}
          </div>

          {/* Date, Location & Status */}
          <div className="flex flex-row items-center gap-2 text-sm leading-5 text-[#768085] md:gap-[6.88px] md:text-[14px] md:leading-[20px]">
            <CalendarIcon
              width={18}
              height={18}
              className="md:h-[21px] md:w-[21px]"
            />
            <p>
              {event.start_date.toLocaleDateString('id-ID', {
                month: 'short',
                year: 'numeric',
              })}
              -{' '}
              {event.end_date?.toLocaleDateString('id-ID', {
                month: 'short',
                year: 'numeric',
              }) ?? 'TBD'}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default HighlightedEventCard;
