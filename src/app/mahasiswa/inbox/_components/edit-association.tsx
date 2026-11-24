import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

type EditAssociationDialogProps = {
  editDialogOpen: boolean;
  setEditDialogOpen: (open: boolean) => void;
  editDivision: string;
  setEditDivision: (division: string) => void;
  editPosition: string;
  setEditPosition: (position: string) => void;
  editEventMutation: { isPending: boolean };
  editLembagaMutation: { isPending: boolean };
  confirmEdit: () => void;
};

export const EditAssociationDialog = ({
  editDialogOpen,
  setEditDialogOpen,
  editDivision,
  setEditDivision,
  editPosition,
  setEditPosition,
  editEventMutation,
  editLembagaMutation,
  confirmEdit,
}: EditAssociationDialogProps) => {
  return (
    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Permintaan Asosiasi</DialogTitle>
          <DialogDescription>
            Ubah divisi dan posisi yang Anda inginkan
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="division">Divisi</Label>
            <Input
              id="division"
              value={editDivision}
              onChange={(e) => setEditDivision(e.target.value)}
              placeholder="Masukkan divisi"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="position">Posisi</Label>
            <Input
              id="position"
              value={editPosition}
              onChange={(e) => setEditPosition(e.target.value)}
              placeholder="Masukkan posisi"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
            Batal
          </Button>
          <Button
            onClick={confirmEdit}
            disabled={
              editEventMutation.isPending || editLembagaMutation.isPending
            }
          >
            {editEventMutation.isPending || editLembagaMutation.isPending
              ? 'Menyimpan...'
              : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
