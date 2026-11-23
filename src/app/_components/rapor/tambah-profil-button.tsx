import { Plus } from 'lucide-react';
import { Button } from '~/components/ui/button';

export default function TambahProfilButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      className="mb-4 w-full rounded-2xl bg-[#00B7B7] text-white hover:bg-[#009999] hover:text-white sm:w-auto"
      variant="ghost"
      onClick={onClick}
    >
      <Plus size={16} />
      {children}
    </Button>
  );
}
