/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@sports/config', '@sports/core', '@sports/db', '@sports/seo', '@sports/templates'],
  async headers() {
    return [
      {
        source: '/((?!admin|api|_next).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, max-age=0, must-revalidate',
          },
          {
            key: 'Vary',
            value: 'Host, X-Forwarded-Host, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept-Encoding',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
