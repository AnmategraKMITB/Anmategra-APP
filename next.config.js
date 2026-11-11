/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import('./src/env.js');

/** @type {import("next").NextConfig} */
const config = {
  // Lint dijalankan terpisah (`npm run lint`, job "Lint" di CI). Lint bawaan
  // `next build` di Next 14 tidak kompatibel dengan ESLint 9 / flat config.
  eslint: {
    ignoreDuringBuilds: true,
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
