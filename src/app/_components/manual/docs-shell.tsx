'use client';

// Library Import
import { ChevronLeft, ChevronRight, Download, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
// Components Import
import { Button } from '~/components/ui/button';
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
          className="gap-2 lg:hidden"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="h-4 w-4" />
          Daftar isi
        </Button>
        <div className="ml-auto">
          <Button
            variant="dark_blue_outline"
            size="sm"
            className="gap-2"
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
        <main ref={articleRef} className="min-w-0 flex-1">
          <DocsArticle content={page.content} />

          {(prev ?? next) && (
            <div className="mt-12 flex flex-col gap-4 border-t border-[#C4CACE] pt-6 sm:flex-row sm:justify-between">
              {prev ? (
                <Link
                  href={prev.href}
                  className="group flex flex-1 flex-col rounded-lg border border-[#C4CACE] p-4 transition-colors hover:border-[#2B6282]"
                >
                  <span className="flex items-center gap-1 text-xs text-neutral-700">
                    <ChevronLeft className="h-3 w-3" />
                    Sebelumnya
                  </span>
                  <span className="mt-1 font-medium text-neutral-800 group-hover:text-[#2B6282]">
                    {prev.title}
                  </span>
                </Link>
              ) : (
                <span className="hidden flex-1 sm:block" />
              )}
              {next ? (
                <Link
                  href={next.href}
                  className="group flex flex-1 flex-col rounded-lg border border-[#C4CACE] p-4 text-right transition-colors hover:border-[#2B6282]"
                >
                  <span className="flex items-center justify-end gap-1 text-xs text-neutral-700">
                    Selanjutnya
                    <ChevronRight className="h-3 w-3" />
                  </span>
                  <span className="mt-1 font-medium text-neutral-800 group-hover:text-[#2B6282]">
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
      {mobileNavOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] overflow-y-auto bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <p className="font-semibold text-neutral-900">Daftar isi</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <DocsNav
              nav={nav}
              basePath={basePath}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
