export function formatTanggal(dateInput: Date | string): string {
  const date = new Date(dateInput);

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Jakarta',
  };

  return new Intl.DateTimeFormat('id-ID', options).format(date);
}
