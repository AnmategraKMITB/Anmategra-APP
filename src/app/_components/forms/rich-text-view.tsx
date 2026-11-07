import { cn } from '~/lib/utils';

import { type RichNode, parseRichText } from './rich-text';

function renderNodes(nodes: RichNode[], keyPrefix = ''): React.ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}${i}`;
    if (node.type === 'link') {
      return (
        <a
          key={key}
          href={node.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-primary-400 underline underline-offset-2 hover:text-primary-500"
        >
          {renderNodes(node.children, `${key}.`)}
        </a>
      );
    }
    return (
      <span
        key={key}
        className={cn(
          node.bold && 'font-semibold',
          node.italic && 'italic',
          node.underline && 'underline underline-offset-2',
        )}
      >
        {node.text}
      </span>
    );
  });
}

/** Teks kaya sebagai elemen React: tidak ada HTML mentah yang pernah ditulis ke halaman. */
export function RichText({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span className={cn('whitespace-pre-line', className)}>
      {renderNodes(parseRichText(value))}
    </span>
  );
}

/** Apakah teks ini memuat penanda format (untuk menampilkan pratinjau di editor). */
export function hasRichMarkup(value: string): boolean {
  return parseRichText(value).some(
    (n) =>
      n.type === 'link' ||
      n.bold === true ||
      n.italic === true ||
      n.underline === true,
  );
}
