import { describe, expect, it, vi } from 'vitest';
import { cmsRepository } from '@sports/db';
import { createApiServer } from '../server';

const adminListRoutes = [
  '/admin/auth/me',
  '/admin/users',
  '/admin/roles',
  '/admin/permissions',
  '/admin/sites',
  '/admin/groups',
  '/admin/templates',
  '/admin/url-configs',
  '/admin/tdk-configs',
  '/admin/categories',
  '/admin/news',
  '/admin/live-replays',
  '/admin/promotion-types',
  '/admin/promotion-links',
  '/admin/leagues',
  '/admin/teams',
  '/admin/matches',
  '/admin/live-products',
  '/admin/signal-domains',
  '/admin/signal-source-names',
  '/admin/scheduled-tasks',
  '/admin/cache/invalidation-jobs',
  '/admin/audit-logs',
];

describe('admin routes smoke test', () => {
  it.each(adminListRoutes)('returns data for %s', async (route) => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);

    const response = await app.inject({
      method: 'GET',
      url: route,
      headers,
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(() => JSON.parse(response.body)).not.toThrow();
  });

  it('logs in with a seeded admin account', async () => {
    const app = createApiServer({ logger: false });

    const response = await app.inject({
      method: 'POST',
      url: '/admin/auth/login',
      payload: {
        identity: 'admin',
        password: 'password123',
      },
    });

    await app.close();

    const body = JSON.parse(response.body) as {
      accessToken?: string;
      user?: { username?: string };
    };
    expect(response.statusCode).toBe(200);
    expect(body.accessToken).toBeTruthy();
    expect(body.user?.username).toBe('admin');
  });

  it('returns paginated admin tables', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);

    const response = await app.inject({
      method: 'GET',
      url: '/admin/news?page=1&pageSize=5',
      headers,
    });

    await app.close();

    const body = JSON.parse(response.body) as {
      data?: unknown[];
      page?: number;
      pageSize?: number;
      total?: number;
    };
    expect(response.statusCode).toBe(200);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(5);
    expect(body.total).toBeGreaterThan(5);
    expect(body.data).toHaveLength(5);
  });

  it('uploads images to the local image bucket and deduplicates by content hash', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);
    const payload = {
      filename: 'demo.png',
      contentType: 'image/png',
      dataBase64:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    };

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/admin/uploads/images',
      headers,
      payload,
    });
    const secondResponse = await app.inject({
      method: 'POST',
      url: '/admin/uploads/images',
      headers,
      payload,
    });

    await app.close();

    const firstBody = JSON.parse(firstResponse.body) as { url?: string; duplicated?: boolean };
    const secondBody = JSON.parse(secondResponse.body) as { url?: string; duplicated?: boolean };
    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect(firstBody.url).toMatch(
      /^http:\/\/img\.localhost:4000\/uploads\/images\/[a-f0-9]{64}\.png$/,
    );
    expect(secondBody.url).toBe(firstBody.url);
    expect(secondBody.duplicated).toBe(true);
  });

  it('imports sites from the Excel batch format', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);
    const suffix = Date.now();
    const domain = `excel-import-${suffix}.example.com`;
    const dataBase64 = buildSiteImportWorkbookBase64([
      [
        '站点名称，必填',
        '语言',
        '分组 ID',
        '域名，必填',
        '状态',
        '模板 ID',
        'TDK ID',
        'URL ID',
        '首页 SEO 标题',
        '首页 SEO 关键词',
        '首页 SEO 描述',
        '统计代码',
      ],
      [
        'name',
        'language',
        'groupId',
        'domainName',
        'status',
        'tmplId',
        'tdkId',
        'urlId',
        'seoTitle',
        'seoKeyword',
        'seoDesc',
        'statisticsCode',
      ],
      [
        'Excel批量测试站',
        'cn',
        '1',
        domain,
        '1',
        '4',
        '4',
        '5',
        'Excel批量标题',
        'Excel批量关键词',
        'Excel批量描述',
        '<script>window.__excelImport=1</script>',
      ],
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/sites/import-excel',
      headers,
      payload: {
        filename: 'sites.xlsx',
        dataBase64,
      },
    });
    const duplicateResponse = await app.inject({
      method: 'POST',
      url: '/admin/sites/import-excel',
      headers,
      payload: {
        filename: 'sites.xlsx',
        dataBase64,
      },
    });

    await app.close();

    const body = JSON.parse(response.body) as {
      created?: Array<{ id?: string; domain?: string }>;
      skipped?: Array<{ domain?: string }>;
      failed?: unknown[];
    };
    const duplicateBody = JSON.parse(duplicateResponse.body) as {
      created?: unknown[];
      skipped?: Array<{ domain?: string }>;
    };
    const imported = cmsRepository.store.sites.find((site) => site.primaryDomain === domain);
    expect(response.statusCode).toBe(200);
    expect(body.created).toHaveLength(1);
    expect(body.created?.[0]?.domain).toBe(domain);
    expect(body.failed).toHaveLength(0);
    expect(imported?.name).toBe('Excel批量测试站');
    expect(imported?.groupId).toBe('group-national');
    expect(imported?.templateId).toBe('template-qzcad-portal');
    expect(imported?.tdkConfigId).toBe('tdk-default-rules');
    expect(imported?.urlConfigId).toBeTruthy();
    expect(imported?.seoTitle).toBe('Excel批量标题');
    expect(imported?.seoKeywords).toBe('Excel批量关键词');
    expect(imported?.seoDescription).toBe('Excel批量描述');
    expect(imported?.analyticsCode).toContain('window.__excelImport');
    expect(duplicateResponse.statusCode).toBe(200);
    expect(duplicateBody.created).toHaveLength(0);
    expect(duplicateBody.skipped?.[0]?.domain).toBe(domain);
  });

  it('hides soft-deleted sites from admin site lists', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);
    const slug = `delete-site-${Date.now()}`;
    const createResponse = await app.inject({
      method: 'POST',
      url: '/admin/sites',
      headers,
      payload: {
        groupId: 'group-national',
        name: '删除测试站点',
        primaryDomain: `https://${slug}.example.com`,
        status: 'ACTIVE',
        templateId: 'template-jinqiu-live',
        urlConfigId: 'url-default-rules',
        tdkConfigId: 'tdk-default-rules',
        seoTitle: '删除测试站点',
        seoKeywords: '删除测试站点',
        seoDescription: '删除测试站点',
      },
    });
    const created = JSON.parse(createResponse.body) as { id?: string; primaryDomain?: string };
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/admin/sites/${created.id}`,
      headers,
    });
    const listResponse = await app.inject({
      method: 'GET',
      url: '/admin/sites?page=1&pageSize=100',
      headers,
    });

    await app.close();

    const listBody = JSON.parse(listResponse.body) as {
      data?: Array<{ id?: string; primaryDomain?: string }>;
    };
    expect(createResponse.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(200);
    expect(listResponse.statusCode).toBe(200);
    expect(
      listBody.data?.some((site) => site.id === created.id || site.primaryDomain === created.primaryDomain),
    ).toBe(false);
  });

  it('returns patched site data in admin site lists', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);
    const slug = `update-site-${Date.now()}`;
    const updatedName = '修改测试站点已生效';
    const createResponse = await app.inject({
      method: 'POST',
      url: '/admin/sites',
      headers,
      payload: {
        groupId: 'group-national',
        name: '修改测试站点',
        primaryDomain: `https://${slug}.example.com`,
        status: 'ACTIVE',
        templateId: 'template-jinqiu-live',
        urlConfigId: 'url-default-rules',
        tdkConfigId: 'tdk-default-rules',
        seoTitle: '修改测试站点',
        seoKeywords: '修改测试站点',
        seoDescription: '修改测试站点',
      },
    });
    const created = JSON.parse(createResponse.body) as { id?: string };
    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/admin/sites/${created.id}`,
      headers,
      payload: {
        name: updatedName,
        seoTitle: updatedName,
      },
    });
    const listResponse = await app.inject({
      method: 'GET',
      url: '/admin/sites?page=1&pageSize=100',
      headers,
    });

    await app.close();

    const listBody = JSON.parse(listResponse.body) as {
      data?: Array<{ id?: string; name?: string }>;
    };
    const listedSite = listBody.data?.find((site) => site.id === created.id);
    expect(createResponse.statusCode).toBe(200);
    expect(updateResponse.statusCode).toBe(200);
    expect(listResponse.statusCode).toBe(200);
    expect(listedSite?.name).toBe(updatedName);
  });

  it('creates an automatic daily news crawl task for a new active site', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);
    const slug = `auto-news-site-${Date.now()}`;
    const createResponse = await app.inject({
      method: 'POST',
      url: '/admin/sites',
      headers,
      payload: {
        groupId: 'group-national',
        name: '自动新闻测试站点',
        primaryDomain: `https://${slug}.example.com`,
        status: 'ACTIVE',
        templateId: 'template-jinqiu-live',
        urlConfigId: 'url-default-rules',
        tdkConfigId: 'tdk-default-rules',
        newsUpdateCount: 7,
        seoTitle: '自动新闻测试站点',
        seoKeywords: '自动新闻测试站点',
        seoDescription: '自动新闻测试站点',
      },
    });
    const created = JSON.parse(createResponse.body) as { id?: string };
    const task = cmsRepository.store.scheduledTasks.find(
      (candidate) =>
        candidate.type === 'NEWS_CRAWL' &&
        candidate.config?.autoCreatedForSite === true &&
        candidate.config?.siteId === created.id,
    );

    await app.close();

    expect(createResponse.statusCode).toBe(200);
    expect(task?.status).toBe('ACTIVE');
    expect(task?.name).toBe(`每日懂球帝新闻采集-${slug}.example.com`);
    expect(task?.config?.limit).toBe(7);
    expect(task?.config?.categoryId).toEqual(expect.any(String));
    expect(task?.nextRunAt).toBeInstanceOf(Date);
  });

  it('rejects creating duplicate sibling category names', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/categories',
      headers,
      payload: {
        name: '体育新闻',
        language: 'zh-CN',
        status: 'ACTIVE',
        sortOrder: 90,
      },
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toMatchObject({
      error: 'CONFLICT',
      message: '栏目名不能重复：体育新闻',
    });
  });

  it('rejects deleting core records that are still bound', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);

    const groupResponse = await app.inject({
      method: 'DELETE',
      url: '/admin/groups/group-national',
      headers,
    });
    const templateResponse = await app.inject({
      method: 'DELETE',
      url: '/admin/templates/template-jinqiu-live',
      headers,
    });
    const categoryResponse = await app.inject({
      method: 'DELETE',
      url: '/admin/categories/cat-frontline-news',
      headers,
    });
    const urlConfigResponse = await app.inject({
      method: 'DELETE',
      url: '/admin/url-configs/url-default-rules',
      headers,
    });
    const tdkConfigResponse = await app.inject({
      method: 'DELETE',
      url: '/admin/tdk-configs/tdk-default-rules',
      headers,
    });

    await app.close();

    expect(groupResponse.statusCode).toBe(409);
    expect(JSON.parse(groupResponse.body)).toMatchObject({
      error: 'CONFLICT',
      message: expect.stringContaining('不能删除分组「全国体育站群」'),
    });
    expect(templateResponse.statusCode).toBe(409);
    expect(JSON.parse(templateResponse.body)).toMatchObject({
      error: 'CONFLICT',
      message: expect.stringContaining('不能删除模板「劲球直播风格 Jinqiu Live」'),
    });
    expect(categoryResponse.statusCode).toBe(409);
    expect(JSON.parse(categoryResponse.body)).toMatchObject({
      error: 'CONFLICT',
      message: expect.stringContaining('不能删除栏目「体育新闻」'),
    });
    expect(urlConfigResponse.statusCode).toBe(409);
    expect(JSON.parse(urlConfigResponse.body)).toMatchObject({
      error: 'CONFLICT',
      message: expect.stringContaining('不能删除URL配置「默认全站 URL 规则」'),
    });
    expect(tdkConfigResponse.statusCode).toBe(409);
    expect(JSON.parse(tdkConfigResponse.body)).toMatchObject({
      error: 'CONFLICT',
      message: expect.stringContaining('不能删除TDK配置「默认全站 TDK 规则」'),
    });
  });

  it('returns a notice after auto-adding URL and TDK rules for a new child category', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);
    const suffix = Date.now();

    const response = await app.inject({
      method: 'POST',
      url: '/admin/categories',
      headers,
      payload: {
        parentId: 'cat-frontline-news',
        name: `子栏目规则提示${suffix}`,
        slug: `child-rule-notice-${suffix}`,
        language: 'zh-CN',
        status: 'ACTIVE',
        description: '用于验证新增子栏目时自动补 URL 和 TDK 规则。',
        sortOrder: 95,
      },
    });

    await app.close();

    const body = JSON.parse(response.body) as { seoRuleNotice?: string; seoRuleSync?: { urlRuleCount?: number; tdkRuleCount?: number } };
    expect(response.statusCode).toBe(200);
    expect(body.seoRuleNotice).toContain('请立即设置并检查 TDK 和 URL 规则');
    expect(body.seoRuleSync?.urlRuleCount).toBeGreaterThan(0);
    expect(body.seoRuleSync?.tdkRuleCount).toBeGreaterThan(0);
  });

  it('keeps bare and www domains on the same site', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);
    const domain = `alias-site-${Date.now()}.example.com`;
    const createResponse = await app.inject({
      method: 'POST',
      url: '/admin/sites',
      headers,
      payload: {
        groupId: 'group-national',
        name: '域名别名测试站点',
        primaryDomain: domain,
        status: 'ACTIVE',
        templateId: 'template-jinqiu-live',
        urlConfigId: 'url-default-rules',
        tdkConfigId: 'tdk-default-rules',
      },
    });
    const duplicateResponse = await app.inject({
      method: 'POST',
      url: '/admin/sites',
      headers,
      payload: {
        groupId: 'group-national',
        name: '重复 www 域名测试站点',
        primaryDomain: `www.${domain}`,
        status: 'ACTIVE',
        templateId: 'template-lybo-industrial',
        urlConfigId: 'url-default-rules',
        tdkConfigId: 'tdk-default-rules',
      },
    });

    await app.close();

    const created = JSON.parse(createResponse.body) as {
      domains?: Array<{ domain?: string; isPrimary?: boolean }>;
    };
    expect(createResponse.statusCode).toBe(200);
    expect(created.domains?.some((item) => item.domain === domain && item.isPrimary)).toBe(true);
    expect(created.domains?.some((item) => item.domain === `www.${domain}`)).toBe(true);
    expect(duplicateResponse.statusCode).toBe(409);
  });

  it('filters news by site for multi-site content operations', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);

    const response = await app.inject({
      method: 'GET',
      url: '/admin/news?siteId=site-frontline&page=1&pageSize=50',
      headers,
    });

    await app.close();

    const body = JSON.parse(response.body) as { data?: Array<{ siteId?: string }>; total?: number };
    expect(response.statusCode).toBe(200);
    expect(body.total).toBeGreaterThan(0);
    expect(body.data?.every((article) => article.siteId === 'site-frontline')).toBe(true);
  });

  it('allows matches to store an empty placeholder live URL path', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/matches',
      headers,
      payload: {
        siteId: 'site-frontline',
        sport: 'FOOTBALL',
        title: '占位直播地址测试',
        leagueId: 'league-premier',
        homeTeamId: 'team-arsenal',
        awayTeamId: 'team-city',
        isTop: false,
        status: 'SCHEDULED',
        startTime: new Date().toISOString(),
        liveUrl: '/',
        externalSource: 'manual',
        externalId: '542057',
      },
    });

    await app.close();

    const body = JSON.parse(response.body) as { liveUrl?: string; externalId?: string };
    expect(response.statusCode).toBe(200);
    expect(body.liveUrl).toBe('/');
    expect(body.externalId).toBe('542057');
  });

  it('syncs fake sports API data and keeps public match listings within two hours', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/matches/sync-fake',
      headers,
      payload: {},
    });

    await app.close();

    const body = JSON.parse(response.body) as {
      data?: Array<{ externalSource?: string }>;
      count?: number;
    };
    const now = Date.now();
    const publicMatches = cmsRepository.listMatches('site-frontline');
    expect(response.statusCode).toBe(200);
    expect(body.count).toBeGreaterThan(0);
    expect(body.data?.every((match) => match.externalSource === 'fake-sports-api')).toBe(true);
    expect(publicMatches.length).toBeGreaterThan(0);
    expect(
      publicMatches.every(
        (match) => Math.abs(match.startTime.getTime() - now) <= 2 * 60 * 60 * 1000,
      ),
    ).toBe(true);
  });

  it('syncs real sports API shape into leagues, teams, and matches', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              type_id: 17,
              short_name_zh: '英超',
              home_name: '阿森纳',
              away_name: '曼城',
              match_time: new Date().toISOString(),
              match_id: 'jk-match-1',
              url: 'https://live.example.com/player?id=jk-match-1',
              class_name: '足球',
              home_logo: 'https://img.example.com/arsenal.png',
              away_logo: 'https://img.example.com/city.png',
              competition_logo: 'https://img.example.com/premier.png',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/admin/matches/sync',
      headers,
      payload: {},
    });

    fetchMock.mockRestore();
    await app.close();

    const body = JSON.parse(response.body) as {
      data?: Array<{
        externalSource?: string;
        externalId?: string;
        liveUrl?: string;
        league?: { name?: string; logoUrl?: string };
        homeTeam?: { name?: string; logoUrl?: string };
        awayTeam?: { name?: string; logoUrl?: string };
      }>;
      count?: number;
    };
    expect(response.statusCode).toBe(200);
    expect(body.count).toBe(1);
    expect(body.data?.[0]?.externalSource).toBe('jktgedc-match-api');
    expect(body.data?.[0]?.externalId).toBe('jk-match-1');
    expect(body.data?.[0]?.liveUrl).toBe('https://live.example.com/player?id=jk-match-1');
    expect(body.data?.[0]?.league?.name).toBe('英超');
    expect(body.data?.[0]?.league?.logoUrl).toBe('https://img.example.com/premier.png');
    expect(body.data?.[0]?.homeTeam?.name).toBe('阿森纳');
    expect(body.data?.[0]?.homeTeam?.logoUrl).toBe('https://img.example.com/arsenal.png');
    expect(body.data?.[0]?.awayTeam?.name).toBe('曼城');
    expect(body.data?.[0]?.awayTeam?.logoUrl).toBe('https://img.example.com/city.png');
  });

  it('runs the daily sports scheduled task manually', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          list: [
            {
              type_id: 17,
              short_name_zh: '中超',
              home_name: '上海海港',
              away_name: '山东泰山',
              match_time: new Date().toISOString(),
              match_id: 'scheduled-match-1',
              class_name: '足球',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/admin/scheduled-tasks/task-daily-sports-sync/run',
      headers,
      payload: {},
    });

    fetchMock.mockRestore();
    await app.close();

    const body = JSON.parse(response.body) as {
      task?: { lastStatus?: string; runCount?: number; lastMessage?: string };
      sports?: { matches?: Array<{ externalId?: string }> };
    };
    expect(response.statusCode).toBe(200);
    expect(body.task?.lastStatus).toBe('SUCCESS');
    expect(body.task?.runCount).toBeGreaterThan(0);
    expect(body.task?.lastMessage).toContain('赛事同步成功');
    expect(body.sports?.matches?.[0]?.externalId).toBe('scheduled-match-1');
  });

  it('runs the daily live replay scheduled task manually', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 0,
          data: [
            {
              title: '【欧冠】皇家马德里VS曼城',
              create_time: 1775106158,
              home_team: '皇家马德里',
              away_team: '曼城',
              play_url: 'https://vod.example.com/replay/champions-league.m3u8',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/admin/scheduled-tasks/task-daily-live-replay-sync/run',
      headers,
      payload: {},
    });

    fetchMock.mockRestore();
    await app.close();

    const body = JSON.parse(response.body) as {
      task?: { lastStatus?: string; runCount?: number; lastMessage?: string };
      liveReplays?: { created?: number; data?: Array<{ title?: string; publicUrl?: string }> };
    };
    expect(response.statusCode).toBe(200);
    expect(body.task?.lastStatus).toBe('SUCCESS');
    expect(body.task?.runCount).toBeGreaterThan(0);
    expect(body.task?.lastMessage).toContain('直播录像采集成功');
    expect(body.liveReplays?.created).toBe(1);
    expect(body.liveReplays?.data?.[0]?.title).toContain('皇家马德里VS曼城');
    expect(body.liveReplays?.data?.[0]?.publicUrl).toContain('/video/');
  });

  it('syncs live replay API rows into clean admin fields and local detail links', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 0,
          data: [
            {
              title: '【墨女超】蒙特雷女足VS美洲狮女足',
              create_time: 1775106158,
              home_team: '蒙特雷女足',
              away_team: '美洲狮女足',
              play_url: 'https://1324291601.vod-qcloud.com/video/playlist_eof.m3u8',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const syncResponse = await app.inject({
      method: 'POST',
      url: '/admin/live-replays/sync',
      headers,
      payload: {
        sourceUrl: 'https://lmaappi.zhongxun132.cn/api/live/reply_history',
        siteId: 'site-frontline',
        categoryId: 'cat-frontline-replay',
      },
    });
    const listResponse = await app.inject({
      method: 'GET',
      url: '/admin/live-replays?siteId=site-frontline&page=1&pageSize=50',
      headers,
    });

    fetchMock.mockRestore();
    await app.close();

    const syncBody = JSON.parse(syncResponse.body) as {
      created?: number;
      data?: Array<{
        id?: string;
        title?: string;
        create_time?: number;
        home_team?: string;
        away_team?: string;
        play_url?: string;
        publicUrl?: string;
      }>;
    };
    const listBody = JSON.parse(listResponse.body) as {
      data?: Array<{ title?: string; publicUrl?: string }>;
    };
    expect(syncResponse.statusCode).toBe(200);
    expect(syncBody.created).toBe(1);
    expect(syncBody.data?.[0]).toMatchObject({
      title: '【墨女超】蒙特雷女足VS美洲狮女足',
      create_time: 1775106158,
      home_team: '蒙特雷女足',
      away_team: '美洲狮女足',
      play_url: 'https://1324291601.vod-qcloud.com/video/playlist_eof.m3u8',
    });
    expect(Object.keys(syncBody.data?.[0] ?? {}).sort()).toEqual(
      ['id', 'title', 'create_time', 'home_team', 'away_team', 'play_url', 'publicUrl'].sort(),
    );
    expect(syncBody.data?.[0]?.publicUrl).toContain('/video/match-replay/');
    expect(listResponse.statusCode).toBe(200);
    expect(listBody.data?.some((row) => row.publicUrl?.includes('/video/match-replay/'))).toBe(true);
  });

  it('creates and runs a daily Dongqiudi news crawl task with dedupe', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);
    cmsRepository.store.news.push({
      id: 'news-existing-cross-site-90001',
      siteId: 'site-courtside',
      categoryId: 'cat-courtside-nba',
      title: '利物浦完成训练备战欧冠半决赛',
      slug: 'existing-cross-site-90001',
      summary: '另一站点已经采集过这条新闻。',
      content: '另一站点已经采集过这条新闻，后续站点采集时应该全库跳过。',
      sourceUrl: 'https://www.dongqiudi.com/article/90001',
      status: 'PUBLISHED',
      isTop: false,
      publishedAt: new Date('2026-05-27T08:10:00.000Z'),
      createdAt: new Date('2026-05-27T08:10:00.000Z'),
      updatedAt: new Date('2026-05-27T08:10:00.000Z'),
    });
    const dongqiudiPayload = {
      articles: [
        {
          id: 90001,
          title: '利物浦完成训练备战欧冠半决赛 | 懂球帝独家报道',
          share: 'https://www.dongqiudi.com/article/90001',
          description: '懂球帝讯 利物浦全队完成赛前训练，主帅确认多名主力可以出战。编辑：测试编辑',
          thumb: 'https://img.dongqiudi.com/news/90001.jpg',
          author_name: '懂球帝资讯',
          created_at: '2026-05-27T08:10:00.000Z',
        },
        {
          id: 90002,
          title: '国足公布新一期集训名单',
          share: 'https://www.dongqiudi.com/article/90002',
          description: '国足新一期名单公布，多名年轻球员首次入选。',
          thumb: 'https://img.dongqiudi.com/news/90002.jpg',
          author_name: '懂球帝资讯',
          created_at: '2026-05-27T08:20:00.000Z',
        },
        {
          id: 90003,
          title: '不喜欢阿根廷',
          share: 'https://www.dongqiudi.com/article/90003',
        },
        {
          id: 90004,
          title: '曼城训练短讯',
          share: 'https://www.dongqiudi.com/article/90004',
        },
      ],
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/article/90001')) {
          return new Response(
            [
              '<article>',
              '<p>利物浦全队完成赛前训练，主帅在发布会上确认多名主力球员可以出战，球队会继续保持高强度压迫和快速转换。</p>',
              '<p>教练组重点演练边路推进和定位球防守，几名年轻球员也进入合练名单，赛前身体状态评估结果较为积极。</p>',
              '<p>俱乐部方面表示，球队将在比赛日前继续控制训练负荷，并根据对手阵型变化调整首发和替补方案。</p>',
              '<p>队内医疗组会在最后一堂训练课后提交报告，技术团队也会根据数据反馈继续微调中场站位。</p>',
              '<p>利物浦|欧冠|| 手机客户端，提供英超、西甲、意甲、中超等足球赛事专业的资讯、战术分析、直播、集锦、积分赛程，是足球迷手机上必备的神器。</p>',
              '<p>主编：测试编辑</p>',
              '<p>来源：懂球帝</p>',
              '</article>',
            ].join(''),
            { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
          );
        }
        if (url.includes('/article/90002')) {
          return new Response(
            JSON.stringify({
              headline: '国足公布新一期集训名单 | 懂球帝',
              articleBody:
                '懂球帝讯 国足新一期名单公布，多名年轻球员首次入选，教练组希望通过本次集训观察阵容厚度和不同位置的竞争状态。球队将在集训期间安排多堂技战术训练课，重点提升中前场衔接效率和防守转换速度。相关人士表示，名单调整主要服务于接下来的正式比赛，部分球员仍需通过训练表现争取出场机会。教练团队还会结合联赛出场时间和身体数据，持续评估每名球员的状态。来源：懂球帝',
              description: '懂球帝讯 国足新一期名单公布，多名年轻球员首次入选。编辑：测试编辑',
              author: { name: '懂球帝资讯' },
              datePublished: '2026-05-27T08:20:00.000Z',
            }),
            { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } },
          );
        }
        if (url.includes('/article/90004')) {
          return new Response('<article><p>短讯。</p></article>', {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        }
        return new Response(JSON.stringify(dongqiudiPayload), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/admin/scheduled-tasks',
      headers,
      payload: {
        type: 'NEWS_CRAWL',
        name: '测试懂球帝采集',
        status: 'ACTIVE',
        scheduleTime: '04:20',
        timezone: 'Asia/Shanghai',
        config: {
          sourceUrl: 'http://api.dongqiudi.com/app/tabs/iphone/1.json',
          siteId: 'site-frontline',
          categoryId: 'cat-frontline-news',
          limit: 4,
        },
      },
    });
    const task = JSON.parse(createResponse.body) as { id?: string };
    const firstRun = await app.inject({
      method: 'POST',
      url: `/admin/scheduled-tasks/${task.id}/run`,
      headers,
      payload: {},
    });
    const secondRun = await app.inject({
      method: 'POST',
      url: `/admin/scheduled-tasks/${task.id}/run`,
      headers,
      payload: {},
    });

    fetchMock.mockRestore();
    await app.close();

    const firstBody = JSON.parse(firstRun.body) as {
      task?: { lastStatus?: string; lastMessage?: string };
      news?: {
        created?: number;
        skipped?: number;
        articles?: Array<{
          title?: string;
          summary?: string;
          sourceName?: string;
          sourceUrl?: string;
          coverImageUrl?: string;
          author?: string;
          content?: string;
        }>;
      };
    };
    const secondBody = JSON.parse(secondRun.body) as {
      news?: { created?: number; skipped?: number };
    };
    expect(createResponse.statusCode).toBe(200);
    expect(firstRun.statusCode).toBe(200);
    expect(firstBody.task?.lastStatus).toBe('SUCCESS');
    expect(firstBody.task?.lastMessage).toContain('懂球帝新闻采集成功');
    expect(firstBody.news?.created).toBe(1);
    expect(firstBody.news?.skipped).toBe(3);
    expect(firstBody.news?.articles?.[0]?.title).toBe('国足公布新一期集训名单');
    expect(firstBody.news?.articles?.[0]?.summary).not.toContain('懂球帝');
    expect(firstBody.news?.articles?.[0]?.sourceName).toBeUndefined();
    expect(firstBody.news?.articles?.[0]?.sourceUrl).toBe('https://www.dongqiudi.com/article/90002');
    expect(firstBody.news?.articles?.[0]?.author).toBe('体育前线');
    expect(firstBody.news?.articles?.[0]?.content).not.toContain('懂球帝');
    expect(firstBody.news?.articles?.[0]?.content).not.toContain('手机客户端');
    expect(firstBody.news?.articles?.[0]?.content).not.toContain('主编');
    expect(firstBody.news?.articles?.[0]?.content).not.toContain('来源');
    expect(firstBody.news?.articles?.[0]?.content).not.toContain('本站已保留原文链接');
    expect(secondRun.statusCode).toBe(200);
    expect(secondBody.news?.created).toBe(0);
    expect(secondBody.news?.skipped).toBe(4);
  });

  it('returns client errors instead of 500 for invalid admin operations', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);

    const invalidLiveProduct = await app.inject({
      method: 'POST',
      url: '/admin/live-products',
      headers,
      payload: {
        name: '错误直播产品',
        jumpUrl: 'not-a-url',
        supportWildcard: false,
        enableReplayJumpDomain: true,
        appendRoomSuffix: true,
        status: 'ACTIVE',
      },
    });
    const missingDelete = await app.inject({
      method: 'DELETE',
      url: '/admin/live-products/not-exists',
      headers,
    });
    const emptyJsonDelete = await app.inject({
      method: 'DELETE',
      url: '/admin/live-products/not-exists',
      headers: {
        ...headers,
        'content-type': 'application/json',
      },
    });

    await app.close();

    expect(invalidLiveProduct.statusCode).toBe(400);
    expect(missingDelete.statusCode).toBe(404);
    expect(emptyJsonDelete.statusCode).toBe(400);
    expect(invalidLiveProduct.statusCode).not.toBe(500);
    expect(missingDelete.statusCode).not.toBe(500);
    expect(emptyJsonDelete.statusCode).not.toBe(500);
  });

  it('generates template keys when the admin omits them', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);
    const payload = {
      name: '自动 Key 模板',
      folder: 'auto-key-template',
      status: 'ACTIVE',
    };

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/admin/templates',
      headers,
      payload,
    });
    const secondResponse = await app.inject({
      method: 'POST',
      url: '/admin/templates',
      headers,
      payload: { ...payload, name: '自动 Key 模板副本' },
    });

    await app.close();

    const firstBody = JSON.parse(firstResponse.body) as { key?: string };
    const secondBody = JSON.parse(secondResponse.body) as { key?: string };
    expect(firstResponse.statusCode).toBe(200);
    expect(firstBody.key).toBe('auto-key-template');
    expect(secondResponse.statusCode).toBe(200);
    expect(secondBody.key).toBe('auto-key-template-2');
  });

  it('generates technical keys and slugs when the admin omits them', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app);

    const roleResponse = await app.inject({
      method: 'POST',
      url: '/admin/roles',
      headers,
      payload: {
        name: 'Content Operator',
        description: 'Creates content without typing a technical key.',
        status: 'ACTIVE',
        permissionActions: ['admin:access', 'news:write'],
      },
    });
    const permissionResponse = await app.inject({
      method: 'POST',
      url: '/admin/permissions',
      headers,
      payload: {
        label: 'Read Reports',
        group: 'Audit',
        description: 'Generated permission action.',
        status: 'ACTIVE',
      },
    });
    const categoryResponse = await app.inject({
      method: 'POST',
      url: '/admin/categories',
      headers,
      payload: {
        name: 'Tennis News',
        language: 'zh-CN',
        status: 'ACTIVE',
        sortOrder: 90,
      },
    });
    const categoryBody = JSON.parse(categoryResponse.body) as {
      id: string;
      slug?: string;
    };
    const urlConfigResponse = await app.inject({
      method: 'POST',
      url: '/admin/url-configs',
      headers,
      payload: {
        siteId: 'site-frontline',
        name: 'Tennis News URL',
        status: 'ACTIVE',
        rules: [
          {
            categoryId: categoryBody.id,
            pageType: 'NEWS_CATEGORY',
            pattern: '/tennis/{categorySlug}.html',
            detailRules: [
              {
                label: 'Tennis News Detail',
                pageType: 'NEWS_DETAIL',
                pattern: '/tennis/{categorySlug}/{newsSlug}.html',
              },
            ],
          },
        ],
        description: 'URL config owns category bindings.',
      },
    });
    const tdkConfigResponse = await app.inject({
      method: 'POST',
      url: '/admin/tdk-configs',
      headers,
      payload: {
        siteId: 'site-frontline',
        name: 'Tennis News TDK',
        status: 'ACTIVE',
        rules: [
          {
            categoryId: categoryBody.id,
            pageType: 'NEWS_CATEGORY',
            titleTemplate: '{categoryName} - {siteName}',
            keywordsTemplate: '{categoryName},{siteName}',
            descriptionTemplate: '{siteName} {categoryName} latest updates.',
            detailRules: [
              {
                label: 'Tennis News Detail',
                pageType: 'NEWS_DETAIL',
                titleTemplate: '{title} - {siteName}',
                keywordsTemplate: '{title},{siteName}',
                descriptionTemplate: '{summary}',
              },
            ],
          },
        ],
      },
    });
    const newsResponse = await app.inject({
      method: 'POST',
      url: '/admin/news',
      headers,
      payload: {
        siteId: 'site-frontline',
        categoryId: categoryBody.id,
        title: 'Weekend Tennis Finals Preview',
        summary: 'Weekend tennis finals preview with broadcast and lineup notes.',
        content:
          'Weekend tennis finals preview with broadcast and lineup notes for editors creating a full article.',
        status: 'DRAFT',
        isTop: false,
      },
    });
    const promotionTypeResponse = await app.inject({
      method: 'POST',
      url: '/admin/promotion-types',
      headers,
      payload: {
        siteId: 'site-frontline',
        name: 'News Bottom Card',
        slot: 'NEWS_BOTTOM',
        renderStyle: 'CARD',
        status: 'ACTIVE',
        sortOrder: 60,
      },
    });
    const leagueResponse = await app.inject({
      method: 'POST',
      url: '/admin/leagues',
      headers,
      payload: {
        sport: 'FOOTBALL',
        name: 'Serie A',
        englishName: 'Serie A',
        isHot: true,
      },
    });
    const teamResponse = await app.inject({
      method: 'POST',
      url: '/admin/teams',
      headers,
      payload: {
        sport: 'FOOTBALL',
        name: 'Inter Milan',
        englishName: 'Inter Milan',
        isHot: true,
      },
    });

    await app.close();

    expect(roleResponse.statusCode).toBe(200);
    expect((JSON.parse(roleResponse.body) as { key?: string }).key).toBe('content-operator');
    expect(permissionResponse.statusCode).toBe(200);
    expect((JSON.parse(permissionResponse.body) as { action?: string }).action).toBe(
      'audit:read-reports',
    );
    expect(categoryResponse.statusCode).toBe(200);
    expect(categoryBody.slug).toBe('tennis-news');
    expect(urlConfigResponse.statusCode).toBe(200);
    expect(
      (
        JSON.parse(urlConfigResponse.body) as {
          rules?: Array<{ categoryId: string; detailRules?: Array<{ pageType?: string }> }>;
        }
      ).rules?.[0]?.categoryId,
    ).toBe(categoryBody.id);
    expect(
      (
        JSON.parse(urlConfigResponse.body) as {
          rules?: Array<{ detailRules?: Array<{ pageType?: string }> }>;
        }
      ).rules?.[0]?.detailRules?.[0]?.pageType,
    ).toBe('NEWS_DETAIL');
    expect(tdkConfigResponse.statusCode).toBe(200);
    expect(
      (
        JSON.parse(tdkConfigResponse.body) as {
          rules?: Array<{ categoryId: string; detailRules?: Array<{ pageType?: string }> }>;
        }
      ).rules?.[0]?.categoryId,
    ).toBe(categoryBody.id);
    expect(
      (
        JSON.parse(tdkConfigResponse.body) as {
          rules?: Array<{ detailRules?: Array<{ pageType?: string }> }>;
        }
      ).rules?.[0]?.detailRules?.[0]?.pageType,
    ).toBe('NEWS_DETAIL');
    expect(newsResponse.statusCode).toBe(200);
    expect((JSON.parse(newsResponse.body) as { slug?: string }).slug).toBe(
      'weekend-tennis-finals-preview',
    );
    expect(promotionTypeResponse.statusCode).toBe(200);
    expect((JSON.parse(promotionTypeResponse.body) as { key?: string }).key).toBe(
      'news-bottom-card',
    );
    expect(leagueResponse.statusCode).toBe(200);
    expect((JSON.parse(leagueResponse.body) as { slug?: string }).slug).toBe('serie-a');
    expect(teamResponse.statusCode).toBe(200);
    expect((JSON.parse(teamResponse.body) as { slug?: string }).slug).toBe('inter-milan');
  });

  it('rejects admin routes without a bearer token', async () => {
    const app = createApiServer({ logger: false });

    const response = await app.inject({
      method: 'GET',
      url: '/admin/sites',
    });

    await app.close();

    expect(response.statusCode).toBe(401);
  });

  it('applies role permissions after login', async () => {
    const app = createApiServer({ logger: false });
    const headers = await loginHeaders(app, 'editor', 'editor123');

    const response = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers,
    });

    await app.close();

    expect(response.statusCode).toBe(403);
  });

  it('allows the local admin app through CORS preflight', async () => {
    const app = createApiServer({ logger: false });

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/admin/sites',
      headers: {
        origin: 'http://127.0.0.1:3001',
        'access-control-request-method': 'GET',
      },
    });

    await app.close();

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3001');
    expect(response.headers['access-control-allow-methods']).toContain('GET');
  });
});

