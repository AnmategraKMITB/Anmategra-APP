import { Card, CardContent } from '~/components/ui/card';

export type NilaiProfilCardType = {
  nilai?: number | null;
  name: string;
};

export default function NilaiProfilCard({
  nilai = 100,
  name = 'Profil 1',
}: NilaiProfilCardType) {
  return (
    <Card className="flex min-h-[90px] w-full flex-shrink-0 flex-col items-center justify-center gap-2 sm:min-h-[100px] sm:w-[130px] sm:gap-[10px] md:min-h-[110px] md:w-[144px]">
      <CardContent className="flex flex-col items-center justify-center px-4 py-3 sm:px-5 sm:py-4 md:px-[25.8px] md:py-[17.2px]">
        <div className="text-center text-sm text-neutral-600 sm:text-base md:text-[18px]">
          {name}
        </div>
        <div className="text-2xl font-medium text-[#2B6282] sm:text-3xl md:text-[32px]">
          {nilai}
        </div>
      </CardContent>
    </Card>
  );
}
