import {
  buildPublicOrigin,
  fillUrlPattern,
  normalizePublicPath,
  resolveTdk,
  tdkRules,
  urlRules,
  type CategoryRecord,
  type LiveProductRecord,
  type LiveReplayRecord,
  type NewsArticleRecord,
  type PageType,
  type PromotionLinkRecord,
  type PublicUrlData,
  type SignalDomainRecord,
  type SignalSourceNameRecord,
  type SiteRecord,
  type SportLeagueRecord,
  type SportMatchRecord,
  type TdkConfigRecord,
  type UrlConfigRecord,
} from '@sports/core';
import { cmsRepository } from '@sports/db';
import { breadcrumbJsonLd, newsArticleJsonLd, serializeJsonLd, videoObjectJsonLd } from '@sports/seo';
import { getTemplatePackage } from '@sports/templates';
import { resolveSignalJumpTarget, signalJumpTokenFromPath } from './signal-jump';

type CategoryUrlBinding = {
  config: UrlConfigRecord;
  pageType: PageType;
  categoryId: string;
};

type CategoryTdkBinding = {
  config: TdkConfigRecord;
  categoryId: string;
};

export type PublicRouteData =
  | {
      kind: 'home';
      site: SiteRecord;
      categories: CategoryRecord[];
      categoryArticleCounts: Record<string, number>;
      topNews: NewsArticleRecord[];
      latestNews: NewsArticleRecord[];
      matches: ReturnType<typeof cmsRepository.listMatches>;
      leagues: ReturnType<typeof cmsRepository.listLeagues>;
      teams: ReturnType<typeof cmsRepository.listTeams>;
      promotions: PromotionLinkRecord[];
      liveProducts: LiveProductRecord[];
      signalDomains: SignalDomainRecord[];
      signalSourceNames: SignalSourceNameRecord[];
      canonical: string;
      tdk: ReturnType<typeof resolveTdk>;
    }
  | {
      kind: 'category';
      site: SiteRecord;
      categories: CategoryRecord[];
      category: CategoryRecord;
      league?: SportLeagueRecord;
      pageType: PageType;
      categoryArticleCounts: Record<string, number>;
      topNews: NewsArticleRecord[];
      latestNews: NewsArticleRecord[];
      matches: ReturnType<typeof cmsRepository.listMatches>;
      leagues: ReturnType<typeof cmsRepository.listLeagues>;
      teams: ReturnType<typeof cmsRepository.listTeams>;
      promotions: PromotionLinkRecord[];
      liveProducts: LiveProductRecord[];
      signalDomains: SignalDomainRecord[];
      signalSourceNames: SignalSourceNameRecord[];
      canonical: string;
      page: number;
      totalPages: number;
      tdk: ReturnType<typeof resolveTdk>;
    }
  | {
      kind: 'news';
      site: SiteRecord;
      categories: CategoryRecord[];
      article: NewsArticleRecord;
      pageType: PageType;
      categoryArticleCounts: Record<string, number>;
      topNews: NewsArticleRecord[];
      latestNews: NewsArticleRecord[];
      matches: ReturnType<typeof cmsRepository.listMatches>;
      leagues: ReturnType<typeof cmsRepository.listLeagues>;
      teams: ReturnType<typeof cmsRepository.listTeams>;
      promotions: PromotionLinkRecord[];
      liveProducts: LiveProductRecord[];
      signalDomains: SignalDomainRecord[];
      signalSourceNames: SignalSourceNameRecord[];
      canonical: string;
      breadcrumbs: Array<{ name: string; url: string }>;
      newsArticleJsonLd: string;
      breadcrumbJsonLd: string;
      videoObjectJsonLd?: string;
      tdk: ReturnType<typeof resolveTdk>;
    }
  | {
      kind: 'match';
      site: SiteRecord;
      categories: CategoryRecord[];
      category: CategoryRecord;
      match: SportMatchRecord;
      categoryArticleCounts: Record<string, number>;
      topNews: NewsArticleRecord[];
      latestNews: NewsArticleRecord[];
      matches: ReturnType<typeof cmsRepository.listMatches>;
      leagues: ReturnType<typeof cmsRepository.listLeagues>;
      teams: ReturnType<typeof cmsRepository.listTeams>;
      promotions: PromotionLinkRecord[];
      liveProducts: LiveProductRecord[];
      signalDomains: SignalDomainRecord[];
      signalSourceNames: SignalSourceNameRecord[];
      canonical: string;
      breadcrumbs: Array<{ name: string; url: string }>;
      breadcrumbJsonLd: string;
      tdk: ReturnType<typeof resolveTdk>;
    }
  | {
      kind: 'signal-jump';
      site: SiteRecord;
      categories: CategoryRecord[];
      categoryArticleCounts: Record<string, number>;
      topNews: NewsArticleRecord[];
      latestNews: NewsArticleRecord[];
      matches: ReturnType<typeof cmsRepository.listMatches>;
      leagues: ReturnType<typeof cmsRepository.listLeagues>;
      teams: ReturnType<typeof cmsRepository.listTeams>;
      promotions: PromotionLinkRecord[];
      liveProducts: LiveProductRecord[];
      signalDomains: SignalDomainRecord[];
      signalSourceNames: SignalSourceNameRecord[];
      canonical: string;
      token: string;
      tdk: ReturnType<typeof resolveTdk>;
    };

type PublicSiteContext = {
  site: SiteRecord;
  urlConfigs: UrlConfigRecord[];
  tdkConfigs: TdkConfigRecord[];
  categories: CategoryRecord[];
  categoryArticleCounts: Record<string, number>;
  siteArticleLimit: number;
  publicNews: NewsArticleRecord[];
  liveReplayArticles: NewsArticleRecord[];
  publicContent: NewsArticleRecord[];
  topNews: NewsArticleRecord[];
  latestNews: NewsArticleRecord[];
  matches: ReturnType<typeof cmsRepository.listMatches>;
  leagues: ReturnType<typeof cmsRepository.listLeagues>;
  teams: ReturnType<typeof cmsRepository.listTeams>;
  sitePromotions: PromotionLinkRecord[];
  liveProducts: LiveProductRecord[];
  signalDomains: SignalDomainRecord[];
  signalSourceNames: SignalSourceNameRecord[];
};

const categoryPageSize = 10;
const matchListWindowMs = 3 * 24 * 60 * 60 * 1000;

