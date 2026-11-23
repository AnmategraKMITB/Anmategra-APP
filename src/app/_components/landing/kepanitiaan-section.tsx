import Link from 'next/link';
import { type Kepanitiaan } from '~/types/kepanitiaan';

import { KepanitiaanCard } from '../card/kepanitiaan-card';
import { ListSectionWrapper } from './list-section-wrapper';

export const KepanitiaanSection = ({
  data,
  hideSeeAll,
}: {
  data: Kepanitiaan[];
  hideSeeAll?: boolean;
}) => {
  return (
    <ListSectionWrapper
      className="container mx-auto"
      title="Kegiatan Terbesar"
      seeAllLink="/mahasiswa/kegiatan"
      hideSeeAll={hideSeeAll}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((kepanitiaan) => (
          <Link
            key={kepanitiaan.name + kepanitiaan.description}
            href={`profile-kegiatan/${kepanitiaan.id}`}
          >
            <KepanitiaanCard kepanitiaan={kepanitiaan} orientation="vertical" />
          </Link>
        ))}
        {!data ||
          (data.length === 0 && (
            <div>
              <p className="text-slate-600">
                Tidak ada kepanitiaan terbaru yang dapat ditampilkan.
              </p>
            </div>
          ))}
      </div>
    </ListSectionWrapper>
  );
};
