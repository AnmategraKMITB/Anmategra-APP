import 'server-only';

// Library Import
import { promises as fs } from 'fs';
import matter from 'gray-matter';
import path from 'path';

// Type Import
import {
  type DocCategory,
  type DocNav,
  type DocPage,
  type DocPageMeta,
} from '~/types/manual';

// The directory that holds the manual's markdown content. Folder = category,
// file = page (see content/manual/README-style layout).
const CONTENT_DIR = path.join(process.cwd(), 'content', 'manual');

// Only allow slug segments that map safely onto the filesystem (guards against
// path traversal via the [[...slug]] catch-all route).
const SLUG_SEGMENT = /^[a-z0-9-]+$/i;

type CategoryConfig = {
  label?: string;
  order?: number;
};

function titleFromSlug(segment: string): string {
  return segment
    .split('-')
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function parseOrder(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isValidSlug(slug: string[]): boolean {
  return slug.every((segment) => SLUG_SEGMENT.test(segment));
}

async function readCategoryConfig(dir: string): Promise<CategoryConfig> {
  try {
    const raw = await fs.readFile(path.join(dir, '_category.json'), 'utf8');
    return JSON.parse(raw) as CategoryConfig;
  } catch {
    return {};
  }
}

async function readPageMeta(
  filePath: string,
  slug: string[],
): Promise<DocPageMeta> {
  const raw = await fs.readFile(filePath, 'utf8');
  const { data } = matter(raw);
  const fallbackTitle = titleFromSlug(slug[slug.length - 1] ?? 'index');
  return {
    slug,
    title: typeof data.title === 'string' ? data.title : fallbackTitle,
    order: parseOrder(data.order, 999),
  };
}

/**
 * Scans content/manual and builds the navigation tree: an optional top-level
 * index page plus one entry per category folder, each with its ordered pages.
 */
export async function getDocNav(): Promise<DocNav> {
  let entries;
  try {
    entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true });
  } catch {
    return { index: null, categories: [] };
  }

  let index: DocPageMeta | null = null;
  const categories: DocCategory[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name === 'index.md') {
      index = await readPageMeta(path.join(CONTENT_DIR, 'index.md'), []);
      continue;
    }

    if (!entry.isDirectory() || !SLUG_SEGMENT.test(entry.name)) continue;

    const categoryDir = path.join(CONTENT_DIR, entry.name);
    const config = await readCategoryConfig(categoryDir);
    const files = await fs.readdir(categoryDir, { withFileTypes: true });

    const pages: DocPageMeta[] = [];
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.md')) continue;
      const pageName = file.name.replace(/\.md$/, '');
      if (!SLUG_SEGMENT.test(pageName)) continue;
      pages.push(
        await readPageMeta(path.join(categoryDir, file.name), [
          entry.name,
          pageName,
        ]),
      );
    }

    if (pages.length === 0) continue;
    pages.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

    categories.push({
      label: config.label ?? titleFromSlug(entry.name),
      order: parseOrder(config.order, 999),
      pages,
    });
  }

  categories.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

  return { index, categories };
}

/**
 * Loads a single page's raw markdown by URL slug. Empty slug resolves to the
 * top-level index.md. Returns null for missing or invalid paths.
 */
export async function getDocPage(slug: string[]): Promise<DocPage | null> {
  if (!isValidSlug(slug)) return null;

  const relativePath =
    slug.length === 0 ? 'index.md' : `${slug.join(path.sep)}.md`;
  const filePath = path.join(CONTENT_DIR, relativePath);

  // Defence in depth: ensure the resolved path stays inside CONTENT_DIR.
  const resolved = path.resolve(filePath);
  if (resolved !== CONTENT_DIR && !resolved.startsWith(CONTENT_DIR + path.sep)) {
    return null;
  }

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }

  const { data, content } = matter(raw);
  const fallbackTitle = titleFromSlug(slug[slug.length - 1] ?? 'index');

  return {
    meta: {
      slug,
      title: typeof data.title === 'string' ? data.title : fallbackTitle,
      order: parseOrder(data.order, 999),
    },
    content,
  };
}

/**
 * All available page slugs, for generateStaticParams / prefetching.
 */
export async function getAllDocSlugs(): Promise<string[][]> {
  const nav = await getDocNav();
  const slugs: string[][] = [];
  if (nav.index) slugs.push(nav.index.slug);
  for (const category of nav.categories) {
    for (const page of category.pages) slugs.push(page.slug);
  }
  return slugs;
}
