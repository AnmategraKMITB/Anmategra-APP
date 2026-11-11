export type SubmitAnswer = {
  fieldId: string;
  value: unknown;
};

export type SubmitPayload = {
  formId: string;
  answers: SubmitAnswer[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (isRecord(value) && Object.keys(value).length === 0) return true;
  return false;
}

/** Hanya pertanyaan yang terjawab, berurutan; 0 dan false tetap jawaban. */
export function buildSubmitPayload(
  formId: string,
  fields: { id: string; type: string }[],
  answers: Record<string, unknown>,
): SubmitPayload {
  const result: SubmitAnswer[] = [];

  for (const field of fields) {
    if (field.type === 'text_block') continue;
    const value = answers[field.id];
    if (isEmptyValue(value)) continue;
    result.push({ fieldId: field.id, value });
  }

  return { formId, answers: result };
}

/** Pesan pertama tiap pertanyaan dari fieldErrors zod. */
export function mapFieldErrors(fieldErrors: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!isRecord(fieldErrors)) return result;

  for (const [fieldId, messages] of Object.entries(fieldErrors)) {
    if (!Array.isArray(messages) || messages.length === 0) continue;
    const first: unknown = messages[0];
    if (typeof first === 'string') result[fieldId] = first;
  }

  return result;
}

/** fieldErrors dari bentuk galat tRPC (`data.zodError.fieldErrors`). */
export function extractFieldErrors(err: unknown): Record<string, string> {
  if (!isRecord(err)) return {};
  const data = err.data;
  if (!isRecord(data)) return {};
  const zodError = data.zodError;
  if (!isRecord(zodError)) return {};
  return mapFieldErrors(zodError.fieldErrors);
}

export type SubmitResult = {
  /** Galat per pertanyaan dari server, kunci = id pertanyaan. */
  fieldErrors?: Record<string, string>;
  /** Galat umum (bukan milik satu pertanyaan). */
  message?: string;
};

export type SubmitOutcome =
  | { kind: 'ok' }
  | { kind: 'field'; firstId: string; fieldErrors: Record<string, string> }
  | { kind: 'error'; message: string };

const GENERIC_ERROR = 'Jawabanmu belum terkirim. Periksa isian lalu coba lagi.';

/**
 * Menilai hasil kirim. Galat yang kuncinya bukan id pertanyaan di form ini
 * (mis. `answers` dari validasi bentuk, atau pertanyaan baru yang belum
 * dimuat) tetap gagal; jangan sampai tampil sebagai terkirim.
 */
export function classifySubmitResult(
  result: SubmitResult,
  fieldIds: string[],
): SubmitOutcome {
  const errors = result.fieldErrors ?? {};
  const firstId = fieldIds.find((id) => errors[id]);
  if (firstId) return { kind: 'field', firstId, fieldErrors: errors };
  if (result.message) return { kind: 'error', message: result.message };
  if (Object.keys(errors).length > 0) {
    return { kind: 'error', message: GENERIC_ERROR };
  }
  return { kind: 'ok' };
}
