import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import type {
  LiveReplayRecord,
  NewsArticleRecord,
  SiteRecord,
  SportLeagueRecord,
  SportMatchRecord,
  SportTeamRecord,
} from '@sports/core';
import { createSeedData, type CmsStore } from '../packages/db/src/seed-data';

type Options = {
  out: string;
  sites: number;
  newsPerSite: number;
  replaysPerSite: number;
  matches: number;
};

const options = parseArgs(process.argv.slice(2));
const store = createEnterpriseStore(options);

mkdirSync(dirname(options.out), { recursive: true });
writeFileSync(options.out, JSON.stringify(store, null, 2));

console.log(
  JSON.stringify(
    {
      out: options.out,
      sites: store.sites.length,
      categories: store.categories.length,
      news: store.news.length,
      liveReplays: store.liveReplays.length,
      leagues: store.leagues.length,
      teams: store.teams.length,
      matches: store.matches.length,
    },
    null,
    2,
  ),
);

function createEnterpriseStore(input: Options): CmsStore {
  const store = createSeedData();
  const now = new Date();
  const templates = store.templates.filter((template) => template.status === 'ACTIVE');
  const groups = store.groups.filter((group) => group.status === 'ACTIVE');
  const publicCategories = store.categories.filter((category) => category.status === 'ACTIVE' && !category.deletedAt);
  const matchCategories = publicCategories.filter((category) => /直播|赛程|football|basketball|nba|cba/i.test(`${category.name} ${category.slug}`));
  const replayCategory = publicCategories.find((category) => /录像|回放|replay|video/i.test(`${category.name} ${category.slug}`)) ?? publicCategories[0];
  const newsCategories = publicCategories.filter((category) => !/录像|回放|replay|video/i.test(`${category.name} ${category.slug}`));

  store.sites = [];
  store.news = [];
  store.liveReplays = [];
  store.promotionTypes = [];
  store.promotionLinks = [];
  store.leagues = createLoadLeagues(80, now);
  store.teams = createLoadTeams(store.leagues, 240, now);
  store.matches = createLoadMatches(store.leagues, store.teams, input.matches, now);

  for (let index = 0; index < input.sites; index += 1) {
    const siteNumber = index + 1;
    const group = groups[index % groups.length];
    const template = templates[index % templates.length];
    const siteId = `load-site-${siteNumber.toString().padStart(3, '0')}`;
    const domain = `site${siteNumber.toString().padStart(3, '0')}.load.test`;
    const site: SiteRecord = {
      id: siteId,
      groupId: group.id,
      group,
      name: `企业体育站 ${siteNumber.toString().padStart(3, '0')}`,
      primaryDomain: domain,
      primaryProtocol: 'http',
      status: 'ACTIVE',
      templateId: template.id,
      template,
      urlConfigId: 'url-default-rules',
      tdkConfigId: 'tdk-default-rules',
      newsUpdateCount: 80,
      showSignalSources: true,
      seoTitle: `企业体育站${siteNumber} - 足球篮球直播与体育新闻`,
      seoKeywords: `企业体育站${siteNumber},足球直播,篮球直播,体育新闻,赛事录像`,
      seoDescription: `企业体育站${siteNumber}提供足球、篮球、赛事录像、体育新闻和多线路直播入口。`,
      seoIndexStatus: 'INDEX',
      analyticsCode: '<script>window.__loadAnalytics=1</script>',
      baiduVerifyCode: `load-site-${siteNumber}`,
      domains: [
        { id: `domain-${siteId}-primary`, siteId, domain, isPrimary: true, status: 'ACTIVE' },
        { id: `domain-${siteId}-www`, siteId, domain: `www.${domain}`, isPrimary: false, status: 'ACTIVE' },
      ],
      createdAt: now,
      updatedAt: now,
    };
    store.sites.push(site);
    store.news.push(...createLoadNewsForSite(site, newsCategories, input.newsPerSite, now));
    store.liveReplays.push(...createLoadReplaysForSite(site, replayCategory, input.replaysPerSite, now));
  }

  return store;
}

function createLoadLeagues(count: number, now: Date): SportLeagueRecord[] {
  const names = ['英超', '西甲', '意甲', '德甲', '法甲', '中超', '欧冠', 'NBA', 'CBA', 'NBL'];
  return Array.from({ length: count }, (_, index) => {
    const sport = index % 4 === 0 ? 'BASKETBALL' : 'FOOTBALL';
    const name = `${names[index % names.length]}企业联赛${index + 1}`;
    return {
      id: `load-league-${index + 1}`,
      sport,
      name,
      slug: `load-league-${index + 1}`,
      englishName: `Load League ${index + 1}`,
      pinyin: `loadleague${index + 1}`,
      logoUrl: `https://img.example.com/leagues/${index + 1}.png`,
      country: index % 2 === 0 ? '中国' : '欧洲',
      isHot: index < 24,
      externalSource: 'load-test',
      externalId: `load-league-${index + 1}`,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    };
  });
}

