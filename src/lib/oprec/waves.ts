/**
 * Gelombang tidak boleh tumpang tindih (#347). Bersebelahan (akhir sama dengan
 * awal berikutnya) dan bercelah boleh. Mengembalikan pesan yang menyebut kedua
 * gelombang, atau null bila aman.
 */
export function waveOverlapMessage(
  waves: { label: string; startsAt: Date; endsAt: Date }[],
): string | null {
  const sorted = [...waves].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const next = sorted[i]!;
    if (next.startsAt < prev.endsAt) {
      return `Gelombang "${prev.label.trim()}" dan "${next.label.trim()}" tumpang tindih. Atur agar "${next.label.trim()}" mulai setelah "${prev.label.trim()}" berakhir.`;
    }
  }
  return null;
}
