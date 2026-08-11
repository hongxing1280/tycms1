import { describe, expect, it, vi } from 'vitest';
import type { CategoryRecord, LiveReplayRecord, NewsArticleRecord, SiteRecord, SportLeagueRecord, SportMatchRecord, TdkConfigRecord, TemplateRecord, UrlConfigRecord } from '@sports/core';
import { cmsRepository } from '@sports/db';
import {
  buildCategoryPublicUrl,
  buildNewsPublicUrl,
  listConfiguredPublicCategories,
  resolvePublicRoute,
  resolveCategoryListTdkConfig,
  resolveCategoryListUrlConfig,
} from './public-route';

const now = new Date('2026-01-01T00:00:00.000Z');

const template: TemplateRecord = {
  id: 'template-jinqiu-live',
  name: '劲球直播',
  key: 'jinqiu-live',
  folder: 'jinqiu-live',
  status: 'ACTIVE',
  createdAt: now,
  updatedAt: now,
};

const site: SiteRecord = {
  id: 'site-a',
  name: '体育前线',
  primaryDomain: 'site-a.local',
  status: 'ACTIVE',
  templateId: template.id,
  template,
  showSignalSources: false,
  seoIndexStatus: 'INDEX',
  domains: [],
  createdAt: now,
  updatedAt: now,
};

const category: CategoryRecord = {
  id: 'cat-tennis',
  name: '网球专题',
  slug: 'tennis',
  language: 'zh-CN',
  status: 'ACTIVE',
  description: '网球赛事资讯。',
  sortOrder: 1,
  createdAt: now,
  updatedAt: now,
};

const childCategory: CategoryRecord = {
  ...category,
  id: 'cat-tennis-child',
  parentId: 'cat-tennis',
  name: '网球资讯',
  slug: 'tennis-news',
  sortOrder: 2,
};