export function resolvePublicRoute(host: string, segments: string[] = [], page = 1): PublicRouteData | undefined {
  cmsRepository.syncFromDisk?.({ force: true });
  const resolution = cmsRepository.resolveSite(host);
  if (!resolution.ok) {
    return undefined;
  }

  const site = resolution.site;
  const {
    urlConfigs,
    tdkConfigs,
    categories,
    categoryArticleCounts,
    topNews,
    latestNews,
    matches,
    leagues,
    teams,
    sitePromotions,
    liveProducts,
    signalDomains,
    signalSourceNames,
  } = getPublicSiteContext(site);

  if (!hasStrictSiteBindings(site, urlConfigs, tdkConfigs)) {
    return undefined;
  }

  if (segments.length === 0) {
    const canonical = buildHomePublicUrl({ site, urlConfigs, absolute: true });
    const tdk = resolveConfiguredTdk({ site, pageType: 'HOME', tdkConfigs });
    if (!tdk) {
      return undefined;
    }

    return {
      kind: 'home',
      site,
      categories,
      categoryArticleCounts,
      topNews,
      latestNews,
      matches,
      leagues,
      teams,
      promotions: sitePromotions,
      liveProducts,
      signalDomains,
      signalSourceNames,
      canonical,
      tdk,
    };
  }

  const requestPath = normalizePublicPath(segments.join('/'));
  const homeUrl = buildHomePublicUrl({ site, urlConfigs, absolute: true });
  const signalJumpToken = signalJumpTokenFromPath(requestPath);
  if (signalJumpToken && resolveSignalJumpTarget(signalJumpToken)) {
    const tdk = resolveConfiguredTdk({
      site,
      pageType: 'LIVE_ROOM',
      tdkConfigs,
      variables: {
        title: '播放源',
        text: '播放源',
      },
      noindex: true,
    }) ?? resolveConfiguredTdk({
      site,
      pageType: 'HOME',
      tdkConfigs,
      variables: {
        title: '播放源',
        text: '播放源',
      },
      noindex: true,
    });
    if (!tdk) {
      return undefined;
    }

    return {
      kind: 'signal-jump',
      site,
      categories,
      categoryArticleCounts,
      topNews,
      latestNews,
      matches,
      leagues,
      teams,
      promotions: sitePromotions,
      liveProducts,
      signalDomains,
      signalSourceNames,
      canonical: `${buildPublicOrigin(site)}/${requestPath}`,
      token: signalJumpToken,
      tdk,
    };
  }

  const matchDetailRoute = matchMatchDetailRoute(site, categories, urlConfigs, requestPath);
  if (matchDetailRoute) {
    const { match, category } = matchDetailRoute;
    const detailTdkBinding = resolveCategoryDetailTdkBinding(category, site, tdkConfigs, 'MATCH_DETAIL');
    const tdk = resolveConfiguredTdk({
      site,
      pageType: 'MATCH_DETAIL',
      tdkConfigs,
      categoryId: category.id,
      configCategoryId: detailTdkBinding?.categoryId,
      preferredConfigId: detailTdkBinding?.config.id,
      variables: matchTdkVariables(match, category),
    });
    if (!detailTdkBinding || !tdk) {
      return undefined;
    }

    const canonical = buildMatchPublicUrl({
      site,
      match,
      category,
      urlConfigs,
      absolute: true,
    });
    const breadcrumbs = [
      { name: '首页', url: homeUrl },
      {
        name: category.name,
        url: buildCategoryPublicUrl({
          site,
          category,
          urlConfigs,
          absolute: true,
        }),
      },
      { name: match.title, url: canonical },
    ];

    return {
      kind: 'match',
      site,
      categories,
      category,
      match,
      categoryArticleCounts,
      topNews,
      latestNews,
      matches,
      leagues,
      teams,
      promotions: cmsRepository.listActivePromotionLinks({ siteId: site.id, categoryId: category.id }),
      liveProducts,
      signalDomains,
      signalSourceNames,
      canonical,
      breadcrumbs,
      breadcrumbJsonLd: serializeJsonLd(breadcrumbJsonLd(breadcrumbs)),
      tdk,
    };
  }

  const newsDetailRoute = matchNewsDetailRoute(site, categories, urlConfigs, requestPath);
  if (newsDetailRoute) {
    const { article, category, pageType } = newsDetailRoute;
    const detailTdkBinding = resolveCategoryDetailTdkBinding(category, site, tdkConfigs, pageType);
    const tdk = resolveConfiguredTdk({
      site,
      pageType,
      tdkConfigs,
      categoryId: category.id,
      configCategoryId: detailTdkBinding?.categoryId,
      preferredConfigId: detailTdkBinding?.config.id,
      objectSeo: {
        title: article.seoTitle,
        keywords: article.seoKeywords,
        description: article.seoDescription,
      },
      variables: {
        title: article.title,
        summary: article.summary,
        categoryName: category.name,
        columnName: category.name,
      },
    });

    if (
      article.status !== 'PUBLISHED' ||
      !detailTdkBinding ||
      !tdk
    ) {
      return undefined;
    }

    const canonical =
      article.canonicalUrl ??
      buildNewsPublicUrl({
        site,
        article,
        category,
        urlConfigs,
        absolute: true,
      });
    const breadcrumbs = [
      { name: '首页', url: homeUrl },
      {
        name: category.name,
        url: buildCategoryPublicUrl({
          site,
          category,
          urlConfigs,
          absolute: true,
        }),
      },
      { name: article.title, url: canonical },
    ];

    return {
      kind: 'news',
      site,
      categories,
      categoryArticleCounts,
      article,
      pageType,
      topNews,
      latestNews,
      matches,
      leagues,
      teams,
      promotions: cmsRepository.listActivePromotionLinks({ siteId: site.id, categoryId: category.id }),
      liveProducts,
      signalDomains,
      signalSourceNames,
      canonical,
      breadcrumbs,
      newsArticleJsonLd: serializeJsonLd(newsArticleJsonLd({ site, article, canonicalUrl: canonical })),
      breadcrumbJsonLd: serializeJsonLd(breadcrumbJsonLd(breadcrumbs)),
      videoObjectJsonLd:
        pageType === 'VIDEO_DETAIL'
          ? serializeJsonLd(videoObjectJsonLd({ site, article, canonicalUrl: canonical }))
          : undefined,
      tdk,
    };
  }

  const leagueRoute = matchLeagueRoute(site, urlConfigs, requestPath);
  if (leagueRoute) {
    const league = leagueRoute;
    const leagueVisibleFrom = Date.now() - 60 * 60 * 1000;
    const leagueMatches = listPublicMatchesForSite(site.id).filter(
      (match) => matchBelongsToLeague(match, league) && match.startTime.getTime() >= leagueVisibleFrom,
    );
    const tdk = resolveConfiguredTdk({
      site,
      pageType: 'LEAGUE',
      tdkConfigs,
      variables: leagueTdkVariables(league),
      noindex: page > 10,
    });
    if (!tdk) {
      return undefined;
    }

    const canonical = buildLeaguePublicUrl({
      site,
      league,
      urlConfigs,
      absolute: true,
    });

    return {
      kind: 'category',
      site,
      categories,
      category: leagueAsCategory(league),
      league,
      pageType: 'LEAGUE',
      categoryArticleCounts,
      topNews,
      latestNews,
      matches: leagueMatches,
      leagues,
      teams,
      promotions: sitePromotions,
      liveProducts,
      signalDomains,
      signalSourceNames,
      canonical: page > 1 ? `${canonical}?page=${page}` : canonical,
      page,
      totalPages: 1,
      tdk,
    };
  }

  const categoryRoute = matchCategoryRoute(site, categories, urlConfigs, requestPath);
  if (categoryRoute) {
    const { category, pageType } = categoryRoute;
    const categoryTdkBinding = resolveCategoryListTdkBinding(category, site, tdkConfigs, pageType);
    const tdk = resolveConfiguredTdk({
      site,
      pageType,
      tdkConfigs,
      categoryId: category.id,
      configCategoryId: categoryTdkBinding?.categoryId,
      preferredConfigId: categoryTdkBinding?.config.id,
      variables: { categoryName: category.name, columnName: category.name },
      noindex: page > 10,
    });
    if (!categoryTdkBinding || !tdk) {
      return undefined;
    }

    if (pageType === 'MATCH_CATEGORY') {
      const categoryMatches = listMatchCategoryPageMatches(site.id, category, page);
      const canonical = buildCategoryPublicUrl({
        site,
        category,
        urlConfigs,
        absolute: true,
      });

      return {
        kind: 'category',
        site,
        categories,
        category,
        pageType,
        categoryArticleCounts,
        topNews,
        latestNews,
        matches: categoryMatches.items,
        leagues,
        teams,
        promotions: cmsRepository.listActivePromotionLinks({ siteId: site.id, categoryId: category.id }),
        liveProducts,
        signalDomains,
        signalSourceNames,
        canonical: page > 1 ? `${canonical}?page=${page}` : canonical,
        page,
        totalPages: categoryMatches.totalPages,
        tdk,
      };
    }

    const isReplayListPage = pageType === 'VIDEO_CATEGORY' || isVideoCategory(category);
    const allNewsRows = isReplayListPage
      ? []
      : cmsRepository.listNews({
          siteId: site.id,
          status: 'PUBLISHED',
          limit: 1000,
        }) as NewsArticleRecord[];
    const newsRows = isReplayListPage
      ? []
      : selectPublicNewsForCategory(normalizePublicNewsArticles(allNewsRows, site.id, categories), category, pageType);
    const liveReplayRows =
      isReplayListPage
        ? listPublicLiveReplayArticles(site.id, [category, ...categories], 1000, category)
        : [];
    const categoryContent = uniquePublicArticles([...liveReplayRows, ...newsRows]).sort(sortPublicArticles);
    const categoryNews = categoryContent.slice((page - 1) * categoryPageSize, page * categoryPageSize);
    const total = categoryContent.length;

    const canonical = buildCategoryPublicUrl({
      site,
      category,
      urlConfigs,
      absolute: true,
    });

    return {
      kind: 'category',
      site,
      categories,
      category,
      pageType,
      categoryArticleCounts,
      topNews,
      latestNews: categoryNews,
      matches,
      leagues,
      teams,
      promotions: cmsRepository.listActivePromotionLinks({ siteId: site.id, categoryId: category.id }),
      liveProducts,
      signalDomains,
      signalSourceNames,
      canonical: page > 1 ? `${canonical}?page=${page}` : canonical,
      page,
      totalPages: Math.max(1, Math.ceil(total / categoryPageSize)),
      tdk,
    };
  }

  return undefined;
}

