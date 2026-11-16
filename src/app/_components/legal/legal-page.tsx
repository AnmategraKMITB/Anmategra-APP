import Link from 'next/link';
import { type ReactNode } from 'react';

export type LegalLocale = 'id' | 'en';

export type LegalRelatedLink = { href: string; label: string };

export type LegalContent = {
  lang: LegalLocale;
  href: string;
  title: string;
  description: string;
  switchLabel: string;
  switchHref: string;
  switchHrefLang: string;
  heading: string;
  effective: string;
  intro: ReactNode;
  sections: { title: string; body: ReactNode }[];
  related: LegalRelatedLink[];
};

export const LEGAL_CONTACT_EMAIL = 'anmategra@km.itb.ac.id';

export const contactLink = (
  <a
    href={`mailto:${LEGAL_CONTACT_EMAIL}`}
    className="underline underline-offset-2"
  >
    {LEGAL_CONTACT_EMAIL}
  </a>
);

/** Daftar butir dengan gaya seragam untuk seluruh dokumen legal. */
export function Daftar({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-6">{children}</ul>;
}

export function LegalPage({ content }: { content: LegalContent }) {
  return (
    <article
      lang={content.lang}
      className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-10"
    >
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-[#0B5C8A] sm:text-3xl">
          {content.heading}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-sm text-slate-500">{content.effective}</p>
          <Link
            href={content.switchHref}
            hrefLang={content.switchHrefLang}
            lang={content.switchHrefLang}
            className="text-sm underline underline-offset-2 hover:opacity-80"
          >
            {content.switchLabel}
          </Link>
        </div>
        {content.intro}
      </header>

      {content.sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-[#0B5C8A] sm:text-2xl">
            {section.title}
          </h2>
          <div className="flex flex-col gap-3 leading-relaxed text-slate-700">
            {section.body}
          </div>
        </section>
      ))}

      <footer className="flex flex-col gap-2 border-t border-slate-200 pt-6">
        {content.related.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-[#0B5C8A] underline underline-offset-2 hover:opacity-80"
          >
            {link.label}
          </Link>
        ))}
      </footer>
    </article>
  );
}
