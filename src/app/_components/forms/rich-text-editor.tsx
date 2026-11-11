'use client';

import { Bold, Italic, Link2, Underline } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';

import { applyMark } from './rich-text';
import { RichText, hasRichMarkup } from './rich-text-view';

type Mark = 'bold' | 'italic' | 'underline';

const TOOLS: {
  mark: Mark;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { mark: 'bold', label: 'Tebal', icon: Bold },
  { mark: 'italic', label: 'Miring', icon: Italic },
  { mark: 'underline', label: 'Garis bawah', icon: Underline },
];

/**
 * Kolom teks dengan tombol tebal, miring, garis bawah, dan tautan. Nilainya
 * teks biasa berpenanda (lihat `rich-text.ts`), bukan HTML.
 */
export function RichTextEditor({
  id,
  label,
  value,
  onChange,
  rows,
  maxLength,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Tanpa `rows` kolomnya satu baris. */
  rows?: number;
  maxLength: number;
}) {
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  // Mengembalikan seleksi sesudah React menulis nilai baru ke kolom.
  useEffect(() => {
    const selection = pendingSelection.current;
    const el = fieldRef.current;
    if (!selection || !el) return;
    pendingSelection.current = null;
    el.focus();
    el.setSelectionRange(selection.start, selection.end);
  });

  const apply = (mark: Mark | 'link', link?: string) => {
    const el = fieldRef.current;
    if (!el) return;
    const result = applyMark(
      value,
      el.selectionStart ?? 0,
      el.selectionEnd ?? 0,
      mark,
      link,
    );
    if (result.value.length > maxLength) return;
    pendingSelection.current = { start: result.start, end: result.end };
    onChange(result.value);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
    const key = e.key.toLowerCase();
    const mark =
      key === 'b'
        ? 'bold'
        : key === 'i'
          ? 'italic'
          : key === 'u'
            ? 'underline'
            : null;
    if (!mark) return;
    e.preventDefault();
    apply(mark);
  };

  const submitLink = () => {
    const address = url.trim();
    if (!/^https?:\/\/[^\s()]+$/i.test(address)) {
      setLinkError('Alamat harus diawali http:// atau https://');
      return;
    }
    setLinkError(null);
    apply('link', address);
    setLinkOpen(false);
    setUrl('');
  };

  const common = {
    id,
    value,
    maxLength,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    onKeyDown,
  };

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div
        role="toolbar"
        aria-label={`Format teks ${label}`}
        className="flex flex-wrap items-center gap-1"
      >
        {TOOLS.map(({ mark, label: toolLabel, icon: Icon }) => (
          <Button
            key={mark}
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={toolLabel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(mark)}
          >
            <Icon />
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Tautan"
          aria-expanded={linkOpen}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setLinkOpen((open) => !open)}
        >
          <Link2 />
        </Button>
      </div>
      {linkOpen ? (
        <div className="flex flex-wrap items-start gap-2 rounded-xl bg-neutral-200 p-2">
          <div className="min-w-0 flex-1">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://contoh.id"
              aria-label="Alamat tautan"
              aria-invalid={linkError !== null}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitLink();
                }
              }}
            />
            {linkError ? (
              <p role="alert" className="mt-1 text-sm text-danger-dark">
                {linkError}
              </p>
            ) : null}
          </div>
          <Button type="button" variant="dark_blue" onClick={submitLink}>
            Terapkan
          </Button>
        </div>
      ) : null}
      {rows ? (
        <Textarea ref={fieldRef} rows={rows} {...common} />
      ) : (
        <input
          ref={fieldRef}
          type="text"
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          {...common}
        />
      )}
      {hasRichMarkup(value) ? (
        <p className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
          <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-neutral-700">
            Tampilan
          </span>
          <RichText value={value} />
        </p>
      ) : null}
    </div>
  );
}
