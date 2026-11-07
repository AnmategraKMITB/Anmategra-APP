/**
 * Seret-lepas jabatan memakai HTML5 drag-and-drop supaya bisa lintas panel
 * (daftar jabatan di Detail, pohon Struktur, dan bagan) tanpa konteks bersama.
 * Setiap seretan punya pengganti papan ketik: Naik/Turun dan "Pindahkan ke bagian".
 */
export const POSITION_DRAG_TYPE = 'application/x-organogram-position';

let activePositionId: string | null = null;

export function startPositionDrag(
  event: React.DragEvent,
  positionId: string,
  preview?: HTMLElement | null,
): void {
  activePositionId = positionId;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(POSITION_DRAG_TYPE, positionId);
  event.dataTransfer.setData('text/plain', positionId);
  if (preview) event.dataTransfer.setDragImage(preview, 16, 16);
}

export function endPositionDrag(): void {
  activePositionId = null;
}

/** Apakah seretan yang sedang lewat adalah jabatan (tipe data tersedia saat dragover). */
export function isPositionDrag(event: React.DragEvent): boolean {
  return event.dataTransfer.types.includes(POSITION_DRAG_TYPE);
}

/** Id jabatan yang diseret; null bila bukan seretan jabatan. */
export function draggedPositionId(event?: React.DragEvent): string | null {
  const fromEvent = event?.dataTransfer.getData(POSITION_DRAG_TYPE);
  if (fromEvent) return fromEvent;
  return activePositionId;
}
