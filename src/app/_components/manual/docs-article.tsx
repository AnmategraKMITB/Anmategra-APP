'use client';

// Library Import
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

// Components Import
import {
  markdownComponents,
  rehypeGithubAlerts,
} from './markdown-components';

export function DocsArticle({ content }: { content: string }) {
  return (
    <div className="docs-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- inline rehype plugin
          rehypeGithubAlerts as never,
          rehypeHighlight,
        ]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
