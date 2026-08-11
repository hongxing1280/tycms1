import { describe, expect, it } from 'vitest';
import type {
  CategoryRecord,
  LiveReplayRecord,
  NewsArticleRecord,
  PromotionLinkRecord,
  ScheduledTaskRecord,
  TdkConfigRecord,
  UrlConfigRecord,
} from '@sports/core';
import { createMemoryCmsRepository } from './repository';
import { createSeedData } from './seed-data';

describe('category sibling name constraints', () => {
  it('rejects creating a top-level category with a duplicate sibling name', () => {
    const repository = createMemoryCmsRepository(createSeedData());

    expect(() =>
      repository.createCategory({
        name: '体育新闻',
        slug: 'sports-news-preview',
        language: 'zh-CN',
        status: 'ACTIVE',
        description: '重复的栏目名称不应被允许。',
        sortOrder: 99,
      }),
    ).toThrow('栏目名不能重复：体育新闻');
  });

  it('rejects renaming a category to match an existing sibling name', () => {
    const repository = createMemoryCmsRepository(createSeedData());

    expect(() =>
      repository.updateCategory('cat-courtside-analysis', {
        name: '体育新闻',
      }),
    ).toThrow('栏目名不能重复：体育新闻');
  });

  it('allows duplicate names under different parents', () => {
    const repository = createMemoryCmsRepository(createSeedData());

    expect(() =>
      repository.createCategory({
        parentId: 'cat-frontline-news',
        name: '体育新闻',
        slug: 'sports-news-child',
        language: 'zh-CN',
        status: 'ACTIVE',
        description: '不同父级可以复用栏目名称。',
        sortOrder: 10,
      }),
    ).not.toThrow();
  });

  it('dedupes existing sibling names and remaps category references', () => {
    const store = createSeedData();
    const duplicateCategoryId = 'category-duplicate-news';
    const duplicateChildId = 'category-duplicate-child';
    const now = new Date('2026-05-29T05:30:00.000Z');

    store.categories.push(
      duplicateCategory({
        id: duplicateCategoryId,
        name: '体育新闻',
        slug: 'sports-news-preview',
        sortOrder: 15,
        createdAt: now,
      }),
      duplicateCategory({
        id: duplicateChildId,
        parentId: duplicateCategoryId,
        name: '国际足球',
        slug: 'global-football',
        sortOrder: 16,
        createdAt: now,
      }),
    );

    store.news.push(
      duplicateNewsArticle({
        id: 'news-duplicate-category',
        categoryId: duplicateCategoryId,
      }),
    );
    store.liveReplays.push(
      duplicateLiveReplay({
        id: 'live-replay-duplicate-category',
        categoryId: duplicateCategoryId,
      }),
    );
    store.promotionLinks.push(
      duplicatePromotionLink({
        id: 'promotion-duplicate-category',
        categoryId: duplicateCategoryId,
      }),
    );
    store.urlConfigs.push(
      duplicateUrlConfig({
        id: 'url-config-duplicate-category',
        categoryId: duplicateCategoryId,
      }),
    );
    store.tdkConfigs.push(
      duplicateTdkConfig({
        id: 'tdk-config-duplicate-category',
        categoryId: duplicateCategoryId,
      }),
    );
    store.scheduledTasks = store.scheduledTasks.map((task) =>
      task.id === 'task-daily-dongqiudi-news'
        ? ({
            ...task,
            config: {
              ...(task.config ?? {}),
              categoryId: duplicateCategoryId,
            },
          } satisfies ScheduledTaskRecord)
        : task,
    );

    const repository = createMemoryCmsRepository(store);
    const rootSportsNewsCategories = repository.store.categories.filter(
      (category) => !category.parentId && category.name === '体育新闻',
    );
    const canonicalCategoryId = rootSportsNewsCategories.find((category) => !category.deletedAt)?.id;
    const child = repository.store.categories.find((category) => category.id === duplicateChildId);

    expect(rootSportsNewsCategories).toHaveLength(2);
    expect(rootSportsNewsCategories.filter((category) => !category.deletedAt)).toHaveLength(1);
    expect(rootSportsNewsCategories.filter((category) => category.deletedAt)).toHaveLength(1);
    expect(canonicalCategoryId).toBeTruthy();
    expect(child?.parentId).toBe(canonicalCategoryId);
    expect(repository.store.news.find((article) => article.id === 'news-duplicate-category')?.categoryId).toBe(
      canonicalCategoryId,
    );
    expect(
      repository.store.liveReplays.find((replay) => replay.id === 'live-replay-duplicate-category')?.categoryId,
    ).toBe(canonicalCategoryId);
    expect(
      repository.store.promotionLinks.find((link) => link.id === 'promotion-duplicate-category')?.categoryId,
    ).toBe(canonicalCategoryId);
    expect(
      repository.store.urlConfigs.find((config) => config.id === 'url-config-duplicate-category')?.categoryIds,
    ).toEqual([canonicalCategoryId]);
    expect(
      repository.store.urlConfigs.find((config) => config.id === 'url-config-duplicate-category')?.rules[0]?.categoryId,
    ).toBe(canonicalCategoryId);
    expect(
      repository.store.tdkConfigs.find((config) => config.id === 'tdk-config-duplicate-category')?.categoryIds,
    ).toEqual([canonicalCategoryId]);
    expect(
      repository.store.tdkConfigs.find((config) => config.id === 'tdk-config-duplicate-category')?.rules[0]?.categoryId,
    ).toBe(canonicalCategoryId);
    expect(repository.store.scheduledTasks.find((task) => task.id === 'task-daily-dongqiudi-news')?.config).toMatchObject({
      categoryId: canonicalCategoryId,
    });
  });
});

