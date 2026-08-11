import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import {
  buildPublicUrl,
  type CategoryRecord,
  type NewsArticleRecord,
  type PageType,
  type SiteRecord,
  type UrlConfigRecord,
} from '@sports/core';
import type { CmsStore } from '../packages/db/src/seed-data';

type Mode = 'hot' | 'mixed' | 'cold';

type Options = {
  storePath: string;
  requests: number;
  mode: Mode;
  hosts: number;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
};

type Target = {
  host: string;
  segments: string[];
  page: number;
  kind: 'home' | 'category' | 'news' | 'replay';
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  process.env.SPORTS_CMS_STORE_PATH = options.storePath;
  if (options.cacheTtlMs !== undefined) {
    process.env.PUBLIC_ROUTE_CACHE_TTL_MS = String(options.cacheTtlMs);
  }
  if (options.cacheMaxEntries !== undefined) {
    process.env.PUBLIC_ROUTE_CACHE_MAX_ENTRIES = String(options.cacheMaxEntries);
  }

  const { resolvePublicRoute } = await import('../apps/web/src/lib/public-route');
  const store = JSON.parse(readFileSync(options.storePath, 'utf8')) as CmsStore;
  const targets = buildTargets(store, options);
  if (!targets.length) {
    throw new Error('没有生成任何可压测路由。');
  }

  const latencies: number[] = [];
  const kindCounts: Record<string, number> = {};
  let ok = 0;
  let failed = 0;
  const errors: Target[] = [];
  const startedAt = performance.now();

  for (let index = 0; index < options.requests; index += 1) {
    const target = chooseTarget(targets, index, options.mode);
    const start = performance.now();
    const route = resolvePublicRoute(target.host, target.segments, target.page);
    const elapsed = performance.now() - start;
    latencies.push(elapsed);
    kindCounts[target.kind] = (kindCounts[target.kind] ?? 0) + 1;
    if (route) {
      ok += 1;
    } else {
      failed += 1;
      if (errors.length < 10) errors.push(target);
    }
  }

  const durationSeconds = (performance.now() - startedAt) / 1000;
  latencies.sort((left, right) => left - right);
  console.log(
    JSON.stringify(
      {
        mode: options.mode,
        storePath: options.storePath,
        requests: options.requests,
        hosts: options.hosts,
        targetCount: targets.length,
        targetKinds: countBy(targets, (target) => target.kind),
        durationSeconds: round(durationSeconds),
        routesPerSecond: round(options.requests / Math.max(durationSeconds, 0.001)),
        ok,
        failed,
        failureRate: round(failed / Math.max(options.requests, 1)),
        kindCounts,
        latencyMs: {
          avg: round(latencies.reduce((total, value) => total + value, 0) / Math.max(latencies.length, 1)),
          p50: round(percentile(latencies, 0.5)),
          p90: round(percentile(latencies, 0.9)),
          p95: round(percentile(latencies, 0.95)),
          p99: round(percentile(latencies, 0.99)),
          max: round(latencies[latencies.length - 1] ?? 0),
        },
        sampleErrors: errors,
      },
      null,
      2,
    ),
  );
}

function buildTargets(store: CmsStore, input: Options): Target[] {
  const sites = store.sites
    .filter((site) => site.status === 'ACTIVE' && !site.deletedAt)
    .slice(0, input.hosts);
  const categories = store.categories.filter((category) => category.status === 'ACTIVE' && !category.deletedAt);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const targets: Target[] = [];

  for (const site of sites) {
    const urlConfigs = store.urlConfigs.filter((config) => config.status === 'ACTIVE' && (!config.siteId || config.siteId === site.id));
    targets.push({ host: site.primaryDomain, segments: [], page: 1, kind: 'home' });

    const categoryRules = activeCategoryRules(urlConfigs, categories).slice(0, input.mode === 'hot' ? 2 : 20);
    for (const { category, pageType } of categoryRules) {
      pushBuiltTarget(targets, site, urlConfigs, pageType, category, undefined, 'category');
    }

    const newsLimit = input.mode === 'hot' ? 5 : input.mode === 'mixed' ? 50 : 220;
    const newsRows = store.news
      .filter((article) => article.siteId === site.id && article.status === 'PUBLISHED' && !article.deletedAt)
      .slice(0, newsLimit);
    for (const article of newsRows) {
      const category = categoryById.get(article.categoryId);
      if (category) {
        pushBuiltTarget(targets, site, urlConfigs, 'NEWS_DETAIL', category, article, 'news');
      }
    }

    const replayLimit = input.mode === 'hot' ? 2 : input.mode === 'mixed' ? 8 : 30;
    const replayRows = store.liveReplays
      .filter((replay) => replay.siteId === site.id && !replay.deletedAt)
      .slice(0, replayLimit);
    for (const replay of replayRows) {
      const category = categoryById.get(replay.categoryId);
      if (category) {
        pushBuiltTarget(
          targets,
          site,
          urlConfigs,
          'VIDEO_DETAIL',
          category,
          { slug: replay.slug } as NewsArticleRecord,
          'replay',
        );
      }
    }
  }

  return targets;
}

