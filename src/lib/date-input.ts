/**
 * Batas tahun untuk isian tanggal (L-06): input tanggal browser menerima tahun
 * sampai 6 digit, yang tak masuk akal untuk jadwal oprec dan form.
 */
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2099;

/** Nilai `min`/`max` untuk `<input type="datetime-local">`. */
export const DATETIME_MIN = `${MIN_YEAR}-01-01T00:00`;
export const DATETIME_MAX = `${MAX_YEAR}-12-31T23:59`;

/**
 * Apakah isian tanggal ("YYYY-MM-DD" atau "YYYY-MM-DDTHH:mm") sah dan
 * tahunnya 4 digit dalam batas. Isian kosong dianggap sah (opsional).
 */
export function isValidDateInput(value: string): boolean {
  if (value === '') return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  return !Number.isNaN(new Date(value).getTime());
}