describe('referential delete protections', () => {
  it('keeps tracking and verification fields isolated per site', () => {
    const repository = createMemoryCmsRepository(createSeedData());
    const courtsideBefore = repository.store.sites.find((site) => site.id === 'site-courtside');

    repository.updateSite('site-frontline', {
      analyticsCode: '<script>window.__frontlineAnalytics = true</script>',
      baiduVerifyCode: 'frontline-baidu-code',
    });

    const frontline = repository.store.sites.find((site) => site.id === 'site-frontline');
    const courtside = repository.store.sites.find((site) => site.id === 'site-courtside');
    expect(frontline?.analyticsCode).toContain('__frontlineAnalytics');
    expect(frontline?.baiduVerifyCode).toBe('frontline-baidu-code');
    expect(courtside?.analyticsCode).toBe(courtsideBefore?.analyticsCode);
    expect(courtside?.baiduVerifyCode).toBe(courtsideBefore?.baiduVerifyCode);
  });

  it('rejects binding a site to another site scoped URL or TDK config', () => {
    const repository = createMemoryCmsRepository(createSeedData());
    const categoryId = repository.store.categories.find((category) => category.slug === 'sports-news')?.id;
    expect(categoryId).toBeTruthy();
    if (!categoryId) return;

    repository.store.urlConfigs.push(duplicateUrlConfig({ id: 'url-frontline-only', categoryId }));
    repository.store.tdkConfigs.push(duplicateTdkConfig({ id: 'tdk-frontline-only', categoryId }));

    expect(() => repository.updateSite('site-courtside', { urlConfigId: 'url-frontline-only' })).toThrow(
      'urlConfigId belongs to another site',
    );
    expect(() => repository.updateSite('site-courtside', { tdkConfigId: 'tdk-frontline-only' })).toThrow(
      'tdkConfigId belongs to another site',
    );
  });

  it('does not silently replace an existing site URL or TDK selection when the selected record is missing', () => {
    const store = createSeedData();
    const site = store.sites.find((record) => record.id === 'site-frontline');
    expect(site).toBeDefined();
    if (!site) return;

    site.urlConfigId = 'url-missing-production-selection';
    site.tdkConfigId = 'tdk-missing-production-selection';
    const repository = createMemoryCmsRepository(store);

    expect(repository.store.sites.find((record) => record.id === 'site-frontline')?.urlConfigId).toBe(
      'url-missing-production-selection',
    );
    expect(repository.store.sites.find((record) => record.id === 'site-frontline')?.tdkConfigId).toBe(
      'tdk-missing-production-selection',
    );
  });

  it('keeps every site template, URL, TDK, analytics and baidu verification isolated when a live product changes', () => {
    const store = createSeedData();
    const secondSite = store.sites.find((site) => site.id === 'site-courtside');
    expect(secondSite).toBeDefined();
    if (!secondSite) return;

    secondSite.analyticsCode = '<script>site-courtside-stat</script>';
    secondSite.baiduVerifyCode = 'baidu-courtside';

    const repository = createMemoryCmsRepository(store);
    const beforeSites = repository.store.sites.map((site) => ({
      id: site.id,
      templateId: site.templateId,
      urlConfigId: site.urlConfigId,
      tdkConfigId: site.tdkConfigId,
      analyticsCode: site.analyticsCode,
      baiduVerifyCode: site.baiduVerifyCode,
    }));

    repository.updateLiveProduct('live-product-frontline', {
      jumpUrl: 'https://121311.com',
      roomSuffix: '/liveMatchesTwo',
      appendRoomSuffix: true,
    });

    const afterSites = repository.store.sites.map((site) => ({
      id: site.id,
      templateId: site.templateId,
      urlConfigId: site.urlConfigId,
      tdkConfigId: site.tdkConfigId,
      analyticsCode: site.analyticsCode,
      baiduVerifyCode: site.baiduVerifyCode,
    }));

    expect(afterSites).toEqual(beforeSites);
  });

  it('deletes scheduled tasks that belong to a deleted site and keeps unrelated tasks', () => {
    const store = createSeedData();
    store.scheduledTasks.push(
      scheduledTaskForSite('task-frontline-extra-news', 'site-frontline'),
      scheduledTaskForSite('task-frontline-extra-replay', 'site-frontline'),
      scheduledTaskForSite('task-courtside-extra-news', 'site-courtside'),
      scheduledTaskForSite('task-global-extra-news', undefined),
    );
    const repository = createMemoryCmsRepository(store);

    repository.deleteSite('site-frontline');

    expect(repository.store.sites.find((site) => site.id === 'site-frontline')?.deletedAt).toBeInstanceOf(Date);
    expect(repository.store.scheduledTasks.some((task) => task.id === 'task-frontline-extra-news')).toBe(false);
    expect(repository.store.scheduledTasks.some((task) => task.id === 'task-frontline-extra-replay')).toBe(false);
    expect(repository.store.scheduledTasks.some((task) => task.id === 'task-courtside-extra-news')).toBe(true);
    expect(repository.store.scheduledTasks.some((task) => task.id === 'task-global-extra-news')).toBe(true);
    expect(
      repository.store.auditLogs.some(
        (entry) => entry.action === 'scheduledTask.delete' && entry.entityId === 'task-frontline-extra-news',
      ),
    ).toBe(true);
  });

  it('deletes scheduled tasks for every site in a bulk site delete', () => {
    const store = createSeedData();
    store.scheduledTasks.push(
      scheduledTaskForSite('task-frontline-bulk-news', 'site-frontline'),
      scheduledTaskForSite('task-courtside-bulk-news', 'site-courtside'),
      scheduledTaskForSite('task-global-bulk-news', undefined),
    );
    const repository = createMemoryCmsRepository(store);

    repository.bulkDeleteSites(['site-frontline', 'site-courtside']);

    expect(repository.store.scheduledTasks.some((task) => task.id === 'task-frontline-bulk-news')).toBe(false);
    expect(repository.store.scheduledTasks.some((task) => task.id === 'task-courtside-bulk-news')).toBe(false);
    expect(repository.store.scheduledTasks.some((task) => task.id === 'task-global-bulk-news')).toBe(true);
  });

  it('rejects deleting a group while an active site uses it', () => {
    const repository = createMemoryCmsRepository(createSeedData());

    expect(() => repository.deleteGroup('group-national')).toThrow('不能删除分组「全国体育站群」');
    expect(repository.store.sites.find((site) => site.id === 'site-frontline')?.groupId).toBe('group-national');
  });

  it('rejects deleting a template while an active site uses it', () => {
    const repository = createMemoryCmsRepository(createSeedData());

    expect(() => repository.deleteTemplate('template-jinqiu-live')).toThrow('不能删除模板「劲球直播风格 Jinqiu Live」');
    expect(repository.store.sites.find((site) => site.id === 'site-frontline')?.templateId).toBe('template-jinqiu-live');
  });

  it('rejects deleting URL and TDK configs while active sites use them', () => {
    const repository = createMemoryCmsRepository(createSeedData());

    expect(() => repository.deleteUrlConfig('url-default-rules')).toThrow('不能删除URL配置「默认全站 URL 规则」');
    expect(() => repository.deleteTdkConfig('tdk-default-rules')).toThrow('不能删除TDK配置「默认全站 TDK 规则」');
    expect(repository.store.sites.find((site) => site.id === 'site-frontline')?.urlConfigId).toBe('url-default-rules');
    expect(repository.store.sites.find((site) => site.id === 'site-frontline')?.tdkConfigId).toBe('tdk-default-rules');
  });

  it('rejects deleting a category while any public data or SEO rule uses it', () => {
    const repository = createMemoryCmsRepository(createSeedData());

    expect(() => repository.deleteCategory('cat-frontline-news')).toThrow('不能删除栏目「体育新闻」');
    expect(repository.store.categories.find((category) => category.id === 'cat-frontline-news')?.deletedAt).toBeUndefined();
  });

  it('validates all category ids before bulk deletion so it cannot partially delete safe rows', () => {
    const repository = createMemoryCmsRepository(createSeedData());
    const unusedCategory = repository.createCategory({
      name: '临时未绑定栏目',
      slug: 'temporary-unused-category',
      language: 'zh-CN',
      status: 'ACTIVE',
      description: '用于验证批量删除不会部分成功。',
      sortOrder: 999,
    });

    expect(() => repository.bulkDeleteCategories(['cat-frontline-news', unusedCategory.id])).toThrow(
      '不能删除栏目「体育新闻」',
    );
    expect(repository.store.categories.find((category) => category.id === unusedCategory.id)?.deletedAt).toBeUndefined();
  });

  it('allows deleting groups, templates, and categories after there are no bindings', () => {
    const repository = createMemoryCmsRepository(createSeedData());
    const unusedGroup = repository.createGroup({
      name: '未绑定分组',
      status: 'ACTIVE',
      remark: '没有站点绑定时可以删除。',
      newsUpdateCount: 0,
    });
    const unusedTemplate = repository.createTemplate({
      name: '未绑定模板',
      key: 'unused-template',
      folder: 'unused-template',
      author: null,
      coverUrl: null,
      status: 'ACTIVE',
    });
    const unusedCategory = repository.createCategory({
      name: '未绑定栏目',
      slug: 'unused-category',
      language: 'zh-CN',
      status: 'DISABLED',
      description: '没有启用、没有数据和 SEO 规则绑定时可以删除。',
      sortOrder: 1000,
    });

    expect(repository.deleteGroup(unusedGroup.id).id).toBe(unusedGroup.id);
    expect(repository.deleteTemplate(unusedTemplate.id).id).toBe(unusedTemplate.id);
    expect(repository.deleteCategory(unusedCategory.id).deletedAt).toBeInstanceOf(Date);
    expect(repository.store.groups.some((group) => group.id === unusedGroup.id)).toBe(false);
    expect(repository.store.templates.some((template) => template.id === unusedTemplate.id)).toBe(false);
  });
});

