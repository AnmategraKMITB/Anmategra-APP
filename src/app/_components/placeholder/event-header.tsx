'use client';

import { X } from 'lucide-react';
import type { Session } from 'next-auth';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AjuanAsosiasiForm from '~/app/lembaga/profile-kegiatan/_components/ajuan-asosiasi-form';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

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
          className={`absolute bottom-0 left-0 flex w-full px-4 pb-5 sm:px-8 sm:pb-8 md:px-10 md:pb-10 ${
            isLembaga
              ? 'flex-row items-center justify-start gap-4 sm:gap-6'
              : 'flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'
          }`}
        >
          <div
            className={`flex gap-4 sm:gap-6 ${isLembaga ? 'items-center' : 'flex-1 items-start sm:items-end'}`}
          >
            <div className="relative aspect-square h-16 w-16 flex-shrink-0 self-start overflow-hidden rounded-full border-[1px] sm:h-20 sm:w-20 md:h-28 md:w-28 md:self-auto">
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
                className={`font-bold leading-tight text-white ${
                  isLembaga
                    ? 'text-lg sm:text-2xl md:text-3xl'
                    : 'text-lg sm:text-2xl md:text-3xl'
                }`}
              >
                {title}
              </h1>
              <p
                className={`font-light leading-tight text-white ${
                  isLembaga
                    ? 'text-sm sm:text-lg md:text-xl'
                    : 'text-sm sm:text-lg md:text-xl'
                }`}
              >
                {organizer}
              </p>
              {!isLembaga && (
                <div className="mt-3 flex flex-col gap-2 sm:mt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  {linkDaftar && (
                    <Link href={linkDaftar} className="w-full sm:w-auto">
                      <Button
                        size="lg"
                        className="w-full rounded-xl bg-[#00B7B7] text-sm text-white hover:bg-[#82CBDE] active:bg-[#D9F4F4] sm:w-auto sm:max-w-[240px] sm:text-lg"
                      >
                        Daftar menjadi Panitia
                      </Button>
                    </Link>
                  )}
                  {ajuanAsosiasi && (
                    <Button
                      size="lg"
                      onClick={() => {
                        if (
                          isSubmitted &&
                          matchingRequest?.status === 'Pending'
                        ) {
                          setShowConfirmation(true);
                        } else if (!isSubmitted) {
                          setIsOpen(true);
                        }
                      }}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl text-sm text-white sm:w-auto sm:max-w-[240px] sm:text-lg ${
                        isSubmitted && matchingRequest?.status === 'Pending'
                          ? 'bg-[#F16350] hover:bg-[#C04F40] active:bg-[#F16350]'
                          : 'bg-[#00B7B7] hover:bg-[#00A3A3] active:bg-[#008F8F]'
                      }`}
                    >
                      {isSubmitted && matchingRequest?.status === 'Pending' ? (
                        <>
                          <X className="h-5 w-5" />
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
          className="md:w-712px mx-auto w-4/5 rounded-3xl bg-white p-6"
          aria-describedby={undefined}
        >
          <div className="text-center">
            <p className="font-regular mb-2 mt-2 text-lg text-gray-900 md:text-xl">
              Apakah Anda yakin ingin membatalkan pengajuan asosiasi?
            </p>
          </div>
          <div className="flex justify-center gap-5">
            <Button
              onClick={() => setShowConfirmation(false)}
              className="rounded-xl bg-[#F16350] px-10 font-medium text-white hover:bg-[#E55541]"
            >
              BATAL
            </Button>
            <Button
              onClick={handleConfirmCancel}
              className="rounded-xl bg-[#4A6FA5] px-10 font-medium text-white hover:bg-[#3A5F95]"
            >
              YAKIN
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
