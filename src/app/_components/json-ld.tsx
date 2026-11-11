/**
 * Merender structured data schema.org.
 *
 * Data yang masuk ke sini sebagian berasal dari input pengguna (mis. deskripsi
 * lembaga), jadi '<' di-escape jadi bentuk unicode-nya. Tanpa itu, '</script>'
 * di dalam data akan menutup tag script lebih awal dan sisanya terbaca sebagai
 * markup.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
