'use client';

import { Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import type { NotificationAudience } from '~/lib/oprec/notification-audience';
import type { NotificationScope } from '~/server/api/types/oprec.type';
import { api } from '~/trpc/react';

import { Field, inputClass, textareaClass } from './placement/shared';

const AUDIENCES: { value: NotificationAudience; label: string }[] = [
  { value: 'all', label: 'Semua pendaftar' },
  { value: 'accepted', label: 'Diterima' },
  { value: 'rejected', label: 'Tidak diterima' },
  { value: 'undecided', label: 'Belum diputuskan' },
];

/** Dialog kirim pesan bebas ke Inbox pendaftar satu oprec. */
export function NotificationDialog({
  recruitmentId,
  open,
  onOpenChange,
}: {
  recruitmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [audience, setAudience] = useState<NotificationAudience>('all');
  const [scope, setScope] = useState('all');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const utils = api.useUtils();

  const scopeInput = useMemo<NotificationScope>(() => {
    if (scope === 'all') return { kind: 'all' };
    if (scope.startsWith('bidang:')) {
      return { kind: 'group', groupLabel: scope.slice('bidang:'.length) };
    }
    return { kind: 'division', divisionId: scope.slice('divisi:'.length) };
  }, [scope]);

  const audienceQuery = api.oprec.notificationAudience.useQuery(
    { recruitmentId, scope: scopeInput },
    { enabled: open, placeholderData: (previous) => previous },
  );
  const divisions = useMemo(
    () => audienceQuery.data?.divisions ?? [],
    [audienceQuery.data],
  );
  const groups = useMemo(
    () => [
      ...new Set(
        divisions
          .map((division) => division.groupLabel)
          .filter((label): label is string => !!label),
      ),
    ],
    [divisions],
  );
  const counts = audienceQuery.data?.counts;
  const recipients = counts?.[audience] ?? 0;
  const targetLabel =
    scope === 'all'
      ? null
      : scope.startsWith('bidang:')
        ? `bidang ${scope.slice('bidang:'.length)}`
        : (divisions.find(
            (division) => division.id === scope.slice('divisi:'.length),
          )?.label ?? null);

  const send = api.oprec.sendApplicantNotification.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Pemberitahuan terkirim ke ${result.sent} pendaftar di Inbox.`,
      );
      setTitle('');
      setContent('');
      onOpenChange(false);
      void utils.oprec.notificationAudience.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const submit = () => {
    send.mutate({
      recruitmentId,
      audience,
      scope: scopeInput,
      title: title.trim(),
      content: content.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kirim pemberitahuan</DialogTitle>
          <DialogDescription>
            Pesan muncul di Inbox Anmategra para pendaftar. Tidak ada email
            atau push, dan pesan yang sudah terkirim tidak bisa ditarik.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="notification-scope">Bidang / divisi</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger id="notification-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua bidang & divisi</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={`bidang:${group}`} value={`bidang:${group}`}>
                    Bidang {group}
                  </SelectItem>
                ))}
                {divisions.map((division) => (
                  <SelectItem key={division.id} value={`divisi:${division.id}`}>
                    {division.groupLabel
                      ? `${division.groupLabel} / ${division.label}`
                      : division.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-xs font-semibold text-neutral-700">
              Penerima
            </legend>
            {AUDIENCES.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-primary-400 hover:border-neutral-500"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="notification-audience"
                    value={option.value}
                    checked={audience === option.value}
                    onChange={() => setAudience(option.value)}
                    className="accent-primary-400"
                  />
                  {option.label}
                </span>
                <span className="text-xs text-neutral-700 tabular-nums">
                  {counts ? (counts[option.value] ?? 0) : '…'}
                </span>
              </label>
            ))}
          </fieldset>

          <Field label="Judul" hint="Maksimal 255 karakter.">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
              className={inputClass}
              placeholder="mis. Jadwal wawancara Oprec"
            />
          </Field>

          <Field
            label="Pesan"
            hint="Maksimal 2.000 karakter. Tautan ke halaman pendaftaran ditambahkan otomatis."
          >
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={2000}
              rows={5}
              className={textareaClass}
              placeholder="Tulis informasi yang perlu diketahui pendaftar…"
            />
          </Field>

          <p
            className="rounded-xl bg-primary-100 px-3 py-2 text-sm text-neutral-1000"
            aria-live="polite"
          >
            {audienceQuery.isFetching ? (
              'Menghitung penerima…'
            ) : (
              <>
                Akan dikirim ke{' '}
                <strong className="tabular-nums">{recipients} penerima</strong>
                {targetLabel ? ` di ${targetLabel}` : ''}.
              </>
            )}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="dark_blue_outline"
            disabled={send.isPending}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            disabled={
              send.isPending ||
              audienceQuery.isFetching ||
              recipients === 0 ||
              title.trim() === '' ||
              content.trim() === ''
            }
            onClick={submit}
          >
            <Send />{' '}
            {send.isPending ? 'Mengirim…' : `Kirim ke ${recipients} penerima`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
