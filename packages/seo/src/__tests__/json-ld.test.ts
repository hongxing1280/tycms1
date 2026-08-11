import { describe, expect, it } from 'vitest';
import type { NewsArticleRecord, SiteRecord } from '@sports/core';
import { breadcrumbJsonLd, serializeJsonLd, videoObjectJsonLd } from '../json-ld';

describe('json ld helpers', () => {
  it('serializes parseable breadcrumb json ld', () => {
    const json = serializeJsonLd(
      breadcrumbJsonLd([
        { name: '首页', url: 'https://site-a.local/' },
        { name: '体育新闻', url: 'https://site-a.local/news/sports-news/' },
      ]),
    );

    expect(JSON.parse(json)).toMatchObject({ '@type': 'BreadcrumbList' });
  });

  it('serializes video detail json ld without exposing playback urls', () => {
    const now = new Date('2026-05-28T08:00:00.000Z');
    const json = serializeJsonLd(
      videoObjectJsonLd({
        site: {
          id: 'site-a',
          name: '体育前线',
          primaryDomain: 'site-a.local',
          primaryProtocol: 'https',
          status: 'ACTIVE',
          showSignalSources: false,
          seoIndexStatus: 'INDEX',
          domains: [],
          createdAt: now,
          updatedAt: now,
        } satisfies SiteRecord,
        article: {
          id: 'news-a',
          siteId: 'site-a',
          categoryId: 'cat-video',
          title: '蒙特雷女足VS美洲狮女足录像回放',
          slug: 'replay-a',
          summary: '蒙特雷女足对阵美洲狮女足录像回放。',
          content: '蒙特雷女足对阵美洲狮女足录像回放。',
          status: 'PUBLISHED',
          isTop: false,
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        } satisfies NewsArticleRecord,
        canonicalUrl: 'https://site-a.local/video/match-replay/replay-a.html',
      }),
    );

    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed).toMatchObject({ '@type': 'VideoObject', name: '蒙特雷女足VS美洲狮女足录像回放' });
    expect(json).not.toContain('m3u8');
  });
});
