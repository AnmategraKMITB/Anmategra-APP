/** Editor organogram: ruang kerja layar penuh tanpa kolom pembatas lebar dan tanpa footer situs. */
export const isOrganogramWorkspace = (pathname: string): boolean =>
  /\/kegiatan\/[^/]+\/organogram\/?$/.test(pathname);

/**
 * Builder form (`/lembaga/forms/[id]`, `/mahasiswa/forms/[id]`): kepala builder
 * selebar layar menempel di bawah navbar, jadi halaman tidak dibungkus kolom.
 * Halaman respons (`.../respons`) tetap halaman berkolom biasa.
 */
export const isFormBuilderWorkspace = (pathname: string): boolean =>
  /^\/(lembaga|mahasiswa)\/forms\/[^/]+\/?$/.test(pathname);