function activeCategoryRules(
  urlConfigs: UrlConfigRecord[],
  categories: CategoryRecord[],
): Array<{ category: CategoryRecord; pageType: PageType }> {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const seen = new Set<string>();
  const rows: Array<{ category: CategoryRecord; pageType: PageType }> = [];
  for (const config of urlConfigs) {
    for (const rule of config.rules ?? []) {
      if (!rule.categoryId || !['NEWS_CATEGORY', 'MATCH_CATEGORY', 'VIDEO_CATEGORY'].includes(rule.pageType)) continue;
      const category = categoryById.get(rule.categoryId);
      if (!category || seen.has(`${category.id}:${rule.pageType}`)) continue;
      seen.add(`${category.id}:${rule.pageType}`);
      rows.push({ category, pageType: rule.pageType });
    }
  }
  return rows.sort((left, right) => left.category.sortOrder - right.category.sortOrder);
}

function pushBuiltTarget(
  targets: Target[],
  site: SiteRecord,
  urlConfigs: UrlConfigRecord[],
  pageType: PageType,
  category: CategoryRecord,
  article: Pick<NewsArticleRecord, 'slug'> | undefined,
  kind: Target['kind'],
) {
  try {
    const path = buildPublicUrl({
      site,
      pageType,
      urlConfigs,
      categoryId: category.id,
      data: {
        categorySlug: category.slug,
        sport: category.slug,
        slug: article?.slug ?? category.slug,
        newsSlug: article?.slug ?? category.slug,
        articleSlug: article?.slug ?? category.slug,
        videoSlug: article?.slug ?? category.slug,
      },
    });
    targets.push({
      host: site.primaryDomain,
      segments: path.split('?')[0]?.split('/').filter(Boolean) ?? [],
      page: 1,
      kind,
    });
  } catch {
    // Skip routes that are not configured for a category/page type pair.
  }
}

function chooseTarget(targets: Target[], index: number, mode: Mode): Target {
  if (mode === 'cold') {
    return targets[index % targets.length];
  }
  const random = createRandom(index * 1103515245 + 17)();
  const kind = chooseKind(random);
  const sameKind = targets.filter((target) => target.kind === kind);
  const bucket = sameKind.length ? sameKind : targets;
  const targetIndex = Math.floor(createRandom(index * 2654435761)() * bucket.length);
  return bucket[targetIndex] ?? targets[index % targets.length];
}

function chooseKind(value: number): Target['kind'] {
  if (value < 0.38) return 'home';
  if (value < 0.63) return 'category';
  if (value < 0.9) return 'news';
  return 'replay';
}

function parseArgs(args: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;
    values.set(arg.slice(2), args[index + 1] ?? '');
    index += 1;
  }
  const mode = values.get('mode') ?? 'mixed';
  if (!['hot', 'mixed', 'cold'].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }
  return {
    storePath: values.get('store') || '/private/tmp/sports-enterprise-store.json',
    requests: positiveInteger(values.get('requests'), 5000),
    mode: mode as Mode,
    hosts: positiveInteger(values.get('hosts'), 60),
    cacheTtlMs: optionalInteger(values.get('cache-ttl-ms')),
    cacheMaxEntries: optionalInteger(values.get('cache-max-entries')),
  };
}

function optionalInteger(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function percentile(sorted: number[], rank: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * rank) - 1));
  return sorted[index] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