function createLoadTeams(leagues: SportLeagueRecord[], count: number, now: Date): SportTeamRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const league = leagues[index % leagues.length];
    return {
      id: `load-team-${index + 1}`,
      sport: league.sport,
      leagueId: league.id,
      name: `企业球队${index + 1}`,
      slug: `load-team-${index + 1}`,
      englishName: `Load Team ${index + 1}`,
      pinyin: `loadteam${index + 1}`,
      country: index % 2 === 0 ? '中国' : '海外',
      logoUrl: `https://img.example.com/teams/${index + 1}.png`,
      isHot: index < 60,
      externalSource: 'load-test',
      externalId: `load-team-${index + 1}`,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    };
  });
}

function createLoadMatches(
  leagues: SportLeagueRecord[],
  teams: SportTeamRecord[],
  count: number,
  now: Date,
): SportMatchRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const league = leagues[index % leagues.length];
    const homeTeam = teams[(index * 2) % teams.length];
    const awayTeam = teams[(index * 2 + 37) % teams.length];
    const startOffsetMinutes = -60 + (index % (3 * 24 * 60));
    const startTime = new Date(now.getTime() + startOffsetMinutes * 60 * 1000);
    return {
      id: `load-match-${index + 1}`,
      siteId: null,
      sport: league.sport,
      title: `${league.name} ${homeTeam.name} VS ${awayTeam.name}`,
      slug: `load-match-${index + 1}`,
      leagueId: league.id,
      league,
      homeTeamId: homeTeam.id,
      homeTeam,
      awayTeamId: awayTeam.id,
      awayTeam,
      isTop: index % 29 === 0,
      status: startTime.getTime() <= now.getTime() ? 'LIVE' : 'SCHEDULED',
      startTime,
      liveUrl: `https://live.example.com/room/load-match-${index + 1}`,
      replayUrl: null,
      externalSource: 'load-test',
      externalId: `load-match-${index + 1}`,
      rawPayload: { load: true },
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    };
  });
}

function createLoadNewsForSite(
  site: SiteRecord,
  categories: CmsStore['categories'],
  count: number,
  now: Date,
): NewsArticleRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const category = categories[index % categories.length];
    const publishedAt = new Date(now.getTime() - index * 15 * 60 * 1000);
    const title = `${site.name} 重点新闻 ${index + 1}：球队阵容和直播赛程更新`;
    return {
      id: `${site.id}-news-${index + 1}`,
      siteId: site.id,
      categoryId: category.id,
      category,
      title,
      slug: `news-${index + 1}`,
      summary: `${title}，包括赛前训练、伤停名单、比赛节奏、直播入口和最新数据观察。`,
      content: [
        `${title}。教练组在赛前训练中重点演练转换进攻和边路保护，球员身体状态总体稳定。`,
        '从近期数据看，双方在开局阶段的压迫强度、篮板保护、二次进攻和定位球处理上都有明显变化。',
        '本站会继续同步最新赛程、直播信号、录像回放和新闻动态，方便用户在同一页面快速完成浏览。',
      ].join('\n\n'),
      coverImageUrl: `https://img.example.com/news/${site.id}/${index + 1}.jpg`,
      coverImageWidth: 1200,
      coverImageHeight: 800,
      author: '企业压测编辑部',
      sourceName: '本站原创',
      sourceUrl: null,
      status: 'PUBLISHED',
      isTop: index % 53 === 0,
      publishedAt,
      createdAt: publishedAt,
      updatedAt: publishedAt,
    };
  });
}

function createLoadReplaysForSite(
  site: SiteRecord,
  category: CmsStore['categories'][number],
  count: number,
  now: Date,
): LiveReplayRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const createTime = new Date(now.getTime() - index * 2 * 60 * 60 * 1000);
    return {
      id: `${site.id}-replay-${index + 1}`,
      siteId: site.id,
      categoryId: category.id,
      title: `【企业录像】主队${index + 1} VS 客队${index + 1} 录像回放`,
      slug: `replay-${index + 1}`,
      createTime,
      homeTeam: `主队${index + 1}`,
      awayTeam: `客队${index + 1}`,
      playUrl: `https://vod.example.com/${site.id}/replay-${index + 1}.m3u8`,
      createdAt: createTime,
      updatedAt: createTime,
    };
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

  return {
    out: values.get('out') || '/private/tmp/sports-enterprise-store.json',
    sites: positiveInteger(values.get('sites'), 60),
    newsPerSite: positiveInteger(values.get('news-per-site'), 200),
    replaysPerSite: positiveInteger(values.get('replays-per-site'), 20),
    matches: positiveInteger(values.get('matches'), 3000),
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
