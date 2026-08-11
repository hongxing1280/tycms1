import type { PageType, PublicUrlData, SiteRecord, TdkConfigRecord, TdkRuleRecord } from './types';

export type ResolvedTdk = {
  title: string;
  keywords: string;
  description: string;
  robots: 'index,follow' | 'noindex,follow' | 'index,nofollow';
};

type ResolvedTdkRule = {
  categoryId: string;
  pageType: PageType;
  titleTemplate: string;
  keywordsTemplate?: string | null;
  descriptionTemplate?: string | null;
};

export const DEFAULT_TDK_TEMPLATES: Record<
  PageType,
  { title: string; keywords: string; description: string }
> = {
  HOME: {
    title: '{siteName} - 体育新闻、足球直播、篮球赛程与赛事前瞻',
    keywords: '{siteName},体育新闻,足球直播,篮球直播,赛事赛程',
    description: '{siteName}提供足球、篮球、赛事直播信息、赛程前瞻和体育资讯，覆盖热门联赛、球队动态和赛前分析。',
  },
  NEWS_CATEGORY: {
    title: '{categoryName} - 最新体育新闻 | {siteName}',
    keywords: '{categoryName},体育新闻,{siteName}',
    description: '浏览{siteName}的{categoryName}栏目，获取最新赛事资讯、球队动态、直播信息和专业前瞻。',
  },
  NEWS_DETAIL: {
    title: '{title} | {siteName}',
    keywords: '{title},{categoryName},{siteName}',
    description: '{summary}',
  },
  MATCH_CATEGORY: {
    title: '{sportName}赛程直播 - {siteName}',
    keywords: '{sportName}赛程,{sportName}直播,{siteName}',
    description: '查看{siteName}整理的{sportName}赛程、直播入口、球队信息和赛事前瞻。',
  },
  MATCH_DETAIL: {
    title: '{homeTeam}vs{awayTeam}直播与赛前分析 - {siteName}',
    keywords: '{homeTeam},{awayTeam},{leagueName},直播',
    description: '{homeTeam}对阵{awayTeam}，比赛时间{matchTime}，查看直播信息、赛事前瞻和双方近况。',
  },
  VIDEO_CATEGORY: {
    title: '赛事录像 - {siteName}',
    keywords: '赛事录像,体育录像,{siteName}',
    description: '{siteName}整理热门赛事录像、集锦和回放入口。',
  },
  VIDEO_DETAIL: {
    title: '{title}录像回放 - {siteName}',
    keywords: '{title},录像回放,{siteName}',
    description: '观看{title}录像回放、集锦和赛后数据。',
  },
  TAG: {
    title: '{tagName}相关新闻 - {siteName}',
    keywords: '{tagName},体育新闻,{siteName}',
    description: '聚合{siteName}中与{tagName}相关的新闻、赛程和球队资讯。',
  },
  TEAM: {
    title: '{teamName}赛程新闻 - {siteName}',
    keywords: '{teamName},球队新闻,赛程,{siteName}',
    description: '查看{teamName}最新新闻、赛程、阵容动态和直播信息。',
  },
  LEAGUE: {
    title: '{leagueName}赛程新闻 - {siteName}',
    keywords: '{leagueName},联赛新闻,赛程,{siteName}',
    description: '查看{leagueName}最新赛程、积分趋势、球队动态和直播信息。',
  },
  LIVE_ROOM: {
    title: '{title}直播间 - {siteName}',
    keywords: '{title},直播,{siteName}',
    description: '进入{siteName}直播间，查看{text}相关直播信息。',
  },
  SEARCH: {
    title: '搜索结果 - {siteName}',
    keywords: '搜索,{siteName}',
    description: '搜索{siteName}的体育新闻、赛事和球队资讯。',
  },
};

export type ResolveTdkInput = {
  site: SiteRecord;
  pageType: PageType;
  variables?: PublicUrlData;
  tdkConfigs?: TdkConfigRecord[];
  preferredConfigId?: string | null;
  categoryId?: string | null;
  objectSeo?: {
    title?: string | null;
    keywords?: string | null;
    description?: string | null;
  };
  noindex?: boolean;
};