describe('child category SEO rule sync', () => {
  it('repairs default global URL and TDK rules to cover every active category', () => {
    const store = createSeedData();
    const activeCategoryIds = store.categories
      .filter((category) => !category.deletedAt && category.status === 'ACTIVE')
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => category.id);
    const urlConfig = store.urlConfigs.find((config) => config.id === 'url-default-rules');
    const tdkConfig = store.tdkConfigs.find((config) => config.id === 'tdk-default-rules');

    expect(urlConfig).toBeDefined();
    expect(tdkConfig).toBeDefined();
    if (!urlConfig || !tdkConfig) return;

    urlConfig.rules = urlConfig.rules.filter((rule) => ['cat-frontline-football', 'cat-frontline-news'].includes(rule.categoryId));
    urlConfig.categoryIds = urlConfig.rules.map((rule) => rule.categoryId);
    tdkConfig.rules = tdkConfig.rules.filter((rule) => ['cat-frontline-football'].includes(rule.categoryId));
    tdkConfig.categoryIds = tdkConfig.rules.map((rule) => rule.categoryId);

    const repository = createMemoryCmsRepository(store);
    const repairedUrlConfig = repository.store.urlConfigs.find((config) => config.id === 'url-default-rules');
    const repairedTdkConfig = repository.store.tdkConfigs.find((config) => config.id === 'tdk-default-rules');

    expect(repairedUrlConfig?.rules.some((rule) => rule.pageType === 'HOME' && rule.categoryId === '')).toBe(true);
    expect(repairedUrlConfig?.rules.filter((rule) => rule.categoryId).map((rule) => rule.categoryId)).toEqual(activeCategoryIds);
    expect(repairedUrlConfig?.categoryIds).toEqual(activeCategoryIds);
    expect(repairedTdkConfig?.rules.some((rule) => rule.pageType === 'HOME' && rule.categoryId === '')).toBe(true);
    expect(repairedTdkConfig?.rules.filter((rule) => rule.categoryId).map((rule) => rule.categoryId)).toEqual(activeCategoryIds);
    expect(repairedTdkConfig?.categoryIds).toEqual(activeCategoryIds);
  });

  it('creates a selectable four-column URL config', () => {
    const repository = createMemoryCmsRepository(createSeedData());
    const config = repository.store.urlConfigs.find((candidate) => candidate.id === 'url-four-column-rules');
    const slugByCategoryId = new Map(repository.store.categories.map((category) => [category.id, category.slug]));

    expect(config).toBeDefined();
    expect(config?.name).toBe('四栏目 URL 规则');
    expect(config?.status).toBe('ACTIVE');
    expect(config?.rules.find((rule) => rule.pageType === 'HOME' && rule.categoryId === '')).toMatchObject({
      pattern: '/',
    });
    expect(config?.rules.filter((rule) => rule.categoryId).map((rule) => slugByCategoryId.get(rule.categoryId))).toEqual([
      'football-live',
      'sports-news',
      'cba-schedule',
      'match-replay',
    ]);
    expect(config?.categoryIds).toHaveLength(4);
  });

  it('does not overwrite an existing four-column URL config', () => {
    const store = createSeedData();
    const sportsNewsCategory = store.categories.find((category) => category.slug === 'sports-news');

    expect(sportsNewsCategory).toBeDefined();
    if (!sportsNewsCategory) return;

    store.urlConfigs.push({
      id: 'url-four-column-rules',
      siteId: null,
      categoryIds: [sportsNewsCategory.id],
      rules: [
        {
          id: 'custom-four-home',
          categoryId: '',
          pageType: 'HOME',
          pattern: '/',
          detailRules: [],
        },
        {
          id: 'custom-four-sports-news',
          categoryId: sportsNewsCategory.id,
          pageType: 'NEWS_CATEGORY',
          pattern: '/news1/{categorySlug}.html',
          detailRules: [
            {
              id: 'custom-four-sports-news-detail',
              label: '新闻内页',
              pageType: 'NEWS_DETAIL',
              pattern: '/news1/{categorySlug}/{newsSlug}.html',
            },
          ],
        },
      ],
      name: '四栏目 URL 规则',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      createdAt: new Date('2026-05-30T00:00:00.000Z'),
      updatedAt: new Date('2026-05-30T00:00:00.000Z'),
    });

    const repository = createMemoryCmsRepository(store);
    const config = repository.store.urlConfigs.find((candidate) => candidate.id === 'url-four-column-rules');

    expect(config?.categoryIds).toEqual([sportsNewsCategory.id]);
    expect(config?.rules.find((rule) => rule.categoryId === sportsNewsCategory.id)).toMatchObject({
      pageType: 'NEWS_CATEGORY',
      pattern: '/news1/{categorySlug}.html',
    });
  });

  it('repairs stale match URL and TDK rules for news categories', () => {
    const store = createSeedData();
    const nbaCategory = store.categories.find((category) => category.slug === 'nba-news');
    const urlConfig = store.urlConfigs.find((config) => config.id === 'url-default-rules');
    const tdkConfig = store.tdkConfigs.find((config) => config.id === 'tdk-default-rules');

    expect(nbaCategory).toBeDefined();
    expect(urlConfig).toBeDefined();
    expect(tdkConfig).toBeDefined();
    if (!nbaCategory || !urlConfig || !tdkConfig) return;

    urlConfig.rules = urlConfig.rules.map((rule) =>
      rule.categoryId === nbaCategory.id
        ? {
            ...rule,
            pageType: 'MATCH_CATEGORY',
            pattern: '/zhibo/{categorySlug}.html',
            detailRules: [
              {
                id: 'stale-url-detail-nba-news',
                label: '旧 NBA 内页',
                pageType: 'MATCH_DETAIL',
                pattern: '/zhibo/{categorySlug}/{newsSlug}.html',
              },
            ],
          }
        : rule,
    );
    tdkConfig.rules = tdkConfig.rules.map((rule) =>
      rule.categoryId === nbaCategory.id
        ? {
            ...rule,
            pageType: 'MATCH_CATEGORY',
            titleTemplate: '{columnName}_高清直播在线_{siteName}',
            keywordsTemplate: '{columnName},高清直播,{siteName}',
            descriptionTemplate: '{siteName}提供{columnName}直播入口。',
            detailRules: [
              {
                id: 'stale-tdk-detail-nba-news',
                label: '旧 NBA 内页',
                pageType: 'MATCH_DETAIL',
                titleTemplate: '{title}_{columnName}_{siteName}',
                keywordsTemplate: '{title},{columnName},{siteName}',
                descriptionTemplate: '{summary}',
              },
            ],
          }
        : rule,
    );

    const repository = createMemoryCmsRepository(store);
    const repairedUrlRule = repository.store.urlConfigs
      .find((config) => config.id === 'url-default-rules')
      ?.rules.find((rule) => rule.categoryId === nbaCategory.id);
    const repairedTdkRule = repository.store.tdkConfigs
      .find((config) => config.id === 'tdk-default-rules')
      ?.rules.find((rule) => rule.categoryId === nbaCategory.id);

    expect(repairedUrlRule).toMatchObject({
      categoryId: nbaCategory.id,
      pageType: 'NEWS_CATEGORY',
      pattern: '/news/{categorySlug}.html',
    });
    expect(repairedUrlRule?.detailRules?.[0]).toMatchObject({
      pageType: 'NEWS_DETAIL',
      pattern: '/news/{categorySlug}/{newsSlug}.html',
    });
    expect(repairedTdkRule).toMatchObject({
      categoryId: nbaCategory.id,
      pageType: 'NEWS_CATEGORY',
      titleTemplate: '最新{columnName}-{siteName}',
    });
    expect(repairedTdkRule?.detailRules?.[0]).toMatchObject({
      pageType: 'NEWS_DETAIL',
      titleTemplate: '{title}_{siteName}',
    });
  });

  it('preserves custom URL and TDK patterns when repairing default global rules', () => {
    const store = createSeedData();
    const sportsNewsCategory = store.categories.find((category) => category.slug === 'sports-news');
    const urlConfig = store.urlConfigs.find((config) => config.id === 'url-default-rules');
    const tdkConfig = store.tdkConfigs.find((config) => config.id === 'tdk-default-rules');

    expect(sportsNewsCategory).toBeDefined();
    expect(urlConfig).toBeDefined();
    expect(tdkConfig).toBeDefined();
    if (!sportsNewsCategory || !urlConfig || !tdkConfig) return;

    urlConfig.rules = urlConfig.rules.map((rule) =>
      rule.categoryId === sportsNewsCategory.id
        ? {
            ...rule,
            pageType: 'NEWS_CATEGORY',
            pattern: '/news1/{categorySlug}.html',
            detailRules: [
              {
                id: 'custom-url-detail-sports-news',
                label: '自定义新闻内页',
                pageType: 'NEWS_DETAIL',
                pattern: '/news1/{categorySlug}/{newsSlug}.html',
              },
            ],
          }
        : rule,
    );
    tdkConfig.rules = tdkConfig.rules.map((rule) =>
      rule.categoryId === sportsNewsCategory.id
        ? {
            ...rule,
            pageType: 'NEWS_CATEGORY',
            titleTemplate: '{columnName}_自定义标题_{siteName}',
            keywordsTemplate: '{columnName},自定义关键词,{siteName}',
            descriptionTemplate: '{siteName}自定义{columnName}描述。',
            detailRules: [
              {
                id: 'custom-tdk-detail-sports-news',
                label: '自定义新闻内页',
                pageType: 'NEWS_DETAIL',
                titleTemplate: '{title}_自定义内页_{siteName}',
                keywordsTemplate: '{title},自定义内页,{siteName}',
                descriptionTemplate: '{summary}',
              },
            ],
          }
        : rule,
    );

    const repository = createMemoryCmsRepository(store);
    const repairedUrlRule = repository.store.urlConfigs
      .find((config) => config.id === 'url-default-rules')
      ?.rules.find((rule) => rule.categoryId === sportsNewsCategory.id);
    const repairedTdkRule = repository.store.tdkConfigs
      .find((config) => config.id === 'tdk-default-rules')
      ?.rules.find((rule) => rule.categoryId === sportsNewsCategory.id);

    expect(repairedUrlRule).toMatchObject({
      pageType: 'NEWS_CATEGORY',
      pattern: '/news1/{categorySlug}.html',
    });
    expect(repairedUrlRule?.detailRules?.[0]).toMatchObject({
      pageType: 'NEWS_DETAIL',
      pattern: '/news1/{categorySlug}/{newsSlug}.html',
    });
    expect(repairedTdkRule).toMatchObject({
      pageType: 'NEWS_CATEGORY',
      titleTemplate: '{columnName}_自定义标题_{siteName}',
    });
    expect(repairedTdkRule?.detailRules?.[0]).toMatchObject({
      pageType: 'NEWS_DETAIL',
      titleTemplate: '{title}_自定义内页_{siteName}',
    });
  });

  it('adds default URL and TDK rules when creating a new top-level category', () => {
    const repository = createMemoryCmsRepository(createSeedData());
    const created = repository.createCategory({
      name: '排球资讯',
      slug: 'volleyball-news',
      language: 'zh-CN',
      status: 'ACTIVE',
      description: '排球赛事和球队动态。',
      sortOrder: 91,
    });
    const urlConfig = repository.store.urlConfigs.find((config) => config.id === 'url-default-rules');
    const tdkConfig = repository.store.tdkConfigs.find((config) => config.id === 'tdk-default-rules');

    expect(urlConfig?.rules.find((rule) => rule.categoryId === created.id)).toMatchObject({
      categoryId: created.id,
      pageType: 'NEWS_CATEGORY',
      pattern: '/news/{categorySlug}.html',
    });
    expect(urlConfig?.categoryIds).toContain(created.id);
    expect(tdkConfig?.rules.find((rule) => rule.categoryId === created.id)).toMatchObject({
      categoryId: created.id,
      pageType: 'NEWS_CATEGORY',
      titleTemplate: '最新{columnName}-{siteName}',
    });
    expect(tdkConfig?.categoryIds).toContain(created.id);
  });

  it('adds default URL and TDK rules when creating a child under a configured parent', () => {
    const repository = createMemoryCmsRepository(createSeedData());
    const created = repository.createCategory({
      parentId: 'cat-frontline-news',
      name: '网球资讯',
      slug: 'tennis-news',
      language: 'zh-CN',
      status: 'ACTIVE',
      description: '网球赛事和球员动态。',
      sortOrder: 90,
    }) as CategoryRecord & { seoRuleNotice?: string };
    const urlConfig = repository.store.urlConfigs.find((config) => config.id === 'url-default-rules');
    const tdkConfig = repository.store.tdkConfigs.find((config) => config.id === 'tdk-default-rules');
    const urlRule = urlConfig?.rules.find((rule) => rule.categoryId === created.id);
    const tdkRule = tdkConfig?.rules.find((rule) => rule.categoryId === created.id);

    expect(created.seoRuleNotice).toContain('请立即设置并检查 TDK 和 URL 规则');
    expect(urlRule).toMatchObject({
      categoryId: created.id,
      pageType: 'NEWS_CATEGORY',
      pattern: '/news/{categorySlug}.html',
    });
    expect(urlRule?.detailRules?.[0]).toMatchObject({
      pageType: 'NEWS_DETAIL',
      pattern: '/news/{categorySlug}/{newsSlug}.html',
    });
    expect(tdkRule).toMatchObject({
      categoryId: created.id,
      pageType: 'NEWS_CATEGORY',
      titleTemplate: '最新{columnName}-{siteName}',
    });
    expect(tdkRule?.detailRules?.[0]).toMatchObject({
      pageType: 'NEWS_DETAIL',
      titleTemplate: '{title}_{siteName}',
    });
  });

  it('does not duplicate child URL and TDK rules when the child category is edited later', () => {
    const repository = createMemoryCmsRepository(createSeedData());
    const created = repository.createCategory({
      parentId: 'cat-frontline-news',
      name: '排球资讯',
      slug: 'volleyball-news',
      language: 'zh-CN',
      status: 'ACTIVE',
      description: '排球赛事和球队动态。',
      sortOrder: 91,
    });

    repository.updateCategory(created.id, {
      description: '排球赛事、球队动态和赛程新闻。',
    });

    const urlRuleCount = repository.store.urlConfigs
      .find((config) => config.id === 'url-default-rules')
      ?.rules.filter((rule) => rule.categoryId === created.id).length;
    const tdkRuleCount = repository.store.tdkConfigs
      .find((config) => config.id === 'tdk-default-rules')
      ?.rules.filter((rule) => rule.categoryId === created.id).length;

    expect(urlRuleCount).toBe(1);
    expect(tdkRuleCount).toBe(1);
  });
});

