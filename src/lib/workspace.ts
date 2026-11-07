/** Editor organogram: ruang kerja layar penuh tanpa kolom pembatas lebar dan tanpa footer situs. */
export const isOrganogramWorkspace = (pathname: string): boolean =>
  /\/kegiatan\/[^/]+\/organogram\/?$/.test(pathname);
