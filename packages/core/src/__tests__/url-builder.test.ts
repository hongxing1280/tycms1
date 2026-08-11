import { describe, expect, it } from 'vitest';
import { buildPublicUrl, fillUrlPattern } from '../url-builder';
import type { SiteRecord } from '../types';

const site: SiteRecord = {
  id: 'site-a',
  name: '体育前线',
  primaryDomain: 'site-a.local',
  primaryProtocol: 'https',
  status: 'ACTIVE',
  showSignalSources: false,
  seoIndexStatus: 'INDEX',
  domains: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('url builder', () => {
  it('fills configured variables and normalizes public paths', () => {
    expect(fillUrlPattern('/news/{categorySlug}/{newsSlug}.html', {
      categorySlug: 'football',
      newsSlug: 'title-a',
    })).toBe('/news/football/title-a.html');
  });

  it('builds absolute canonical urls from the site primary domain', () => {
    expect(
      buildPublicUrl({
        site,
        pageType: 'NEWS_CATEGORY',
        data: { categorySlug: 'football' },
        absolute: true,
      }),
    ).toBe('https://site-a.local/news/football.html');
  });

  it('uses selected site url config when page type matches', () => {
    expect(
      buildPublicUrl({
        site,
        pageType: 'NEWS_DETAIL',
        data: { categorySlug: 'football', newsSlug: 'title-a' },
        preferredConfigId: 'url-selected',
        urlConfigs: [
          {
            id: 'url-default',
            siteId: 'site-a',
            rules: [
              {
                id: 'rule-default',
                categoryId: '',
                pageType: 'NEWS_CATEGORY',
                pattern: '/news/{categorySlug}.html',
                detailRules: [
                  { id: 'rule-default-detail', label: '默认内页', pageType: 'NEWS_DETAIL', pattern: '/news/{categorySlug}/{newsSlug}.html' },
                ],
              },
            ],
            name: '默认详情 URL',
            status: 'ACTIVE',
            pageType: 'NEWS_CATEGORY',
            pattern: '/news/{categorySlug}.html',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
          },
          {
            id: 'url-selected',
            siteId: 'site-a',
            rules: [
              {
                id: 'rule-selected',
                categoryId: '',
                pageType: 'NEWS_CATEGORY',
                pattern: '/article.html',
                detailRules: [
                  { id: 'rule-selected-detail', label: '选中内页', pageType: 'NEWS_DETAIL', pattern: '/article/{newsSlug}.html' },
                ],
              },
            ],
            name: '选中详情 URL',
            status: 'ACTIVE',
            pageType: 'NEWS_CATEGORY',
            pattern: '/article.html',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
          },
        ],
      }),
    ).toBe('/article/title-a.html');
  });

  it('does not silently fall back to another config when a selected config is missing a rule', () => {
    expect(() =>
      buildPublicUrl({
        site,
        pageType: 'NEWS_DETAIL',
        data: { categorySlug: 'football', newsSlug: 'title-a' },
        preferredConfigId: 'url-selected',
        urlConfigs: [
          {
            id: 'url-default',
            siteId: 'site-a',
            rules: [
              {
                id: 'rule-default',
                categoryId: '',
                pageType: 'NEWS_CATEGORY',
                pattern: '/news/{categorySlug}.html',
                detailRules: [
                  { id: 'rule-default-detail', label: '默认内页', pageType: 'NEWS_DETAIL', pattern: '/news/{categorySlug}/{newsSlug}.html' },
                ],
              },
            ],
            name: '默认详情 URL',
            status: 'ACTIVE',
            pageType: 'NEWS_CATEGORY',
            pattern: '/news/{categorySlug}.html',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
          },
          {
            id: 'url-selected',
            siteId: 'site-a',
            rules: [
              {
                id: 'rule-selected',
                categoryId: '',
                pageType: 'NEWS_CATEGORY',
                pattern: '/article.html',
                detailRules: [],
              },
            ],
            name: '选中 URL',
            status: 'ACTIVE',
            pageType: 'NEWS_CATEGORY',
            pattern: '/article.html',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
          },
        ],
      }),
    ).toThrow('Missing URL config: NEWS_DETAIL');
  });

  it('uses the site default url config when no per-call config is selected', () => {
    expect(
      buildPublicUrl({
        site: { ...site, urlConfigId: 'url-site-default' },
        pageType: 'NEWS_CATEGORY',
        data: { categorySlug: 'football' },
        urlConfigs: [
          {
            id: 'url-site-default',
            siteId: null,
            rules: [
              {
                id: 'rule-site-default',
                categoryId: '',
                pageType: 'NEWS_CATEGORY',
                pattern: '/sports/{categorySlug}.html',
                detailRules: [],
              },
            ],
            name: '站点默认 URL',
            status: 'ACTIVE',
            pageType: 'NEWS_CATEGORY',
            pattern: '/sports/{categorySlug}.html',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
          },
        ],
      }),
    ).toBe('/sports/football.html');
  });
});