describe('public route category config binding', () => {
  it('uses site home seo fields before global home tdk rules', () => {
    const originalStore = snapshotCmsStore();
    const homeSite: SiteRecord = {
      ...site,
      id: 'site-home-seo',
      primaryDomain: 'home-seo.local',
      urlConfigId: 'url-home-seo',
      tdkConfigId: 'tdk-home-seo',
      seoTitle: 'Excel 首页标题',
      seoKeywords: 'Excel 首页关键词',
      seoDescription: 'Excel 首页描述',
    };
    const urlConfig: UrlConfigRecord = {
      id: 'url-home-seo',
      siteId: null,
      categoryIds: [],
      rules: [
        {
          id: 'url-home-seo-rule',
          categoryId: '',
          pageType: 'HOME',
          pattern: '/',
          detailRules: [],
        },
      ],
      name: '首页 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const tdkConfig: TdkConfigRecord = {
      id: 'tdk-home-seo',
      siteId: null,
      categoryIds: [],
      rules: [
        {
          id: 'tdk-home-seo-rule',
          categoryId: '',
          pageType: 'HOME',
          titleTemplate: '全局模板标题',
          keywordsTemplate: '全局模板关键词',
          descriptionTemplate: '全局模板描述',
          detailRules: [],
        },
      ],
      name: '首页 TDK',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '全局模板标题',
      keywordsTemplate: '全局模板关键词',
      descriptionTemplate: '全局模板描述',
      createdAt: now,
      updatedAt: now,
    };

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [homeSite],
        categories: [],
        urlConfigs: [urlConfig],
        tdkConfigs: [tdkConfig],
        news: [],
        liveReplays: [],
        matches: [],
        leagues: [],
        teams: [],
      });

      const route = resolvePublicRoute('home-seo.local');

      expect(route?.kind).toBe('home');
      expect(route?.tdk.title).toBe('Excel 首页标题');
      expect(route?.tdk.keywords).toBe('Excel 首页关键词');
      expect(route?.tdk.description).toBe('Excel 首页描述');
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('does not fall back to global TDK when the selected site TDK lacks a home rule', () => {
    const originalStore = snapshotCmsStore();
    const strictSite: SiteRecord = {
      ...site,
      id: 'site-strict-tdk',
      primaryDomain: 'strict-tdk.local',
      urlConfigId: 'url-strict-tdk',
      tdkConfigId: 'tdk-selected-without-home',
    };
    const urlConfig: UrlConfigRecord = {
      id: 'url-strict-tdk',
      siteId: null,
      categoryIds: [],
      rules: [{ id: 'url-strict-tdk-home', categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] }],
      name: '严格 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const selectedTdkConfig: TdkConfigRecord = {
      id: 'tdk-selected-without-home',
      siteId: null,
      categoryIds: [category.id],
      rules: [
        {
          id: 'tdk-selected-without-home-news',
          categoryId: category.id,
          pageType: 'NEWS_CATEGORY',
          titleTemplate: '选中栏目 {columnName}',
          detailRules: [],
        },
      ],
      name: '选中但无首页规则',
      status: 'ACTIVE',
      pageType: 'NEWS_CATEGORY',
      titleTemplate: '选中栏目 {columnName}',
      createdAt: now,
      updatedAt: now,
    };
    const globalTdkConfig: TdkConfigRecord = {
      id: 'tdk-global-home-fallback',
      siteId: null,
      categoryIds: [],
      rules: [{ id: 'tdk-global-home-rule', categoryId: '', pageType: 'HOME', titleTemplate: '不应使用的全局首页', detailRules: [] }],
      name: '全局首页兜底',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '不应使用的全局首页',
      createdAt: now,
      updatedAt: now,
    };

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [strictSite],
        categories: [category],
        urlConfigs: [urlConfig],
        tdkConfigs: [selectedTdkConfig, globalTdkConfig],
        news: [],
        liveReplays: [],
        matches: [],
        leagues: [],
        teams: [],
      });

      expect(resolvePublicRoute('strict-tdk.local')).toBeUndefined();
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('uses the previous one hour and next two hours for homepage matches', () => {
    const originalStore = snapshotCmsStore();
    const current = new Date('2026-06-04T12:00:00.000Z');
    const homeSite: SiteRecord = {
      ...site,
      id: 'site-home-match-window',
      primaryDomain: 'home-match-window.local',
      urlConfigId: 'url-home-match-window',
      tdkConfigId: 'tdk-home-match-window',
    };
    const urlConfig: UrlConfigRecord = {
      id: 'url-home-match-window',
      siteId: null,
      categoryIds: [],
      rules: [
        { id: 'url-home-match-window-home', categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] },
      ],
      name: '首页 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const tdkConfig: TdkConfigRecord = {
      id: 'tdk-home-match-window',
      siteId: null,
      categoryIds: [],
      rules: [
        { id: 'tdk-home-match-window-home', categoryId: '', pageType: 'HOME', titleTemplate: '{siteName}', detailRules: [] },
      ],
      name: '首页 TDK',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '{siteName}',
      createdAt: now,
      updatedAt: now,
    };
    const matchAt = (id: string, minutesFromNow: number): SportMatchRecord => ({
      id,
      sport: 'FOOTBALL',
      title: `${id} 主队 VS 客队`,
      slug: `${id}-slug`,
      isTop: false,
      status: 'SCHEDULED',
      startTime: new Date(current.getTime() + minutesFromNow * 60_000),
      createdAt: now,
      updatedAt: now,
    });

    try {
      vi.useFakeTimers();
      vi.setSystemTime(current);
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [homeSite],
        categories: [],
        urlConfigs: [urlConfig],
        tdkConfigs: [tdkConfig],
        news: [],
        liveReplays: [],
        matches: [
          matchAt('too-old', -61),
          matchAt('recent', -30),
          matchAt('soon', 30),
          matchAt('too-far', 121),
        ],
        leagues: [],
        teams: [],
      });

      const route = resolvePublicRoute('home-match-window.local');

      expect(route?.kind).toBe('home');
      if (route?.kind !== 'home') {
        throw new Error('expected home route');
      }
      expect(route.matches.map((match) => match.id)).toEqual(['recent', 'soon']);
    } finally {
      vi.useRealTimers();
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('falls back to upcoming backend matches when the homepage three-hour window is empty', () => {
    const originalStore = snapshotCmsStore();
    const current = new Date('2026-06-04T12:00:00.000Z');
    const homeSite: SiteRecord = {
      ...site,
      id: 'site-home-match-fallback',
      primaryDomain: 'home-match-fallback.local',
      urlConfigId: 'url-home-match-fallback',
      tdkConfigId: 'tdk-home-match-fallback',
    };
    const urlConfig: UrlConfigRecord = {
      id: 'url-home-match-fallback',
      siteId: null,
      categoryIds: [],
      rules: [
        { id: 'url-home-match-fallback-home', categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] },
      ],
      name: '首页 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const tdkConfig: TdkConfigRecord = {
      id: 'tdk-home-match-fallback',
      siteId: null,
      categoryIds: [],
      rules: [
        { id: 'tdk-home-match-fallback-home', categoryId: '', pageType: 'HOME', titleTemplate: '{siteName}', detailRules: [] },
      ],
      name: '首页 TDK',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '{siteName}',
      createdAt: now,
      updatedAt: now,
    };
    const matchAt = (id: string, hoursFromNow: number): SportMatchRecord => ({
      id,
      sport: 'FOOTBALL',
      title: `${id} 主队 VS 客队`,
      slug: `${id}-slug`,
      isTop: false,
      status: 'SCHEDULED',
      startTime: new Date(current.getTime() + hoursFromNow * 60 * 60_000),
      createdAt: now,
      updatedAt: now,
    });

    try {
      vi.useFakeTimers();
      vi.setSystemTime(current);
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [homeSite],
        categories: [],
        urlConfigs: [urlConfig],
        tdkConfigs: [tdkConfig],
        news: [],
        liveReplays: [],
        matches: [matchAt('future-1', 4), matchAt('future-2', 6)],
        leagues: [],
        teams: [],
      });

      const route = resolvePublicRoute('home-match-fallback.local');

      expect(route?.kind).toBe('home');
      if (route?.kind !== 'home') {
        throw new Error('expected home route');
      }
      expect(route.matches.map((match) => match.id)).toEqual(['future-1', 'future-2']);
    } finally {
      vi.useRealTimers();
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('lets URL configs own category relationships instead of category fields', () => {
    const urlConfigs: UrlConfigRecord[] = [
      {
        id: 'url-news',
        siteId: 'site-a',
        categoryIds: ['cat-other'],
        rules: [
          {
            id: 'rule-news',
            categoryId: 'cat-other',
            pageType: 'NEWS_CATEGORY',
            pattern: '/news/{categorySlug}.html',
            detailRules: [],
          },
        ],
        name: '新闻栏目 URL',
        status: 'ACTIVE',
        pageType: 'NEWS_CATEGORY',
        pattern: '/news/{categorySlug}.html',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'url-live',
        siteId: 'site-a',
        categoryIds: ['cat-tennis'],
        rules: [
          {
            id: 'rule-live',
            categoryId: 'cat-tennis',
            pageType: 'MATCH_CATEGORY',
            pattern: '/zhibo/{categorySlug}.html',
            detailRules: [
              { id: 'rule-live-detail', label: '直播内页', pageType: 'MATCH_DETAIL', pattern: '/zhibo/{matchId}-{slug}.html' },
            ],
          },
        ],
        name: '直播栏目 URL',
        status: 'ACTIVE',
        pageType: 'MATCH_CATEGORY',
        pattern: '/zhibo/{categorySlug}.html',
        createdAt: now,
        updatedAt: now,
      },
    ];

    expect(resolveCategoryListUrlConfig(category, site, urlConfigs)?.id).toBe('url-live');
  });

  it('prefers the URL config selected by the site when multiple configs match', () => {
    const selectedSite = { ...site, urlConfigId: 'url-selected' };
    const urlConfigs: UrlConfigRecord[] = [
      {
        id: 'url-other',
        siteId: 'site-a',
        categoryIds: ['cat-tennis'],
        rules: [
          {
            id: 'rule-other',
            categoryId: 'cat-tennis',
            pageType: 'NEWS_CATEGORY',
            pattern: '/old/{categorySlug}.html',
            detailRules: [],
          },
        ],
        name: '旧 URL',
        status: 'ACTIVE',
        pageType: 'NEWS_CATEGORY',
        pattern: '/old/{categorySlug}.html',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'url-selected',
        siteId: null,
        categoryIds: ['cat-tennis'],
        rules: [
          {
            id: 'rule-selected',
            categoryId: 'cat-tennis',
            pageType: 'NEWS_CATEGORY',
            pattern: '/new/{categorySlug}.html',
            detailRules: [],
          },
        ],
        name: '选中 URL',
        status: 'ACTIVE',
        pageType: 'NEWS_CATEGORY',
        pattern: '/new/{categorySlug}.html',
        createdAt: now,
        updatedAt: now,
      },
    ];

    expect(resolveCategoryListUrlConfig(category, selectedSite, urlConfigs)?.id).toBe('url-selected');
  });

  it('builds category and detail URLs from arbitrary admin path prefixes', () => {
    const selectedSite = { ...site, urlConfigId: 'url-article' };
    const urlConfigs: UrlConfigRecord[] = [
      {
        id: 'url-article',
        siteId: null,
        categoryIds: ['cat-tennis'],
        rules: [
          {
            id: 'rule-article',
            categoryId: 'cat-tennis',
            pageType: 'NEWS_CATEGORY',
            pattern: '/article/{categorySlug}.html',
            detailRules: [
              {
                id: 'rule-article-detail',
                label: '文章内页',
                pageType: 'NEWS_DETAIL',
                pattern: '/article/{categorySlug}/{articleSlug}.html',
              },
            ],
          },
        ],
        name: '文章 URL',
        status: 'ACTIVE',
        pageType: 'NEWS_CATEGORY',
        pattern: '/article/{categorySlug}.html',
        createdAt: now,
        updatedAt: now,
      },
    ];

    expect(buildCategoryPublicUrl({ site: selectedSite, category, urlConfigs })).toBe('/article/tennis.html');
    expect(
      buildNewsPublicUrl({
        site: selectedSite,
        category,
        article: { slug: 'story-a' },
        urlConfigs,
      }),
    ).toBe('/article/tennis/story-a.html');
  });

  it('supports edited URL rules such as /news1 for category and detail links', () => {
    const selectedSite = { ...site, urlConfigId: 'url-news1' };
    const urlConfigs: UrlConfigRecord[] = [
      {
        id: 'url-news1',
        siteId: null,
        categoryIds: ['cat-tennis'],
        rules: [
          {
            id: 'rule-news1',
            categoryId: 'cat-tennis',
            pageType: 'NEWS_CATEGORY',
            pattern: '/news1/{categorySlug}.html',
            detailRules: [
              {
                id: 'rule-news1-detail',
                label: '新闻内页',
                pageType: 'NEWS_DETAIL',
                pattern: '/news1/{categorySlug}/{newsSlug}.html',
              },
            ],
          },
        ],
        name: 'News1 URL',
        status: 'ACTIVE',
        pageType: 'NEWS_CATEGORY',
        pattern: '/news1/{categorySlug}.html',
        createdAt: now,
        updatedAt: now,
      },
    ];

    expect(buildCategoryPublicUrl({ site: selectedSite, category, urlConfigs })).toBe('/news1/tennis.html');
    expect(
      buildNewsPublicUrl({
        site: selectedSite,
        category,
        article: { slug: 'story-a' },
        urlConfigs,
      }),
    ).toBe('/news1/tennis/story-a.html');
  });

  it('resolves TDK config by the selected page type and category binding', () => {
    const tdkConfigs: TdkConfigRecord[] = [
      {
        id: 'tdk-live',
        siteId: 'site-a',
        categoryIds: ['cat-tennis'],
        rules: [
          {
            id: 'rule-tdk-live',
            categoryId: 'cat-tennis',
            pageType: 'MATCH_CATEGORY',
            titleTemplate: '{columnName}直播_{siteName}',
            detailRules: [
              {
                id: 'rule-tdk-live-detail',
                label: '直播内页',
                pageType: 'MATCH_DETAIL',
                titleTemplate: '{homeTeam}VS{awayTeam}直播_{siteName}',
              },
            ],
          },
        ],
        name: '直播栏目 TDK',
        status: 'ACTIVE',
        pageType: 'MATCH_CATEGORY',
        titleTemplate: '{columnName}直播_{siteName}',
        createdAt: now,
        updatedAt: now,
      },
    ];

    expect(resolveCategoryListTdkConfig(category, site, tdkConfigs, 'MATCH_CATEGORY')?.id).toBe('tdk-live');
  });

  it('uses explicit URL config rules as the public category source', () => {
    const hiddenCategory = {
      ...category,
      id: 'cat-hidden',
      name: '未配置栏目',
      slug: 'hidden',
      sortOrder: 2,
    };
    const urlConfigs: UrlConfigRecord[] = [
      {
        id: 'url-visible',
        siteId: 'site-a',
        categoryIds: ['cat-tennis'],
        rules: [
          {
            id: 'rule-visible',
            categoryId: 'cat-tennis',
            pageType: 'NEWS_CATEGORY',
            pattern: '/news/{categorySlug}.html',
            detailRules: [],
          },
        ],
        name: '前台栏目 URL',
        status: 'ACTIVE',
        pageType: 'NEWS_CATEGORY',
        pattern: '/news/{categorySlug}.html',
        createdAt: now,
        updatedAt: now,
      },
    ];

    expect(listConfiguredPublicCategories(site, [category, childCategory, hiddenCategory], urlConfigs).map((item) => item.slug)).toEqual([
      'tennis',
    ]);
    expect(resolveCategoryListUrlConfig(childCategory, site, urlConfigs)).toBeUndefined();
  });

  it('shows child categories only when they have their own URL rule', () => {
    const urlConfigs: UrlConfigRecord[] = [
      {
        id: 'url-visible',
        siteId: 'site-a',
        categoryIds: ['cat-tennis', 'cat-tennis-child'],
        rules: [
          {
            id: 'rule-visible',
            categoryId: 'cat-tennis',
            pageType: 'NEWS_CATEGORY',
            pattern: '/news/{categorySlug}.html',
            detailRules: [],
          },
          {
            id: 'rule-visible-child',
            categoryId: 'cat-tennis-child',
            pageType: 'NEWS_CATEGORY',
            pattern: '/news/{categorySlug}.html',
            detailRules: [],
          },
        ],
        name: '前台栏目 URL',
        status: 'ACTIVE',
        pageType: 'NEWS_CATEGORY',
        pattern: '/news/{categorySlug}.html',
        createdAt: now,
        updatedAt: now,
      },
    ];

    expect(listConfiguredPublicCategories(site, [category, childCategory], urlConfigs).map((item) => item.slug)).toEqual([
      'tennis',
      'tennis-news',
    ]);
    expect(resolveCategoryListUrlConfig(childCategory, site, urlConfigs)?.id).toBe('url-visible');
    expect(buildCategoryPublicUrl({ site, category: childCategory, urlConfigs })).toBe('/news/tennis-news.html');
  });

  it('uses only the selected URL config as the public category source', () => {
    const selectedSite = { ...site, urlConfigId: 'url-four' };
    const hiddenCategory = {
      ...category,
      id: 'cat-hidden',
      name: '隐藏栏目',
      slug: 'hidden',
      sortOrder: 3,
    };
    const urlConfigs: UrlConfigRecord[] = [
      {
        id: 'url-four',
        siteId: null,
        categoryIds: ['cat-tennis'],
        rules: [
          {
            id: 'rule-four',
            categoryId: 'cat-tennis',
            pageType: 'NEWS_CATEGORY',
            pattern: '/article/{categorySlug}.html',
            detailRules: [],
          },
        ],
        name: '四栏目 URL',
        status: 'ACTIVE',
        pageType: 'NEWS_CATEGORY',
        pattern: '/article/{categorySlug}.html',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'url-default',
        siteId: null,
        categoryIds: ['cat-hidden'],
        rules: [
          {
            id: 'rule-default',
            categoryId: 'cat-hidden',
            pageType: 'NEWS_CATEGORY',
            pattern: '/news/{categorySlug}.html',
            detailRules: [],
          },
        ],
        name: '默认全站 URL',
        status: 'ACTIVE',
        pageType: 'NEWS_CATEGORY',
        pattern: '/news/{categorySlug}.html',
        createdAt: now,
        updatedAt: now,
      },
    ];

    expect(listConfiguredPublicCategories(selectedSite, [category, hiddenCategory], urlConfigs).map((item) => item.slug)).toEqual([
      'tennis',
    ]);
    expect(resolveCategoryListUrlConfig(hiddenCategory, selectedSite, urlConfigs)).toBeUndefined();
  });

  it('orders public categories by the selected URL config rule order', () => {
    const selectedSite = { ...site, urlConfigId: 'url-ordered' };
    const firstByConfig = {
      ...category,
      id: 'cat-second-sort',
      name: '配置优先',
      slug: 'config-first',
      sortOrder: 90,
    };
    const secondByConfig = {
      ...category,
      id: 'cat-first-sort',
      name: '排序靠前',
      slug: 'sort-first',
      sortOrder: 1,
    };
    const urlConfigs: UrlConfigRecord[] = [
      {
        id: 'url-ordered',
        siteId: null,
        categoryIds: ['cat-second-sort', 'cat-first-sort'],
        rules: [
          {
            id: 'rule-config-first',
            categoryId: 'cat-second-sort',
            pageType: 'NEWS_CATEGORY',
            pattern: '/news/{categorySlug}.html',
            detailRules: [],
          },
          {
            id: 'rule-config-second',
            categoryId: 'cat-first-sort',
            pageType: 'NEWS_CATEGORY',
            pattern: '/news/{categorySlug}.html',
            detailRules: [],
          },
        ],
        name: '有序 URL',
        status: 'ACTIVE',
        pageType: 'NEWS_CATEGORY',
        pattern: '/news/{categorySlug}.html',
        createdAt: now,
        updatedAt: now,
      },
    ];

    expect(listConfiguredPublicCategories(selectedSite, [secondByConfig, firstByConfig], urlConfigs).map((item) => item.slug)).toEqual([
      'config-first',
      'sort-first',
    ]);
  });

  it('lets child categories inherit parent TDK rules', () => {
    const tdkConfigs: TdkConfigRecord[] = [
      {
        id: 'tdk-parent-news',
        siteId: 'site-a',
        categoryIds: ['cat-tennis'],
        rules: [
          {
            id: 'rule-parent-news',
            categoryId: 'cat-tennis',
            pageType: 'NEWS_CATEGORY',
            titleTemplate: '{columnName}_{siteName}',
            detailRules: [],
          },
        ],
        name: '父栏目 TDK',
        status: 'ACTIVE',
        pageType: 'NEWS_CATEGORY',
        titleTemplate: '{columnName}_{siteName}',
        createdAt: now,
        updatedAt: now,
      },
    ];

    expect(resolveCategoryListTdkConfig(childCategory, site, tdkConfigs, 'NEWS_CATEGORY')?.id).toBe('tdk-parent-news');
  });

  it('prefers the TDK config selected by the site when multiple configs match', () => {
    const selectedSite = { ...site, tdkConfigId: 'tdk-selected' };
    const tdkConfigs: TdkConfigRecord[] = [
      {
        id: 'tdk-other',
        siteId: 'site-a',
        categoryIds: ['cat-tennis'],
        rules: [
          {
            id: 'rule-other',
            categoryId: 'cat-tennis',
            pageType: 'NEWS_CATEGORY',
            titleTemplate: '旧 {columnName}',
            detailRules: [],
          },
        ],
        name: '旧 TDK',
        status: 'ACTIVE',
        pageType: 'NEWS_CATEGORY',
        titleTemplate: '旧 {columnName}',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'tdk-selected',
        siteId: null,
        categoryIds: ['cat-tennis'],
        rules: [
          {
            id: 'rule-selected',
            categoryId: 'cat-tennis',
            pageType: 'NEWS_CATEGORY',
            titleTemplate: '选中 {columnName}',
            detailRules: [],
          },
        ],
        name: '选中 TDK',
        status: 'ACTIVE',
        pageType: 'NEWS_CATEGORY',
        titleTemplate: '选中 {columnName}',
        createdAt: now,
        updatedAt: now,
      },
    ];

    expect(resolveCategoryListTdkConfig(category, selectedSite, tdkConfigs, 'NEWS_CATEGORY')?.id).toBe('tdk-selected');
  });

  it('falls back to existing content when a single-site install has legacy site ids', () => {
    const originalStore = snapshotCmsStore();
    const fallbackSite: SiteRecord = {
      ...site,
      id: 'site-current',
      primaryDomain: 'fallback.local',
      urlConfigId: 'url-current',
      tdkConfigId: 'tdk-current',
    };
    const newsCategory: CategoryRecord = {
      ...category,
      id: 'cat-news-current',
      name: '体育新闻',
      slug: 'sports-news',
    };
    const replayCategory: CategoryRecord = {
      ...category,
      id: 'cat-replay-current',
      name: '赛事录像',
      slug: 'match-replay',
      sortOrder: 2,
    };
    const urlConfig: UrlConfigRecord = {
      id: 'url-current',
      siteId: null,
      categoryIds: [newsCategory.id, replayCategory.id],
      rules: [
        {
          id: 'url-home',
          categoryId: '',
          pageType: 'HOME',
          pattern: '/',
          detailRules: [],
        },
        {
          id: 'url-news',
          categoryId: newsCategory.id,
          pageType: 'NEWS_CATEGORY',
          pattern: '/news/{categorySlug}.html',
          detailRules: [
            { id: 'url-news-detail', label: '新闻详情', pageType: 'NEWS_DETAIL', pattern: '/news/{categorySlug}/{newsSlug}.html' },
          ],
        },
        {
          id: 'url-replay',
          categoryId: replayCategory.id,
          pageType: 'VIDEO_CATEGORY',
          pattern: '/video/{categorySlug}.html',
          detailRules: [
            { id: 'url-replay-detail', label: '录像详情', pageType: 'VIDEO_DETAIL', pattern: '/video/{categorySlug}/{videoSlug}.html' },
          ],
        },
      ],
      name: '当前 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const tdkConfig: TdkConfigRecord = {
      id: 'tdk-current',
      siteId: null,
      categoryIds: [newsCategory.id, replayCategory.id],
      rules: [
        {
          id: 'tdk-home',
          categoryId: '',
          pageType: 'HOME',
          titleTemplate: '{siteName}',
          detailRules: [],
        },
      ],
      name: '当前 TDK',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '{siteName}',
      createdAt: now,
      updatedAt: now,
    };
    const legacyNews: NewsArticleRecord = {
      siteId: 'site-legacy',
      categoryId: 'cat-legacy-news',
      title: '旧站点新闻仍应展示',
      slug: 'legacy-news',
      summary: '这是一条保存到旧站点 ID 的新闻摘要内容。',
      content: '这是一条保存到旧站点 ID 的新闻正文内容，单站点部署时应该兜底展示。',
      status: 'PUBLISHED',
      isTop: false,
      publishedAt: now,
      id: 'news-legacy',
      createdAt: now,
      updatedAt: now,
    };
    const legacyReplay: LiveReplayRecord = {
      siteId: 'site-legacy',
      categoryId: 'cat-legacy-replay',
      title: '旧站点录像仍应展示',
      slug: 'legacy-replay',
      createTime: now,
      homeTeam: '主队',
      awayTeam: '客队',
      playUrl: 'https://example.com/replay.m3u8',
      id: 'replay-legacy',
      createdAt: now,
      updatedAt: now,
    };

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [fallbackSite],
        categories: [newsCategory, replayCategory],
        urlConfigs: [urlConfig],
        tdkConfigs: [tdkConfig],
        news: [legacyNews],
        liveReplays: [legacyReplay],
      });

      const route = resolvePublicRoute('fallback.local', []);

      expect(route?.kind).toBe('home');
      expect(route?.latestNews.map((article) => article.title)).toContain('旧站点新闻仍应展示');
      expect(route?.latestNews.map((article) => article.title)).toContain('旧站点录像仍应展示');
      expect(route?.latestNews.map((article) => article.categoryId)).toContain(newsCategory.id);
      expect(route?.latestNews.map((article) => article.categoryId)).toContain(replayCategory.id);
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('keeps sites isolated and respects each site article count', () => {
    const originalStore = snapshotCmsStore();
    const firstSite: SiteRecord = {
      ...site,
      id: 'site-first',
      name: '第一站',
      primaryDomain: 'first.local',
      urlConfigId: 'url-first',
      tdkConfigId: 'tdk-first',
      newsUpdateCount: 2,
    };
    const secondSite: SiteRecord = {
      ...site,
      id: 'site-second',
      name: '第二站',
      primaryDomain: 'second.local',
      urlConfigId: 'url-first',
      tdkConfigId: 'tdk-first',
      newsUpdateCount: 5,
    };
    const newsCategory: CategoryRecord = {
      ...category,
      id: 'cat-shared-news',
      name: '体育新闻',
      slug: 'sports-news',
    };
    const urlConfig: UrlConfigRecord = {
      id: 'url-first',
      siteId: null,
      categoryIds: [newsCategory.id],
      rules: [
        { id: 'url-home', categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] },
        {
          id: 'url-news',
          categoryId: newsCategory.id,
          pageType: 'NEWS_CATEGORY',
          pattern: '/news/{categorySlug}.html',
          detailRules: [
            { id: 'url-news-detail', label: '新闻详情', pageType: 'NEWS_DETAIL', pattern: '/news/{categorySlug}/{newsSlug}.html' },
          ],
        },
      ],
      name: '站点 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const tdkConfig: TdkConfigRecord = {
      id: 'tdk-first',
      siteId: null,
      categoryIds: [newsCategory.id],
      rules: [
        { id: 'tdk-home', categoryId: '', pageType: 'HOME', titleTemplate: '{siteName}', detailRules: [] },
      ],
      name: '站点 TDK',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '{siteName}',
      createdAt: now,
      updatedAt: now,
    };
    const newsRows: NewsArticleRecord[] = [
      articleForSite('site-first', newsCategory.id, '第一站新闻一', 'first-1', 3),
      articleForSite('site-first', newsCategory.id, '第一站新闻二', 'first-2', 2),
      articleForSite('site-first', newsCategory.id, '第一站新闻三', 'first-3', 1),
      articleForSite('site-second', newsCategory.id, '第二站新闻', 'second-1', 4),
    ];

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [firstSite, secondSite],
        categories: [newsCategory],
        urlConfigs: [urlConfig],
        tdkConfigs: [tdkConfig],
        news: newsRows,
        liveReplays: [],
      });

      const route = resolvePublicRoute('first.local', []);

      expect(route?.kind).toBe('home');
      expect(route?.latestNews).toHaveLength(2);
      expect(route?.latestNews.map((article) => article.title)).toEqual(['第一站新闻一', '第一站新闻二']);
      expect(route?.latestNews.map((article) => article.title)).not.toContain('第二站新闻');
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('deduplicates public news lists by source URL and cleaned title', () => {
    const originalStore = snapshotCmsStore();
    const dedupeSite: SiteRecord = {
      ...site,
      id: 'site-dedupe-news',
      primaryDomain: 'dedupe-news.local',
      urlConfigId: 'url-dedupe-news',
      tdkConfigId: 'tdk-dedupe-news',
      newsUpdateCount: 10,
    };
    const newsCategory: CategoryRecord = {
      ...category,
      id: 'cat-dedupe-news',
      name: '体育新闻',
      slug: 'sports-news',
    };
    const urlConfig: UrlConfigRecord = {
      id: 'url-dedupe-news',
      siteId: null,
      categoryIds: [newsCategory.id],
      rules: [
        { id: 'url-dedupe-news-home', categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] },
        {
          id: 'url-dedupe-news-list',
          categoryId: newsCategory.id,
          pageType: 'NEWS_CATEGORY',
          pattern: '/news/{categorySlug}.html',
          detailRules: [
            { id: 'url-dedupe-news-detail', label: '新闻详情', pageType: 'NEWS_DETAIL', pattern: '/news/{categorySlug}/{newsSlug}.html' },
          ],
        },
      ],
      name: '去重 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const tdkConfig: TdkConfigRecord = {
      id: 'tdk-dedupe-news',
      siteId: null,
      categoryIds: [newsCategory.id],
      rules: [
        { id: 'tdk-dedupe-news-home', categoryId: '', pageType: 'HOME', titleTemplate: '{siteName}', detailRules: [] },
      ],
      name: '去重 TDK',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '{siteName}',
      createdAt: now,
      updatedAt: now,
    };
    const sourceDuplicateFirst = {
      ...articleForSite(dedupeSite.id, newsCategory.id, '同源新闻 A', 'source-a', 4),
      sourceUrl: 'https://example.com/article/1',
    };
    const sourceDuplicateSecond = {
      ...articleForSite(dedupeSite.id, newsCategory.id, '同源新闻 B', 'source-b', 3),
      sourceUrl: 'https://example.com/article/1',
    };
    const titleDuplicateFirst = articleForSite(dedupeSite.id, newsCategory.id, '曼联签约新援 | 懂球帝', 'title-a', 2);
    const titleDuplicateSecond = articleForSite(dedupeSite.id, newsCategory.id, '曼联签约新援', 'title-b', 1);

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [dedupeSite],
        categories: [newsCategory],
        urlConfigs: [urlConfig],
        tdkConfigs: [tdkConfig],
        news: [sourceDuplicateFirst, sourceDuplicateSecond, titleDuplicateFirst, titleDuplicateSecond],
        liveReplays: [],
      });

      const route = resolvePublicRoute('dedupe-news.local');

      expect(route?.kind).toBe('home');
      expect(route?.latestNews.map((article) => article.slug)).toEqual(['source-a', 'title-a']);
      expect(route?.latestNews.map((article) => article.title)).toEqual(['同源新闻 A', '曼联签约新援']);
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('keeps each site locked to its own template url and tdk selection', () => {
    const originalStore = snapshotCmsStore();
    const firstTemplate: TemplateRecord = {
      id: 'template-first',
      name: '第一模板',
      key: 'jinqiu-live',
      folder: 'jinqiu-live',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    const secondTemplate: TemplateRecord = {
      id: 'template-second',
      name: '第二模板',
      key: 'lybo-industrial',
      folder: 'lybo-industrial',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    const firstSite: SiteRecord = {
      ...site,
      id: 'site-template-first',
      name: '第一站',
      primaryDomain: 'template-first.local',
      templateId: firstTemplate.id,
      template: firstTemplate,
      urlConfigId: 'url-template-first',
      tdkConfigId: 'tdk-template-first',
    };
    const secondSite: SiteRecord = {
      ...site,
      id: 'site-template-second',
      name: '第二站',
      primaryDomain: 'template-second.local',
      templateId: secondTemplate.id,
      template: secondTemplate,
      urlConfigId: 'url-template-second',
      tdkConfigId: 'tdk-template-second',
    };
    const firstUrlConfig: UrlConfigRecord = {
      id: 'url-template-first',
      siteId: firstSite.id,
      categoryIds: [category.id],
      rules: [
        { id: 'url-template-first-home', categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] },
        {
          id: 'url-template-first-news',
          categoryId: category.id,
          pageType: 'NEWS_CATEGORY',
          pattern: '/first/{categorySlug}.html',
          detailRules: [
            { id: 'url-template-first-detail', label: '详情', pageType: 'NEWS_DETAIL', pattern: '/first/{categorySlug}/{newsSlug}.html' },
          ],
        },
      ],
      name: '第一站 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const secondUrlConfig: UrlConfigRecord = {
      id: 'url-template-second',
      siteId: secondSite.id,
      categoryIds: [category.id],
      rules: [
        { id: 'url-template-second-home', categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] },
        {
          id: 'url-template-second-news',
          categoryId: category.id,
          pageType: 'NEWS_CATEGORY',
          pattern: '/second/{categorySlug}.html',
          detailRules: [
            { id: 'url-template-second-detail', label: '详情', pageType: 'NEWS_DETAIL', pattern: '/second/{categorySlug}/{newsSlug}.html' },
          ],
        },
      ],
      name: '第二站 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const firstTdkConfig: TdkConfigRecord = {
      id: 'tdk-template-first',
      siteId: firstSite.id,
      categoryIds: [category.id],
      rules: [
        { id: 'tdk-template-first-home', categoryId: '', pageType: 'HOME', titleTemplate: '第一站 {siteName}', detailRules: [] },
      ],
      name: '第一站 TDK',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '第一站 {siteName}',
      createdAt: now,
      updatedAt: now,
    };
    const secondTdkConfig: TdkConfigRecord = {
      id: 'tdk-template-second',
      siteId: secondSite.id,
      categoryIds: [category.id],
      rules: [
        { id: 'tdk-template-second-home', categoryId: '', pageType: 'HOME', titleTemplate: '第二站 {siteName}', detailRules: [] },
      ],
      name: '第二站 TDK',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '第二站 {siteName}',
      createdAt: now,
      updatedAt: now,
    };

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [firstSite, secondSite],
        categories: [category],
        templates: [firstTemplate, secondTemplate],
        urlConfigs: [firstUrlConfig, secondUrlConfig],
        tdkConfigs: [firstTdkConfig, secondTdkConfig],
        news: [],
        liveReplays: [],
        matches: [],
        leagues: [],
        teams: [],
      });

      const firstRoute = resolvePublicRoute('template-first.local');
      const secondRoute = resolvePublicRoute('template-second.local');

      expect(firstRoute?.site.templateId).toBe(firstTemplate.id);
      expect(secondRoute?.site.templateId).toBe(secondTemplate.id);
      expect(firstRoute?.site.template?.key).toBe(firstTemplate.key);
      expect(secondRoute?.site.template?.key).toBe(secondTemplate.key);
      expect(firstRoute?.tdk.title).toContain('第一站');
      expect(secondRoute?.tdk.title).toContain('第二站');
      expect(buildCategoryPublicUrl({ site: firstSite, category, urlConfigs: [firstUrlConfig, secondUrlConfig] })).toBe('/first/tennis.html');
      expect(buildCategoryPublicUrl({ site: secondSite, category, urlConfigs: [firstUrlConfig, secondUrlConfig] })).toBe('/second/tennis.html');
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('keeps template, URL and TDK stable across interleaved concurrent nav requests for different sites', async () => {
    const originalStore = snapshotCmsStore();
    const templates: TemplateRecord[] = [
      {
        id: 'template-concurrent-a',
        name: '并发模板 A',
        key: 'jinqiu-live',
        folder: 'jinqiu-live',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'template-concurrent-b',
        name: '并发模板 B',
        key: 'lybo-industrial',
        folder: 'lybo-industrial',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'template-concurrent-c',
        name: '并发模板 C',
        key: 'qzcad-portal',
        folder: 'qzcad-portal',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    ];
    const navCategory: CategoryRecord = {
      ...category,
      id: 'cat-concurrent-nav',
      name: '并发导航',
      slug: 'nav',
    };
    const sites: SiteRecord[] = templates.map((templateRecord, index) => ({
      ...site,
      id: `site-concurrent-${index + 1}`,
      name: `并发站点${index + 1}`,
      primaryDomain: `concurrent-${index + 1}.local`,
      templateId: templateRecord.id,
      template: templateRecord,
      urlConfigId: `url-concurrent-${index + 1}`,
      tdkConfigId: `tdk-concurrent-${index + 1}`,
      domains: [],
    }));
    const urlConfigs: UrlConfigRecord[] = sites.map((siteRecord, index) => ({
      id: `url-concurrent-${index + 1}`,
      siteId: siteRecord.id,
      categoryIds: [navCategory.id],
      rules: [
        { id: `url-concurrent-${index + 1}-home`, categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] },
        {
          id: `url-concurrent-${index + 1}-nav`,
          categoryId: navCategory.id,
          pageType: 'NEWS_CATEGORY',
          pattern: `/site-${index + 1}/{categorySlug}.html`,
          detailRules: [
            {
              id: `url-concurrent-${index + 1}-detail`,
              label: '新闻详情',
              pageType: 'NEWS_DETAIL',
              pattern: `/site-${index + 1}/{categorySlug}/{newsSlug}.html`,
            },
          ],
        },
      ],
      name: `并发 URL ${index + 1}`,
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    }));
    const tdkConfigs: TdkConfigRecord[] = sites.map((siteRecord, index) => ({
      id: `tdk-concurrent-${index + 1}`,
      siteId: siteRecord.id,
      categoryIds: [navCategory.id],
      rules: [
        {
          id: `tdk-concurrent-${index + 1}-home`,
          categoryId: '',
          pageType: 'HOME',
          titleTemplate: `TDK站点${index + 1}首页`,
          keywordsTemplate: `TDK站点${index + 1}关键词`,
          descriptionTemplate: `TDK站点${index + 1}描述`,
          detailRules: [],
        },
        {
          id: `tdk-concurrent-${index + 1}-nav`,
          categoryId: navCategory.id,
          pageType: 'NEWS_CATEGORY',
          titleTemplate: `TDK站点${index + 1}导航 {columnName}`,
          keywordsTemplate: `TDK站点${index + 1}导航关键词`,
          descriptionTemplate: `TDK站点${index + 1}导航描述`,
          detailRules: [],
        },
      ],
      name: `并发 TDK ${index + 1}`,
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: `TDK站点${index + 1}首页`,
      createdAt: now,
      updatedAt: now,
    }));
    const navPaths = [
      ['site-1', 'nav.html'],
      ['site-2', 'nav.html'],
      ['site-3', 'nav.html'],
    ];
    const expected = sites.map((siteRecord, index) => ({
      host: siteRecord.primaryDomain,
      siteId: siteRecord.id,
      templateId: templates[index]?.id,
      templateKey: templates[index]?.key,
      urlPrefix: `/site-${index + 1}/`,
      homeTitle: `TDK站点${index + 1}首页`,
      navTitle: `TDK站点${index + 1}导航`,
      navPath: navPaths[index] ?? [],
    }));
    const requests = Array.from({ length: 30 }, (_value, round) =>
      expected.map((item, siteIndex) => [
        { ...item, segments: [] as string[], pageKind: 'home', round, siteIndex },
        { ...item, segments: item.navPath, pageKind: 'nav', round, siteIndex },
      ]),
    ).flat(2);

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites,
        templates,
        categories: [navCategory],
        urlConfigs,
        tdkConfigs,
        news: sites.map((siteRecord, index) =>
          articleForSite(siteRecord.id, navCategory.id, `并发站点${index + 1}新闻`, `concurrent-${index + 1}-news`, index + 1),
        ),
        liveReplays: [],
        matches: [],
        leagues: [],
        teams: [],
      });

      const results = await Promise.all(
        requests.map(async (request) => ({
          request,
          route: resolvePublicRoute(request.host, request.segments),
          templatePackage: resolvePublicRoute(request.host, request.segments)?.site.templateId,
        })),
      );

      for (const { request, route } of results) {
        expect(route, `${request.host}/${request.segments.join('/')}`).toBeDefined();
        expect(route?.site.id).toBe(request.siteId);
        expect(route?.site.templateId).toBe(request.templateId);
        expect(route?.site.template?.key).toBe(request.templateKey);
        expect(route?.site.urlConfigId).toBe(`url-concurrent-${request.siteIndex + 1}`);
        expect(route?.site.tdkConfigId).toBe(`tdk-concurrent-${request.siteIndex + 1}`);
        expect(route?.canonical).toContain(request.host);
        if (request.pageKind === 'home') {
          expect(route?.kind).toBe('home');
          expect(route?.tdk.title).toBe(request.homeTitle);
        } else {
          expect(route?.kind).toBe('category');
          expect(route?.tdk.title).toContain(request.navTitle);
          expect(route?.canonical).toContain(request.urlPrefix);
        }
      }
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('keeps replay articles available on the homepage even when fresh news reaches the site limit', () => {
    const originalStore = snapshotCmsStore();
    const limitedSite: SiteRecord = {
      ...site,
      id: 'site-replay-limit',
      primaryDomain: 'replay-limit.local',
      urlConfigId: 'url-replay-limit',
      tdkConfigId: 'tdk-replay-limit',
      newsUpdateCount: 2,
    };
    const newsCategory: CategoryRecord = {
      ...category,
      id: 'cat-limit-news',
      name: '体育新闻',
      slug: 'sports-news',
    };
    const replayCategory: CategoryRecord = {
      ...category,
      id: 'cat-limit-replay',
      name: '赛事录像',
      slug: 'match-replay',
      sortOrder: 2,
    };
    const urlConfig = homeNewsReplayUrlConfig('url-replay-limit', newsCategory, replayCategory);
    const tdkConfig = homeNewsReplayTdkConfig('tdk-replay-limit', newsCategory, replayCategory);
    const replay: LiveReplayRecord = {
      siteId: limitedSite.id,
      categoryId: replayCategory.id,
      title: '限量站点录像仍应展示',
      slug: 'limited-replay',
      createTime: new Date(now.getTime() + 60_000),
      homeTeam: '主队',
      awayTeam: '客队',
      playUrl: 'https://example.com/replay.m3u8',
      id: 'replay-limited',
      createdAt: now,
      updatedAt: now,
    };

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [limitedSite],
        categories: [newsCategory, replayCategory],
        urlConfigs: [urlConfig],
        tdkConfigs: [tdkConfig],
        news: [
          articleForSite(limitedSite.id, newsCategory.id, '最新新闻一', 'limit-news-1', 5),
          articleForSite(limitedSite.id, newsCategory.id, '最新新闻二', 'limit-news-2', 4),
          articleForSite(limitedSite.id, newsCategory.id, '最新新闻三', 'limit-news-3', 3),
          {
            ...articleForSite(limitedSite.id, newsCategory.id, '含视频字样但不是录像的新闻', 'video-word-news', 6),
            summary: '这条新闻提到了视频、直播和集锦，但它仍然是新闻，不应进入赛事录像栏目。',
            content: '这条新闻提到了视频、直播和集锦，但它仍然是新闻，不应进入赛事录像栏目。',
          },
        ],
        liveReplays: [replay],
      });

      const route = resolvePublicRoute('replay-limit.local', []);
      const replayRoute = resolvePublicRoute('replay-limit.local', ['video', 'match-replay.html']);

      expect(route?.kind).toBe('home');
      expect(route?.latestNews.map((article) => article.title)).toContain('限量站点录像仍应展示');
      expect(route?.latestNews.filter((article) => article.categoryId === newsCategory.id)).toHaveLength(2);
      expect(replayRoute?.kind).toBe('category');
      expect(replayRoute?.latestNews.map((article) => article.title)).toContain('限量站点录像仍应展示');
      expect(replayRoute?.latestNews.map((article) => article.title)).not.toContain('含视频字样但不是录像的新闻');
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('cleans public news titles and attribution noise from existing rows', () => {
    const originalStore = snapshotCmsStore();
    const cleanSite: SiteRecord = {
      ...site,
      id: 'site-clean-news',
      primaryDomain: 'clean-news.local',
      urlConfigId: 'url-clean-news',
      tdkConfigId: 'tdk-clean-news',
      newsUpdateCount: 5,
    };
    const newsCategory: CategoryRecord = {
      ...category,
      id: 'cat-clean-news',
      name: '体育新闻',
      slug: 'sports-news',
    };
    const replayCategory: CategoryRecord = {
      ...category,
      id: 'cat-clean-replay',
      name: '赛事录像',
      slug: 'match-replay',
      sortOrder: 2,
    };
    const urlConfig = homeNewsReplayUrlConfig('url-clean-news', newsCategory, replayCategory);
    const tdkConfig = homeNewsReplayTdkConfig('tdk-clean-news', newsCategory, replayCategory);
    const dirtyArticle: NewsArticleRecord = {
      ...articleForSite(cleanSite.id, newsCategory.id, '曼联签约新援 | 懂球帝独家报道', 'man-utd-signing', 1),
      author: '懂球帝资讯',
      sourceName: '懂球帝',
      summary: '懂球帝讯 曼联签约新援，球队完成补强。编辑：张三',
      content: [
        '懂球帝讯 曼联签约新援，球队完成补强。',
        '曼联|新援|| 手机客户端，提供英超、西甲、意甲、中超等足球赛事专业的资讯、战术分析、直播、集锦、积分赛程，是足球迷手机上必备的神器。',
        '主编：张三',
        '来源：懂球帝',
      ].join('\n\n'),
      seoTitle: '曼联签约新援 | 懂球帝独家报道',
      seoKeywords: '曼联签约新援,懂球帝,体育前线',
    };

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [cleanSite],
        categories: [newsCategory, replayCategory],
        urlConfigs: [urlConfig],
        tdkConfigs: [tdkConfig],
        news: [dirtyArticle],
        liveReplays: [],
        matches: [],
        leagues: [],
        teams: [],
      });

      const homeRoute = resolvePublicRoute('clean-news.local', []);
      const detailRoute = resolvePublicRoute('clean-news.local', ['news', 'sports-news', 'man-utd-signing.html']);

      expect(homeRoute?.kind).toBe('home');
      expect(homeRoute?.latestNews[0]?.title).toBe('曼联签约新援');
      expect(detailRoute?.kind).toBe('news');
      if (detailRoute?.kind !== 'news') return;
      expect(detailRoute.article.title).toBe('曼联签约新援');
      expect(detailRoute.article.author).toBeUndefined();
      expect(detailRoute.article.sourceName).toBeUndefined();
      expect(detailRoute.article.summary).not.toContain('懂球帝');
      expect(detailRoute.article.content).not.toContain('懂球帝');
      expect(detailRoute.article.content).not.toContain('手机客户端');
      expect(detailRoute.article.content).not.toContain('主编');
      expect(detailRoute.article.content).not.toContain('来源');
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('uses shared replay rows when a site has no dedicated replay data', () => {
    const originalStore = snapshotCmsStore();
    const currentSite: SiteRecord = {
      ...site,
      id: 'site-current-replay',
      primaryDomain: 'current-replay.local',
      urlConfigId: 'url-shared-replay',
      tdkConfigId: 'tdk-shared-replay',
      newsUpdateCount: 5,
    };
    const sourceSite: SiteRecord = {
      ...site,
      id: 'site-source-replay',
      primaryDomain: 'source-replay.local',
      urlConfigId: 'url-shared-replay',
      tdkConfigId: 'tdk-shared-replay',
      newsUpdateCount: 5,
    };
    const newsCategory: CategoryRecord = {
      ...category,
      id: 'cat-shared-replay-news',
      name: '体育新闻',
      slug: 'sports-news',
    };
    const replayCategory: CategoryRecord = {
      ...category,
      id: 'cat-shared-replay-video',
      name: '赛事录像',
      slug: 'match-replay',
      sortOrder: 2,
    };
    const urlConfig = homeNewsReplayUrlConfig('url-shared-replay', newsCategory, replayCategory);
    const tdkConfig = homeNewsReplayTdkConfig('tdk-shared-replay', newsCategory, replayCategory);
    const sharedReplay: LiveReplayRecord = {
      siteId: sourceSite.id,
      categoryId: replayCategory.id,
      title: '共享赛事录像应展示',
      slug: 'shared-replay',
      createTime: now,
      homeTeam: '主队',
      awayTeam: '客队',
      playUrl: 'https://example.com/shared-replay.m3u8',
      id: 'replay-shared',
      createdAt: now,
      updatedAt: now,
    };

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [currentSite, sourceSite],
        categories: [newsCategory, replayCategory],
        urlConfigs: [urlConfig],
        tdkConfigs: [tdkConfig],
        news: [articleForSite(currentSite.id, newsCategory.id, '当前站新闻', 'current-news', 1)],
        liveReplays: [sharedReplay],
      });

      const homeRoute = resolvePublicRoute('current-replay.local', []);
      const detailRoute = resolvePublicRoute('current-replay.local', ['video', 'match-replay', 'shared-replay.html']);

      expect(homeRoute?.kind).toBe('home');
      expect(homeRoute?.latestNews.map((article) => article.title)).toContain('共享赛事录像应展示');
      expect(detailRoute?.kind).toBe('news');
      if (detailRoute?.kind !== 'news') {
        throw new Error('expected news detail route');
      }
      expect(detailRoute.pageType).toBe('VIDEO_DETAIL');
      expect(detailRoute.article.siteId).toBe(currentSite.id);
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('resolves match detail URLs whose configured pattern combines matchId and slug', () => {
    const originalStore = snapshotCmsStore();
    const matchSite: SiteRecord = {
      ...site,
      id: 'site-match-detail',
      primaryDomain: 'match-detail.local',
      urlConfigId: 'url-match-detail',
      tdkConfigId: 'tdk-match-detail',
    };
    const matchCategory: CategoryRecord = {
      ...category,
      id: 'cat-match-football',
      name: '足球赛程',
      slug: 'football-schedule',
    };
    const urlConfig: UrlConfigRecord = {
      id: 'url-match-detail',
      siteId: null,
      categoryIds: [matchCategory.id],
      rules: [
        { id: 'url-home', categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] },
        {
          id: 'url-match',
          categoryId: matchCategory.id,
          pageType: 'MATCH_CATEGORY',
          pattern: '/zhibo/{categorySlug}.html',
          detailRules: [
            { id: 'url-match-detail-rule', label: '直播详情', pageType: 'MATCH_DETAIL', pattern: '/zhibo/{categorySlug}/{matchId}-{slug}.html' },
          ],
        },
      ],
      name: '直播 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const tdkConfig: TdkConfigRecord = {
      id: 'tdk-match-detail',
      siteId: null,
      categoryIds: [matchCategory.id],
      rules: [
        { id: 'tdk-home', categoryId: '', pageType: 'HOME', titleTemplate: '{siteName}', detailRules: [] },
        {
          id: 'tdk-match',
          categoryId: matchCategory.id,
          pageType: 'MATCH_CATEGORY',
          titleTemplate: '{columnName}_{siteName}',
          detailRules: [
            { id: 'tdk-match-detail-rule', label: '直播详情', pageType: 'MATCH_DETAIL', titleTemplate: '{title}_{siteName}' },
          ],
        },
      ],
      name: '直播 TDK',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '{siteName}',
      createdAt: now,
      updatedAt: now,
    };
    const match: SportMatchRecord = {
      id: 'match-football-1',
      sport: 'FOOTBALL',
      title: '主队 VS 客队',
      slug: 'vs-abc-1',
      isTop: false,
      status: 'SCHEDULED',
      startTime: now,
      createdAt: now,
      updatedAt: now,
    };

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [matchSite],
        categories: [matchCategory],
        urlConfigs: [urlConfig],
        tdkConfigs: [tdkConfig],
        news: [],
        liveReplays: [],
        matches: [match],
        leagues: [],
        teams: [],
      });

      const route = resolvePublicRoute('match-detail.local', ['zhibo', 'football-schedule', 'match-football-1-vs-abc-1.html']);

      expect(route?.kind).toBe('match');
      if (route?.kind !== 'match') {
        throw new Error('expected match detail route');
      }
      expect(route.match.id).toBe(match.id);
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('paginates match category pages over the next three days', () => {
    const originalStore = snapshotCmsStore();
    const current = new Date(Date.now());
    const matchSite: SiteRecord = {
      ...site,
      id: 'site-match-list',
      primaryDomain: 'match-list.local',
      urlConfigId: 'url-match-list',
      tdkConfigId: 'tdk-match-list',
    };
    const matchCategory: CategoryRecord = {
      ...category,
      id: 'cat-match-football-list',
      name: '足球直播',
      slug: 'football-live',
    };
    const urlConfig: UrlConfigRecord = {
      id: 'url-match-list',
      siteId: null,
      categoryIds: [matchCategory.id],
      rules: [
        { id: 'url-match-list-home', categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] },
        {
          id: 'url-match-list-category',
          categoryId: matchCategory.id,
          pageType: 'MATCH_CATEGORY',
          pattern: '/zhibo/{categorySlug}.html',
          detailRules: [
            { id: 'url-match-list-detail', label: '直播详情', pageType: 'MATCH_DETAIL', pattern: '/zhibo/{categorySlug}/{matchId}-{slug}.html' },
          ],
        },
      ],
      name: '直播列表 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const tdkConfig: TdkConfigRecord = {
      id: 'tdk-match-list',
      siteId: null,
      categoryIds: [matchCategory.id],
      rules: [
        { id: 'tdk-match-list-home', categoryId: '', pageType: 'HOME', titleTemplate: '{siteName}', detailRules: [] },
        {
          id: 'tdk-match-list-category',
          categoryId: matchCategory.id,
          pageType: 'MATCH_CATEGORY',
          titleTemplate: '{columnName}_{siteName}',
          detailRules: [
            { id: 'tdk-match-list-detail', label: '直播详情', pageType: 'MATCH_DETAIL', titleTemplate: '{title}_{siteName}' },
          ],
        },
      ],
      name: '直播列表 TDK',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '{siteName}',
      createdAt: now,
      updatedAt: now,
    };
    const matchAt = (id: string, hoursFromNow: number, sport: SportMatchRecord['sport'] = 'FOOTBALL'): SportMatchRecord => ({
      id,
      sport,
      title: `${id} 主队 VS 客队`,
      slug: `${id}-slug`,
      isTop: false,
      status: 'SCHEDULED',
      startTime: new Date(current.getTime() + hoursFromNow * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    const footballMatches = Array.from({ length: 12 }, (_, index) => matchAt(`football-${index + 1}`, index + 1));

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [matchSite],
        categories: [matchCategory],
        urlConfigs: [urlConfig],
        tdkConfigs: [tdkConfig],
        news: [],
        liveReplays: [],
        matches: [
          matchAt('past-football', -1),
          ...footballMatches,
          matchAt('future-football', 73),
          matchAt('basketball-1', 1, 'BASKETBALL'),
        ],
        leagues: [],
        teams: [],
      });

      const firstPage = resolvePublicRoute('match-list.local', ['zhibo', 'football-live.html']);
      const secondPage = resolvePublicRoute('match-list.local', ['zhibo', 'football-live.html'], 2);

      expect(firstPage?.kind).toBe('category');
      expect(secondPage?.kind).toBe('category');
      if (firstPage?.kind !== 'category' || secondPage?.kind !== 'category') {
        throw new Error('expected match category routes');
      }
      expect(firstPage.pageType).toBe('MATCH_CATEGORY');
      expect(firstPage.totalPages).toBe(2);
      expect(firstPage.matches.map((item) => item.id)).toEqual(footballMatches.slice(0, 10).map((item) => item.id));
      expect(secondPage.matches.map((item) => item.id)).toEqual(footballMatches.slice(10).map((item) => item.id));
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('resolves league pages and filters the schedule to that league', () => {
    const originalStore = snapshotCmsStore();
    const leagueSite: SiteRecord = {
      ...site,
      id: 'site-league-page',
      primaryDomain: 'league.local',
      urlConfigId: 'url-league-page',
      tdkConfigId: 'tdk-league-page',
    };
    const league: SportLeagueRecord = {
      id: 'league-premier-test',
      sport: 'FOOTBALL',
      name: '英超',
      slug: 'premier-league',
      isHot: true,
      createdAt: now,
      updatedAt: now,
    };
    const otherLeague: SportLeagueRecord = {
      ...league,
      id: 'league-other-test',
      name: '西甲',
      slug: 'la-liga',
    };
    const match: SportMatchRecord = {
      id: 'match-premier-test',
      sport: 'FOOTBALL',
      title: '英超：主队 VS 客队',
      slug: 'home-vs-away',
      leagueId: league.id,
      isTop: false,
      status: 'SCHEDULED',
      startTime: new Date(Date.now() + 60 * 60_000),
      createdAt: now,
      updatedAt: now,
    };
    const otherMatch: SportMatchRecord = {
      ...match,
      id: 'match-other-test',
      title: '西甲：主队 VS 客队',
      leagueId: otherLeague.id,
    };
    const urlConfig: UrlConfigRecord = {
      id: 'url-league-page',
      siteId: null,
      categoryIds: [],
      rules: [
        { id: 'url-home', categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] },
        { id: 'url-league', categoryId: '', pageType: 'LEAGUE', pattern: '/league/{leagueSlug}.html', detailRules: [] },
      ],
      name: '联赛 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const tdkConfig: TdkConfigRecord = {
      id: 'tdk-league-page',
      siteId: null,
      categoryIds: [],
      rules: [
        { id: 'tdk-home', categoryId: '', pageType: 'HOME', titleTemplate: '{siteName}', detailRules: [] },
        { id: 'tdk-league', categoryId: '', pageType: 'LEAGUE', titleTemplate: '{leagueName}_{siteName}', detailRules: [] },
      ],
      name: '联赛 TDK',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '{siteName}',
      createdAt: now,
      updatedAt: now,
    };

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [leagueSite],
        categories: [],
        urlConfigs: [urlConfig],
        tdkConfigs: [tdkConfig],
        news: [],
        liveReplays: [],
        matches: [match, otherMatch],
        leagues: [league, otherLeague],
        teams: [],
      });

      const route = resolvePublicRoute('league.local', ['league', 'premier-league.html']);

      expect(route?.kind).toBe('category');
      if (route?.kind !== 'category') {
        throw new Error('expected league category route');
      }
      expect(route.pageType).toBe('LEAGUE');
      expect(route.league?.id).toBe(league.id);
      expect(route.matches.map((item) => item.id)).toEqual([match.id]);
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });

  it('does not fall back to global or default league URL rules when the selected site URL lacks league rules', () => {
    const originalStore = snapshotCmsStore();
    const leagueSite: SiteRecord = {
      ...site,
      id: 'site-strict-league-url',
      primaryDomain: 'strict-league-url.local',
      urlConfigId: 'url-selected-without-league',
      tdkConfigId: 'tdk-strict-league-url',
    };
    const league: SportLeagueRecord = {
      id: 'league-strict-url',
      sport: 'FOOTBALL',
      name: '英超',
      slug: 'premier-league',
      isHot: true,
      createdAt: now,
      updatedAt: now,
    };
    const selectedUrlConfig: UrlConfigRecord = {
      id: 'url-selected-without-league',
      siteId: null,
      categoryIds: [],
      rules: [{ id: 'url-selected-without-league-home', categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] }],
      name: '选中但无联赛 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const globalLeagueUrlConfig: UrlConfigRecord = {
      id: 'url-global-league-should-not-be-used',
      siteId: null,
      categoryIds: [],
      rules: [
        { id: 'url-global-league-home', categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] },
        { id: 'url-global-league-rule', categoryId: '', pageType: 'LEAGUE', pattern: '/league/{leagueSlug}.html', detailRules: [] },
      ],
      name: '不应使用的全局联赛 URL',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: now,
      updatedAt: now,
    };
    const tdkConfig: TdkConfigRecord = {
      id: 'tdk-strict-league-url',
      siteId: null,
      categoryIds: [],
      rules: [
        { id: 'tdk-strict-league-url-home', categoryId: '', pageType: 'HOME', titleTemplate: '{siteName}', detailRules: [] },
        { id: 'tdk-strict-league-url-league', categoryId: '', pageType: 'LEAGUE', titleTemplate: '{leagueName}_{siteName}', detailRules: [] },
      ],
      name: '严格联赛 TDK',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '{siteName}',
      createdAt: now,
      updatedAt: now,
    };

    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        sites: [leagueSite],
        categories: [],
        urlConfigs: [selectedUrlConfig, globalLeagueUrlConfig],
        tdkConfigs: [tdkConfig],
        news: [],
        liveReplays: [],
        matches: [],
        leagues: [league],
        teams: [],
      });

      expect(resolvePublicRoute('strict-league-url.local', ['league', 'premier-league.html'])).toBeUndefined();
    } finally {
      Object.assign(cmsRepository.store, originalStore);
    }
  });
});

