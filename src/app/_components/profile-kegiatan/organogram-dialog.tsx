'use client';

import { LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';

interface OrganogramDialogProps {
  organogramImage: string;
  eventName: string;
}

export const OrganogramDialog = ({
  organogramImage,
  eventName,
}: OrganogramDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="flex w-full items-center gap-2 sm:w-auto"
        >
          <LayoutGrid size={20} />
          Lihat Organogram
        </Button>
      </DialogTrigger>
      <DialogContent className="h-full max-h-[95vh] w-full max-w-[95vw] p-0 sm:max-h-[90vh] sm:max-w-[90vw]">
        <DialogHeader className="px-6 pb-4 pt-6">
          <DialogTitle className="text-xl font-semibold">
            Organogram {eventName}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto px-6 pb-6">
          <img
            src={organogramImage}
            alt={`Organogram ${eventName}`}
            className="h-auto w-full object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
