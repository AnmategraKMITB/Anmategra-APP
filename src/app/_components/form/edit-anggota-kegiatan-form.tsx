'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';
import { toast } from '~/hooks/use-toast';

const EditAnggotaSchema = z.object({
  nama: z.string().min(1, 'Nama wajib diisi'),
  nim: z.string().min(1, 'NIM wajib diisi'),
  position: z.string().min(1, 'Posisi wajib diisi'),
  division: z.string().min(1, 'Divisi wajib diisi'),
});

type EditAnggotaSchemaType = z.infer<typeof EditAnggotaSchema>;

type EditAnggotaKegiatanFormProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  memberId: string;
  eventId: string;
  lembagaId: string;
  currentNama: string;
  currentNim: string;
  currentPosition: string;
  currentDivision: string;
};

const EditAnggotaKegiatanForm: React.FC<EditAnggotaKegiatanFormProps> = ({
  isOpen,
  setIsOpen,
  memberId,
  eventId,
  lembagaId,
  currentNama,
  currentNim,
  currentPosition,
  currentDivision,
}) => {
  const mutation = api.event.editPanitia.useMutation();
  const form = useForm<EditAnggotaSchemaType>({
    resolver: zodResolver(EditAnggotaSchema),
    defaultValues: {
      nama: currentNama,
      nim: currentNim,
      position: currentPosition,
      division: currentDivision,
    },
  });

  // Reset form when dialog opens or values change
  useEffect(() => {
    if (isOpen) {
      form.reset({
        nama: currentNama,
        nim: currentNim,
        position: currentPosition,
        division: currentDivision,
      });
    }
  }, [isOpen, currentNama, currentNim, currentPosition, currentDivision, form]);

  const onSubmit = (values: EditAnggotaSchemaType) => {
    if (!eventId) {
      console.error('eventId is required');
      return;
    }
    
    mutation.mutate(
      {
        lembagaId,
        user_id: memberId,
        event_id: eventId,
        position: values.position,
        division: values.division,
      },
      {
        onSuccess: () => {
          setIsOpen(false);
          form.reset();
          window.location.reload();
          toast({
            title: 'Berhasil mengedit panitia',
            description: 'Data panitia telah diperbarui.',
          })
        },
        onError: (error) => {
          toast({
            title: 'Gagal mengedit panitia',
            description: error.message,
            variant: 'destructive',
          })
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-center text-[#00B7B7]">
            Edit Panitia
          </DialogTitle>
          <DialogDescription className="text-center text-[#98A2B3]">
            Ubah posisi atau divisi panitia
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nama"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Masukkan nama..."
                      {...field}
                      className="h-10 w-full rounded-[5px] border-[#DDE3EA]"
                      disabled
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nim"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NIM</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Masukkan NIM..."
                      {...field}
                      className="h-10 w-full rounded-[5px] border-[#DDE3EA]"
                      disabled
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Posisi</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Masukkan posisi..."
                      {...field}
                      className="h-10 w-full rounded-[5px] border-[#DDE3EA]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="division"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Divisi</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Masukkan divisi..."
                      {...field}
                      className="h-10 w-full rounded-[5px] border-[#DDE3EA]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full bg-[#00B7B7] hover:bg-[#00B7B7]/85 text-white"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditAnggotaKegiatanForm;
