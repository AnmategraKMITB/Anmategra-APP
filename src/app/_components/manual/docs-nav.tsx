'use client';

// Library Import
import Link from 'next/link';
import { usePathname } from 'next/navigation';
// Lib Import
import { cn } from '~/lib/utils';
// Type Import
import { type DocNav } from '~/types/manual';

function hrefFor(basePath: string, slug: string[]): string {
  return slug.length === 0 ? basePath : `${basePath}/${slug.join('/')}`;
}

export function DocsNav({
  nav,
  basePath,
  onNavigate,
}: {
  nav: DocNav;
  basePath: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const NavLink = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'block rounded-md px-3 py-1.5 text-[15px] text-neutral-600 transition-colors hover:bg-[#DFE7EC] hover:text-[#2B6282]',
          'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-[#7FBFD8]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6282] focus-visible:ring-offset-1 focus-visible:ring-offset-background dark:focus-visible:ring-[#7FBFD8]',
          active &&
            'bg-[#DFE7EC] font-medium text-[#2B6282] dark:bg-slate-800 dark:text-[#7FBFD8]',
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav aria-label="Dokumentasi" className="flex flex-col gap-6">
      {nav.index && (
        <NavLink
          href={hrefFor(basePath, nav.index.slug)}
          label={nav.index.title}
        />
      )}

      {nav.categories.map((category) => (
        <div key={category.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-700 dark:text-slate-500">
            {category.label}
          </p>
          {category.pages.map((page) => (
            <NavLink
              key={page.slug.join('/')}
              href={hrefFor(basePath, page.slug)}
              label={page.title}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}
