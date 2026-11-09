'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { cn } from '~/lib/utils';

export const inputClass =
  'h-9 w-full rounded-lg border border-neutral-400 bg-neutral-50 px-3 text-sm text-neutral-1000 placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400';

export const selectClass =
  'h-9 w-full rounded-lg border border-neutral-400 bg-neutral-50 px-3 text-sm text-neutral-1000 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400';

export const textareaClass =
  'min-h-24 w-full rounded-lg border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm text-neutral-1000 placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-neutral-700">
      <span>{label}</span>
      {children}
      {hint ? (
        <span className="text-xs font-normal text-neutral-700">{hint}</span>
      ) : null}
    </label>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <p role="status" className="py-10 text-center text-sm text-neutral-700">
      {label}
    </p>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
    >
      {message}
    </p>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 text-sm text-neutral-700">
      {children}
    </p>
  );
}

export function Chip({
  children,
  tone = 'primary',
  title,
}: {
  children: React.ReactNode;
  tone?: 'primary' | 'success' | 'danger' | 'warning' | 'muted';
  title?: string;
}) {
  const style = {
    primary: 'bg-primary-100 text-primary-500',
    success: 'bg-success-light text-success-dark',
    danger: 'bg-danger-light text-danger-dark',
    warning: 'bg-warning-light text-neutral-1000',
    muted: 'bg-neutral-200 text-neutral-700',
  }[tone];
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        style,
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[88vh] overflow-y-auto rounded-[20px] border-neutral-400 bg-neutral-50 p-5',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-neutral-1000">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-sm text-neutral-700">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="grid gap-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2">{footer}</div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export const when = (value: Date | string | null | undefined) => {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });
};
