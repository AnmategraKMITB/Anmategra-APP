'use client';

// Library Import
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

// Components Import
import { ManualDemo } from './demo/registry';
import {
  markdownComponents,
  rehypeGithubAlerts,
} from './markdown-components';

type Segment = { kind: 'markdown'; text: string } | { kind: 'demo'; id: string };

// Baris `::demo[nama]` yang berdiri sendiri menanam satu simulasi interaktif.
const DEMO_LINE = /^::demo\[([a-z0-9-]+)\][ \t]*$/gm;

/**
 * Memecah markdown di tiap baris demo. Simulasi dirender di luar
 * `.docs-content` supaya gaya tipografi artikel tidak bocor ke dalamnya.
 */
function splitContent(content: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of content.matchAll(DEMO_LINE)) {
    const text = content.slice(cursor, match.index);
    if (text.trim() !== '') segments.push({ kind: 'markdown', text });
    segments.push({ kind: 'demo', id: match[1]! });
    cursor = match.index + match[0].length;
  }
  const rest = content.slice(cursor);
  if (rest.trim() !== '') segments.push({ kind: 'markdown', text: rest });
  return segments;
}

export function DocsArticle({ content }: { content: string }) {
  return (
    <>
      {splitContent(content).map((segment, index) =>
        segment.kind === 'demo' ? (
          <ManualDemo key={`${index}-${segment.id}`} id={segment.id} />
        ) : (
          <div key={index} className="docs-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[
                rehypeSlug,
                rehypeGithubAlerts as never,
                rehypeHighlight,
              ]}
              components={markdownComponents}
            >
              {segment.text}
            </ReactMarkdown>
          </div>
        ),
      )}
    </>
  );
}
