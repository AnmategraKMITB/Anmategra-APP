'use client';

// Library Import
import { type RefObject, useEffect, useState } from 'react';
// Lib Import
import { cn } from '~/lib/utils';

type TocItem = {
  id: string;
  text: string;
  level: number;
};

/**
 * "Di halaman ini" table of contents. Reads the rendered article's h2/h3
 * headings straight from the DOM (so anchor ids always match rehype-slug) and
 * highlights the section currently in view.
 */
export function DocsToc({
  articleRef,
  contentKey,
}: {
  articleRef: RefObject<HTMLElement | null>;
  contentKey: string;
}) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const root = articleRef.current;
    if (!root) return;

    const headings = Array.from(
      root.querySelectorAll<HTMLHeadingElement>('h2[id], h3[id]'),
    );

    setItems(
      headings.map((heading) => ({
        id: heading.id,
        text: heading.textContent ?? '',
        level: heading.tagName === 'H2' ? 2 : 3,
      })),
    );

    if (headings.length === 0) {
      setActiveId('');
      return;
    }

    setActiveId(headings[0]!.id);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0]?.target as HTMLElement | undefined;
        if (top) setActiveId(top.id);
      },
      { rootMargin: '-88px 0px -70% 0px', threshold: 0 },
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [articleRef, contentKey]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Di halaman ini" className="text-sm">
      <p className="mb-3 font-semibold text-neutral-900">Di halaman ini</p>
      <ul className="space-y-2 border-l border-[#C4CACE]">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                '-ml-px block border-l border-transparent py-0.5 text-neutral-700 transition-colors hover:text-[#2B6282]',
                item.level === 3 ? 'pl-7' : 'pl-4',
                activeId === item.id &&
                  'border-[#2B6282] font-medium text-[#2B6282]',
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
