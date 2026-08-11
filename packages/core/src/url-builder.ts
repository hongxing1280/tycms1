import type {
  PageType,
  PublicUrlData,
  SiteRecord,
  UrlConfigRecord,
  UrlDetailRuleRecord,
  UrlRuleRecord,
} from './types';

export const DEFAULT_URL_PATTERNS: Record<PageType, string> = {
  HOME: '/',
  NEWS_CATEGORY: '/news/{categorySlug}.html',
  NEWS_DETAIL: '/news/{categorySlug}/{newsSlug}.html',
  MATCH_CATEGORY: '/zhibo/{sport}.html',
  MATCH_DETAIL: '/zhibo/{matchId}-{slug}.html',
  VIDEO_CATEGORY: '/video/{categorySlug}.html',
  VIDEO_DETAIL: '/video/{categorySlug}/{videoSlug}.html',
  TAG: '/tag/{tagSlug}.html',
  TEAM: '/team/{teamSlug}.html',
  LEAGUE: '/league/{leagueSlug}.html',
  LIVE_ROOM: '/zhibo/{matchId}.html',
  SEARCH: '/search.html',
};

export type BuildPublicUrlInput = {
  site: SiteRecord;
  pageType: PageType;
  data?: PublicUrlData;
  urlConfigs?: UrlConfigRecord[];
  preferredConfigId?: string | null;
  categoryId?: string | null;
  absolute?: boolean;
};

export function resolveUrlPattern(
  pageType: PageType,
  siteId: string,
  urlConfigs: UrlConfigRecord[] = [],
  preferredConfigId?: string | null,
  categoryId?: string | null,
): string | undefined {
  const activeConfigs = urlConfigs.filter(
    (config) => config.status === 'ACTIVE' && (config.siteId === siteId || !config.siteId),
  );

  const fromConfig = (config: UrlConfigRecord | undefined) => (config ? findUrlRule(config, pageType, categoryId)?.pattern : undefined);

  const preferredPattern = preferredConfigId
    ? fromConfig(activeConfigs.find((config) => config.id === preferredConfigId))
    : undefined;
  if (preferredConfigId) {
    return preferredPattern;
  }

  const sitePattern = activeConfigs
    .filter((config) => config.siteId === siteId)
    .map((config) => fromConfig(config))
    .find(Boolean);
  const globalPattern = activeConfigs
    .filter((config) => !config.siteId)
    .map((config) => fromConfig(config))
    .find(Boolean);

  return preferredPattern ?? sitePattern ?? globalPattern ?? DEFAULT_URL_PATTERNS[pageType];
}

export function fillUrlPattern(pattern: string, data: PublicUrlData = {}): string {
  const filled = pattern.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const value = data[key];
    if (value === null || value === undefined) {
      throw new Error(`Missing URL variable: ${key}`);
    }
    return encodeURIComponent(formatUrlValue(value));
  });

  return normalizePublicPath(filled);
}

export function buildPublicUrl(input: BuildPublicUrlInput): string {
  const pattern = resolveUrlPattern(
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

  if (!input.absolute) {
    return path;
  }

  return `${buildPublicOrigin(input.site)}${path}`;
}

export function urlRules(config: UrlConfigRecord): UrlRuleRecord[] {
  if (config.rules?.length) {
    return config.rules;
  }

  if (config.pageType && config.pattern) {
    return (config.categoryIds?.length ? config.categoryIds : ['']).map((categoryId, index) => ({
      id: `${config.id}-legacy-${index}`,
      categoryId,
      pageType: config.pageType as PageType,
      pattern: config.pattern as string,
      detailRules: [],
    }));
  }

  return [];
}

export function findUrlRule(
  config: UrlConfigRecord,
  pageType: PageType,
  categoryId?: string | null,
): (UrlRuleRecord | UrlDetailRuleRecord) | undefined {
  const rules = urlRules(config);
  for (const rule of rules) {
    if (rule.categoryId === categoryId && rule.pageType === pageType) {
      return rule;
    }
    const detail = (rule.detailRules ?? []).find((item) => item.pageType === pageType);
    if (detail && (!categoryId || rule.categoryId === categoryId)) {
      return detail;
    }
  }

  const fallback = rules.find((rule) => rule.pageType === pageType && (!categoryId || rule.categoryId === categoryId));
  if (fallback) return fallback;

  return rules[0]?.detailRules?.find((item) => item.pageType === pageType);
}

export function buildPublicOrigin(site: SiteRecord): string {
  const protocol = site.primaryProtocol ?? 'http';
  return `${protocol}://${site.primaryDomain}`;
}

export function normalizePublicPath(path: string): string {
  const prefixed = path.startsWith('/') ? path : `/${path}`;
  return prefixed.replace(/\/{2,}/g, '/');
}

function formatUrlValue(value: string | number | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).trim().toLowerCase();
}