function duplicateCategory(
  input: Pick<CategoryRecord, 'id' | 'name' | 'slug' | 'sortOrder' | 'createdAt'> & {
    parentId?: string;
  },
): CategoryRecord {
  return {
    id: input.id,
    parentId: input.parentId,
    name: input.name,
    slug: input.slug,
    language: 'zh-CN',
    status: 'ACTIVE',
    description: `${input.name} duplicate fixture`,
    sortOrder: input.sortOrder,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

function duplicateNewsArticle(input: Pick<NewsArticleRecord, 'id' | 'categoryId'>): NewsArticleRecord {
  const now = new Date('2026-05-29T05:30:00.000Z');
  return {
    id: input.id,
    siteId: 'site-frontline',
    categoryId: input.categoryId,
    title: '重复栏目新闻',
    slug: 'duplicate-category-news',
    summary: '用于验证栏目引用迁移。',
    content: '用于验证栏目引用迁移的完整正文内容。',
    coverImageUrl: null,
    coverImageWidth: 1200,
    coverImageHeight: 630,
    author: 'Codex',
    sourceName: 'Fixture',
    sourceUrl: 'https://example.com/duplicate-category-news',
    status: 'PUBLISHED',
    isTop: false,
    publishedAt: now,
    seoTitle: null,
    seoKeywords: null,
    seoDescription: null,
    canonicalUrl: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

function duplicateLiveReplay(input: Pick<LiveReplayRecord, 'id' | 'categoryId'>): LiveReplayRecord {
  const now = new Date('2026-05-29T05:30:00.000Z');
  return {
    id: input.id,
    siteId: 'site-frontline',
    categoryId: input.categoryId,
    title: '重复栏目录像',
    slug: 'duplicate-category-replay',
    createTime: now,
    homeTeam: '主队',
    awayTeam: '客队',
    playUrl: 'https://example.com/replay',
    createdAt: now,
    updatedAt: now,
  };
}

function duplicatePromotionLink(input: Pick<PromotionLinkRecord, 'id' | 'categoryId'>): PromotionLinkRecord {
  const now = new Date('2026-05-29T05:30:00.000Z');
  return {
    id: input.id,
    siteId: 'site-frontline',
    categoryId: input.categoryId,
    promotionTypeId: 'promo-type-frontline-home-hero',
    title: '重复栏目推广位',
    subtitle: '用于验证栏目引用迁移',
    targetUrl: 'https://example.com/promo',
    imageUrl: null,
    relNofollow: false,
    relSponsored: false,
    openInNewTab: true,
    device: 'ALL',
    weight: 10,
    startAt: null,
    endAt: null,
    status: 'ACTIVE',
    sortOrder: 10,
    createdAt: now,
    updatedAt: now,
  };
}

function duplicateUrlConfig(input: Pick<UrlConfigRecord, 'id'> & { categoryId: string }): UrlConfigRecord {
  const now = new Date('2026-05-29T05:30:00.000Z');
  return {
    id: input.id,
    siteId: 'site-frontline',
    categoryIds: [input.categoryId],
    rules: [
      {
        id: `${input.id}-rule`,
        categoryId: input.categoryId,
        pageType: 'NEWS_CATEGORY',
        pattern: '/news/{categorySlug}.html',
        detailRules: [
          {
            id: `${input.id}-rule-detail`,
            label: '栏目详情',
            pageType: 'NEWS_DETAIL',
            pattern: '/news/{categorySlug}/{newsSlug}.html',
          },
        ],
      },
    ],
    name: '重复栏目 URL 规则',
    status: 'ACTIVE',
    pageType: 'NEWS_CATEGORY',
    pattern: '/news/{categorySlug}.html',
    description: '验证重复栏目 URL 绑定迁移。',
    createdAt: now,
    updatedAt: now,
  };
}

function duplicateTdkConfig(input: Pick<TdkConfigRecord, 'id'> & { categoryId: string }): TdkConfigRecord {
  const now = new Date('2026-05-29T05:30:00.000Z');
  return {
    id: input.id,
    siteId: 'site-frontline',
    categoryIds: [input.categoryId],
    rules: [
      {
        id: `${input.id}-rule`,
        categoryId: input.categoryId,
        pageType: 'NEWS_CATEGORY',
        titleTemplate: '{categoryName}-{siteName}',
        keywordsTemplate: '{categoryName},{siteName}',
        descriptionTemplate: '{siteName}{categoryName}',
        detailRules: [
          {
            id: `${input.id}-rule-detail`,
            label: '栏目详情',
            pageType: 'NEWS_DETAIL',
            titleTemplate: '{title}-{siteName}',
            keywordsTemplate: '{title},{siteName}',
            descriptionTemplate: '{summary}',
          },
        ],
      },
    ],
    name: '重复栏目 TDK 规则',
    status: 'ACTIVE',
    pageType: 'NEWS_CATEGORY',
    titleTemplate: '{categoryName}-{siteName}',
    keywordsTemplate: '{categoryName},{siteName}',
    descriptionTemplate: '{siteName}{categoryName}',
    createdAt: now,
    updatedAt: now,
  };
}

function scheduledTaskForSite(id: string, siteId: string | undefined): ScheduledTaskRecord {
  const now = new Date('2026-05-29T05:30:00.000Z');
  return {
    id,
    type: 'NEWS_CRAWL',
    name: `${id} 测试任务`,
    status: 'ACTIVE',
    scheduleTime: '03:00',
    timezone: 'Asia/Shanghai',
    lastRunAt: null,
    nextRunAt: null,
    lastStatus: 'IDLE',
    lastMessage: '等待执行',
    runCount: 0,
    failureCount: 0,
    config: siteId
      ? {
          siteId,
          sourceUrl: 'https://example.com/news',
          categoryId: 'cat-frontline-news',
        }
      : {
          sourceUrl: 'https://example.com/news',
        },
    createdAt: now,
    updatedAt: now,
  };
}
