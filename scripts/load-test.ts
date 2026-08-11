import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import {
  buildPublicUrl,
  type CategoryRecord,
  type NewsArticleRecord,
  type PageType,
  type SiteRecord,
  type SportMatchRecord,
  type UrlConfigRecord,
} from '@sports/core';
import type { CmsStore } from '../packages/db/src/seed-data';

type Mode = 'hot' | 'mixed' | 'cold';

type Options = {
  baseUrl: string;
  storePath: string;
  requests: number;
  concurrency: number;
  warmup: number;
  mode: Mode;
  hosts: number;
  timeoutMs: number;
};

type Target = {
  host: string;
  path: string;
  kind: 'home' | 'category' | 'news' | 'replay' | 'match';
};

type RequestResult = {
  ok: boolean;
  statusCode: number;
  latencyMs: number;
  bytes: number;
  kind: Target['kind'];
  host: string;
  path: string;
  error?: string;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const store = JSON.parse(readFileSync(options.storePath, 'utf8')) as CmsStore;
  const targets = buildTargets(store, options);

  if (!targets.length) {
    throw new Error('没有生成任何可压测 URL，请检查 store 数据。');
  }

  console.log(
    JSON.stringify(
      {
        phase: 'targets',
        mode: options.mode,
        requests: options.requests,
        concurrency: options.concurrency,
        warmup: options.warmup,
        targetCount: targets.length,
        byKind: countBy(targets, (target) => target.kind),
      },
      null,
      2,
    ),
  );

  if (options.warmup > 0) {
    await runLoad({
      ...options,
      requests: options.warmup,
      concurrency: Math.min(options.concurrency, 50),
    }, targets, false);
  }

  const result = await runLoad(options, targets, true);
  console.log(JSON.stringify(result, null, 2));
}

