// Shared types for the in-app manual/documentation feature. Kept separate from
// the server-only loader (src/server/manual/docs.ts) so client components can
// import them safely.

export type DocPageMeta = {
  // URL segments relative to the manual base path. Empty array = index page.
  slug: string[];
  title: string;
  order: number;
};

export type DocCategory = {
  label: string;
  order: number;
  pages: DocPageMeta[];
};

export type DocNav = {
  index: DocPageMeta | null;
  categories: DocCategory[];
};

export type DocPage = {
  meta: DocPageMeta;
  content: string;
};