async function loginHeaders(
  app: ReturnType<typeof createApiServer>,
  identity = 'admin',
  password = 'password123',
): Promise<Record<string, string>> {
  const response = await app.inject({
    method: 'POST',
    url: '/admin/auth/login',
    payload: { identity, password },
  });
  const body = JSON.parse(response.body) as { accessToken: string };

  return {
    authorization: `Bearer ${body.accessToken}`,
  };
}

function buildSiteImportWorkbookBase64(rows: string[][]): string {
  const files: Record<string, string> = {
    '[Content_Types].xml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
      '</Types>',
    ].join(''),
    '_rels/.rels': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
      '</Relationships>',
    ].join(''),
    'xl/workbook.xml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      '<sheets><sheet name="站点导入" sheetId="1" r:id="rId1"/></sheets>',
      '</workbook>',
    ].join(''),
    'xl/_rels/workbook.xml.rels': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
      '</Relationships>',
    ].join(''),
    'xl/worksheets/sheet1.xml': worksheetXml(rows),
  };
  return zipStoredFiles(files).toString('base64');
}

function worksheetXml(rows: string[][]): string {
  const rowXml = rows
    .map((row, rowIndex) => {
      const cellXml = row
        .map((value, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cellXml}</row>`;
    })
    .join('');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `<sheetData>${rowXml}</sheetData>`,
    '</worksheet>',
  ].join('');
}

function zipStoredFiles(files: Record<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  Object.entries(files).forEach(([name, content]) => {
    const nameBuffer = Buffer.from(name, 'utf8');
    const dataBuffer = Buffer.from(content, 'utf8');
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(Object.keys(files).length, 8);
  endOfCentralDirectory.writeUInt16LE(Object.keys(files).length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

function columnName(index: number): string {
  let value = '';
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }
  return value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