function getPublicSiteContext(site: SiteRecord): PublicSiteContext {
  const urlConfigs = cmsRepository.listUrlConfigs(site.id);
  const tdkConfigs = cmsRepository.listTdkConfigs(site.id);
  const allCategories = cmsRepository.listCategories();
  const categories = listConfiguredPublicCategories(site, allCategories, urlConfigs);
  const categoryIds = new Set(categories.map((category) => category.id));
  const categoryArticleCounts = countPublishedNewsByCategory(site.id, categoryIds);
  const siteArticleLimit = publicArticleLimitForSite(site);
  const publicNews = listPublicNewsArticles(site.id, categories, siteArticleLimit);
  const liveReplayArticles = listPublicLiveReplayArticles(site.id, categories, siteArticleLimit);
  const publicContent = [...liveReplayArticles, ...publicNews].sort(sortPublicArticles);
  const topNews = publicContent.slice(0, Math.min(10, siteArticleLimit));
  const latestNews = uniquePublicArticles([...publicNews, ...liveReplayArticles]);
  const matches = listHomepageMatches(site.id, 96);
  const leagues = cmsRepository.listLeagues({ page: 1, pageSize: 80 });
  const teams = cmsRepository.listTeams({ page: 1, pageSize: 120 });
  const sitePromotions = cmsRepository.listActivePromotionLinks({ siteId: site.id });
  const selectedLiveProductIds = site.group?.liveProductIds ?? [];
  const liveProducts = selectedLiveProductIds.length
    ? cmsRepository.listLiveProductsByIds(selectedLiveProductIds, selectedLiveProductIds.length)
    : cmsRepository.listActiveLiveProducts(20);
  const signalDomains = cmsRepository.listActiveSignalDomains();
  const signalSourceNames = cmsRepository.listActiveSignalSourceNames();

  return {
    site,
    urlConfigs,
    tdkConfigs,
    categories,
    categoryArticleCounts,
    siteArticleLimit,
    publicNews,
    liveReplayArticles,
    publicContent,
    topNews,
    latestNews,
    matches,
    leagues,
    teams,
    sitePromotions,
    liveProducts,
    signalDomains,
    signalSourceNames,
  };
}

function hasStrictSiteBindings(
  site: SiteRecord,
  urlConfigs: UrlConfigRecord[],
  tdkConfigs: TdkConfigRecord[],
): boolean {
  if (!resolveSiteTemplatePackage(site)) {
    return false;
  }

  if (!site.urlConfigId || !urlConfigs.some((config) => config.id === site.urlConfigId && isConfigVisibleToSite(config, site.id))) {
    return false;
  }

  if (!site.tdkConfigId || !tdkConfigs.some((config) => config.id === site.tdkConfigId && isConfigVisibleToSite(config, site.id))) {
    return false;
  }

  return true;
}

export function resolveSiteTemplatePackage(site: SiteRecord) {
  const template = site.templateId
    ? cmsRepository.store.templates.find((record) => record.id === site.templateId && record.status === 'ACTIVE')
    : undefined;
  return template ? getTemplatePackage(template.key ?? template.folder) : undefined;
}

function isConfigVisibleToSite(config: { siteId?: string | null; status: string }, siteId: string): boolean {
  return config.status === 'ACTIVE' && (!config.siteId || config.siteId === siteId);
}

function publicArticleLimitForSite(site: SiteRecord): number {
  const configured = site.newsUpdateCount && site.newsUpdateCount > 0
    ? site.newsUpdateCount
    : site.group?.newsUpdateCount;
  const parsed = Number(configured);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(200, Math.floor(parsed)) : 60;
}

function listHomepageMatches(siteId: string, limit: number): SportMatchRecord[] {
  const windowMatches = cmsRepository.listMatches(siteId, { recentHours: 1, upcomingHours: 2, limit });
  if (windowMatches.length) {
    return windowMatches;
  }

  const now = Date.now();
  const allMatches = listPublicMatchesForSite(siteId);
  const upcomingMatches = allMatches.filter((match) => match.startTime.getTime() >= now).slice(0, limit);
  if (upcomingMatches.length) {
    return upcomingMatches;
  }

  return allMatches.slice(Math.max(0, allMatches.length - limit));
}

function matchUrlPattern(pattern: string, path: string): Record<string, string> | undefined {
  const keys: string[] = [];
  const source = normalizePublicPath(pattern)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{([a-zA-Z0-9_]+)\\\}/g, (_match, key: string) => {
      keys.push(key);
      return '([^/]+)';
    });
  const match = new RegExp(`^${source}/?$`).exec(normalizePublicPath(path));

  if (!match) {
    return undefined;
  }

  return Object.fromEntries(keys.map((key, index) => [key, decodeURIComponent(match[index + 1] ?? '')]));
}

function tryBuildConfiguredPublicUrl(input: {
  site: SiteRecord;
  pageType: PageType;
  data?: PublicUrlData;
  urlConfigs: UrlConfigRecord[];
  preferredConfigId?: string | null;
  categoryId?: string | null;
  absolute?: boolean;
}): string | undefined {
  try {
    return buildConfiguredPublicUrl(input);
  } catch {
    return undefined;
  }
}

function buildConfiguredPublicUrl(input: {
  site: SiteRecord;
  pageType: PageType;
  data?: PublicUrlData;
  urlConfigs: UrlConfigRecord[];
  preferredConfigId?: string | null;
  categoryId?: string | null;
  absolute?: boolean;
}): string {
  const pattern = resolveConfiguredUrlPattern(
    input.pageType,
    input.site.id,
    input.urlConfigs,
    input.preferredConfigId ?? input.site.urlConfigId,
    input.categoryId,
  );
  if (!pattern) {
    throw new Error(`Missing URL config: ${input.pageType}`);
  }

  const path = fillUrlPattern(pattern, input.data);
  return input.absolute ? `${buildPublicOrigin(input.site)}${path}` : path;
}

function resolveConfiguredUrlPattern(
  pageType: PageType,
  siteId: string,
  urlConfigs: UrlConfigRecord[],
  preferredConfigId?: string | null,
  categoryId?: string | null,
): string | undefined {
  const activeConfigs = urlConfigs.filter((config) => config.status === 'ACTIVE' && (config.siteId === siteId || !config.siteId));
  const fromConfig = (config: UrlConfigRecord | undefined) => (config ? findConfiguredUrlPattern(config, pageType, categoryId) : undefined);
  if (preferredConfigId) {
    return fromConfig(activeConfigs.find((config) => config.id === preferredConfigId));
  }

  const sitePattern = activeConfigs
    .filter((config) => config.siteId === siteId)
    .map(fromConfig)
    .find(Boolean);
  const globalPattern = activeConfigs
    .filter((config) => !config.siteId)
    .map(fromConfig)
    .find(Boolean);
  return sitePattern ?? globalPattern;
}

function findConfiguredUrlPattern(
  config: UrlConfigRecord,
  pageType: PageType,
  categoryId?: string | null,
): string | undefined {
  if (!categoryId && config.pageType === pageType && config.pattern) {
    return config.pattern;
  }

  for (const rule of urlRules(config)) {
    if (categoryId) {
      if (rule.categoryId !== categoryId) continue;
    } else if (rule.categoryId) {
      continue;
    }

    if (rule.pageType === pageType) {
      return rule.pattern;
    }
    const detail = (rule.detailRules ?? []).find((item) => item.pageType === pageType);
    if (detail) {
      return detail.pattern;
    }
  }

  return undefined;
}

