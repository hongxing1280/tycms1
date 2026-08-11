import { buildPublicOrigin, type SiteRecord } from '@sports/core';

export function buildRobotsTxt(site: SiteRecord): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    'Disallow: /preview/',
    'Disallow: /search?',
    `Sitemap: ${buildPublicOrigin(site)}/sitemap.xml`,
    '',
  ].join('\n');
}