function homeNewsReplayUrlConfig(
  id: string,
  newsCategory: CategoryRecord,
  replayCategory: CategoryRecord,
): UrlConfigRecord {
  return {
    id,
    siteId: null,
    categoryIds: [newsCategory.id, replayCategory.id],
    rules: [
      { id: `${id}-home`, categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] },
      {
        id: `${id}-news`,
        categoryId: newsCategory.id,
        pageType: 'NEWS_CATEGORY',
        pattern: '/news/{categorySlug}.html',
        detailRules: [
          { id: `${id}-news-detail`, label: '新闻详情', pageType: 'NEWS_DETAIL', pattern: '/news/{categorySlug}/{newsSlug}.html' },
        ],
      },
      {
        id: `${id}-replay`,
        categoryId: replayCategory.id,
        pageType: 'VIDEO_CATEGORY',
        pattern: '/video/{categorySlug}.html',
        detailRules: [
          { id: `${id}-replay-detail`, label: '录像详情', pageType: 'VIDEO_DETAIL', pattern: '/video/{categorySlug}/{videoSlug}.html' },
        ],
      },
    ],
    name: id,
    status: 'ACTIVE',
    pageType: 'HOME',
    pattern: '/',
    createdAt: now,
    updatedAt: now,
  };
}

function homeNewsReplayTdkConfig(
  id: string,
  newsCategory: CategoryRecord,
  replayCategory: CategoryRecord,
): TdkConfigRecord {
  return {
    id,
    siteId: null,
    categoryIds: [newsCategory.id, replayCategory.id],
    rules: [
      { id: `${id}-home`, categoryId: '', pageType: 'HOME', titleTemplate: '{siteName}', detailRules: [] },
      {
        id: `${id}-news`,
        categoryId: newsCategory.id,
        pageType: 'NEWS_CATEGORY',
        titleTemplate: '{columnName}_{siteName}',
        detailRules: [
          { id: `${id}-news-detail`, label: '新闻详情', pageType: 'NEWS_DETAIL', titleTemplate: '{title}_{siteName}' },
        ],
      },
      {
        id: `${id}-replay`,
        categoryId: replayCategory.id,
        pageType: 'VIDEO_CATEGORY',
        titleTemplate: '{columnName}_{siteName}',
        detailRules: [
          { id: `${id}-replay-detail`, label: '录像详情', pageType: 'VIDEO_DETAIL', titleTemplate: '{title}_{siteName}' },
        ],
      },
    ],
    name: id,
    status: 'ACTIVE',
    pageType: 'HOME',
    titleTemplate: '{siteName}',
    createdAt: now,
    updatedAt: now,
  };
}

function snapshotCmsStore() {
  return Object.fromEntries(
    Object.entries(cmsRepository.store).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]),
  );
}

function articleForSite(
  siteId: string,
  categoryId: string,
  title: string,
  slug: string,
  minute: number,
): NewsArticleRecord {
  const date = new Date(now.getTime() + minute * 60_000);
  return {
    siteId,
    categoryId,
    title,
    slug,
    summary: `${title}的摘要内容，确保前台可以展示。`,
    content: `${title}的正文内容，确保前台可以服务端渲染输出。`,
    status: 'PUBLISHED',
    isTop: false,
    publishedAt: date,
    id: `news-${slug}`,
    createdAt: date,
    updatedAt: date,
  };
}
