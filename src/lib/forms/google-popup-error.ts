/**
 * Pesan untuk kegagalan popup izin Google (`error_callback` Google Identity).
 * Tanpa ini, popup yang diblokir atau ditutup membuat unggahan menggantung.
 */
export function googlePopupErrorMessage(type: string | undefined): string {
  if (type === 'popup_failed_to_open') {
    return 'Popup Google diblokir browser. Izinkan popup untuk situs ini, atau buka form lewat Chrome/Safari (bukan dari dalam aplikasi lain).';
  }
  if (type === 'popup_closed') {
    return 'Jendela izin Google ditutup sebelum selesai. Klik "Hubungkan Google Drive" lagi.';
  }
  return 'Izin Google Drive belum bisa diminta. Coba lagi.';
}
