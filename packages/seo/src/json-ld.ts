import { buildPublicOrigin, type BreadcrumbItem, type NewsArticleRecord, type SiteRecord } from '@sports/core';

export type JsonLdValue = Record<string, unknown>;

export function newsArticleJsonLd(input: {
  site: SiteRecord;
  article: NewsArticleRecord;
  canonicalUrl: string;
}): JsonLdValue {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: input.article.title,
    description: input.article.summary,
    image: input.article.coverImageUrl ? [input.article.coverImageUrl] : undefined,
    datePublished: input.article.publishedAt?.toISOString(),
    dateModified: input.article.updatedAt.toISOString(),
    author: {
      '@type': 'Person',
      name: input.article.author ?? input.site.name,
    },
    publisher: {
      '@type': 'Organization',
      name: input.site.name,
      url: buildPublicOrigin(input.site),
    },
    mainEntityOfPage: input.canonicalUrl,
  };
}

export function videoObjectJsonLd(input: {
  site: SiteRecord;
  article: NewsArticleRecord;
  canonicalUrl: string;
}): JsonLdValue {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: input.article.title,
    description: input.article.summary,
    thumbnailUrl: input.article.coverImageUrl ? [input.article.coverImageUrl] : undefined,
    uploadDate: input.article.publishedAt?.toISOString(),
    dateModified: input.article.updatedAt.toISOString(),
    publisher: {
      '@type': 'Organization',
      name: input.site.name,
      url: buildPublicOrigin(input.site),
    },
    mainEntityOfPage: input.canonicalUrl,
  };
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdValue {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function serializeJsonLd(value: JsonLdValue): string {
  return JSON.stringify(removeUndefined(value));
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, removeUndefined(entryValue)]),
    );
  }

  return value;
}
