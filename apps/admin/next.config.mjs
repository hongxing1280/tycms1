/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@sports/config', '@sports/core', '@sports/db'],
};

export default nextConfig;
