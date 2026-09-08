'use client';

// Library Import
import { ChevronLeft, ChevronRight, Download, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
// Components Import
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '~/components/ui/sheet';
// Type Import
import { type DocNav, type DocPage } from '~/types/manual';

import { DocsArticle } from './docs-article';
import { DocsNav } from './docs-nav';
import { DocsToc } from './docs-toc';

type FlatPage = { href: string; title: string };

function hrefFor(basePath: string, slug: string[]): string {
  return slug.length === 0 ? basePath : `${basePath}/${slug.join('/')}`;
}

function flattenPages(nav: DocNav, basePath: string): FlatPage[] {
  const pages: FlatPage[] = [];
  if (nav.index) {
    pages.push({
      href: hrefFor(basePath, nav.index.slug),
      title: nav.index.title,
    });
  }
  for (const category of nav.categories) {
    for (const page of category.pages) {
      pages.push({ href: hrefFor(basePath, page.slug), title: page.title });
    }
  }
  return pages;
}

// Accessible light+dark styling shared by the manual's outline buttons.
const manualOutlineButton =
  'dark:border-[#7FBFD8] dark:text-[#7FBFD8] dark:hover:bg-[#7FBFD8]/10 dark:hover:text-[#7FBFD8] dark:active:bg-[#7FBFD8]/10 dark:active:text-[#7FBFD8]';

export function DocsShell({
  nav,
  page,
  basePath,
  pdfHref,
}: {
  nav: DocNav;
  page: DocPage;
  basePath: string;
  pdfHref: string;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (e.g. browser back/forward).
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const contentKey = page.meta.slug.join('/');
  const flat = flattenPages(nav, basePath);
  const currentHref = hrefFor(basePath, page.meta.slug);
  const currentIndex = flat.findIndex((item) => item.href === currentHref);
  const prev = currentIndex > 0 ? flat[currentIndex - 1] : null;
  const next =
    currentIndex >= 0 && currentIndex < flat.length - 1
      ? flat[currentIndex + 1]
      : null;

  return (
    <div className="py-8">
      {/* Top action row */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button
          variant="dark_blue_outline"
          size="sm"
          className={`gap-2 lg:hidden ${manualOutlineButton}`}
          aria-haspopup="dialog"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="h-4 w-4" />
          Daftar isi
        </Button>
        <div className="ml-auto">
          <Button
            variant="dark_blue_outline"
            size="sm"
            className={`gap-2 ${manualOutlineButton}`}
            asChild
          >
            <a href={pdfHref} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              Unduh PDF
            </a>
          </Button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Left navigation (desktop) */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8">
            <DocsNav nav={nav} basePath={basePath} />
          </div>
        </aside>

        {/* Content */}
        <main ref={articleRef} className="min-w-0 max-w-3xl flex-1">
          <DocsArticle content={page.content} />

          {(prev ?? next) && (
            <div className="mt-12 flex flex-col gap-4 border-t border-[#C4CACE] pt-6 dark:border-slate-700 sm:flex-row sm:justify-between">
              {prev ? (
                <Link
                  href={prev.href}
                  className="group flex flex-1 flex-col rounded-lg border border-[#C4CACE] p-4 transition-colors hover:border-[#2B6282] dark:border-slate-700 dark:hover:border-[#7FBFD8]"
                >
                  <span className="flex items-center gap-1 text-xs text-neutral-700 dark:text-slate-400">
                    <ChevronLeft className="h-3 w-3" />
                    Sebelumnya
                  </span>
                  <span className="mt-1 font-medium text-neutral-800 group-hover:text-[#2B6282] dark:text-slate-200 dark:group-hover:text-[#7FBFD8]">
                    {prev.title}
                  </span>
                </Link>
              ) : (
                <span className="hidden flex-1 sm:block" />
              )}
              {next ? (
                <Link
                  href={next.href}
                  className="group flex flex-1 flex-col rounded-lg border border-[#C4CACE] p-4 text-right transition-colors hover:border-[#2B6282] dark:border-slate-700 dark:hover:border-[#7FBFD8]"
                >
                  <span className="flex items-center justify-end gap-1 text-xs text-neutral-700 dark:text-slate-400">
                    Selanjutnya
                    <ChevronRight className="h-3 w-3" />
                  </span>
                  <span className="mt-1 font-medium text-neutral-800 group-hover:text-[#2B6282] dark:text-slate-200 dark:group-hover:text-[#7FBFD8]">
                    {next.title}
                  </span>
                </Link>
              ) : (
                <span className="hidden flex-1 sm:block" />
              )}
            </div>
          )}
        </main>

        {/* On this page (wide screens) */}
        <aside className="hidden w-56 shrink-0 xl:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8">
            <DocsToc articleRef={articleRef} contentKey={contentKey} />
          </div>
        </aside>
      </div>

      {/* Mobile navigation drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-80 max-w-[85vw] overflow-y-auto p-6"
        >
          <SheetTitle>Daftar isi</SheetTitle>
          <SheetDescription className="sr-only">
            Navigasi manual Anmategra
          </SheetDescription>
          <div className="mt-4">
            <DocsNav
              nav={nav}
              basePath={basePath}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
