'use client';

import { useState } from 'react';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

type RaporVisibilitySwitchProps = {
  type: 'event' | 'lembaga' | 'mahasiswa';
  id?: string; // Required for event, optional for lembaga
  initialValue: boolean;
};

export default function RaporVisibilitySwitch({
  type,
  id,
  initialValue,
}: RaporVisibilitySwitchProps) {
  const [isVisible, setIsVisible] = useState(initialValue);
  const { toast } = useToast();

  const mutationOptions = {
    onSuccess: (data) => {
      setIsVisible(data.rapor_visible);
      toast({
        title: 'Success',
        description: `Rapor visibility ${data.rapor_visible ? 'enabled' : 'disabled'}`,
      });
    },
    onError: (error) => {
      // Revert the switch on error
      setIsVisible(!isVisible);
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to update rapor visibility',
        variant: 'destructive',
      });
    },
  };

  const eventMutation =
    api.event.toggleRaporVisibility.useMutation(mutationOptions);

  const lembagaMutation =
    api.lembaga.toggleRaporVisibility.useMutation(mutationOptions);

  const mahasiswaMutation =
    api.users.toggleRaporVisibility.useMutation(mutationOptions);

  const isLoading = eventMutation.isPending || lembagaMutation.isPending;

  const handleToggle = (checked: boolean) => {
    // Optimistically update the UI
    setIsVisible(checked);

    if (type === 'event') {
      if (!id) {
        console.error('Event ID is required for event type');
        setIsVisible(!checked); // Revert
        return;
      }
      eventMutation.mutate({
        id,
        rapor_visible: checked,
      });
    } else if (type === 'lembaga') {
      lembagaMutation.mutate({
        rapor_visible: checked,
      });
    } else {
      mahasiswaMutation.mutate({
        rapor_visible: checked,
      });
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Label
        htmlFor="rapor-visibility"
        className="text-sm font-medium cursor-pointer"
      >
        Rapor Visible to Public
      </Label>
      <Switch
        id="rapor-visibility"
        checked={isVisible}
        onCheckedChange={handleToggle}
        disabled={isLoading}
      />
    </div>
  );
}
