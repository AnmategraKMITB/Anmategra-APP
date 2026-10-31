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
