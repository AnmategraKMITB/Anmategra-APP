'use client';

// Bagian kecil yang dipakai ulang oleh simulasi manual. Sengaja ringan dan
// tanpa portal supaya semua yang tampil tetap berada di dalam jendela demo.

// Library Import
import { X } from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { cn } from '~/lib/utils';

export const inputClass =
  'h-9 w-full rounded-md border border-neutral-400 bg-white px-3 text-sm text-neutral-1000 placeholder:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:bg-neutral-200 disabled:text-neutral-700';

export const thClass =
  'whitespace-nowrap border-b border-neutral-400 bg-neutral-100 px-3 py-2 text-left text-xs font-semibold text-neutral-800';
export const tdClass = 'border-b border-neutral-300 px-3 py-2 align-middle';

const BTN_TONE = {
  primary: 'bg-primary-400 text-white hover:bg-primary-500',
  teal: 'bg-secondary-400 text-white hover:bg-secondary-500',
  outline:
    'border border-primary-400 bg-white text-primary-400 hover:bg-primary-100',
  ghost: 'text-neutral-800 hover:bg-neutral-200',
  danger: 'bg-tomato text-white hover:bg-danger-dark',
  dangerOutline: 'border border-tomato bg-white text-danger-dark hover:bg-danger-light',
} as const;

export function Btn({
  tone = 'primary',
  small = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: keyof typeof BTN_TONE;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4',
        small ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        BTN_TONE[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

const PILL_TONE = {
  neutral: 'bg-neutral-200 text-neutral-800',
  success: 'bg-success-light text-success-dark',
  warning: 'bg-warning-light text-neutral-1000 ring-1 ring-inset ring-saffron',
  danger: 'bg-danger-light text-danger-dark',
  info: 'bg-primary-100 text-primary-600',
  teal: 'bg-secondary-100 text-secondary-800',
} as const;
export type PillTone = keyof typeof PILL_TONE;

export function Pill({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
        PILL_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Label di atas satu kontrol. `children` menerima id untuk dihubungkan. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="block text-xs font-semibold text-neutral-800">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-xs text-neutral-700">{hint}</p> : null}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-center gap-2 rounded-md text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
          checked ? 'bg-secondary-400' : 'bg-neutral-500',
        )}
      >
        <span
          className={cn(
            'size-4 rounded-full bg-white transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  spot,
  label,
}: {
  tabs: readonly (readonly [T, string])[];
  value: T;
  onChange: (next: T) => void;
  /** Kelas sorotan per tab, untuk mode Ikuti langkah. */
  spot?: (id: T) => string;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex flex-wrap gap-1 border-b border-neutral-400"
    >
      {tabs.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
            value === id
              ? 'border-primary-400 text-primary-400'
              : 'border-transparent text-neutral-700 hover:text-neutral-1000',
            spot?.(id),
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Dialog yang menutupi isi jendela demo, bukan seluruh halaman. */
export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto bg-primary-1000/40 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
        className={cn(
          'w-full rounded-xl border border-neutral-400 bg-white p-4 shadow-lg focus-visible:outline-none',
          wide ? 'max-w-xl' : 'max-w-md',
        )}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {/* Bukan heading: daftar isi manual membaca h2/h3 dari artikel. */}
            <p id={titleId} className="text-base font-semibold text-neutral-1000">
              {title}
            </p>
            {description ? (
              <p className="mt-1 text-xs text-neutral-700">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="rounded-md p-1 text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <X className="size-4" />
          </button>
        </div>
        {children ? <div className="mt-3 space-y-3">{children}</div> : null}
        {footer ? (
          <div className="mt-4 flex flex-wrap justify-end gap-2">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Pesan singkat pengganti toast; hilang sendiri setelah beberapa detik. */
export function useFlash() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), 3500);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const node = (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-4"
    >
      {message ? (
        <span className="rounded-lg bg-primary-1000 px-3 py-2 text-xs font-medium text-white shadow-lg">
          {message}
        </span>
      ) : null}
    </div>
  );

  return { flash, node };
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-neutral-400 px-4 py-6 text-center text-sm text-neutral-700">
      {children}
    </p>
  );
}

/** Judul layar di dalam jendela demo, meniru kepala halaman aplikasi. */
export function ScreenTitle({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold leading-tight text-neutral-1000">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-neutral-700">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