async function runLoad(input: Options, candidates: Target[], measured: boolean) {
  const startedAt = Date.now();
  const latencies: number[] = [];
  const statusCounts: Record<string, number> = {};
  const kindCounts: Record<string, number> = {};
  const errors: Array<Pick<RequestResult, 'statusCode' | 'kind' | 'host' | 'path' | 'error'>> = [];
  let completed = 0;
  let bytes = 0;
  let cursor = 0;

  async function worker(workerIndex: number) {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= input.requests) {
        return;
      }
      const target = chooseTarget(candidates, index, workerIndex, input.mode);
      const response = await requestTarget(input.baseUrl, target, input.timeoutMs);
      completed += 1;
      bytes += response.bytes;
      latencies.push(response.latencyMs);
      statusCounts[String(response.statusCode)] = (statusCounts[String(response.statusCode)] ?? 0) + 1;
      kindCounts[response.kind] = (kindCounts[response.kind] ?? 0) + 1;
      if (!response.ok && errors.length < 12) {
        errors.push({
          statusCode: response.statusCode,
          kind: response.kind,
          host: response.host,
          path: response.path,
          error: response.error,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: input.concurrency }, (_, index) => worker(index)));

  const durationSeconds = (Date.now() - startedAt) / 1000;
  latencies.sort((left, right) => left - right);
  const failed = latencies.length - (statusCounts['200'] ?? 0);
  return {
    phase: measured ? 'measured' : 'warmup',
    mode: input.mode,
    requests: completed,
    concurrency: input.concurrency,
    durationSeconds: round(durationSeconds),
    rps: round(completed / Math.max(durationSeconds, 0.001)),
    throughputMbps: round((bytes * 8) / Math.max(durationSeconds, 0.001) / 1_000_000),
    bytes,
    failed,
    errorRate: round(failed / Math.max(completed, 1)),
    statusCounts,
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
  };
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
    pushTarget(targets, site, '/', 'home');

    const categoryRules = activeCategoryRules(urlConfigs, categories);
    const categoryLimit = input.mode === 'hot' ? 2 : categoryRules.length;
    for (const { category, pageType } of categoryRules.slice(0, categoryLimit)) {
      pushBuiltUrl(targets, site, urlConfigs, pageType, category, undefined, 'category');
    }

    const newsRows = store.news
      .filter((article) => article.siteId === site.id && article.status === 'PUBLISHED' && !article.deletedAt)
      .slice(0, input.mode === 'cold' ? 220 : input.mode === 'mixed' ? 50 : 5);
    for (const article of newsRows) {
      const category = categoryById.get(article.categoryId);
      if (category) {
        pushBuiltUrl(targets, site, urlConfigs, 'NEWS_DETAIL', category, article, 'news');
      }
    }

    const replayRows = store.liveReplays
      .filter((replay) => replay.siteId === site.id && !replay.deletedAt)
      .slice(0, input.mode === 'hot' ? 2 : input.mode === 'mixed' ? 8 : 30);
    for (const replay of replayRows) {
      const category = categoryById.get(replay.categoryId);
      if (category) {
        pushBuiltUrl(
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

  const matchRows = store.matches
    .filter((match) => !match.siteId)
    .slice(0, input.mode === 'hot' ? 30 : input.mode === 'mixed' ? 250 : 1000);
  for (const site of sites) {
    const urlConfigs = store.urlConfigs.filter((config) => config.status === 'ACTIVE' && (!config.siteId || config.siteId === site.id));
    const matchCategory = categories.find((category) => /足球|football/i.test(`${category.name} ${category.slug}`)) ?? categories[0];
    const basketballCategory = categories.find((category) => /篮球|basketball|nba|cba/i.test(`${category.name} ${category.slug}`)) ?? matchCategory;
    for (const match of matchRows.slice(0, input.mode === 'hot' ? 3 : input.mode === 'mixed' ? 15 : 30)) {
      const category = match.sport === 'BASKETBALL' ? basketballCategory : matchCategory;
      pushBuiltMatchUrl(targets, site, urlConfigs, category, match);
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
      if (!rule.categoryId || !['NEWS_CATEGORY', 'MATCH_CATEGORY', 'VIDEO_CATEGORY'].includes(rule.pageType)) {
        continue;
      }
      const category = categoryById.get(rule.categoryId);
      if (!category || seen.has(`${category.id}:${rule.pageType}`)) {
        continue;
      }
      seen.add(`${category.id}:${rule.pageType}`);
      rows.push({ category, pageType: rule.pageType });
    }
  }
  return rows.sort((left, right) => left.category.sortOrder - right.category.sortOrder);
}

function pushBuiltUrl(
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
    pushTarget(targets, site, path, kind);
  } catch {
    // Some categories intentionally do not have a matching detail rule.
  }
}

function pushBuiltMatchUrl(
  targets: Target[],
  site: SiteRecord,
  urlConfigs: UrlConfigRecord[],
  category: CategoryRecord,
  match: SportMatchRecord,
) {
  try {
    const path = buildPublicUrl({
      site,
      pageType: 'MATCH_DETAIL',
      urlConfigs,
      categoryId: category.id,
      data: {
        categorySlug: category.slug,
        sport: category.slug,
        matchId: match.id,
        slug: match.slug ?? match.id,
        newsSlug: match.id,
      },
    });
    pushTarget(targets, site, path, 'match');
  } catch {
    // Match pages exist only for live/schedule categories.
  }
}

function pushTarget(targets: Target[], site: SiteRecord, path: string, kind: Target['kind']) {
  targets.push({
    host: site.primaryDomain,
    path,
    kind,
  });
}

function chooseTarget(targets: Target[], index: number, workerIndex: number, mode: Mode): Target {
  if (mode === 'cold') {
    return targets[index % targets.length];
  }
  const random = createRandom(index * 1103515245 + workerIndex * 97 + 17)();
  const kind = chooseKind(random);
  const sameKind = targets.filter((target) => target.kind === kind);
  const bucket = sameKind.length ? sameKind : targets;
  const targetIndex = Math.floor(createRandom(index * 2654435761 + workerIndex)() * bucket.length);
  return bucket[targetIndex] ?? targets[index % targets.length];
}

function chooseKind(value: number): Target['kind'] {
  if (value < 0.36) return 'home';
  if (value < 0.61) return 'category';
  if (value < 0.86) return 'news';
  if (value < 0.94) return 'match';
  return 'replay';
}

function requestTarget(baseUrl: string, target: Target, timeoutMs: number): Promise<RequestResult> {
  const base = new URL(baseUrl);
  const startedAt = process.hrtime.bigint();
  const transport = base.protocol === 'https:' ? https : http;
  return new Promise((resolve) => {
    const request = transport.request(
      {
        hostname: base.hostname,
        port: base.port || (base.protocol === 'https:' ? 443 : 80),
        protocol: base.protocol,
        method: 'GET',
        path: target.path,
        headers: {
          Host: target.host,
          'User-Agent': 'SportsEnterpriseLoadTest/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
        timeout: timeoutMs,
      },
      (response) => {
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
        });
        response.on('end', () => {
          const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
          const statusCode = response.statusCode ?? 0;
          resolve({
            ok: statusCode >= 200 && statusCode < 400,
            statusCode,
            latencyMs,
            bytes,
            kind: target.kind,
            host: target.host,
            path: target.path,
          });
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error(`timeout after ${timeoutMs}ms`));
    });
    request.on('error', (error) => {
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      resolve({
        ok: false,
        statusCode: 0,
        latencyMs,
        bytes: 0,
        kind: target.kind,
        host: target.host,
        path: target.path,
        error: error.message,
      });
    });
    request.end();
  });
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
    baseUrl: values.get('url') || 'http://127.0.0.1:5310',
    storePath: values.get('store') || '/private/tmp/sports-enterprise-store.json',
    requests: positiveInteger(values.get('requests'), 5000),
    concurrency: positiveInteger(values.get('concurrency'), 200),
    warmup: positiveInteger(values.get('warmup'), 500),
    mode: mode as Mode,
    hosts: positiveInteger(values.get('hosts'), 60),
    timeoutMs: positiveInteger(values.get('timeout-ms'), 15_000),
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
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
