import { Button } from '~/components/ui/button';
import { Dialog, DialogContent } from '~/components/ui/dialog';

export default function DeleteProfilDialog({
  open,
  onCancel,
  onConfirm,
  title = 'Apakah Anda yakin ingin menghapus profil ini?',
  cancelButtonText = 'Batal',
  confirmButtonText = 'Yakin',
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  cancelButtonText?: string;
  confirmButtonText?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent
        className="max-w-[90vw] sm:max-w-md lg:rounded-[26px]"
        aria-describedby={undefined}
      >
        <div className="text-center text-sm sm:text-base">{title}</div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
          <Button
            variant="outline"
            className="w-full rounded-xl bg-[#F16350] px-6 text-white hover:bg-[#FF9185] hover:text-white sm:w-auto"
            onClick={onCancel}
            type="button"
          >
            {cancelButtonText}
          </Button>
          <Button
            className="w-full rounded-xl bg-[#2B6282] px-6 text-white hover:bg-[#2B6282] hover:text-white sm:w-auto"
            onClick={onConfirm}
            type="button"
          >
            {confirmButtonText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