function resolveConfiguredTdk(input: {
  site: SiteRecord;
  pageType: PageType;
  variables?: PublicUrlData;
  tdkConfigs: TdkConfigRecord[];
  preferredConfigId?: string | null;
  categoryId?: string | null;
  configCategoryId?: string | null;
  objectSeo?: {
    title?: string | null;
    keywords?: string | null;
    description?: string | null;
  };
  noindex?: boolean;
}): ReturnType<typeof resolveTdk> | undefined {
  const preferredConfigId = input.preferredConfigId ?? input.site.tdkConfigId;
  const config = resolveStrictTdkConfig(input.tdkConfigs, {
    siteId: input.site.id,
    pageType: input.pageType,
    preferredConfigId,
    categoryId: input.pageType === 'HOME' ? undefined : input.configCategoryId ?? input.categoryId,
  });
  if (!config) {
    return undefined;
  }

  return resolveTdk({
    ...input,
    preferredConfigId: config.id,
    categoryId: input.pageType === 'HOME' ? undefined : input.configCategoryId ?? input.categoryId,
  });
}

function resolveStrictTdkConfig(
  configs: TdkConfigRecord[],
  input: {
    siteId: string;
    pageType: PageType;
    preferredConfigId?: string | null;
    categoryId?: string | null;
  },
): TdkConfigRecord | undefined {
  const activeConfigs = configs.filter((config) => config.status === 'ACTIVE' && (!config.siteId || config.siteId === input.siteId));
  const preferredConfig = input.preferredConfigId
    ? activeConfigs.find((config) => config.id === input.preferredConfigId)
    : undefined;
  if (input.preferredConfigId) {
    return preferredConfig && findStrictTdkRule(preferredConfig, input.pageType, input.categoryId) ? preferredConfig : undefined;
  }

  const orderedConfigs = [
    ...activeConfigs.filter((config) => config.siteId === input.siteId),
    ...activeConfigs.filter((config) => !config.siteId),
  ];

  return orderedConfigs.find((config) => Boolean(findStrictTdkRule(config, input.pageType, input.categoryId)));
}

function findStrictTdkRule(
  config: TdkConfigRecord,
  pageType: PageType,
  categoryId?: string | null,
): boolean {
  for (const rule of tdkRules(config)) {
    if (categoryId) {
      if (rule.categoryId !== categoryId) continue;
    } else if (rule.categoryId) {
      continue;
    }

    if (rule.pageType === pageType) {
      return true;
    }
    if ((rule.detailRules ?? []).some((item) => item.pageType === pageType)) {
      return true;
    }
  }

  return false;
}

export function buildTemplateUrl(site: SiteRecord) {
  const urlConfigs = cmsRepository.listUrlConfigs(site.id);
  const categories = listConfiguredPublicCategories(site, cmsRepository.listCategories(), urlConfigs);
  return (pageType: PageType, data?: Record<string, string>) => {
    const homeUrl = () => buildHomePublicUrl({ site, urlConfigs });
    try {
      if (pageType === 'HOME') {
        return homeUrl();
      }

      const category = data?.categorySlug
        ? categories.find((candidate) => candidate.slug === data.categorySlug)
        : undefined;

      if (category && ['NEWS_CATEGORY', 'MATCH_CATEGORY', 'VIDEO_CATEGORY'].includes(pageType)) {
        return buildCategoryPublicUrl({ site, category, urlConfigs });
      }

      const articleSlug = data?.newsSlug ?? data?.videoSlug ?? data?.articleSlug ?? data?.slug;
      if (category && ['NEWS_DETAIL', 'VIDEO_DETAIL'].includes(pageType) && articleSlug) {
        return buildNewsPublicUrl({
          site,
          category,
          article: { slug: articleSlug } as NewsArticleRecord,
          urlConfigs,
        });
      }

      if (pageType === 'MATCH_DETAIL' && category && data?.matchId) {
        return buildMatchPublicUrl({
          site,
          category,
          match: {
            id: data.matchId,
            slug: data.slug ?? data.matchId,
          },
          urlConfigs,
        });
      }

      if (pageType === 'LEAGUE' && data?.leagueSlug) {
        return buildLeaguePublicUrl({
          site,
          league: { slug: data.leagueSlug },
          urlConfigs,
        });
      }

      return buildConfiguredPublicUrl({ site, pageType, data, urlConfigs });
    } catch {
      return homeUrl();
    }
  };
}

export function buildHomePublicUrl(input: {
  site: SiteRecord;
  urlConfigs: UrlConfigRecord[];
  absolute?: boolean;
}): string {
  const path =
    tryBuildConfiguredPublicUrl({
      site: input.site,
      pageType: 'HOME',
      urlConfigs: input.urlConfigs,
    }) ?? '/';
  return input.absolute ? `${buildPublicOrigin(input.site)}${path}` : path;
}

export function buildCategoryPublicUrl(input: {
  site: SiteRecord;
  category: CategoryRecord;
  urlConfigs: UrlConfigRecord[];
  absolute?: boolean;
}): string {
  const binding = resolveCategoryListUrlBinding(input.category, input.site, input.urlConfigs);
  if (!binding) {
    throw new Error(`Missing URL config for category: ${input.category.id}`);
  }
  return buildConfiguredPublicUrl({
    site: input.site,
    pageType: binding.pageType,
    data: categoryUrlVariables(input.category),
    urlConfigs: input.urlConfigs,
    preferredConfigId: binding.config.id,
    categoryId: binding.categoryId,
    absolute: input.absolute,
  });
}

export function buildNewsPublicUrl(input: {
  site: SiteRecord;
  article: Pick<NewsArticleRecord, 'slug'>;
  category: CategoryRecord;
  urlConfigs: UrlConfigRecord[];
  absolute?: boolean;
}): string {
  const binding = resolveCategoryDetailUrlBinding(input.category, input.site, input.urlConfigs);
  if (!binding) {
    throw new Error(`Missing detail URL config for category: ${input.category.id}`);
  }
  const data = {
    ...categoryUrlVariables(input.category),
    newsSlug: input.article.slug,
    videoSlug: input.article.slug,
    articleSlug: input.article.slug,
    slug: input.article.slug,
  };

  return buildConfiguredPublicUrl({
    site: input.site,
    pageType: binding.pageType,
    data,
    urlConfigs: input.urlConfigs,
    preferredConfigId: binding.config.id,
    categoryId: binding.categoryId,
    absolute: input.absolute,
  });
}

export function buildMatchPublicUrl(input: {
  site: SiteRecord;
  match: Pick<SportMatchRecord, 'id' | 'slug'>;
  category: CategoryRecord;
  urlConfigs: UrlConfigRecord[];
  absolute?: boolean;
}): string {
  const binding = resolveCategoryDetailUrlBinding(input.category, input.site, input.urlConfigs);
  if (!binding || binding.pageType !== 'MATCH_DETAIL') {
    throw new Error(`Missing match detail URL config for category: ${input.category.id}`);
  }
  const data = {
    ...categoryUrlVariables(input.category),
    matchId: input.match.id,
    newsSlug: input.match.id,
    slug: input.match.slug ?? input.match.id,
  };

  return buildConfiguredPublicUrl({
    site: input.site,
    pageType: 'MATCH_DETAIL',
    data,
    urlConfigs: input.urlConfigs,
    preferredConfigId: binding.config.id,
    categoryId: binding.categoryId,
    absolute: input.absolute,
  });
}

export function buildLeaguePublicUrl(input: {
  site: SiteRecord;
  league: Pick<SportLeagueRecord, 'slug'>;
  urlConfigs: UrlConfigRecord[];
  absolute?: boolean;
}): string {
  const data = leagueUrlVariables(input.league);
  const pattern = resolveConfiguredUrlPattern('LEAGUE', input.site.id, input.urlConfigs, input.site.urlConfigId);
  if (!pattern) {
    throw new Error(`Missing URL config: LEAGUE`);
  }
  const path = fillUrlPattern(pattern, data);
  return input.absolute ? `${buildPublicOrigin(input.site)}${path}` : path;
}

