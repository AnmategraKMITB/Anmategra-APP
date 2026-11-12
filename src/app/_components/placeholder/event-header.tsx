'use client';

import { X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AjuanAsosiasiForm from '~/app/lembaga/profile-kegiatan/_components/ajuan-asosiasi-form';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import type { Session } from 'next-auth';
import { api } from '~/trpc/react';
import { useToast } from '~/hooks/use-toast';

interface EventHeaderProps {
  title: string;
  organizer: string;
  backgroundImage: string;
  logoImage: string;
  eventId?: string;
  linkDaftar?: string | null;
  ajuanAsosiasi?: boolean;
  session?: Session | null;
}

export function EventHeader({
  title,
  organizer,
  backgroundImage,
  logoImage,
  eventId,
  linkDaftar,
  ajuanAsosiasi,
  session,
}: EventHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const toast = useToast();

  const { data: myRequests } = api.users.getMyRequestAssociation.useQuery(
    undefined,
    { enabled: Boolean(eventId) && !!session },
  );

  const matchingRequest = useMemo(
    () => myRequests?.find((r) => r.event_id === eventId),
    [myRequests, eventId],
  );

  useEffect(() => {
    if (matchingRequest) {
      setIsSubmitted(matchingRequest.status !== 'Declined');
    } else {
      setIsSubmitted(false);
    }
  }, [matchingRequest]);

  const utils = api.useUtils();
  const deleteAssociationMutation =
    api.users.deleteRequestAssociation.useMutation({
      onSuccess: async () => {
        setIsSubmitted(false);
        setShowConfirmation(false);
        await utils.users.getMyRequestAssociation.invalidate();
        await utils.users.getMyRequestAssociation.refetch();
        toast.toast({
          title: 'Ajuan dibatalkan',
          description: 'Pengajuan asosiasi telah dibatalkan.',
        });
      },
      onError: (err) => {
        toast.toast({
          title: 'Gagal membatalkan pengajuan',
          description: err.message || 'Coba lagi nanti.',
          variant: 'destructive',
        });
      },
    });

  const handleConfirmCancel = () => {
    if (!eventId) {
      toast.toast({
        title: 'Event ID tidak tersedia',
        description: 'Silakan muat ulang halaman lalu coba lagi.',
        variant: 'destructive',
      });
      return;
    }
    deleteAssociationMutation.mutate({ event_id: eventId });
  };

  const isLembaga = session?.user.role === 'lembaga';

  return (
    <header className="mb-8 overflow-hidden rounded-[36px]">
      <div className="relative h-56 sm:h-64 md:h-72">
        <div className="absolute inset-0">
          <Image
            src={backgroundImage}
            alt={title}
            layout="fill"
            objectFit="cover"
            priority
            sizes="100vw"
          />
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.8) 100%)',
          }}
        />
        <div
          className={`absolute bottom-0 left-0 flex w-full px-4 sm:px-8 md:px-10 pb-5 sm:pb-8 md:pb-10 ${
            isLembaga
              ? 'flex-row items-center justify-start gap-4 sm:gap-6'
              : 'flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'
          }`}
        >
          <div
            className={`flex gap-4 sm:gap-6 ${isLembaga ? 'items-center' : 'items-start sm:items-end flex-1'}`}
          >
            <div className="relative h-16 w-16 sm:h-20 sm:w-20 md:h-28 md:w-28 overflow-hidden rounded-full border-[1px] aspect-square flex-shrink-0 self-start md:self-auto">
              <Image
                src={logoImage}
                alt="Event logo"
                fill
                className="object-cover object-center"
                sizes="(max-width: 640px) 80px, 112px"
              />
            </div>

            <div className={`flex flex-col gap-1 ${isLembaga ? 'pb-1' : ''}`}>
              <h1
                className={`font-bold text-white leading-tight ${
                  isLembaga
                    ? 'text-lg sm:text-2xl md:text-3xl'
                    : 'text-lg sm:text-2xl md:text-3xl'
                }`}
              >
                {title}
              </h1>
              <p
                className={`font-light text-white leading-tight ${
                  isLembaga ? 'text-sm sm:text-lg md:text-xl' : 'text-sm sm:text-lg md:text-xl'
                }`}
              >
                {organizer}
              </p>
              {!isLembaga && (
                <div className="mt-3 sm:mt-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
                  {linkDaftar && (
                    <Link href={linkDaftar} className="w-full sm:w-auto">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto sm:max-w-[240px] rounded-xl bg-[#00B7B7] text-sm sm:text-lg text-white hover:bg-[#82CBDE] active:bg-[#D9F4F4]"
                      >
                        Daftar menjadi Panitia
                      </Button>
                    </Link>
                  )}
                  {ajuanAsosiasi && (
                    <Button
                      size="lg"
                      onClick={() => {
                        if (isSubmitted && matchingRequest?.status === 'Pending') {
                          setShowConfirmation(true);
                        } else if (!isSubmitted) {
                          setIsOpen(true);
                        }
                      }}
                      className={`w-full sm:w-auto sm:max-w-[240px] rounded-xl text-sm sm:text-lg text-white flex items-center justify-center gap-2 ${
                        isSubmitted && matchingRequest?.status === 'Pending'
                          ? 'bg-[#F16350] hover:bg-[#C04F40] active:bg-[#F16350]'
                          : 'bg-[#00B7B7] hover:bg-[#00A3A3] active:bg-[#008F8F]'
                      }`}
                    >
                      {isSubmitted && matchingRequest?.status === 'Pending' ? (
                        <>
                          <X className="w-5 h-5" />
                          Batalkan Pengajuan
                        </>
                      ) : isSubmitted ? (
                        'Sudah diajukan'
                      ) : (
                        'Ajukan Asosiasi'
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form dialog */}
      {ajuanAsosiasi && !isLembaga && (
        <AjuanAsosiasiForm
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          eventId={eventId ?? ''}
          lembagaId={session?.user.lembagaId ?? ''}
          eventName={title}
          eventLogo={logoImage}
          organizationName={organizer}
          onSubmissionSuccess={() => setIsSubmitted(true)}
          resetTrigger={resetTrigger}
        />
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent
          className="w-4/5 md:w-712px mx-auto p-6 bg-white rounded-3xl"
          aria-describedby={undefined}
        >
          <div className="text-center">
            <p className="text-lg md:text-xl font-regular text-gray-900 mt-2 mb-2">
              Apakah Anda yakin ingin membatalkan pengajuan asosiasi?
            </p>
          </div>
          <div className="flex gap-5 justify-center">
            <Button
              onClick={() => setShowConfirmation(false)}
              className="px-10 bg-[#F16350] hover:bg-[#E55541] text-white font-medium rounded-xl"
            >
              BATAL
            </Button>
            <Button
              onClick={handleConfirmCancel}
              className="px-10 bg-[#4A6FA5] hover:bg-[#3A5F95] text-white font-medium rounded-xl"
            >
              YAKIN
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
