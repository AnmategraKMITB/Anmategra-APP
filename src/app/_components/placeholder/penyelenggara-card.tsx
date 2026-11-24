import Image from 'next/image';

interface PenyelenggaraCardProps {
  title: string;
  category: string;
  logo: string;
}

export const PenyelenggaraCard: React.FC<PenyelenggaraCardProps> = ({
  title,
  category,
  logo,
}) => {
  return (
    <div className="flex w-3/4 cursor-pointer items-center gap-4 rounded-2xl border border-[#C4CACE] bg-white px-7 py-5 hover:shadow-md md:w-1/2">
      <div className="h-8 w-8 overflow-hidden rounded-full sm:h-16 sm:w-16 md:h-20 md:w-20">
        <Image
          src={logo}
          alt={`${title} logo`}
          width={80}
          height={80}
          className="h-8 w-8 object-cover sm:h-16 sm:w-16 md:h-20 md:w-20"
        />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[#2B6282] sm:text-lg md:text-xl">
          {title}
        </h3>
        <p className="text-xs text-[#768085] sm:text-base md:text-lg">
          {category}
        </p>
      </div>
    </div>
  );
};