export function listConfiguredPublicCategories(
  site: SiteRecord,
  categories: CategoryRecord[],
  urlConfigs: UrlConfigRecord[],
): CategoryRecord[] {
  return uniqueCategoriesByDisplayName(
    categories
      .filter((category) => Boolean(resolveCategoryListUrlBinding(category, site, urlConfigs)))
      .map((category) => ({
        ...category,
        sortOrder: categoryPublicOrderValue(category, site, urlConfigs),
      })),
  );
}

function categoryPublicOrderValue(category: CategoryRecord, site: SiteRecord, urlConfigs: UrlConfigRecord[]): number {
  const binding = resolveCategoryListUrlBinding(category, site, urlConfigs);
  if (!binding) {
    return category.sortOrder;
  }

  const ruleIndex = urlRules(binding.config).findIndex((rule) => rule.categoryId === binding.categoryId);
  const configuredOrder = ruleIndex >= 0 ? ruleIndex : Number.MAX_SAFE_INTEGER / 2;
  return configuredOrder * 10_000 + category.sortOrder;
}

function matchLeagueRoute(
  site: SiteRecord,
  urlConfigs: UrlConfigRecord[],
  requestPath: string,
): SportLeagueRecord | undefined {
  const patterns = Array.from(
    new Set(
      [
        resolveConfiguredUrlPattern('LEAGUE', site.id, urlConfigs, site.urlConfigId),
      ].filter((pattern): pattern is string => Boolean(pattern)),
    ),
  );

  for (const pattern of patterns) {
    const match = matchUrlPattern(pattern, requestPath);
    const leagueSlug = match?.leagueSlug ?? match?.slug;
    if (!leagueSlug) continue;

    const league = cmsRepository
      .listLeagues({ page: 1, pageSize: 20_000 })
      .find((item) => item.slug === leagueSlug || item.id === leagueSlug || item.externalId === leagueSlug);
    if (league) return league;
  }

  return undefined;
}

function matchCategoryRoute(
  site: SiteRecord,
  categories: CategoryRecord[],
  urlConfigs: UrlConfigRecord[],
  requestPath: string,
): { category: CategoryRecord; pageType: PageType } | undefined {
  const matches: Array<{ category: CategoryRecord; pageType: PageType }> = [];

  for (const category of categories) {
    const binding = resolveCategoryListUrlBinding(category, site, urlConfigs);
    if (!binding) continue;
    const pattern = resolveConfiguredUrlPattern(binding.pageType, site.id, urlConfigs, binding.config.id, binding.categoryId);
    if (!pattern) continue;
    const match = matchUrlPattern(pattern, requestPath);
    if (!match) continue;

    const matchedSlug = match.categorySlug ?? match.sport ?? match.slug;
    if (!matchedSlug || matchedSlug === category.slug) {
      matches.push({ category, pageType: binding.pageType });
    }
  }

  return matches.sort((a, b) => categoryRouteScore(site, b) - categoryRouteScore(site, a))[0];
}

function categoryRouteScore(site: SiteRecord, match: { category: CategoryRecord; pageType: PageType }): number {
  let score = 0;
  if (match.pageType === 'NEWS_CATEGORY' || match.pageType === 'VIDEO_CATEGORY') {
    score += Math.min(countPublishedNews(site.id, match.category.id), 100);
  }
  score -= match.category.sortOrder / 1000;
  return score;
}

function countPublishedNews(siteId: string, categoryId: string): number {
  const newsCount = cmsRepository.store.news.filter(
    (article) =>
      article.siteId === siteId &&
      article.categoryId === categoryId &&
      article.status === 'PUBLISHED' &&
      !article.deletedAt,
  ).length;
  const replayCount = cmsRepository.store.liveReplays.filter(
    (replay) =>
      replay.siteId === siteId &&
      replay.categoryId === categoryId &&
      !replay.deletedAt,
  ).length;
  return newsCount + replayCount;
}

function countPublishedNewsByCategory(siteId: string, categoryIds?: Set<string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const article of cmsRepository.store.news) {
    if (
      article.siteId !== siteId ||
      article.status !== 'PUBLISHED' ||
      article.deletedAt ||
      (categoryIds && !categoryIds.has(article.categoryId))
    ) {
      continue;
    }
    counts[article.categoryId] = (counts[article.categoryId] ?? 0) + 1;
  }
  for (const replay of cmsRepository.store.liveReplays) {
    if (
      replay.siteId !== siteId ||
      replay.deletedAt ||
      (categoryIds && !categoryIds.has(replay.categoryId))
    ) {
      continue;
    }
    counts[replay.categoryId] = (counts[replay.categoryId] ?? 0) + 1;
  }
  return counts;
}

function selectPublicNewsForCategory(
  articles: NewsArticleRecord[],
  category: CategoryRecord,
  pageType: PageType,
): NewsArticleRecord[] {
  if (pageType === 'VIDEO_CATEGORY' || isVideoCategory(category)) {
    return articles.filter(isReplayArticle);
  }

  if (isBroadNewsCategory(category)) {
    const newsArticles = articles.filter((article) => !isReplayArticle(article));
    return newsArticles.length ? newsArticles : articles;
  }

  const topicArticles = articles.filter((article) => articleMatchesCategoryTopic(article, category));
  if (topicArticles.length) {
    return topicArticles;
  }

  const newsArticles = articles.filter((article) => !isReplayArticle(article));
  return newsArticles.length ? newsArticles : articles;
}

