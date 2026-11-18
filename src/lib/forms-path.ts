export type FormsPathDecision =
  | { kind: 'public' }
  | { kind: 'shared' }
  | { kind: 'login'; location: string }
  | { kind: 'not-forms' };

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * Halaman isi form: `/forms/<slug|id>` dan alias singkatnya `/f/<slug|id>`.
 * Slug peka huruf besar-kecil, sama seperti kolom `form.slug` di database.
 */
const FILL_PATH_PATTERN = /^\/(?:forms|f)\/[A-Za-z0-9_-]{1,100}$/;

export function isFillFormPath(pathname: string): boolean {
  return FILL_PATH_PATTERN.test(pathname);
}

/** Keputusan middleware untuk jalur /forms dan /f: pratinjau publik, halaman isi, atau bukan urusan ini. */
export function decideFormsPath(
  pathname: string,
  search: string,
  isAuthenticated: boolean,
): FormsPathDecision {
  if (pathname === '/forms/preview') return { kind: 'public' };
  if (/^\/forms\/preview\/[^/]+$/.test(pathname)) return { kind: 'public' };

  if (!isFillFormPath(pathname)) {
    return { kind: 'not-forms' };
  }

  if (isAuthenticated) return { kind: 'shared' };

  return {
    kind: 'login',
    location: `/authentication?callbackUrl=${encodeURIComponent(pathname + search)}`,
  };
}

/** callbackUrl dari halaman login hanya boleh mengarah ke halaman isi atau pratinjau form. */
export function isSafeFormsCallback(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.length > 300) return false;
  if (value.includes('\n') || value.includes('\r')) return false;
  if (value.includes('\\')) return false;
  if (value.includes('//')) return false;
  if (value.includes('..')) return false;
  if (/%2e/i.test(value)) return false;

  const questionIndex = value.indexOf('?');
  const path = questionIndex === -1 ? value : value.slice(0, questionIndex);
  const query = questionIndex === -1 ? '' : value.slice(questionIndex + 1);

  if (questionIndex !== -1 && !/^[A-Za-z0-9=&_.%-]*$/.test(query)) {
    return false;
  }

  // Halaman pengumuman hasil oprec juga memakai alur login dengan callbackUrl.
  if (/^\/pengumuman\/[A-Za-z0-9_-]{1,100}$/.test(path)) return true;

  const previewMatch = /^\/forms\/preview\/([^/]+)$/.exec(path);
  if (previewMatch) return ID_PATTERN.test(previewMatch[1] ?? '');

  return isFillFormPath(path);
}

/** Ambil callbackUrl yang aman dari query string halaman login; selain itu `undefined`. */
export function pickFormsCallback(search: string): string | undefined {
  const value = new URLSearchParams(search).get('callbackUrl');
  return isSafeFormsCallback(value) ? value! : undefined;
}
