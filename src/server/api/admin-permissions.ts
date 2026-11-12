/**
 * Izin operator admin console. `role === 'admin'` (superadmin) otomatis
 * memiliki semua izin; operator biasa mendapat subset dari tabel
 * `admin_permission`.
 */
export const ADMIN_PERMISSIONS = [
  'accounts.read',
  'accounts.write',
  'accounts.roles',
  'lembaga.read',
  'lembaga.write',
  'lembaga.events',
  'lembaga.organization',
  'lembaga.forms',
  'lembaga.oprec',
  'lembaga.members',
  'access.read',
  'access.write',
  'audit.read',
  'reports.read',
  'reports.write',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminPermissionGroup = {
  id: string;
  label: string;
  permissions: { value: AdminPermission; label: string }[];
};

export const ADMIN_PERMISSION_GROUPS: AdminPermissionGroup[] = [
  {
    id: 'accounts',
    label: 'Akun',
    permissions: [
      { value: 'accounts.read', label: 'Lihat akun' },
      { value: 'accounts.write', label: 'Ubah profil akun' },
      { value: 'accounts.roles', label: 'Ubah email dan role' },
    ],
  },
  {
    id: 'lembaga',
    label: 'Lembaga',
    permissions: [
      { value: 'lembaga.read', label: 'Lihat lembaga' },
      { value: 'lembaga.write', label: 'Ubah profil lembaga' },
      { value: 'lembaga.events', label: 'Kelola kegiatan/kepengurusan' },
      { value: 'lembaga.organization', label: 'Kelola organogram' },
      { value: 'lembaga.forms', label: 'Kelola forms' },
      { value: 'lembaga.oprec', label: 'Kelola oprec' },
      { value: 'lembaga.members', label: 'Kelola anggota' },
    ],
  },
  {
    id: 'access',
    label: 'Akses',
    permissions: [
      { value: 'access.read', label: 'Lihat akses' },
      { value: 'access.write', label: 'Beri/cabut akses' },
    ],
  },
  {
    id: 'audit',
    label: 'Audit',
    permissions: [{ value: 'audit.read', label: 'Lihat audit' }],
  },
  {
    id: 'reports',
    label: 'Laporan',
    permissions: [
      { value: 'reports.read', label: 'Lihat laporan' },
      { value: 'reports.write', label: 'Ubah laporan' },
    ],
  },
];

export function hasAdminPermission(
  permissions: readonly string[] | null | undefined,
  required: AdminPermission,
): boolean {
  return permissions?.includes('*') === true || permissions?.includes(required) === true;
}
