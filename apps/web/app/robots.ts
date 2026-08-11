import type { MetadataRoute } from 'next';
import { buildPublicOrigin } from '@sports/core';
import { cmsRepository } from '@sports/db';
import { getRequestHost } from '../src/lib/headers';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const resolution = cmsRepository.resolveSite(getRequestHost());
  const site = resolution.ok ? resolution.site : cmsRepository.store.sites[0];

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/preview/', '/search?'],
    },
    sitemap: `${buildPublicOrigin(site)}/sitemap.xml`,
  };
}
