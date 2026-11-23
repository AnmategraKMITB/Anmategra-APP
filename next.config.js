/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import('./src/env.js');

/** @type {import("next").NextConfig} */
const config = {
  // Lint dijalankan terpisah (`bun lint`, job "Lint" di CI); ESLint tidak
  // terpasang, jadi lint bawaan `next build` dimatikan.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Tipe dicek terpisah oleh `bun run check` (TypeScript 7, job "Typecheck" di
  // CI), termasuk .next/types dari `next typegen`. Pengecekan bawaan `next
  // build` memakai TypeScript 6 dan hanya mengulang pekerjaan yang sama.
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizeCss: true,
  },
  images: {
    // Default-nya 60 dtk: tiap menit varian gambar kedaluwarsa dan di-resize
    // ulang oleh proses Node (CPU). Gambar upload punya URL unik per file,
    // jadi aman di-cache lama.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Kurangi jumlah varian lebar yang mungkin diminta browser.
    deviceSizes: [640, 828, 1080, 1280, 1920],
    imageSizes: [32, 64, 128, 256],
    domains: ['lh3.googleusercontent.com', 'utfs.uploadthing.com'],
    remotePatterns: [
      {
        hostname: 'utfs.io',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  // headers: async () => {
  //     return [
  //         {
  //             source: "/api/trpc/profil",
  //             headers: [
  //                 {
  //                     key: "Cache-Control",
  //                     value: "public, s-maxage=90, max-age=90",
  //                 },
  //             ],
  //         },
  //     ];
  // },
};

export default config;
