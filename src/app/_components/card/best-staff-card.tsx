import Image, { type StaticImageData } from 'next/image';
import Link from 'next/link';
import YellowStarIcon from 'public/icons/yellow-star.svg';
import dummyProfile from 'public/images/placeholder/profile-pic.png';
import { Card } from '~/components/ui/card';

// const dummyData = {
//   nama: 'John Doe',
//   NIM: '111234567',
//   jurusan: 'Sastra Mesin',
//   profilePhoto: dummyProfile,
//   divisi: 'UI/UX'
// }

interface BestStaffCardProps {
  nama: string;
  NIM?: string;
  jurusan?: string;
  profilePicture?: StaticImageData | string | null;
  divisi: string;
  id_mahasiswa?: string;
  isLembaga?: boolean;
  subtitle?: string;
  disableLink?: boolean;
  targetType?: 'lembaga' | 'kegiatan';
  targetId?: string;
}

export default function BestStaffCard({
  nama = 'John Doe',
  NIM,
  jurusan,
  profilePicture = dummyProfile,
  divisi = 'UI/UX',
  id_mahasiswa,
  isLembaga = false,
  subtitle,
  disableLink = false,
  targetType,
  targetId,
}: BestStaffCardProps) {
  // const session = await getServerAuthSession();
  // const isLembaga = session?.user.role === 'lembaga';

  const namaSliced = nama.length > 22 ? nama.slice(0, 20) + '...' : nama;
  const divisiSliced =
    divisi.length > 28 ? divisi.slice(0, 20) + '...' : divisi;

  const cardContent = (
    <Card className="group flex max-h-[200px] w-60 flex-col items-center justify-center rounded-[20px] border border-[#E0E5E8] bg-white hover:cursor-pointer hover:bg-[#00B7B7]">
      <div className="flex h-full w-full">
        <div className="relative flex h-full w-full flex-col items-center justify-center">
          <div className="absolute left-[192px] top-[17px]">
            <Image
              src={YellowStarIcon}
              alt="Yellow Star Icon"
              width={36}
              height={36}
              className="object-cover"
            />
          </div>
          <div className="flex flex-col items-center justify-center px-1 py-[27px]">
            <div className="mb-[9px] h-16 w-16 overflow-hidden rounded-full border border-[#009292] group-hover:border-[#E0E5E8]">
              <Image
                src={profilePicture ?? dummyProfile}
                alt="Profile Picture"
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="text-center">
              <h1 className="text-xl font-bold text-[#009292] group-hover:text-white">
                {namaSliced}
              </h1>
              <p className="text-xs text-[#141718] group-hover:text-white">
                {subtitle ?? (NIM && jurusan ? `${NIM} - ${jurusan}` : '')}
              </p>
              <h2 className="font-semibold text-[#9DA4A8] group-hover:text-white">
                {divisiSliced}
              </h2>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );

  if (disableLink) {
    return cardContent;
  }

  if (targetType && targetId) {
    const href =
      targetType === 'lembaga'
        ? `/profile-lembaga/${targetId}`
        : `/profile-kegiatan/${targetId}`;
    return (
      <Link href={href} className="no-underline">
        {cardContent}
      </Link>
    );
  }

  if (id_mahasiswa) {
    return (
      <Link
        href={`/profile-mahasiswa/${id_mahasiswa}`}
        className="no-underline"
      >
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
