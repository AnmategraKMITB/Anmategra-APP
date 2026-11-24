import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';

type DeleteAssociationDialogProps = {
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  name?: string | null | undefined;
  deleteEventMutation: { isPending: boolean };
  deleteLembagaMutation: { isPending: boolean };
  confirmDelete: () => void;
};

export const DeleteAssociationDialog = ({
  deleteDialogOpen,
  setDeleteDialogOpen,
  name,
  deleteEventMutation,
  deleteLembagaMutation,
  confirmDelete,
}: DeleteAssociationDialogProps) => {
  return (
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus Permintaan Asosiasi</DialogTitle>
          <DialogDescription>
            Apakah Anda yakin ingin menghapus permintaan asosiasi ke{' '}
            <span className="font-semibold">{name}</span>? Tindakan ini tidak
            dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
            Batal
          </Button>
          <Button
            variant="warning"
            onClick={confirmDelete}
            disabled={
              deleteEventMutation.isPending || deleteLembagaMutation.isPending
            }
          >
            {deleteEventMutation.isPending || deleteLembagaMutation.isPending
              ? 'Menghapus...'
              : 'Hapus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
