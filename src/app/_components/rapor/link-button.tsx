import { MoveUpRight } from 'lucide-react';
import Link from 'next/link';
import React from 'react';
import { Button } from '~/components/ui/button';

interface LinkButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export default function LinkButton({
  href,
  children,
  className,
}: LinkButtonProps) {
  return (
    <Link href={href} passHref legacyBehavior>
      <Button
        asChild
        className={`mb-4 w-full rounded-2xl bg-[#00B7B7] text-white hover:bg-[#009999] hover:text-white sm:w-auto ${className ?? ''}`}
        variant="ghost"
      >
        <a>
          <MoveUpRight size={24} />
          {children}
        </a>
      </Button>
    </Link>
  );
}
