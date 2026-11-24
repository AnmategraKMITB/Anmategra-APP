import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

interface ListSectionWrapperProps extends React.PropsWithChildren {
  className?: string;
  title: string;
  seeAllLink: string;
  hideSeeAll?: boolean;
}

export const ListSectionWrapper = ({
  className,
  title,
  children,
  seeAllLink,
  hideSeeAll = false,
}: ListSectionWrapperProps) => {
  return (
    <div
      className={cn('flex size-full flex-col gap-4 px-4 sm:px-12', className)}
    >
      <div className="flex w-full items-center justify-between gap-4">
        <span className="text-xl font-semibold text-[#0B5C8A]">{title}</span>
        {!hideSeeAll && (
          <Button asChild variant="ghost" className="flex items-center gap-2">
            <Link href={seeAllLink}>
              Lihat Semua
              <ChevronRight size={20} />
            </Link>
          </Button>
        )}
      </div>
      {children}
    </div>
  );
};
