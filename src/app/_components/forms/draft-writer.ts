/** Jeda sebelum draf jawaban ditulis ke penyimpanan perangkat. */
export const DRAFT_DEBOUNCE_MS = 500;

/**
 * Penulis draf dengan debounce. Menulis ke `localStorage` bersifat sinkron dan
 * mengubah seluruh jawaban menjadi JSON, jadi menjalankannya pada setiap
 * ketikan membebani utas utama. `schedule` hanya menyimpan jawaban terbaru dan
 * menulisnya setelah `delayMs` tanpa perubahan. `flush` menulis seketika
 * (dipakai saat halaman ditinggalkan), sedangkan `cancel` membuang tulisan
 * yang tertunda.
 */
export function createDraftWriter(
  write: (key: string, answers: Record<string, unknown>) => void,
  delayMs: number = DRAFT_DEBOUNCE_MS,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { key: string; answers: Record<string, unknown> } | null = null;

  const flush = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const job = pending;
    pending = null;
    if (job) write(job.key, job.answers);
  };

  return {
    schedule(key: string, answers: Record<string, unknown>) {
      pending = { key, answers };
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