function uniquePublicArticles(articles: NewsArticleRecord[]): NewsArticleRecord[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    const key = publicArticleDedupeKey(article);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function publicArticleDedupeKey(article: NewsArticleRecord): string {
  const sourceUrl = article.sourceUrl?.trim();
  if (sourceUrl) {
    return `source:${sourceUrl}`;
  }

  const title = cleanPublicNewsTitle(article.title).toLocaleLowerCase();
  if (title) {
    return `title:${title}`;
  }

  return `id:${article.id}:${article.slug}`;
}

function uniqueCategoriesByDisplayName(categories: CategoryRecord[]): CategoryRecord[] {
  const selected = new Map<string, CategoryRecord>();
  for (const category of categories) {
    const key = normalizeDisplayText(category.name);
    const existing = selected.get(key);
    if (!existing || categoryDisplayScore(category) < categoryDisplayScore(existing)) {
      selected.set(key, category);
    }
  }
  return [...selected.values()].sort((left, right) => left.sortOrder - right.sortOrder);
}

function categoryDisplayScore(category: CategoryRecord): number {
  const activeScore = category.status === 'ACTIVE' && !category.deletedAt ? 0 : 10_000;
  return activeScore + category.sortOrder / 1000 + category.slug.length / 10_000;
}

function listPublicLiveReplayArticles(
  siteId: string,
  categories: CategoryRecord[],
  limit: number,
  fallbackCategory?: CategoryRecord,
): NewsArticleRecord[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const replayRows = cmsRepository.listLiveReplays({ siteId, limit }) as LiveReplayRecord[];
  const rows = replayRows.length ? replayRows : listSharedLiveReplayRows(limit);

  return rows
    .map((replay) => {
      const category = categoryById.get(replay.categoryId) ?? fallbackCategory ?? categories.find(isVideoCategory) ?? categories[0];
      return category ? liveReplayToArticle({ ...replay, siteId }, category) : undefined;
    })
    .filter((article): article is NewsArticleRecord => Boolean(article));
}

function listPublicNewsArticles(
  siteId: string,
  categories: CategoryRecord[],
  limit: number,
): NewsArticleRecord[] {
  const currentSiteRows = cmsRepository.listNews({ siteId, status: 'PUBLISHED', limit }) as NewsArticleRecord[];
  if (currentSiteRows.length || !shouldUseSingleSiteContentFallback(siteId, 'news')) {
    return normalizePublicNewsArticles(currentSiteRows, siteId, categories).slice(0, limit);
  }

  return normalizePublicNewsArticles(
    cmsRepository.store.news
      .filter((article) => article.status === 'PUBLISHED' && !article.deletedAt)
      .sort(sortPublicArticles),
    siteId,
    categories,
  ).slice(0, limit);
}

function listSharedLiveReplayRows(limit: number): LiveReplayRecord[] {
  return cmsRepository.store.liveReplays
    .filter((replay) => !replay.deletedAt)
    .sort((a, b) => b.createTime.getTime() - a.createTime.getTime())
    .slice(0, limit) as LiveReplayRecord[];
}

function normalizePublicNewsArticles(
  rows: NewsArticleRecord[],
  siteId: string,
  categories: CategoryRecord[],
): NewsArticleRecord[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const fallbackNewsCategory = categories.find(isBroadNewsCategory) ?? categories.find((category) => !isVideoCategory(category)) ?? categories[0];

  return rows
    .map((article) => {
      const category = categoryById.get(article.categoryId) ?? fallbackNewsCategory;
      return category ? normalizePublicNewsArticle(article, siteId, category) : undefined;
    })
    .filter((article): article is NewsArticleRecord => Boolean(article))
    .sort(sortPublicArticles);
}

function normalizePublicNewsArticle(
  article: NewsArticleRecord,
  siteId: string,
  category: CategoryRecord,
): NewsArticleRecord {
  return {
    ...article,
    siteId,
    categoryId: category.id,
    category,
    title: cleanPublicNewsTitle(article.title),
    summary: article.summary ? cleanPublicNewsText(article.summary) : article.summary,
    content: cleanPublicNewsContent(article.content),
    author: cleanPublicNewsAuthor(article.author),
    sourceName: cleanPublicNewsAuthor(article.sourceName),
    seoTitle: article.seoTitle ? cleanPublicNewsTitle(article.seoTitle) : article.seoTitle,
    seoKeywords: article.seoKeywords ? cleanPublicNewsText(article.seoKeywords) : article.seoKeywords,
    seoDescription: article.seoDescription ? cleanPublicNewsText(article.seoDescription) : article.seoDescription,
  };
}

function shouldUseSingleSiteContentFallback(
  siteId: string,
  contentType: 'news' | 'liveReplay',
): boolean {
  const activeSites = cmsRepository.store.sites.filter(
    (site) => !site.deletedAt && site.status !== 'DISABLED',
  );
  if (activeSites.length !== 1 || activeSites[0]?.id !== siteId) {
    return false;
  }

  if (contentType === 'news') {
    const hasCurrentSiteNews = cmsRepository.store.news.some(
      (article) => article.siteId === siteId && article.status === 'PUBLISHED' && !article.deletedAt,
    );
    const hasForeignNews = cmsRepository.store.news.some(
      (article) => article.siteId !== siteId && article.status === 'PUBLISHED' && !article.deletedAt,
    );
    return !hasCurrentSiteNews && hasForeignNews;
  }

  const hasCurrentSiteReplays = cmsRepository.store.liveReplays.some(
    (replay) => replay.siteId === siteId && !replay.deletedAt,
  );
  const hasForeignReplays = cmsRepository.store.liveReplays.some(
    (replay) => replay.siteId !== siteId && !replay.deletedAt,
  );
  return !hasCurrentSiteReplays && hasForeignReplays;
}

function getPublicLiveReplayArticle(
  siteId: string,
  slug: string,
  category: CategoryRecord,
): NewsArticleRecord | undefined {
  const replay =
    (cmsRepository.getLiveReplayBySlug(siteId, slug) as LiveReplayRecord | undefined) ??
    listSharedLiveReplayRows(20_000).find((candidate) => candidate.slug === slug);
  if (!replay) {
    return undefined;
  }
  return liveReplayToArticle({ ...replay, siteId }, category);
}

function liveReplayToArticle(replay: LiveReplayRecord, category: CategoryRecord): NewsArticleRecord {
  const matchText = [replay.homeTeam, replay.awayTeam].filter(Boolean).join(' VS ');
  const summary = matchText ? `${matchText}录像回放。` : `${replay.title}录像回放。`;
  const content = [
    replay.title,
    matchText ? `对阵：${matchText}` : '',
    `创建时间：${formatPublicReplayTime(replay.createTime)}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    id: replay.id,
    siteId: replay.siteId,
    categoryId: category.id,
    category,
    title: replay.title,
    slug: replay.slug,
    summary,
    content,
    status: 'PUBLISHED',
    isTop: false,
    publishedAt: replay.createTime,
    tags: cmsRepository.store.tags.filter(
      (tag) => tag.siteId === replay.siteId && [replay.homeTeam, replay.awayTeam].includes(tag.name),
    ),
    createdAt: replay.createdAt,
    updatedAt: replay.updatedAt,
  };
}

function isVideoCategory(category: CategoryRecord): boolean {
  return /录像|回放|视频|replay|video/i.test(`${category.name} ${category.slug}`);
}

function isBroadNewsCategory(category: CategoryRecord): boolean {
  const value = `${category.name} ${category.slug}`;
  return !isVideoCategory(category) && /(^|\s)(新闻|资讯)($|\s)|体育新闻|sports-news|(^|[-_])news($|[-_])/i.test(value);
}

function isReplayArticle(article: NewsArticleRecord): boolean {
  return Boolean(article.category && isVideoCategory(article.category));
}

function articleMatchesCategoryTopic(article: NewsArticleRecord, category: CategoryRecord): boolean {
  const text = articleTopicText(article);
  return categoryTopicTokens(category).some((token) => text.includes(token));
}

function categoryTopicTokens(category: CategoryRecord): string[] {
  const raw = `${category.name} ${category.slug}`
    .replace(/[-_/]+/g, ' ')
    .split(/\s+/)
    .map(normalizeDisplayText)
    .filter((token) => token.length >= 2);
  const value = `${category.name} ${category.slug}`;
  const aliases = [
    /足球|football|soccer/i.test(value) ? ['足球', 'football', 'soccer'] : [],
    /篮球|basketball|nba|cba/i.test(value) ? ['篮球', 'basketball', 'nba', 'cba'] : [],
    /直播|live|zhibo/i.test(value) ? ['直播', 'live', 'zhibo'] : [],
    /赛程|schedule/i.test(value) ? ['赛程', 'schedule'] : [],
    isVideoCategory(category) ? ['录像', '回放', '视频', 'replay', 'video'] : [],
  ].flat();
  return [...new Set([...raw, ...aliases].map(normalizeDisplayText))];
}

function articleTopicText(article: NewsArticleRecord): string {
  return normalizeDisplayText(
    [
      article.title,
      article.summary,
      article.category?.name,
      article.category?.slug,
      ...(article.tags ?? []).map((tag) => tag.name),
      ...(article.tags ?? []).map((tag) => tag.slug),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function normalizeDisplayText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function cleanPublicNewsTitle(title: string): string {
  const cleaned = title
    .split(/[|｜]/)[0]
    ?.replace(/\s*[-_]\s*懂球帝.*$/i, '')
    .replace(/懂球帝(?:独家|原创|报道|资讯|新闻)?/gi, '')
    .trim();
  return cleaned || title.trim();
}

function cleanPublicNewsContent(content: string): string {
  const lines = content
    .split(/\n+/)
    .map(cleanPublicNewsText)
    .filter((line) => line && !isPublicNewsBoilerplateLine(line));
  return Array.from(new Set(lines)).join('\n\n');
}

function cleanPublicNewsText(value: string): string {
  return value
    .replace(/\|+\s*手机客户端[，,][\s\S]*$/i, '')
    .replace(/手机客户端[，,].*(?:必备的神器|积分赛程|足球赛事专业的资讯).*$/i, '')
    .replace(/^懂球帝\s*(?:讯|消息|报道|独家)[，,。:：\s]*/i, '')
    .replace(/懂球帝(?:独家|原创|报道|资讯|新闻|客户端|App|APP)?/g, '')
    .replace(/(?:本文)?(?:来源|作者|编辑|主编|责编|责任编辑|撰文|记者)[:：][^。！？!?]*$/i, '')
    .replace(/（\s*(?:来源|作者|编辑|主编|责编|责任编辑|撰文|记者)[:：][^）]*）\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPublicNewsAuthor(value?: string | null): string | null | undefined {
  if (!value) return value;
  const cleaned = cleanPublicNewsText(value)
    .replace(/^(?:作者|编辑|主编|责编|责任编辑|来源|撰文|记者)[:：]\s*/i, '')
    .trim();
  return cleaned && !isPublicNewsBoilerplateLine(cleaned) ? cleaned : undefined;
}

function isPublicNewsBoilerplateLine(line: string): boolean {
  return [
    /^【来源】/,
    /^来源[:：]/,
    /^作者[:：]/,
    /^编辑[:：]/,
    /^主编[:：]/,
    /^责编[:：]/,
    /^责任编辑[:：]/,
    /^撰文[:：]/,
    /^记者[:：]/,
    /^发布[:：]/,
    /^原文链接[:：]/,
    /^免责声明/,
    /^版权/,
    /^懂球帝(?:资讯|新闻|编辑部|客户端|App|APP)?$/,
    /懂球帝.*(?:下载|客户端|App|APP|版权|举报|评论|点赞|关注)/,
    /手机客户端.*(?:必备的神器|积分赛程|足球赛事专业的资讯)/,
  ].some((pattern) => pattern.test(line));
}

function sortPublicArticles(a: NewsArticleRecord, b: NewsArticleRecord): number {
  if (a.isTop !== b.isTop) {
    return a.isTop ? -1 : 1;
  }
  return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
}

function formatPublicReplayTime(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function matchMatchDetailRoute(
  site: SiteRecord,
  categories: CategoryRecord[],
  urlConfigs: UrlConfigRecord[],
  requestPath: string,
): { match: SportMatchRecord; category: CategoryRecord } | undefined {
  const matchCategories = categories.filter((category) => resolveCategoryListUrlBinding(category, site, urlConfigs)?.pageType === 'MATCH_CATEGORY');
  for (const category of matchCategories) {
    const binding = resolveCategoryDetailUrlBinding(category, site, urlConfigs);
    if (!binding || binding.pageType !== 'MATCH_DETAIL') continue;
    const pattern = resolveConfiguredUrlPattern('MATCH_DETAIL', site.id, urlConfigs, binding.config.id, binding.categoryId);
    if (!pattern) continue;
    const urlMatch = matchUrlPattern(pattern, requestPath);
    const matchedId = urlMatch?.matchId ?? urlMatch?.newsSlug ?? urlMatch?.slug;
    if (!urlMatch || !matchedId) continue;

    const matchedCategorySlug = urlMatch.categorySlug ?? urlMatch.sport;
    if (matchedCategorySlug && matchedCategorySlug !== category.slug) continue;

    const match = getPublicMatch(site.id, matchedId) ?? getPublicMatchFromPath(site.id, requestPath);
    if (!match || !matchBelongsToCategory(match, category)) continue;

    return { match, category };
  }

  return undefined;
}

function getPublicMatch(siteId: string, matchIdOrSlug: string): SportMatchRecord | undefined {
  return listPublicMatchesForSite(siteId).find(
    (match) =>
      (match.id === matchIdOrSlug || match.slug === matchIdOrSlug || match.externalId === matchIdOrSlug),
  );
}

function getPublicMatchFromPath(siteId: string, path: string): SportMatchRecord | undefined {
  const normalizedPath = normalizePublicPath(path).toLowerCase();
  const candidates = listPublicMatchesForSite(siteId);
  const scored = candidates
    .map((match) => {
      const identifiers = [
        { value: match.id, weight: 100_000 },
        { value: match.slug, weight: 50_000 },
        { value: match.externalId, weight: 10_000 },
      ].filter((item): item is { value: string; weight: number } => Boolean(item.value));
      const score = identifiers.reduce((best, item) => {
        const value = item.value.toLowerCase();
        return normalizedPath.includes(value) ? Math.max(best, item.weight + value.length) : best;
      }, 0);
      return { match, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.match;
}

function listPublicMatchesForSite(siteId: string): SportMatchRecord[] {
  return cmsRepository
    .listAllMatches({ page: 1, pageSize: 20_000 })
    .filter((match) => !match.siteId || match.siteId === siteId)
    .sort((left, right) => left.startTime.getTime() - right.startTime.getTime());
}

function listMatchCategoryPageMatches(
  siteId: string,
  category: CategoryRecord,
  page: number,
): { items: SportMatchRecord[]; totalPages: number } {
  const now = Date.now();
  const visibleUntil = now + matchListWindowMs;
  const categoryMatches = listPublicMatchesForSite(siteId).filter(
    (match) =>
      matchBelongsToCategory(match, category) &&
      match.startTime.getTime() >= now &&
      match.startTime.getTime() <= visibleUntil,
  );
  const offset = (page - 1) * categoryPageSize;

  return {
    items: categoryMatches.slice(offset, offset + categoryPageSize),
    totalPages: Math.max(1, Math.ceil(categoryMatches.length / categoryPageSize)),
  };
}

function matchBelongsToCategory(match: SportMatchRecord, category: CategoryRecord): boolean {
  const value = `${category.name} ${category.slug}`;
  if (/篮球|basketball|nba|cba/i.test(value)) {
    return match.sport === 'BASKETBALL';
  }
  if (/足球|football|soccer/i.test(value)) {
    return match.sport === 'FOOTBALL';
  }
  return true;
}

function matchNewsDetailRoute(
  site: SiteRecord,
  categories: CategoryRecord[],
  urlConfigs: UrlConfigRecord[],
  requestPath: string,
): { article: NewsArticleRecord; category: CategoryRecord; pageType: PageType } | undefined {
  for (const category of categories) {
    const binding = resolveCategoryDetailUrlBinding(category, site, urlConfigs);
    if (!binding) continue;
    const pattern = resolveConfiguredUrlPattern(binding.pageType, site.id, urlConfigs, binding.config.id, binding.categoryId);
    if (!pattern) continue;
    const match = matchUrlPattern(pattern, requestPath);
    const articleSlug = match?.newsSlug ?? match?.videoSlug ?? match?.articleSlug ?? match?.slug;
    if (!match || !articleSlug) continue;

    const matchedCategorySlug = match.categorySlug ?? match.sport;
    if (matchedCategorySlug && matchedCategorySlug !== category.slug) continue;

    const article =
      binding.pageType === 'VIDEO_DETAIL'
        ? getPublicLiveReplayArticle(site.id, articleSlug, category)
        : cmsRepository.getNewsBySlug(site.id, articleSlug);
    if (article) {
      return {
        article: binding.pageType === 'VIDEO_DETAIL' ? article : normalizePublicNewsArticle(article, site.id, category),
        category,
        pageType: binding.pageType,
      };
    }
  }

  return undefined;
}

export function resolveCategoryListUrlConfig(
  category: CategoryRecord,
  site: SiteRecord,
  urlConfigs: UrlConfigRecord[],
): UrlConfigRecord | undefined {
  return resolveCategoryListUrlBinding(category, site, urlConfigs)?.config;
}

export function resolveCategoryDetailUrlConfig(
  category: CategoryRecord,
  site: SiteRecord,
  urlConfigs: UrlConfigRecord[],
): UrlConfigRecord | undefined {
  return resolveCategoryDetailUrlBinding(category, site, urlConfigs)?.config;
}

function resolveCategoryListUrlBinding(
  category: CategoryRecord,
  site: SiteRecord,
  urlConfigs: UrlConfigRecord[],
): CategoryUrlBinding | undefined {
  return resolveCategoryBoundUrlBinding(urlConfigs, {
    category,
    siteId: site.id,
    preferredConfigId: site.urlConfigId,
    pageTypes: ['MATCH_CATEGORY', 'NEWS_CATEGORY', 'VIDEO_CATEGORY'],
  });
}

function resolveCategoryDetailUrlBinding(
  category: CategoryRecord,
  site: SiteRecord,
  urlConfigs: UrlConfigRecord[],
): CategoryUrlBinding | undefined {
  return resolveCategoryBoundUrlBinding(urlConfigs, {
    category,
    siteId: site.id,
    preferredConfigId: site.urlConfigId,
    pageTypes: ['MATCH_DETAIL', 'NEWS_DETAIL', 'VIDEO_DETAIL'],
  });
}

export function resolveCategoryListTdkConfig(
  category: CategoryRecord,
  site: SiteRecord,
  tdkConfigs: TdkConfigRecord[],
  pageType = inferCategoryPageType(category),
): TdkConfigRecord | undefined {
  return resolveCategoryListTdkBinding(category, site, tdkConfigs, pageType)?.config;
}

function resolveCategoryListTdkBinding(
  category: CategoryRecord,
  site: SiteRecord,
  tdkConfigs: TdkConfigRecord[],
  pageType = inferCategoryPageType(category),
): CategoryTdkBinding | undefined {
  return resolveCategoryBoundTdkBinding(tdkConfigs, {
    category,
    siteId: site.id,
    preferredConfigId: site.tdkConfigId,
    pageTypes: [pageType],
  });
}

export function resolveCategoryDetailTdkConfig(
  category: CategoryRecord,
  site: SiteRecord,
  tdkConfigs: TdkConfigRecord[],
  pageType: PageType = 'NEWS_DETAIL',
): TdkConfigRecord | undefined {
  return resolveCategoryDetailTdkBinding(category, site, tdkConfigs, pageType)?.config;
}

function resolveCategoryDetailTdkBinding(
  category: CategoryRecord,
  site: SiteRecord,
  tdkConfigs: TdkConfigRecord[],
  pageType: PageType = 'NEWS_DETAIL',
): CategoryTdkBinding | undefined {
  return resolveCategoryBoundTdkBinding(tdkConfigs, {
    category,
    siteId: site.id,
    preferredConfigId: site.tdkConfigId,
    pageTypes: [pageType],
  });
}

function categoryConfigCandidateIds(category: CategoryRecord): string[] {
  return [category.id, typeof category.parentId === 'string' ? category.parentId : undefined].filter(
    (id): id is string => Boolean(id),
  );
}

function categoryUrlConfigCandidateIds(category: CategoryRecord): string[] {
  return [category.id];
}

function resolveCategoryBoundUrlBinding(
  configs: UrlConfigRecord[],
  input: {
    category: CategoryRecord;
    siteId: string;
    preferredConfigId?: string | null;
    pageTypes: PageType[];
  },
): CategoryUrlBinding | undefined {
  const pageTypes = new Set(uniquePageTypes(input.pageTypes));
  const activeConfigs = configs.filter((config) => config.status === 'ACTIVE' && (!config.siteId || config.siteId === input.siteId));
  const preferredConfig = input.preferredConfigId
    ? activeConfigs.find((config) => config.id === input.preferredConfigId)
    : undefined;
  if (input.preferredConfigId) {
    return findCategoryUrlBindingInConfigs(preferredConfig ? [preferredConfig] : [], input.category, pageTypes);
  }

  const orderedConfigs = uniqueConfigs([
    ...activeConfigs.filter((config) => config.siteId === input.siteId),
    ...activeConfigs.filter((config) => !config.siteId),
  ]);

  return findCategoryUrlBindingInConfigs(orderedConfigs, input.category, pageTypes);
}

function findCategoryUrlBindingInConfigs(
  configs: UrlConfigRecord[],
  category: CategoryRecord,
  pageTypes: Set<PageType>,
): CategoryUrlBinding | undefined {
  for (const config of configs) {
    for (const categoryId of categoryUrlConfigCandidateIds(category)) {
      for (const rule of urlRules(config)) {
        if (rule.categoryId !== categoryId) continue;
        if (pageTypes.has(rule.pageType)) {
          return { config, pageType: rule.pageType, categoryId: rule.categoryId };
        }
        const detail = (rule.detailRules ?? []).find((item) => pageTypes.has(item.pageType));
        if (detail) {
          return { config, pageType: detail.pageType, categoryId: rule.categoryId };
        }
      }
    }
  }

  return undefined;
}

function uniqueConfigs(configs: UrlConfigRecord[]): UrlConfigRecord[] {
  const seen = new Set<string>();
  return configs.filter((config) => {
    if (seen.has(config.id)) {
      return false;
    }
    seen.add(config.id);
    return true;
  });
}

function resolveCategoryBoundTdkBinding(
  configs: TdkConfigRecord[],
  input: {
    category: CategoryRecord;
    siteId: string;
    preferredConfigId?: string | null;
    pageTypes: PageType[];
  },
): CategoryTdkBinding | undefined {
  const pageTypes = uniquePageTypes(input.pageTypes);
  const activeConfigs = configs.filter((config) => config.status === 'ACTIVE' && (!config.siteId || config.siteId === input.siteId));
  const preferredConfig = input.preferredConfigId
    ? activeConfigs.find((config) => config.id === input.preferredConfigId)
    : undefined;
  if (input.preferredConfigId) {
    return findCategoryTdkBindingInConfigs(preferredConfig ? [preferredConfig] : [], input.category, pageTypes);
  }

  const siteConfigs = activeConfigs.filter((config) => config.siteId === input.siteId);
  const globalConfigs = activeConfigs.filter((config) => !config.siteId);

  return findCategoryTdkBindingInConfigs([...siteConfigs, ...globalConfigs], input.category, pageTypes);
}

function findCategoryTdkBindingInConfigs(
  configs: TdkConfigRecord[],
  category: CategoryRecord,
  pageTypes: PageType[],
): CategoryTdkBinding | undefined {
  for (const pageType of pageTypes) {
    for (const categoryId of categoryConfigCandidateIds(category)) {
      const config = configs.find((candidate) => findStrictTdkRule(candidate, pageType, categoryId));
      if (config) {
        return { config, categoryId };
      }
    }
  }

  return undefined;
}

function uniquePageTypes(values: PageType[]): PageType[] {
  return Array.from(new Set(values));
}

function inferCategoryPageType(category: CategoryRecord): PageType {
  const value = `${category.name} ${category.slug}`.toLowerCase();
  if (value.includes('录像') || value.includes('回放') || value.includes('replay') || value.includes('video')) {
    return 'VIDEO_CATEGORY';
  }

  if (/新闻|资讯|快讯|动态|分析|观察|情报|news|article|info|analysis|insight|update/i.test(value)) {
    return 'NEWS_CATEGORY';
  }

  if (
    value.includes('直播') ||
    value.includes('赛程') ||
    value.includes('live') ||
    value.includes('schedule') ||
    value.includes('zhibo')
  ) {
    return 'MATCH_CATEGORY';
  }

  return 'NEWS_CATEGORY';
}

function categoryUrlVariables(category: CategoryRecord): Record<string, string> {
  return {
    categorySlug: category.slug,
    sport: category.slug,
    slug: category.slug,
    categoryName: category.name,
    columnName: category.name,
  };
}

function leagueUrlVariables(league: Pick<SportLeagueRecord, 'slug'>): Record<string, string> {
  return {
    leagueSlug: league.slug,
    slug: league.slug,
  };
}

function leagueTdkVariables(league: SportLeagueRecord): Record<string, string> {
  return {
    ...leagueUrlVariables(league),
    leagueName: league.name,
    sportName: league.sport === 'BASKETBALL' ? '篮球' : '足球',
    title: league.name,
    summary: `${league.name}赛程、直播入口和赛事资讯。`,
  };
}

function leagueAsCategory(league: SportLeagueRecord): CategoryRecord {
  return {
    id: `league:${league.id}`,
    name: league.name,
    slug: league.slug,
    language: 'zh-CN',
    status: 'ACTIVE',
    description: `${league.name}赛程、直播和相关资讯。`,
    sortOrder: 0,
    createdAt: league.createdAt,
    updatedAt: league.updatedAt,
  };
}

function matchBelongsToLeague(match: SportMatchRecord, league: SportLeagueRecord): boolean {
  return match.leagueId === league.id || match.league?.id === league.id || match.league?.slug === league.slug;
}

function matchTdkVariables(match: SportMatchRecord, category: CategoryRecord): Record<string, string> {
  const homeTeam = match.homeTeam?.name ?? '主队';
  const awayTeam = match.awayTeam?.name ?? '客队';
  return {
    ...categoryUrlVariables(category),
    title: match.title,
    summary: `${homeTeam}对阵${awayTeam}，${match.league?.name ?? category.name}赛事信息。`,
    homeTeam,
    awayTeam,
    leagueName: match.league?.name ?? category.name,
    sportName: match.sport === 'BASKETBALL' ? '篮球' : '足球',
    matchTime: match.startTime.toISOString().slice(0, 16).replace('T', ' '),
  };
}
