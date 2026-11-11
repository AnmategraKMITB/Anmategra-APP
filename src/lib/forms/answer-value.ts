import type { FieldOutput } from '~/server/api/types/form.type';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionId = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.optionId === 'string'
    ? value.optionId
    : undefined;

const columnId = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.columnId === 'string'
    ? value.columnId
    : undefined;

const isFileItem = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.itemId === 'string' &&
  typeof value.driveId === 'string' &&
  typeof value.name === 'string' &&
  typeof value.size === 'number' &&
  typeof value.mime === 'string' &&
  typeof value.url === 'string' &&
  (value.scope === 'anyone' || value.scope === 'organization');

/**
 * Mengubah jawaban seperti tersimpan di database menjadi bentuk yang dipakai
 * pengisi (`AnswerValueSchema`): pilihan menjadi id opsi, matriks menjadi
 * objek baris → kolom. Dipakai saat membuka kembali jawaban untuk disunting.
 */
export function storedAnswerToInput(
  field: FieldOutput,
  value: unknown,
): unknown {
  switch (field.type) {
    case 'short_text':
    case 'long_text':
    case 'link':
    case 'date':
      return typeof value === 'string' ? value : undefined;
    case 'number':
    case 'scale':
      return typeof value === 'number' && Number.isFinite(value)
        ? value
        : undefined;
    case 'checkbox':
      return typeof value === 'boolean' ? value : undefined;
    case 'single_choice':
      return optionId(value);
    case 'multiple_choice': {
      if (!Array.isArray(value)) return undefined;
      const ids = value
        .map(optionId)
        .filter((id): id is string => id !== undefined);
      return ids.length > 0 ? ids : undefined;
    }
    case 'matrix': {
      if (!Array.isArray(value)) return undefined;
      const result: Record<string, string | string[]> = {};
      for (const row of value) {
        if (
          !isRecord(row) ||
          typeof row.rowId !== 'string' ||
          !Array.isArray(row.selected)
        ) {
          continue;
        }
        const ids = row.selected
          .map(columnId)
          .filter((id): id is string => id !== undefined);
        if (ids.length === 0) continue;
        result[row.rowId] = field.config.multiple ? ids : ids[0]!;
      }
      return Object.keys(result).length > 0 ? result : undefined;
    }
    case 'file': {
      if (!Array.isArray(value)) return undefined;
      // Baris lama bisa memuat item yang sama dua kali; buang duplikatnya
      // supaya bentuk keluaran tetap lolos validasi.
      return value
        .filter(isFileItem)
        .filter(
          (item, index, all) =>
            all.findIndex(
              (other) =>
                isRecord(other) &&
                isRecord(item) &&
                other.itemId === item.itemId,
            ) === index,
        );
    }
    case 'unit_choice': {
      // Tersimpan sebagai [{ optionId, label }] berurutan; kembalikan id-nya.
      if (!Array.isArray(value)) return undefined;
      const ids = value
        .map((v) => (isRecord(v) ? v.optionId : undefined))
        .filter((id): id is string => typeof id === 'string');
      return ids.length > 0 ? ids : undefined;
    }
    case 'text_block':
      return undefined;
    default:
      return undefined;
  }
}
