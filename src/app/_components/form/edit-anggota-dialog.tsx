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
  position: z.string().min(1, 'Posisi wajib diisi'),
  division: z.string().min(1, 'Divisi wajib diisi'),
});

type EditAnggotaSchemaType = z.infer<typeof EditAnggotaSchema>;

export function EditAnggotaDialog({
  isOpen,
  setIsOpen,
  memberId,
  currentPosition,
  currentDivision,
  lembagaId,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  memberId: string;
  currentPosition: string;
  currentDivision: string;
  lembagaId?: string;
}) {
  const mutation = api.lembaga.editAnggota.useMutation({
    onError: (error) => {
        toast({
            title: 'Gagal mengedit anggota',
            description: error.message,
            variant: 'destructive',
        })
    },
    onSuccess: () => {
        setIsOpen(false);
        mutation.reset();
        window.location.reload();
        toast({
            title: 'Berhasil mengedit anggota',
            description: 'Data anggota telah diperbarui.',
        })
    }
  });
  const form = useForm<EditAnggotaSchemaType>({
    resolver: zodResolver(EditAnggotaSchema),
    defaultValues: {
      position: currentPosition,
      division: currentDivision,
    },
  });

  // Reset form when dialog opens or values change
  useEffect(() => {
    if (isOpen) {
      form.reset({
        position: currentPosition,
        division: currentDivision,
      });
    }
  }, [isOpen, currentPosition, currentDivision, form]);

  const onSubmit = (values: EditAnggotaSchemaType) => {
    if (!lembagaId) {
      console.error('lembagaId is required');
      return;
    }
    
    mutation.mutate(
      {
        user_id: memberId,
        position: values.position,
        division: values.division,
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-center text-[#00B7B7]">
            Edit Anggota
          </DialogTitle>
          <DialogDescription className="text-center text-[#98A2B3]">
            Ubah posisi atau bidang anggota
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="division"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bidang</FormLabel>
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
}
