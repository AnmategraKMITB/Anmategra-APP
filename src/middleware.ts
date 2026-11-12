import { getToken } from 'next-auth/jwt';
import { type NextRequest, NextResponse } from 'next/server';
import { decideFormsPath } from '~/lib/forms-path';

const AUTH_ROUTES = ['/authentication'];
const STATIC = [
  '/_next',
  '/api',
  '/images',
  '/favicon.ico',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
  // Halaman pendaratan popup MSAL; harus bisa dibuka tanpa sesi dan tanpa
  // dialihkan ke halaman peran.
  '/msal-redirect',
];
const PUBLIC_ROUTES = [
  '/profile-lembaga',
  '/profile-kegiatan',
  '/404',
];
// Rute publik tanpa prefiks role: URL yang sama berlaku untuk pengunjung dan
// semua role, jadi tidak dialihkan ke `/<role>/manual`.
const PUBLIC_SHARED_ROUTES = ['/manual'];
// Purwarupa internal: tidak untuk publik. Tanpa login dialihkan ke halaman
// login; yang sudah login dilewatkan tanpa prefiks role.
const PROTOTYPE_ROUTES = ['/prototype'];
// Authenticated-only routes shared by all roles. These stay unprefixed so the
// same URL works for lembaga, mahasiswa, and admin users.
// `/manage` memuat alat pengelola (kegiatan, oprec, forms); aksesnya ditentukan
// per halaman lewat canManageLembaga/canManageEvent, bukan oleh role akun.
const AUTHENTICATED_SHARED_ROUTES = ['/manage'];

const matchesRoute = (pathname: string, route: string) =>
  pathname === route || pathname.startsWith(`${route}/`);

export default async function middleware(req: NextRequest) {
  // Skip static files and API routes
  if (STATIC.some((route) => req.nextUrl.pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  const host = (req.headers.get('host') ?? '').split(':')[0]?.toLowerCase();
  const adminHost = process.env.ADMIN_HOST?.toLowerCase();
  const demoHost = process.env.DEMO_HOST?.toLowerCase();

  // admin.anmategra.com: root langsung ke backoffice.
  if (adminHost && host === adminHost && pathname === '/') {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  // Jangan biarkan host demo melayani build produksi.
  if (demoHost && host === demoHost && process.env.APP_ENV !== 'demo') {
    return NextResponse.rewrite(new URL('/404', req.url));
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Form pages: the fill page is shared by every role (no role prefix) and the
  // public preview needs no login at all, even for someone who is logged in.
  const forms = decideFormsPath(pathname, req.nextUrl.search, !!token);
  if (forms.kind === 'public' || forms.kind === 'shared') {
    return NextResponse.next();
  }
  if (forms.kind === 'login') {
    return NextResponse.redirect(new URL(forms.location, req.url));
  }

  // Manual terbuka untuk publik dan memakai satu URL untuk semua role.
  if (PUBLIC_SHARED_ROUTES.some((route) => matchesRoute(pathname, route))) {
    return NextResponse.next();
  }

  if (
    [...PROTOTYPE_ROUTES, ...AUTHENTICATED_SHARED_ROUTES].some((route) =>
      matchesRoute(pathname, route),
    )
  ) {
    if (!token) {
      return NextResponse.redirect(new URL('/authentication', req.url));
    }
    return NextResponse.next();
  }

  // Allow public routes without redirection
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) && !token) {
    return NextResponse.next();
  }

  // Redirect to authentication if not logged in (except for root and auth page)
  if (pathname !== '/' && pathname !== '/authentication' && pathname !== '/auth-error' && !token) {
    return NextResponse.redirect(new URL('/authentication', req.url));
  }

  // If authenticated, redirect from auth routes to role-based home
  if (AUTH_ROUTES.includes(pathname) && token) {
    return NextResponse.redirect(new URL(`/${token.role}`, req.url));
  }

  // If authenticated and accessing root, redirect to role-based home
  if (pathname === '/' && token) {
    return NextResponse.redirect(new URL(`/${token.role}`, req.url));
  }

  // Backoffice punya guard sendiri di src/app/admin/layout.tsx: superadmin
  // (role admin) atau operator dengan izin dari tabel admin_permission.
  // Jangan paksa operator ber-role mahasiswa/lembaga kembali ke home role-nya.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return NextResponse.next();
  }

  // If authenticated and URL doesn't start with role, prepend role
  const role = token?.role;
  if (role) {
    const rolePrefix = `/${role}`;
    
    // If the path doesn't start with the role prefix
    if (!pathname.startsWith(rolePrefix)) {
      // Check if it's trying to access another role's route
      const otherRoles = ['admin', 'lembaga', 'mahasiswa'].filter(r => r !== role);
      const isAccessingOtherRole = otherRoles.some(r => pathname.startsWith(`/${r}`));
      
      if (isAccessingOtherRole) {
        // Redirect to their own role's home
        return NextResponse.redirect(new URL(`/${role}`, req.url));
      }
      
      // Otherwise, prepend their role to the path
      return NextResponse.redirect(new URL(`${rolePrefix}${pathname}`, req.url));
    }
  }

  return NextResponse.next();
}

// Prefiks yang sama dengan STATIC di atas: request ke sana tidak perlu masuk middleware sama
// sekali (route API mengecek sesinya sendiri). Tanpa matcher, setiap file JS/CSS, gambar, dan
// panggilan tRPC tetap menjalankan middleware dulu sebelum dilewatkan.
export const config = {
  matcher: [
    '/((?!api|_next|images|favicon\\.ico|manifest\\.json|robots\\.txt|sitemap\\.xml|msal-redirect).*)',
  ],
};
