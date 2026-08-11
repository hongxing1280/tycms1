import { describe, expect, it } from 'vitest';
import { resolveTdk } from '../tdk-resolver';
import type { SiteRecord } from '../types';

const site: SiteRecord = {
  id: 'site-a',
  name: '体育前线',
  primaryDomain: 'site-a.local',
  status: 'ACTIVE',
  showSignalSources: false,
  seoIndexStatus: 'INDEX',
  domains: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('tdk resolver', () => {
  it('uses object seo before default templates', () => {
    const tdk = resolveTdk({
      site,
      pageType: 'NEWS_DETAIL',
      variables: { title: '国足公布新名单', summary: '这是一段用于描述新闻页面的摘要。' },
      objectSeo: { title: '{title} - 深度解读' },
    });

    expect(tdk.title).toBe('国足公布新名单 - 深度解读');
    expect(tdk.robots).toBe('index,follow');
  });

  it('marks noindex pages when requested', () => {
    const tdk = resolveTdk({ site, pageType: 'SEARCH', noindex: true });

    expect(tdk.robots).toBe('noindex,follow');
  });

  it('uses site home seo before home tdk configs', () => {
    const tdk = resolveTdk({
      site: {
        ...site,
        seoTitle: '首页直接填写标题',
        seoKeywords: '首页关键词',
        seoDescription: '首页描述',
      },
      pageType: 'HOME',
      tdkConfigs: [
        {
          id: 'tdk-home-a',
          siteId: 'site-a',
          rules: [
            {
              id: 'rule-home',
              categoryId: '',
              pageType: 'HOME',
              titleTemplate: '模板标题',
              keywordsTemplate: '模板关键词',
              descriptionTemplate: '模板描述',
              detailRules: [],
            },
          ],
          name: '首页模板',
          status: 'ACTIVE',
          pageType: 'HOME',
          titleTemplate: '模板标题',
          keywordsTemplate: '模板关键词',
          descriptionTemplate: '模板描述',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ],
    });

    expect(tdk.title).toBe('首页直接填写标题');
    expect(tdk.keywords).toBe('首页关键词');
    expect(tdk.description).toBe('首页描述');
  });

  it('uses selected inner page tdk config when page type matches', () => {
    const tdk = resolveTdk({
      site,
      pageType: 'NEWS_CATEGORY',
      variables: { categoryName: '足球直播' },
      preferredConfigId: 'tdk-category-selected',
      tdkConfigs: [
        {
          id: 'tdk-category-default',
          siteId: 'site-a',
          rules: [
            {
              id: 'rule-default',
              categoryId: '',
              pageType: 'NEWS_CATEGORY',
              titleTemplate: '默认 {categoryName}',
              detailRules: [
                {
                  id: 'rule-default-detail',
                  label: '默认内页',
                  pageType: 'NEWS_DETAIL',
                  titleTemplate: '默认内页 {categoryName}',
                },
              ],
            },
          ],
          name: '默认栏目模板',
          status: 'ACTIVE',
          pageType: 'NEWS_CATEGORY',
          titleTemplate: '默认 {categoryName}',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
        {
          id: 'tdk-category-selected',
          siteId: 'site-a',
          rules: [
            {
              id: 'rule-selected',
              categoryId: '',
              pageType: 'NEWS_CATEGORY',
              titleTemplate: '选中 {categoryName}',
              detailRules: [
                {
                  id: 'rule-selected-detail',
                  label: '选中内页',
                  pageType: 'NEWS_DETAIL',
                  titleTemplate: '选中内页 {categoryName}',
                },
              ],
            },
          ],
          name: '选中栏目模板',
          status: 'ACTIVE',
          pageType: 'NEWS_CATEGORY',
          titleTemplate: '选中 {categoryName}',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ],
    });

    expect(tdk.title).toBe('选中 足球直播');
  });

  it('uses the site default tdk config when no per-call config is selected', () => {
    const tdk = resolveTdk({
      site: { ...site, tdkConfigId: 'tdk-site-default' },
      pageType: 'NEWS_CATEGORY',
      variables: { categoryName: '足球直播' },
      tdkConfigs: [
        {
          id: 'tdk-site-default',
          siteId: null,
          rules: [
            {
              id: 'rule-site-default',
              categoryId: '',
              pageType: 'NEWS_CATEGORY',
              titleTemplate: '站点默认 {categoryName}',
              detailRules: [],
            },
          ],
          name: '站点默认 TDK',
          status: 'ACTIVE',
          pageType: 'NEWS_CATEGORY',
          titleTemplate: '站点默认 {categoryName}',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ],
    });

    expect(tdk.title).toBe('站点默认 足球直播');
  });
});
