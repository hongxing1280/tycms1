import type { MetadataRoute } from 'next';
import type { CategoryRecord, SportMatchRecord } from '@sports/core';
import { cmsRepository } from '@sports/db';
import { getRequestHost } from '../src/lib/headers';
import {
  buildCategoryPublicUrl,
  buildHomePublicUrl,
  buildMatchPublicUrl,
  buildNewsPublicUrl,
  listConfiguredPublicCategories,
} from '../src/lib/public-route';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const resolution = cmsRepository.resolveSite(getRequestHost());
  if (!resolution.ok) {
    return [];
  }

  const site = resolution.site;
  const urlConfigs = cmsRepository.listUrlConfigs(site.id);
  const categories = listConfiguredPublicCategories(site, cmsRepository.listCategories(), urlConfigs);
  const categoryIds = new Set(categories.map((category) => category.id));
  const news = cmsRepository
    .listNews({ siteId: site.id, status: 'PUBLISHED', limit: 1000 })
    .filter((article) => categoryIds.has(article.categoryId));
  const liveReplays = cmsRepository
    .listLiveReplays({ siteId: site.id, limit: 1000 })
    .filter((replay) => categoryIds.has(replay.categoryId));
  const matches = cmsRepository.listMatches(site.id, { recentHours: 24, upcomingHours: 24 * 7, limit: 1000 });
  let homeUrl: string;
  try {
    homeUrl = buildHomePublicUrl({ site, urlConfigs, absolute: true });
  } catch {
    return [];
  }

  return [
    {
      url: homeUrl,
      lastModified: site.updatedAt,
      changeFrequency: 'daily',
      priority: 1,
    },
    ...categories.map((category) => ({
      url: buildCategoryPublicUrl({
        site,
        category,
        urlConfigs,
        absolute: true,
      }),
      lastModified: category.updatedAt,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    })),
    ...news.flatMap((article) => {
      const category = article.category ?? categories.find((candidate) => candidate.id === article.categoryId);
      if (!category) return [];

      return [
        {
          url: buildNewsPublicUrl({
            site,
            article,
            category,
            urlConfigs,
            absolute: true,
          }),
          lastModified: article.updatedAt,
          changeFrequency: 'daily' as const,
          priority: 0.7,
        },
      ];
    }),
    ...liveReplays.flatMap((replay) => {
      const category = categories.find((candidate) => candidate.id === replay.categoryId);
      if (!category) return [];

      return [
        {
          url: buildNewsPublicUrl({
            site,
            article: { slug: replay.slug },
            category,
            urlConfigs,
            absolute: true,
          }),
          lastModified: replay.updatedAt,
          changeFrequency: 'daily' as const,
          priority: 0.7,
        },
      ];
    }),
    ...matches.flatMap((match) => {
      const category = findSportCategory(categories, match);
      if (!category) return [];

      return [
        {
          url: buildMatchPublicUrl({
            site,
            match,
            category,
            urlConfigs,
            absolute: true,
          }),
          lastModified: match.updatedAt,
          changeFrequency: 'hourly' as const,
          priority: 0.7,
        },
      ];
    }),
  ];
}

function findSportCategory(categories: CategoryRecord[], match: SportMatchRecord): CategoryRecord | undefined {
  const pattern = match.sport === 'BASKETBALL' ? /篮球|basketball|nba|cba/i : /足球|football|soccer/i;
  const matches = categories.filter((category) => pattern.test(`${category.name} ${category.slug}`));
  return (
    matches.find((category) => /直播|live/i.test(`${category.name} ${category.slug}`)) ??
    matches.find((category) => /赛程|schedule/i.test(`${category.name} ${category.slug}`)) ??
    matches[0]
  );
}
