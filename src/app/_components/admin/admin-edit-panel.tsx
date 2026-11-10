'use client';

import { X } from 'lucide-react';
import { type ReactNode } from 'react';
import { Button } from '~/components/ui/button';

export function AdminEditPanel({
  title,
  description,
  onClose,
  error,
  footer,
  children,
}: {
  title: string;
  description?: string;
  onClose?: () => void;
  error?: string | null;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-1000">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-neutral-700">{description}</p>
          ) : null}
        </div>
        {onClose ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClose}
            aria-label="Tutup panel edit"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger-dark">
          {error}
        </p>
      ) : null}
      {children}
      {footer ? <div className="flex flex-wrap gap-2">{footer}</div> : null}
    </section>
  );
}
