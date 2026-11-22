/** Label pertanyaan tanpa format ringan (tautan, tebal, miring, garis bawah) untuk teks polos. */
export const plainLabel = (text: string) =>
  text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\+\+([^+]+)\+\+/g, '$1');
