'use client';

// Library Import
import Link from 'next/link';
import { type Components } from 'react-markdown';

// Minimal hast node shape we need for the callout transform.
type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i;

function walk(node: HastNode, visitor: (node: HastNode) => void): void {
  visitor(node);
  node.children?.forEach((child) => walk(child, visitor));
}

/**
 * Turns GitHub-style alert blockquotes (`> [!NOTE]` etc.) into styled callouts
 * by stripping the marker and tagging the blockquote with a `callout-<type>`
 * class. Styling lives in globals.css. Written as a small inline rehype plugin
 * so no extra dependency is needed.
 */
export function rehypeGithubAlerts() {
  return (tree: HastNode) => {
    walk(tree, (node) => {
      if (node.type !== 'element' || node.tagName !== 'blockquote') return;

      const firstParagraph = node.children?.find(
        (child) => child.type === 'element' && child.tagName === 'p',
      );
      const firstText = firstParagraph?.children?.[0];
      if (!firstText || firstText.type !== 'text' || !firstText.value) return;

      const match = ALERT_RE.exec(firstText.value);
      if (!match) return;

      const type = match[1]!.toLowerCase();
      // Drop the marker and the line break / space that follows it.
      firstText.value = firstText.value
        .slice(match[0].length)
        .replace(/^[ \t]*\n/, '')
        .replace(/^[ \t]+/, '');

      node.properties = node.properties ?? {};
      node.properties.className = ['callout', `callout-${type}`];
    });
  };
}

/**
 * Component overrides for react-markdown. Internal links use next/link for
 * client-side navigation; everything else is styled via the `.docs-content`
 * scope in globals.css.
 */
export const markdownComponents: Components = {
  a: ({ href, children }) => {
    const target = typeof href === 'string' ? href : '';
    if (target.startsWith('/')) {
      return <Link href={target}>{children}</Link>;
    }
    const external = target.startsWith('http');
    return (
      <a
        href={target}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element -- markdown images lack intrinsic dimensions
    <img
      src={typeof src === 'string' ? src : ''}
      alt={alt ?? ''}
      loading="lazy"
      className="block h-auto max-w-full"
    />
  ),
  // Wide tables scroll inside their own container instead of stretching the
  // page, so future content with many columns stays readable on mobile.
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
};
