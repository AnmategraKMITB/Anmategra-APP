/**
 * Awalan rute tempat halaman bersama (oprec, formulir) dipasang. `/lembaga`
 * untuk Owner, `/manage` untuk pengelola yang ditunjuk (Admin Lembaga atau
 * Admin Kegiatan), dan `/mahasiswa` untuk rute lama yang kini dialihkan.
 */
export type AppBase = '/lembaga' | '/mahasiswa' | '/manage';
