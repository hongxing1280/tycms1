import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

const rootDir = new URL('..', import.meta.url).pathname;
const now = '2026-06-10T00:00:00.000Z';
const templateMarkers = {
  'template-jinqiu-live': 'class="jinqiu-page',
  'template-lybo-industrial': 'class="lybo-page',
  'template-qzcad-portal': 'class="qzcad-page',
};
const smokeSites = [
  { host: '23h6.com', templateId: 'template-jinqiu-live', templateKey: 'jinqiu-live' },
  { host: 'q560.com', templateId: 'template-qzcad-portal', templateKey: 'qzcad-portal' },
  { host: '21speak.com', templateId: 'template-lybo-industrial', templateKey: 'lybo-industrial' },
];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const mode = process.argv.includes('--dev') ? 'dev' : 'start';
  const keepStore = process.argv.includes('--keep-store');
  const tempDir = mkdtempSync(join(tmpdir(), 'sports-multisite-nav-'));
  const storePath = join(tempDir, 'cms-store.json');
  const port = await findOpenPort();
  const store = createStore();
  writeFileSync(storePath, JSON.stringify(store, null, 2));

  const server = spawn(
    'pnpm',
    ['--filter', '@sports/web', 'exec', 'next', mode, '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        SPORTS_CMS_STORE_PATH: storePath,
        SPORTS_CMS_DISK_SYNC_INTERVAL_MS: '0',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const logs = [];
  server.stdout.on('data', (chunk) => pushLog(logs, chunk));
  server.stderr.on('data', (chunk) => pushLog(logs, chunk));

  try {
    await waitForReady(port, store.sites[0].primaryDomain, logs);
    const targets = buildTargets(store);
    const requests = [
      ...firstWriterRequests(targets),
      ...shuffledRequests(targets, 30),
    ];
    const results = await Promise.all(requests.map((request) => verifyRequest(port, request)));
    const summary = results.reduce(
      (memo, result) => {
        memo[result.siteId] ??= { home: 0, nav: 0, forwarded: 0, direct: 0 };
        memo[result.siteId][result.kind] += 1;
        memo[result.siteId][result.mode] += 1;
        return memo;
      },
      {},
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode,
          localUrl: `http://127.0.0.1:${port}`,
          storePath,
          requests: results.length,
          sites: store.sites.map((site) => ({
            id: site.id,
            host: site.primaryDomain,
            templateId: site.templateId,
            urlConfigId: site.urlConfigId,
            tdkConfigId: site.tdkConfigId,
          })),
          summary,
        },
        null,
        2,
      ),
    );
  } finally {
    server.kill('SIGTERM');
    await waitForExit(server);
    if (!keepStore) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

function createStore() {
  const templates = smokeSites.map((site) => template(site.templateId, site.templateKey));
  const category = {
    id: 'cat-smoke-nav',
    name: 'Smoke Nav',
    slug: 'nav',
    language: 'zh-CN',
    status: 'ACTIVE',
    description: 'Multisite nav smoke category.',
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  };
  const sites = smokeSites.map((item, index) => {
    const number = index + 1;
    return {
      id: `site-smoke-${number}`,
      groupId: null,
      group: null,
      name: `Smoke Site ${number}`,
      primaryDomain: item.host,
      primaryProtocol: 'http',
      status: 'ACTIVE',
      templateId: item.templateId,
      template: templates[index],
      urlConfigId: `url-smoke-${number}`,
      tdkConfigId: `tdk-smoke-${number}`,
      newsUpdateCount: 20,
      showSignalSources: true,
      seoTitle: null,
      seoKeywords: null,
      seoDescription: null,
      seoIndexStatus: 'INDEX',
      analyticsCode: `<script>window.__smokeAnalytics${number}=true</script>`,
      baiduVerifyCode: `smoke-baidu-${number}`,
      domains: [
        {
          id: `domain-smoke-${number}-primary`,
          siteId: `site-smoke-${number}`,
          domain: item.host,
          isPrimary: true,
          status: 'ACTIVE',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
  });

  return {
    adminUsers: [],
    adminRoles: [],
    adminPermissions: [],
    adminSessions: [],
    groups: [],
    templates,
    sites,
    urlConfigs: sites.map((site, index) => urlConfig(site, category, index + 1)),
    tdkConfigs: sites.map((site, index) => tdkConfig(site, category, index + 1)),
    categories: [category],
    tags: [],
    news: sites.map((site, index) => newsArticle(site, category, index + 1)),
    liveReplays: [],
    promotionTypes: [],
    promotionLinks: [],
    leagues: [],
    teams: [],
    matches: [],
    liveProducts: [],
    signalDomains: [],
    signalSourceNames: [],
    scheduledTasks: [],
    invalidationJobs: [],
    auditLogs: [],
  };
}

function template(id, key) {
  return {
    id,
    name: key,
    key,
    folder: key,
    author: 'smoke',
    coverUrl: null,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
}

function urlConfig(site, category, number) {
  return {
    id: `url-smoke-${number}`,
    siteId: site.id,
    categoryIds: [category.id],
    rules: [
      { id: `url-smoke-${number}-home`, categoryId: '', pageType: 'HOME', pattern: '/', detailRules: [] },
      {
        id: `url-smoke-${number}-nav`,
        categoryId: category.id,
        pageType: 'NEWS_CATEGORY',
        pattern: '/{categorySlug}.html',
        detailRules: [
          {
            id: `url-smoke-${number}-detail`,
            label: 'Detail',
            pageType: 'NEWS_DETAIL',
            pattern: '/{categorySlug}/{newsSlug}.html',
          },
        ],
      },
    ],
    name: `Smoke URL ${number}`,
    status: 'ACTIVE',
    pageType: 'HOME',
    pattern: '/',
    description: null,
    createdAt: now,
    updatedAt: now,
  };
}

function tdkConfig(site, category, number) {
  return {
    id: `tdk-smoke-${number}`,
    siteId: site.id,
    categoryIds: [category.id],
    rules: [
      {
        id: `tdk-smoke-${number}-home`,
        categoryId: '',
        pageType: 'HOME',
        titleTemplate: `SMOKE-${number}-HOME`,
        keywordsTemplate: `SMOKE-${number}-HOME-KW`,
        descriptionTemplate: `SMOKE-${number}-HOME-DESC`,
        detailRules: [],
      },
      {
        id: `tdk-smoke-${number}-nav`,
        categoryId: category.id,
        pageType: 'NEWS_CATEGORY',
        titleTemplate: `SMOKE-${number}-NAV {columnName}`,
        keywordsTemplate: `SMOKE-${number}-NAV-KW`,
        descriptionTemplate: `SMOKE-${number}-NAV-DESC`,
        detailRules: [],
      },
    ],
    name: `Smoke TDK ${number}`,
    status: 'ACTIVE',
    pageType: 'HOME',
    titleTemplate: `SMOKE-${number}-HOME`,
    keywordsTemplate: `SMOKE-${number}-HOME-KW`,
    descriptionTemplate: `SMOKE-${number}-HOME-DESC`,
    createdAt: now,
    updatedAt: now,
  };
}

function newsArticle(site, category, number) {
  return {
    id: `news-smoke-${number}`,
    siteId: site.id,
    categoryId: category.id,
    category,
    title: `Smoke Site ${number} Article`,
    slug: `smoke-site-${number}-article`,
    summary: `Smoke summary ${number}.`,
    content: `Smoke content ${number} first paragraph.\n\nSmoke content ${number} second paragraph.`,
    coverImageUrl: null,
    coverImageWidth: null,
    coverImageHeight: null,
    author: 'smoke',
    sourceName: 'smoke',
    sourceUrl: null,
    status: 'PUBLISHED',
    isTop: true,
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

function buildTargets(store) {
  return store.sites.flatMap((site, index) => {
    const number = index + 1;
    return [
      {
        siteId: site.id,
        host: site.primaryDomain,
        path: '/',
        kind: 'home',
        title: `SMOKE-${number}-HOME`,
        canonical: `http://${site.primaryDomain}/`,
        templateId: site.templateId,
      },
      {
        siteId: site.id,
        host: site.primaryDomain,
        path: '/nav.html',
        kind: 'nav',
        title: `SMOKE-${number}-NAV Smoke Nav`,
        canonical: `http://${site.primaryDomain}/nav.html`,
        templateId: site.templateId,
      },
    ];
  });
}

function shuffledRequests(targets, rounds) {
  const requests = [];
  for (let round = 0; round < rounds; round += 1) {
    for (const target of targets) {
      requests.push({
        ...target,
        mode: (round + target.siteId.length + target.path.length) % 2 === 0 ? 'forwarded' : 'direct',
      });
    }
  }
  return requests
    .map((request, index) => ({ request, sort: seededRandom(index + 17) }))
    .sort((left, right) => left.sort - right.sort)
    .map((item) => item.request);
}

function firstWriterRequests(targets) {
  const navTargets = targets.filter((target) => target.kind === 'nav');
  const requests = [];
  for (const first of navTargets) {
    requests.push({ ...first, mode: 'direct' });
    for (const next of navTargets.filter((target) => target.host !== first.host)) {
      requests.push({ ...next, mode: 'direct' });
      requests.push({ ...next, mode: 'forwarded' });
    }
  }
  return requests;
}

async function verifyRequest(port, request) {
  const headers =
    request.mode === 'forwarded'
      ? { Host: `127.0.0.1:${port}`, 'X-Forwarded-Host': `${request.host}, internal.proxy` }
      : { Host: request.host };
  const response = await requestHtml(port, request.path, headers);
  const html = response.body;

  if (response.status !== 200) {
    throw new Error(`${request.host}${request.path} returned ${response.status}\n${html.slice(0, 500)}`);
  }
  assertCacheHeaders(response.headers, request);
  assertIncludes(html, `<title>${request.title}</title>`, request, 'title');
  assertCanonical(html, request);
  assertIncludes(html, templateMarkers[request.templateId], request, 'template marker');

  for (const [templateId, marker] of Object.entries(templateMarkers)) {
    if (templateId !== request.templateId && html.includes(marker)) {
      throw new Error(`${request.host}${request.path} leaked template marker ${marker}`);
    }
  }

  return {
    siteId: request.siteId,
    kind: request.kind,
    mode: request.mode,
  };
}

function assertIncludes(html, value, request, label) {
  if (!html.includes(value)) {
    throw new Error(`${request.host}${request.path} missing ${label}: ${value}\n${html.slice(0, 800)}`);
  }
}

function assertCacheHeaders(headers, request) {
  const cacheControl = headers['cache-control'] ?? '';
  if (!cacheControl.includes('no-store')) {
    throw new Error(`${request.host}${request.path} cache-control is not no-store: ${cacheControl}`);
  }
}

function assertCanonical(html, request) {
  const canonical = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/.exec(html)?.[1];
  if (normalizeCanonical(canonical) !== normalizeCanonical(request.canonical)) {
    throw new Error(
      `${request.host}${request.path} canonical mismatch: expected ${request.canonical}, got ${canonical}\n${html.slice(0, 800)}`,
    );
  }
}

function normalizeCanonical(value) {
  if (!value) return '';
  return value.endsWith('/') && value !== 'http://' && value !== 'https://' ? value.slice(0, -1) : value;
}

async function waitForReady(port, host, logs) {
  const deadline = Date.now() + 90_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await requestHtml(port, '/', { Host: host });
      if (response.status === 200 && response.body.includes('SMOKE-1-HOME')) {
        return;
      }
      lastError = new Error(`status ${response.status}: ${response.body.slice(0, 200)}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for Next dev server. Last error: ${lastError?.message}\n${logs.join('')}`);
}

function requestHtml(port, path, headers) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method: 'GET',
        path,
        headers: {
          ...headers,
          'User-Agent': 'SportsMultisiteSmoke/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
        timeout: 20_000,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    request.on('timeout', () => request.destroy(new Error('request timeout')));
    request.on('error', reject);
    request.end();
  });
}

async function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to allocate a local port.'));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(5_000).then(() => {
      child.kill('SIGKILL');
    }),
  ]);
}

function pushLog(logs, chunk) {
  logs.push(String(chunk));
  if (logs.length > 120) {
    logs.splice(0, logs.length - 120);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function seededRandom(seed) {
  let value = seed >>> 0;
  value = (value * 1664525 + 1013904223) >>> 0;
  return value / 0x100000000;
}
