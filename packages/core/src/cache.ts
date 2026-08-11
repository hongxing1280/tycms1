import type { CategoryRecord, NewsArticleRecord, PageType, SiteRecord } from './types';

export function siteCacheTag(siteId: string): string {
  return `site:${siteId}`;
}

export function pageCacheTag(siteId: string, pageType: PageType): string {
  return `site:${siteId}:page:${pageType.toLowerCase()}`;
}

export function newsCacheTag(newsId: string): string {
  return `news:${newsId}`;
}

export function categoryCacheTag(categoryId: string): string {
  return `category:${categoryId}`;
}

export function templateCacheTag(templateKey: string): string {
  return `template:${templateKey}`;
}

export function buildNewsInvalidationTags(
  site: SiteRecord,
  article: NewsArticleRecord,
  category: CategoryRecord,
): string[] {
  return [
    siteCacheTag(site.id),
    pageCacheTag(site.id, 'HOME'),
    pageCacheTag(site.id, 'NEWS_CATEGORY'),
    pageCacheTag(site.id, 'NEWS_DETAIL'),
    newsCacheTag(article.id),
    categoryCacheTag(category.id),
    templateCacheTag(site.template?.key ?? 'jinqiu-live'),
  ];
}
