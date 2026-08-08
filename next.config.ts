import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No `output: 'standalone'` — this is a self-hosted tool run via
  // `pnpm build && pnpm start` against the full checked-out repo, not a
  // minimal Docker image. Keeping the full source tree on disk at runtime
  // also means the regex-search worker thread (src/lib/search/regexWorker.js)
  // can be loaded by a plain filesystem path instead of needing bundler
  // configuration to trace a file that's never statically imported.
  serverExternalPackages: ['better-sqlite3', 'unzipper'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