export function resolveTdk(input: ResolveTdkInput): ResolvedTdk {
  const isHome = input.pageType === 'HOME';
  const preferredConfigId = input.preferredConfigId ?? input.site.tdkConfigId;
  const config = resolveTdkConfig(
    input.pageType,
    input.site.id,
    input.tdkConfigs ?? [],
    preferredConfigId,
    isHome ? undefined : input.categoryId,
  );
  const fallback = DEFAULT_TDK_TEMPLATES[input.pageType];
  const inputVariables = input.variables ?? {};
  const variables = {
    siteName: input.site.name,
    year: new Date().getFullYear(),
    date: new Date().toISOString().slice(0, 10),
    ...inputVariables,
    columnName: inputVariables.columnName ?? inputVariables.categoryName,
    labelName: inputVariables.labelName ?? inputVariables.tagName,
    mouth: inputVariables.mouth ?? new Date().getMonth() + 1,
    day: inputVariables.day ?? new Date().getDate(),
  };

  const titleTemplate =
    input.objectSeo?.title ?? (isHome ? input.site.seoTitle ?? config?.titleTemplate : config?.titleTemplate ?? input.site.seoTitle) ?? fallback.title;
  const keywordsTemplate =
    input.objectSeo?.keywords ??
    (isHome ? input.site.seoKeywords ?? config?.keywordsTemplate : config?.keywordsTemplate ?? input.site.seoKeywords) ??
    fallback.keywords;
  const descriptionTemplate =
    input.objectSeo?.description ??
    (isHome
      ? input.site.seoDescription ?? config?.descriptionTemplate
      : config?.descriptionTemplate ?? input.site.seoDescription) ??
    fallback.description;

  return {
    title: truncate(interpolateTemplate(titleTemplate, variables), 80),
    keywords: truncate(interpolateTemplate(keywordsTemplate, variables), 180),
    description: truncate(interpolateTemplate(descriptionTemplate, variables), 180),
    robots: input.noindex || input.site.seoIndexStatus === 'NOINDEX' ? 'noindex,follow' : 'index,follow',
  };
}

export function resolveTdkConfig(
  pageType: PageType,
  siteId: string,
  tdkConfigs: TdkConfigRecord[],
  preferredConfigId?: string | null,
  categoryId?: string | null,
): TdkConfigRecord | undefined {
  const activeConfigs = tdkConfigs.filter(
    (config) => config.status === 'ACTIVE' && (config.siteId === siteId || !config.siteId),
  );
  const resolve = (config: TdkConfigRecord | undefined) => {
    if (!config) return undefined;
    const rule = findTdkRule(config, pageType, categoryId);
    return rule ? withTdkRule(config, rule) : undefined;
  };

  const preferredConfig = preferredConfigId
    ? resolve(activeConfigs.find((config) => config.id === preferredConfigId))
    : undefined;
  const siteConfig = activeConfigs
    .filter((config) => config.siteId === siteId)
    .map(resolve)
    .find(Boolean);
  const globalConfig = activeConfigs
    .filter((config) => !config.siteId)
    .map(resolve)
    .find(Boolean);

  return preferredConfig ?? siteConfig ?? globalConfig;
}

export function tdkRules(config: TdkConfigRecord): TdkRuleRecord[] {
  if (config.rules?.length) {
    return config.rules;
  }

  if (config.pageType && config.titleTemplate) {
    return (config.categoryIds?.length ? config.categoryIds : ['']).map((categoryId, index) => ({
      id: `${config.id}-legacy-${index}`,
      categoryId,
      pageType: config.pageType as PageType,
      titleTemplate: config.titleTemplate as string,
      keywordsTemplate: config.keywordsTemplate,
      descriptionTemplate: config.descriptionTemplate,
      detailRules: [],
    }));
  }

  return [];
}

export function findTdkRule(
  config: TdkConfigRecord,
  pageType: PageType,
  categoryId?: string | null,
): ResolvedTdkRule | undefined {
  const rules = tdkRules(config);
  for (const rule of rules) {
    if (rule.categoryId === categoryId && rule.pageType === pageType) {
      return rule;
    }
    const detail = (rule.detailRules ?? []).find((item) => item.pageType === pageType);
    if (detail && (!categoryId || rule.categoryId === categoryId)) {
      return {
        categoryId: rule.categoryId,
        pageType: detail.pageType,
        titleTemplate: detail.titleTemplate,
        keywordsTemplate: detail.keywordsTemplate,
        descriptionTemplate: detail.descriptionTemplate,
      };
    }
  }
  const fallback = rules.find((rule) => rule.pageType === pageType && (!categoryId || rule.categoryId === categoryId));
  if (fallback) return fallback;
  const firstDetail = rules[0]?.detailRules?.find((item) => item.pageType === pageType);
  if (firstDetail && rules[0]) {
    return {
      categoryId: rules[0].categoryId,
      pageType: firstDetail.pageType,
      titleTemplate: firstDetail.titleTemplate,
      keywordsTemplate: firstDetail.keywordsTemplate,
      descriptionTemplate: firstDetail.descriptionTemplate,
    };
  }
  return undefined;
}

function withTdkRule(config: TdkConfigRecord, rule: ResolvedTdkRule): TdkConfigRecord {
  return {
    ...config,
    categoryIds: [rule.categoryId].filter(Boolean),
    pageType: rule.pageType,
    titleTemplate: rule.titleTemplate,
    keywordsTemplate: rule.keywordsTemplate,
    descriptionTemplate: rule.descriptionTemplate,
  };
}

export function interpolateTemplate(template: string | null | undefined, variables: PublicUrlData = {}): string {
  if (!template) {
    return '';
  }

  return template
    .replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
      const value = variables[key];
      if (value === null || value === undefined || value === '') {
        return '';
      }
      if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
      }
      return String(value);
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength - 1).trimEnd();
}
