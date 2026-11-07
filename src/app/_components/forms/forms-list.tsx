'use client';

import {
  ChevronLeft,
  ChevronRight,
  FileText,
  MoreVertical,
  Plus,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { cn } from '~/lib/utils';
import { type RouterOutputs, api } from '~/trpc/react';

import { type FormStatus, previewUrl, statusLabel } from './model';

export type FormsScope =
  | { type: 'lembaga'; lembagaId: string }
  | { type: 'event'; eventId: string };

type FormListItem = RouterOutputs['form']['listByLembaga'][number];

const PAGE_SIZE = 10;

const STATUS_STYLE: Record<FormStatus, string> = {
  Draft: 'bg-neutral-200 text-neutral-700',
  Published: 'bg-success-light text-success-dark',
  Closed: 'bg-primary-100 text-primary-400',
};

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function StatusBadge({ status }: { status: FormStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
        STATUS_STYLE[status],
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function FormsList({
  scope,
  basePath,
}: {
  scope: FormsScope;
  /** `/lembaga` atau `/mahasiswa`: awalan rute builder. */
  basePath: '/lembaga' | '/mahasiswa';
}) {
  const router = useRouter();
  const utils = api.useUtils();

  const byLembaga = api.form.listByLembaga.useQuery(
    { lembagaId: scope.type === 'lembaga' ? scope.lembagaId : '' },
    { enabled: scope.type === 'lembaga', staleTime: 0 },
  );
  const byEvent = api.form.listByEvent.useQuery(
    { eventId: scope.type === 'event' ? scope.eventId : '' },
    { enabled: scope.type === 'event', staleTime: 0 },
  );
  const query = scope.type === 'lembaga' ? byLembaga : byEvent;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | FormStatus>('all');
  const [sort, setSort] = useState<'newest' | 'title'>('newest');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<FormListItem | null>(null);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (query.data ?? []).filter(
      (f) =>
        (status === 'all' || f.status === status) &&
        f.title.toLowerCase().includes(needle),
    );
    return [...filtered].sort(
      sort === 'title'
        ? (a, b) => a.title.localeCompare(b.title, 'id')
        : (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }, [query.data, search, status, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const refresh = () => {
    void utils.form.listByLembaga.invalidate();
    void utils.form.listByEvent.invalidate();
  };

  const remove = api.form.delete.useMutation({
    onSuccess: () => {
      toast.success('Form dihapus.');
      setDeleting(null);
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const copyLink = async (item: FormListItem) => {
    if (!item.previewEnabled || !item.previewToken) return;
    try {
      await navigator.clipboard.writeText(
        previewUrl(window.location.origin, item.previewToken),
      );
      toast.success('Tautan pratinjau disalin.');
    } catch {
      toast.error(
        'Tautan tidak bisa disalin. Salin dari tombol Share di builder.',
      );
    }
  };

  const hasAny = (query.data ?? []).length > 0;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari form"
            aria-label="Cari form"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as 'all' | FormStatus);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-40" aria-label="Filter status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="Draft">Draf</SelectItem>
            <SelectItem value="Published">Terbit</SelectItem>
            <SelectItem value="Closed">Ditutup</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(v) => setSort(v as 'newest' | 'title')}
        >
          <SelectTrigger className="sm:w-40" aria-label="Urutkan">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Terbaru</SelectItem>
            <SelectItem value="title">Judul A–Z</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="light_blue" onClick={() => setCreating(true)}>
          <Plus /> Buat form
        </Button>
      </div>

      <div className="mt-6">
        {query.isLoading ? (
          <ul
            aria-busy="true"
            className="divide-y divide-neutral-400 border-y border-neutral-400"
          >
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-4 px-2 py-4">
                <div className="h-10 w-14 animate-pulse rounded-lg bg-neutral-200" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-200" />
              </li>
            ))}
          </ul>
        ) : query.isError ? (
          <div
            role="alert"
            className="rounded-[24px] border border-neutral-400 p-6"
          >
            <p className="font-semibold text-neutral-1000">
              Daftar form tidak bisa dimuat.
            </p>
            <p className="mt-1 text-sm text-neutral-700">
              {query.error.message}
            </p>
            <Button
              className="mt-4"
              variant="dark_blue_outline"
              onClick={() => void query.refetch()}
            >
              Coba lagi
            </Button>
          </div>
        ) : !hasAny ? (
          <div className="rounded-[24px] border border-neutral-400 p-8 text-center">
            <FileText aria-hidden className="mx-auto size-8 text-neutral-500" />
            <p className="mt-3 font-semibold text-neutral-1000">
              Belum ada form.
            </p>
            <p className="mt-1 text-sm text-neutral-700">
              Buat form pertama untuk mulai mengumpulkan jawaban.
            </p>
            <Button
              className="mt-4"
              variant="light_blue"
              onClick={() => setCreating(true)}
            >
              <Plus /> Buat form
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-neutral-700">
            Tidak ada form yang cocok dengan pencarian.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-400 border-y border-neutral-400">
            {visible.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 px-2 py-4 transition-colors duration-150 hover:bg-neutral-200"
              >
                <div
                  aria-hidden
                  className="hidden h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-400 sm:flex"
                >
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`${basePath}/forms/${item.id}`}
                    className="block truncate font-semibold text-neutral-1000 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-neutral-700">
                    Dibuat {dateFormat.format(item.createdAt)} ·{' '}
                    {item.submissionCount} respons
                  </p>
                </div>
                <StatusBadge status={item.status} />
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Aksi untuk ${item.title}`}
                    >
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="min-w-40 rounded-xl"
                  >
                    <DropdownMenuItem
                      onSelect={() =>
                        router.push(`${basePath}/forms/${item.id}`)
                      }
                    >
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        router.push(`${basePath}/forms/${item.id}/respons`)
                      }
                    >
                      Lihat respons
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!item.previewEnabled || !item.previewToken}
                      onSelect={() => void copyLink(item)}
                    >
                      Salin tautan pratinjau
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-danger-dark focus:text-danger-dark"
                      onSelect={() => setDeleting(item)}
                    >
                      Hapus
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pages > 1 ? (
        <nav
          aria-label="Halaman daftar"
          className="mt-4 flex items-center justify-center gap-3 text-sm text-neutral-700"
        >
          <Button
            variant="dark_blue_outline"
            size="sm"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft /> Sebelumnya
          </Button>
          <span>
            Halaman {current} dari {pages}
          </span>
          <Button
            variant="dark_blue_outline"
            size="sm"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            Berikutnya <ChevronRight />
          </Button>
        </nav>
      ) : null}

      <CreateFormDialog
        open={creating}
        onOpenChange={setCreating}
        scope={scope}
        onCreated={(id) => {
          refresh();
          router.push(`${basePath}/forms/${id}`);
        }}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent className="rounded-[20px]">
          <DialogHeader>
            <DialogTitle>Hapus form?</DialogTitle>
            <DialogDescription>
              “{deleting?.title}” beserta semua pertanyaannya akan dihapus dan
              tidak bisa dikembalikan. Form yang sudah punya respons tidak bisa
              dihapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="dark_blue_outline"
              onClick={() => setDeleting(null)}
            >
              Batal
            </Button>
            <Button
              variant="warning"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate({ formId: deleting.id })}
            >
              {remove.isPending ? 'Menghapus…' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateFormDialog({
  open,
  onOpenChange,
  scope,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: FormsScope;
  onCreated: (formId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlers = {
    onSuccess: (created: { id: string }) => {
      setTitle('');
      setDescription('');
      setError(null);
      onOpenChange(false);
      onCreated(created.id);
    },
    onError: (e: { message: string }) => setError(e.message),
  };
  const createForLembaga = api.form.createForLembaga.useMutation(handlers);
  const createForEvent = api.form.createForEvent.useMutation(handlers);
  const pending = createForLembaga.isPending || createForEvent.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) {
      setError('Judul form tidak boleh kosong.');
      return;
    }
    setError(null);
    const meta = { title: clean, description: description.trim() || null };
    if (scope.type === 'lembaga') {
      createForLembaga.mutate({ lembagaId: scope.lembagaId, ...meta });
    } else {
      createForEvent.mutate({ eventId: scope.eventId, ...meta });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[20px]">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Buat form</DialogTitle>
            <DialogDescription>
              Form baru berstatus draf. Pertanyaannya disusun di halaman
              berikutnya.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="form-title">Judul</Label>
            <Input
              id="form-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              autoFocus
              aria-invalid={error !== null}
              aria-describedby={error ? 'form-title-error' : undefined}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="form-description">Deskripsi (opsional)</Label>
            <Textarea
              id="form-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={3}
            />
          </div>
          {error ? (
            <p
              id="form-title-error"
              role="alert"
              className="text-sm text-danger-dark"
            >
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="dark_blue_outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="light_blue" disabled={pending}>
              {pending ? 'Membuat…' : 'Buat form'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
