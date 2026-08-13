import type {
  AdminPermissionRecord,
  AdminRoleRecord,
  AdminSessionRecord,
  AdminUserRecord,
  AuditLogRecord,
  CacheInvalidationJobRecord,
  CategoryRecord,
  LiveReplayRecord,
  LiveProductRecord,
  NewsArticleRecord,
  PromotionLinkRecord,
  PromotionTypeRecord,
  ScheduledTaskRecord,
  SiteGroupRecord,
  SiteRecord,
  SignalDomainRecord,
  SignalSourceNameRecord,
  SportLeagueRecord,
  SportMatchRecord,
  SportTeamRecord,
  SecuritySettingsRecord,
  TagRecord,
  PageType,
  TdkConfigRecord,
  TemplateRecord,
  UrlConfigRecord,
} from '@sports/core';
import { hashPassword } from './auth-crypto';

export type CmsStore = {
  adminUsers: AdminUserRecord[];
  adminRoles: AdminRoleRecord[];
  adminPermissions: AdminPermissionRecord[];
  adminSessions: AdminSessionRecord[];
  groups: SiteGroupRecord[];
  templates: TemplateRecord[];
  sites: SiteRecord[];
  urlConfigs: UrlConfigRecord[];
  tdkConfigs: TdkConfigRecord[];
  categories: CategoryRecord[];
  tags: TagRecord[];
  news: NewsArticleRecord[];
  liveReplays: LiveReplayRecord[];
  promotionTypes: PromotionTypeRecord[];
  promotionLinks: PromotionLinkRecord[];
  leagues: SportLeagueRecord[];
  teams: SportTeamRecord[];
  matches: SportMatchRecord[];
  liveProducts: LiveProductRecord[];
  signalDomains: SignalDomainRecord[];
  signalSourceNames: SignalSourceNameRecord[];
  scheduledTasks: ScheduledTaskRecord[];
  invalidationJobs: CacheInvalidationJobRecord[];
  auditLogs: AuditLogRecord[];
  securitySettings: SecuritySettingsRecord;
};

const now = new Date('2026-05-13T10:00:00.000Z');

const coverImages = [
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80',
];

export function createSeedData(): CmsStore {
  const adminPermissions = createAdminPermissions();
  const adminRoles = createAdminRoles();
  const adminUsers = createAdminUsers();

  const groups: SiteGroupRecord[] = [
    {
      id: 'group-national',
      name: '全国体育站群',
      status: 'ACTIVE',
      newsUpdateCount: 12,
      liveProductIds: ['live-product-frontline', 'live-product-frontline-aux'],
      enableDeviceSignalCheck: true,
      pcSignalSourceEnabled: true,
      mobileSignalSourceEnabled: true,
      randomSignalSourceEnabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'group-basketball',
      name: '篮球垂直站群',
      status: 'ACTIVE',
      newsUpdateCount: 8,
      liveProductIds: ['live-product-courtside', 'live-product-courtside-aux'],
      enableDeviceSignalCheck: true,
      pcSignalSourceEnabled: true,
      mobileSignalSourceEnabled: true,
      randomSignalSourceEnabled: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const templates: TemplateRecord[] = [
    {
      id: 'template-jinqiu-live',
      name: '劲球直播风格 Jinqiu Live',
      key: 'jinqiu-live',
      folder: 'jinqiu-live',
      author: 'Sports Platform',
      coverUrl: coverImages[3],
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'template-lybo-industrial',
      name: '波佳管业企业模板 Lybo Industrial',
      key: 'lybo-industrial',
      folder: 'lybo-industrial',
      author: 'Sports Platform',
      coverUrl: coverImages[4],
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'template-qzcad-portal',
      name: 'QZCAD 红色直播模板',
      key: 'qzcad-portal',
      folder: 'qzcad-portal',
      author: 'Sports Platform',
      coverUrl: coverImages[0],
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const sites: SiteRecord[] = [
    {
      id: 'site-frontline',
      groupId: 'group-national',
      group: groups[0],
      name: '体育前线',
      primaryDomain: 'www.frontline-sports.com',
      primaryProtocol: 'https',
      status: 'ACTIVE',
      templateId: 'template-jinqiu-live',
      template: templates[0],
      urlConfigId: 'url-default-rules',
      tdkConfigId: 'tdk-default-rules',
      newsUpdateCount: 12,
      showSignalSources: true,
      seoTitle: '体育前线 - 足球篮球新闻、赛程直播与赛事分析',
      seoKeywords: '体育前线,体育新闻,足球直播,篮球直播,赛程',
      seoDescription: '体育前线提供足球、篮球、热门联赛、球队动态、赛事直播信息和赛前深度分析。',
      seoIndexStatus: 'INDEX',
      domains: [
        { id: 'domain-frontline-primary', siteId: 'site-frontline', domain: 'www.frontline-sports.com', isPrimary: true, status: 'ACTIVE' },
        { id: 'domain-frontline-alias', siteId: 'site-frontline', domain: 'frontline-sports.com', isPrimary: false, status: 'ACTIVE' },
        { id: 'domain-frontline-localhost', siteId: 'site-frontline', domain: 'localhost', isPrimary: false, status: 'ACTIVE' },
        { id: 'domain-frontline-loopback', siteId: 'site-frontline', domain: '127.0.0.1', isPrimary: false, status: 'ACTIVE' },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'site-courtside',
      groupId: 'group-basketball',
      group: groups[1],
      name: '篮足速递',
      primaryDomain: 'www.courtside-sports.com',
      primaryProtocol: 'https',
      status: 'ACTIVE',
      templateId: 'template-lybo-industrial',
      template: templates[1],
      urlConfigId: 'url-default-rules',
      tdkConfigId: 'tdk-default-rules',
      newsUpdateCount: 8,
      showSignalSources: true,
      seoTitle: '篮足速递 - NBA、CBA、足球赛程和直播资讯',
      seoKeywords: '篮足速递,NBA新闻,CBA赛程,足球直播,体育资讯',
      seoDescription: '篮足速递聚合 NBA、CBA、足球赛事、直播入口、球队动态和赛程前瞻。',
      seoIndexStatus: 'INDEX',
      domains: [
        { id: 'domain-courtside-primary', siteId: 'site-courtside', domain: 'www.courtside-sports.com', isPrimary: true, status: 'ACTIVE' },
        { id: 'domain-courtside-alias', siteId: 'site-courtside', domain: 'courtside-sports.com', isPrimary: false, status: 'ACTIVE' },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];

  const categories: CategoryRecord[] = [
    category('cat-frontline-football', '足球直播', 'football-live', '中超、英超、欧冠等足球赛事直播与新闻。', 10),
    category('cat-frontline-basketball', '篮球直播', 'basketball-live', 'NBA、CBA 与国际篮球赛事直播资讯。', 20),
    category('cat-frontline-replay', '赛事录像', 'match-replay', '热门比赛录像、集锦和回放入口。', 30),
    category('cat-frontline-news', '体育新闻', 'sports-news', '综合体育新闻、球队动态和赛前观察。', 40),
    category('cat-courtside-nba', 'NBA 资讯', 'nba-news', 'NBA 新闻、球队动态、球星表现和赛程。', 50),
    category('cat-courtside-cba', 'CBA 赛程', 'cba-schedule', 'CBA 常规赛、季后赛和直播信息。', 60),
    category('cat-courtside-football', '足球赛程', 'football-schedule', '热门足球赛事赛程和直播入口。', 70),
    category('cat-courtside-analysis', '赛前分析', 'match-analysis', '赛前情报、数据趋势和对阵看点。', 80),
  ];

  const tags: TagRecord[] = [
    tag('tag-frontline-champions', 'site-frontline', '欧冠', 'champions-league'),
    tag('tag-frontline-cba', 'site-frontline', 'CBA', 'cba'),
    tag('tag-courtside-nba', 'site-courtside', 'NBA', 'nba'),
    tag('tag-courtside-derby', 'site-courtside', '德比', 'derby'),
  ];

  const news = createNews(categories);
  const promotionTypes = createPromotionTypes(sites);
  const promotionLinks = createPromotionLinks(categories, promotionTypes);
  const urlConfigs = createUrlConfigs(categories);
  const tdkConfigs = createTdkConfigs(categories);
  const leagues = createLeagues();
  const teams = createTeams();
  const matches = createMatches(leagues, teams);
  const liveProducts = createLiveProducts();
  const signalDomains = createSignalDomains();
  const signalSourceNames = createSignalSourceNames();
  const scheduledTasks = createScheduledTasks();

  return {
    adminUsers,
    adminRoles,
    adminPermissions,
    adminSessions: [],
    groups,
    templates,
    sites,
    urlConfigs,
    tdkConfigs,
    categories,
    tags,
    news,
    liveReplays: [],
    promotionTypes,
    promotionLinks,
    leagues,
    teams,
    matches,
    liveProducts,
    signalDomains,
    signalSourceNames,
    scheduledTasks,
    invalidationJobs: [],
    auditLogs: [],
    securitySettings: {
      id: 'security-settings',
      adminSafeEntry: null,
      totpRequired: false,
      totpSecret: null,
      adminManaged: false,
      updatedAt: now,
    },
  };
}

function createAdminPermissions(): AdminPermissionRecord[] {
  const permissions = [
    ['perm-admin-access', 'admin:access', '进入后台', '账号权限', '允许登录并访问体育站群后台。'],
    ['perm-security-write', 'security:write', '安全设置', '账号权限', '修改后台安全入口和 Google 验证器配置。'],
    ['perm-user-read', 'user:read', '查看用户', '账号权限', '查看后台用户列表和用户资料。'],
    ['perm-user-write', 'user:write', '管理用户', '账号权限', '新增、编辑、禁用和删除后台用户。'],
    ['perm-role-read', 'role:read', '查看角色', '账号权限', '查看角色和角色授权范围。'],
    ['perm-role-write', 'role:write', '管理角色', '账号权限', '新增、编辑和删除角色。'],
    ['perm-permission-read', 'permission:read', '查看权限', '账号权限', '查看权限动作和权限分组。'],
    ['perm-permission-write', 'permission:write', '管理权限', '账号权限', '新增、编辑和删除权限动作。'],
    ['perm-site-write', 'site:write', '站点与分组', '站点管理', '管理站点、站点分组和站点状态。'],
    ['perm-template-write', 'template:write', '模板管理', '模板与 SEO', '管理受控模板包记录。'],
    ['perm-url-config-write', 'url-config:write', 'URL 配置', '模板与 SEO', '管理前台 URL 规则。'],
    ['perm-tdk-config-write', 'tdk-config:write', 'TDK 配置', '模板与 SEO', '管理标题、关键词和描述模板。'],
    ['perm-category-write', 'category:write', '栏目管理', '内容管理', '管理栏目、子栏目、语言和排序。'],
    ['perm-news-write', 'news:write', '新闻管理', '内容管理', '新增、编辑和删除新闻。'],
    ['perm-news-publish', 'news:publish', '发布新闻', '内容管理', '发布新闻并触发缓存失效任务。'],
    ['perm-sports-write', 'sports:write', '赛事数据', '体育赛事', '管理赛事、联赛和球队。'],
    ['perm-live-write', 'live:write', '直播产品', '直播与信号', '管理直播产品和跳转配置。'],
    ['perm-signal-write', 'signal:write', '信号配置', '直播与信号', '管理信号域名和信号源名称。'],
    ['perm-promotion-read', 'promotion:read', '查看推广', '推广管理', '查看各站点、栏目和展示位的推广配置。'],
    ['perm-promotion-write', 'promotion:write', '管理推广', '推广管理', '管理推广类型、链接、权重、时间和投放位置。'],
    ['perm-task-read', 'task:read', '查看计划任务', '系统审计', '查看每日自动拉取任务、执行结果和下次运行时间。'],
    ['perm-task-write', 'task:write', '管理计划任务', '系统审计', '新增、编辑、暂停、删除和手动执行计划任务。'],
    ['perm-cache-read', 'cache:read', '缓存任务', '系统审计', '查看缓存失效任务。'],
    ['perm-audit-read', 'audit:read', '审计日志', '系统审计', '查看后台操作审计日志。'],
  ] as const;

  return permissions.map(([id, action, label, group, description]) => ({
    id,
    action,
    label,
    group,
    description,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  }));
}

function createAdminRoles(): AdminRoleRecord[] {
  const allPermissions = createAdminPermissions().map((permission) => permission.action);

  return [
    {
      id: 'role-super-admin',
      key: 'super-admin',
      name: '超级管理员',
      description: '拥有后台全部账号、内容、SEO、赛事和系统审计权限。',
      status: 'ACTIVE',
      permissionActions: allPermissions,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'role-site-admin',
      key: 'site-admin',
      name: '站点管理员',
      description: '负责站点、栏目、新闻、赛事、直播和缓存任务。',
      status: 'ACTIVE',
      permissionActions: [
        'admin:access',
        'site:write',
        'category:write',
        'news:write',
        'news:publish',
        'sports:write',
        'live:write',
        'signal:write',
        'promotion:read',
        'promotion:write',
        'task:read',
        'task:write',
        'cache:read',
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'role-editor',
      key: 'editor',
      name: '内容编辑',
      description: '负责栏目和新闻编辑发布。',
      status: 'ACTIVE',
      permissionActions: ['admin:access', 'category:write', 'news:write', 'news:publish'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'role-seo-manager',
      key: 'seo-manager',
      name: 'SEO 管理',
      description: '负责 URL、TDK、缓存任务和审计查看。',
      status: 'ACTIVE',
      permissionActions: [
        'admin:access',
        'url-config:write',
        'tdk-config:write',
        'promotion:read',
        'promotion:write',
        'task:read',
        'cache:read',
        'audit:read',
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'role-viewer',
      key: 'viewer',
      name: '只读观察员',
      description: '只能登录后台查看公开运营面板。',
      status: 'ACTIVE',
      permissionActions: ['admin:access'],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function createScheduledTasks(): ScheduledTaskRecord[] {
  return [
    {
      id: 'task-daily-sports-sync',
      type: 'SPORTS_SYNC',
      name: '每日赛事数据同步',
      status: 'ACTIVE',
      scheduleTime: '03:10',
      timezone: 'Asia/Shanghai',
      lastRunAt: null,
      nextRunAt: null,
      lastStatus: 'IDLE',
      lastMessage: '每天自动拉取赛事接口，写入联赛、球队和赛事。',
      runCount: 0,
      failureCount: 0,
      config: {
        sourceUrl: 'https://jk.jktgedc.com/app/encryptionMatchOther?check_type=17',
        typeId: '17',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-daily-dongqiudi-news',
      type: 'NEWS_CRAWL',
      name: '每日懂球帝新闻采集',
      status: 'ACTIVE',
      scheduleTime: '03:30',
      timezone: 'Asia/Shanghai',
      lastRunAt: null,
      nextRunAt: null,
      lastStatus: 'IDLE',
      lastMessage: '每天采集懂球帝新闻详情正文，正文过短或解析失败会自动跳过。',
      runCount: 0,
      failureCount: 0,
      config: {
        sourceUrl: 'http://api.dongqiudi.com/app/tabs/iphone/1.json',
        siteId: 'site-frontline',
        categoryId: 'cat-frontline-news',
        limit: 10,
        minContentChars: 160,
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-daily-live-replay-sync',
      type: 'LIVE_REPLAY_SYNC',
      name: '每日直播录像采集',
      status: 'ACTIVE',
      scheduleTime: '03:50',
      timezone: 'Asia/Shanghai',
      lastRunAt: null,
      nextRunAt: null,
      lastStatus: 'IDLE',
      lastMessage: '每天自动采集直播录像接口，写入录像栏目并生成本地详情链接。',
      runCount: 0,
      failureCount: 0,
      config: {
        sourceUrl: 'https://lmaappi.zhongxun132.cn/api/live/reply_history',
        siteId: 'site-frontline',
        categoryId: 'cat-frontline-replay',
        limit: 30,
      },
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function createAdminUsers(): AdminUserRecord[] {
  return [
    {
      id: 'user-admin',
      username: 'admin',
      email: 'admin@sports.local',
      displayName: '总后台管理员',
      passwordHash: hashPassword('password123', 'sports-admin-seed'),
      status: 'ACTIVE',
      roleIds: ['role-super-admin'],
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-editor',
      username: 'editor',
      email: 'editor@sports.local',
      displayName: '赛事编辑',
      passwordHash: hashPassword('editor123', 'sports-editor-seed'),
      status: 'ACTIVE',
      roleIds: ['role-editor'],
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-seo',
      username: 'seo',
      email: 'seo@sports.local',
      displayName: 'SEO 运营',
      passwordHash: hashPassword('seo12345', 'sports-seo-seed'),
      status: 'ACTIVE',
      roleIds: ['role-seo-manager'],
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function category(
  id: string,
  name: string,
  slug: string,
  description: string,
  sortOrder: number,
): CategoryRecord {
  return {
    id,
    name,
    slug,
    language: 'zh-CN',
    status: 'ACTIVE',
    description,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

function tag(id: string, siteId: string, name: string, slug: string): TagRecord {
  return {
    id,
    siteId,
    name,
    slug,
    createdAt: now,
    updatedAt: now,
  };
}

function createNews(categories: CategoryRecord[]): NewsArticleRecord[] {
  const topics = [
    ['site-frontline', 'football-live', '海港主场压迫提速，边路轮换成为争冠变量', 'harbor-pressing-wide-rotation'],
    ['site-frontline', 'basketball-live', '广东男篮加练转换进攻，新援首秀时间基本确定', 'guangdong-transition-new-signing'],
    ['site-frontline', 'match-replay', '欧冠半决赛经典回放：高位逼抢如何改变比赛节奏', 'champions-semi-pressing-replay'],
    ['site-frontline', 'sports-news', '国家队集训名单更新，年轻中场进入重点观察区', 'national-team-young-midfield'],
    ['site-frontline', 'football-live', '英超收官战直播前瞻：两个边卫的推进路线最关键', 'premier-league-final-fullbacks'],
    ['site-frontline', 'basketball-live', '总决赛 G1 观察：篮板保护决定系列赛开局', 'finals-game-one-rebound'],
    ['site-frontline', 'match-replay', '世界杯预选赛回放：定位球防守暴露三处细节', 'world-cup-qualifier-set-piece'],
    ['site-frontline', 'sports-news', '体能教练解读密集赛程：恢复日比训练日更重要', 'fitness-coach-recovery-day'],
    ['site-frontline', 'football-live', '中超焦点战临场名单出炉，两队均保留后手', 'csl-focus-lineup-depth'],
    ['site-frontline', 'sports-news', '多队开启夏窗评估，年轻门将行情升温', 'summer-window-young-goalkeepers'],
    ['site-courtside', 'nba-news', '凯尔特人调整二阵容，外线防守强度继续提升', 'celtics-second-unit-defense'],
    ['site-courtside', 'cba-schedule', '辽宁队客场赛程密集，轮换深度迎来考验', 'liaoning-road-schedule-depth'],
    ['site-courtside', 'football-schedule', '西甲争四赛程更新，两场直接对话影响排名', 'laliga-top-four-schedule'],
    ['site-courtside', 'match-analysis', '数据前瞻：湖人需要提高弱侧三分回应速度', 'lakers-weak-side-three-preview'],
    ['site-courtside', 'nba-news', '掘金内线配合稳定，半场阵地战效率领跑联盟', 'nuggets-halfcourt-efficiency'],
    ['site-courtside', 'cba-schedule', '新疆队连续主场开打，防守篮板是第一指标', 'xinjiang-home-stand-rebounds'],
    ['site-courtside', 'football-schedule', '德比战开球时间确认，安保和交通方案同步发布', 'derby-kickoff-confirmed'],
    ['site-courtside', 'match-analysis', '战术板：高位挡拆后的短顺下正在改变进攻空间', 'short-roll-spacing-analysis'],
    ['site-courtside', 'nba-news', '新秀榜更新：两名后卫凭防守进入前十', 'rookie-ladder-defensive-guards'],
    ['site-courtside', 'match-analysis', '赛前情报：连续客场球队如何管理最后五分钟体能', 'road-team-clutch-stamina'],
  ] as const;

  return topics.map(([siteId, categorySlug, title, slug], index) => {
    const categoryRecord = categories.find((candidate) => candidate.slug === categorySlug);

    if (!categoryRecord) {
      throw new Error(`Missing category ${siteId}/${categorySlug}`);
    }

    const publishedAt = new Date(now.getTime() - index * 3600 * 1000);
    const summary = `${title}。本文从阵容、节奏、数据和直播信息四个角度整理核心看点，帮助球迷快速了解赛前变化。`;

    return {
      id: `news-${index + 1}`,
      siteId,
      categoryId: categoryRecord.id,
      category: categoryRecord,
      title,
      slug,
      summary,
      content: [
        `${title}。本场相关消息显示，教练组在训练中重点强调攻防转换和局部对抗，首发选择仍会根据临场身体状态微调。`,
        '从数据看，最近三场比赛双方在前十五分钟的压迫强度差异明显，谁能更早建立节奏，谁就更容易把比赛带入熟悉区间。',
        '直播信息和赛程安排已经同步更新，本站会在赛前继续整理双方名单、伤停动态、历史交锋和关键球员状态。',
      ].join('\n\n'),
      coverImageUrl: coverImages[index % coverImages.length],
      coverImageWidth: 1200,
      coverImageHeight: 800,
      author: index % 3 === 0 ? '前线编辑部' : '赛事观察员',
      sourceName: '本站原创',
      status: 'PUBLISHED',
      isTop: index % 7 === 0,
      publishedAt,
      createdAt: publishedAt,
      updatedAt: publishedAt,
    };
  });
}

function createPromotionTypes(sites: SiteRecord[]): PromotionTypeRecord[] {
  const siteName = (id: string) => sites.find((site) => site.id === id)?.name ?? id;

  return [
    promotionType(
      'promo-type-frontline-home-hero',
      'site-frontline',
      'frontline-home-live-button',
      `${siteName('site-frontline')} 首页直播按钮`,
      'HOME_HERO',
      'BUTTON',
      10,
      '首页首屏直播入口，适合主推赛事。',
    ),
    promotionType(
      'promo-type-frontline-category-banner',
      'site-frontline',
      'frontline-category-banner',
      `${siteName('site-frontline')} 栏目顶部横幅`,
      'CATEGORY_TOP',
      'IMAGE_BANNER',
      20,
      '栏目顶部图片推广，可按栏目分别配置。',
    ),
    promotionType(
      'promo-type-frontline-news-inline',
      'site-frontline',
      'frontline-news-inline-text',
      `${siteName('site-frontline')} 正文内链推荐`,
      'NEWS_INLINE',
      'TEXT_LINK',
      30,
      '新闻正文中段文字推广。',
    ),
    promotionType(
      'promo-type-courtside-after-news',
      'site-courtside',
      'courtside-home-score-card',
      `${siteName('site-courtside')} 首页赛程卡片`,
      'HOME_AFTER_NEWS',
      'CARD',
      10,
      '首页资讯列表后方的赛程/直播推广卡片。',
    ),
    promotionType(
      'promo-type-courtside-category-banner',
      'site-courtside',
      'courtside-category-banner',
      `${siteName('site-courtside')} 栏目顶部横幅`,
      'CATEGORY_TOP',
      'IMAGE_BANNER',
      20,
      '篮球垂直站栏目顶部推广。',
    ),
    promotionType(
      'promo-type-courtside-global-float',
      'site-courtside',
      'courtside-global-float',
      `${siteName('site-courtside')} 全站浮动入口`,
      'GLOBAL_FLOAT',
      'FLOATING',
      40,
      '全站右下角浮动推广入口。',
    ),
  ];
}

function promotionType(
  id: string,
  siteId: string,
  key: string,
  name: string,
  slot: PromotionTypeRecord['slot'],
  renderStyle: PromotionTypeRecord['renderStyle'],
  sortOrder: number,
  description: string,
): PromotionTypeRecord {
  return {
    id,
    siteId,
    key,
    name,
    slot,
    renderStyle,
    description,
    status: 'ACTIVE',
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

function createPromotionLinks(
  categories: CategoryRecord[],
  promotionTypes: PromotionTypeRecord[],
): PromotionLinkRecord[] {
  const categoryId = (_siteId: string, slug: string) => {
    const categoryRecord = categories.find((candidate) => candidate.slug === slug);
    if (!categoryRecord) {
      throw new Error(`Missing promotion category ${_siteId}/${slug}`);
    }
    return categoryRecord.id;
  };
  const typeId = (id: string) => {
    const record = promotionTypes.find((candidate) => candidate.id === id);
    if (!record) {
      throw new Error(`Missing promotion type ${id}`);
    }
    return record.id;
  };

  return [
    promotionLink({
      id: 'promo-link-frontline-home-live',
      siteId: 'site-frontline',
      promotionTypeId: typeId('promo-type-frontline-home-hero'),
      title: '今晚焦点战高清直播',
      subtitle: '开赛前 30 分钟更新信号，支持多线路切换。',
      targetUrl: 'https://live.xinghuosports.com/go/frontline-home',
      weight: 180,
      sortOrder: 10,
    }),
    promotionLink({
      id: 'promo-link-frontline-football-banner',
      siteId: 'site-frontline',
      categoryId: categoryId('site-frontline', 'football-live'),
      promotionTypeId: typeId('promo-type-frontline-category-banner'),
      title: '足球直播专题入口',
      subtitle: '英超、中超、欧冠热门场次集中整理。',
      targetUrl: 'https://live.xinghuosports.com/go/football',
      imageUrl: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80',
      weight: 160,
      sortOrder: 20,
    }),
    promotionLink({
      id: 'promo-link-frontline-basketball-inline',
      siteId: 'site-frontline',
      categoryId: categoryId('site-frontline', 'basketball-live'),
      promotionTypeId: typeId('promo-type-frontline-news-inline'),
      title: '篮球赛事即时信号',
      subtitle: 'NBA、CBA 赛前信号和录像入口同步更新。',
      targetUrl: 'https://live.xinghuosports.com/go/basketball',
      weight: 130,
      sortOrder: 30,
    }),
    promotionLink({
      id: 'promo-link-courtside-home-card',
      siteId: 'site-courtside',
      promotionTypeId: typeId('promo-type-courtside-after-news'),
      title: 'NBA 今日直播与赛前数据',
      subtitle: '热门球队赛程、伤停和直播入口一屏查看。',
      targetUrl: 'https://watch.fengchisports.com/go/nba-today',
      weight: 170,
      sortOrder: 10,
    }),
    promotionLink({
      id: 'promo-link-courtside-nba-banner',
      siteId: 'site-courtside',
      categoryId: categoryId('site-courtside', 'nba-news'),
      promotionTypeId: typeId('promo-type-courtside-category-banner'),
      title: 'NBA 季后赛专题',
      subtitle: '球队动态、战术分析和直播提醒。',
      targetUrl: 'https://watch.fengchisports.com/go/nba-playoffs',
      imageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
      weight: 190,
      sortOrder: 20,
    }),
    promotionLink({
      id: 'promo-link-courtside-cba-float',
      siteId: 'site-courtside',
      categoryId: categoryId('site-courtside', 'cba-schedule'),
      promotionTypeId: typeId('promo-type-courtside-global-float'),
      title: 'CBA 看球入口',
      subtitle: '主客场赛程和高清直播线路。',
      targetUrl: 'https://watch.fengchisports.com/go/cba',
      weight: 120,
      sortOrder: 40,
    }),
  ];
}

function promotionLink(input: {
  id: string;
  siteId: string;
  categoryId?: string;
  promotionTypeId: string;
  title: string;
  subtitle: string;
  targetUrl: string;
  imageUrl?: string;
  weight: number;
  sortOrder: number;
}): PromotionLinkRecord {
  return {
    id: input.id,
    siteId: input.siteId,
    categoryId: input.categoryId,
    promotionTypeId: input.promotionTypeId,
    title: input.title,
    subtitle: input.subtitle,
    targetUrl: input.targetUrl,
    imageUrl: input.imageUrl,
    relNofollow: true,
    relSponsored: true,
    openInNewTab: true,
    device: 'ALL',
    weight: input.weight,
    status: 'ACTIVE',
    sortOrder: input.sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

function createUrlConfigs(categories: CategoryRecord[]): UrlConfigRecord[] {
  const rules: UrlConfigRecord['rules'] = [
    {
      id: 'rule-url-home',
      categoryId: '',
      pageType: 'HOME',
      pattern: '/',
      detailRules: [],
    },
    {
      id: 'rule-url-league',
      categoryId: '',
      pageType: 'LEAGUE',
      pattern: '/league/{leagueSlug}.html',
      detailRules: [],
    },
    ...categories.map((category) => buildUrlRuleForCategory(category)),
  ];

  return [
    {
      id: 'url-default-rules',
      siteId: null,
      categoryIds: categories.map((category) => category.id),
      rules,
      name: '默认全站 URL 规则',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      description: '一个配置内维护首页、直播、新闻、录像栏目的栏目链接与内页链接规则。',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function createTdkConfigs(categories: CategoryRecord[]): TdkConfigRecord[] {
  const rules: TdkConfigRecord['rules'] = [
    {
      id: 'rule-tdk-home',
      categoryId: '',
      pageType: 'HOME',
      titleTemplate: '{siteName} - 今日体育新闻、直播赛程与赛事分析',
      keywordsTemplate: '{siteName},体育新闻,赛事直播,足球赛程,篮球赛程',
      descriptionTemplate: '{siteName}实时整理足球、篮球、热门赛事、球队动态和直播信息，提供服务端渲染的高质量体育资讯页面。',
      detailRules: [],
    },
    {
      id: 'rule-tdk-league',
      categoryId: '',
      pageType: 'LEAGUE',
      titleTemplate: '{leagueName}直播赛程_{siteName}',
      keywordsTemplate: '{leagueName}直播,{leagueName}赛程,{siteName}',
      descriptionTemplate: '{siteName}提供{leagueName}直播赛程、比赛时间、对阵信息和相关赛事入口。',
      detailRules: [],
    },
    ...categories.map((category) => buildTdkRuleForCategory(category)),
  ];

  return [
    {
      id: 'tdk-default-rules',
      siteId: null,
      categoryIds: categories.map((category) => category.id),
      rules,
      name: '默认全站 TDK 规则',
      status: 'ACTIVE',
      pageType: 'HOME',
      titleTemplate: '{siteName} - 今日体育新闻、直播赛程与赛事分析',
      keywordsTemplate: '{siteName},体育新闻,赛事直播,足球赛程,篮球赛程',
      descriptionTemplate: '{siteName}实时整理足球、篮球、热门赛事、球队动态和直播信息，提供服务端渲染的高质量体育资讯页面。',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function buildUrlRuleForCategory(category: CategoryRecord): UrlConfigRecord['rules'][number] {
  const pageType = inferCategoryListPageType(category);
  const detailPageType = detailPageTypeForCategory(category);
  const config = urlPatternForPageTypes(pageType, detailPageType);

  return {
    id: `rule-url-${category.id}`,
    categoryId: category.id,
    pageType,
    pattern: config.pattern,
    detailRules: [
      {
        id: `rule-url-detail-${category.id}`,
        label: `${category.name}内页`,
        pageType: detailPageType,
        pattern: config.detailPattern,
      },
    ],
  };
}

function buildTdkRuleForCategory(category: CategoryRecord): TdkConfigRecord['rules'][number] {
  const pageType = inferCategoryListPageType(category);
  const detailPageType = detailPageTypeForCategory(category);
  const templates = tdkTemplatesForPageTypes(pageType, detailPageType);

  return {
    id: `rule-tdk-${category.id}`,
    categoryId: category.id,
    pageType,
    titleTemplate: templates.titleTemplate,
    keywordsTemplate: templates.keywordsTemplate,
    descriptionTemplate: templates.descriptionTemplate,
    detailRules: [
      {
        id: `rule-tdk-detail-${category.id}`,
        label: `${category.name}内页`,
        pageType: detailPageType,
        titleTemplate: templates.detailTitleTemplate,
        keywordsTemplate: templates.detailKeywordsTemplate,
        descriptionTemplate: templates.detailDescriptionTemplate,
      },
    ],
  };
}

function urlPatternForPageTypes(pageType: PageType, detailPageType: PageType): { pattern: string; detailPattern: string } {
  if (pageType === 'MATCH_CATEGORY') {
    return { pattern: '/zhibo/{categorySlug}.html', detailPattern: '/zhibo/{categorySlug}/{newsSlug}.html' };
  }
  if (pageType === 'VIDEO_CATEGORY') {
    return { pattern: '/video/{categorySlug}.html', detailPattern: '/video/{categorySlug}/{videoSlug}.html' };
  }
  if (detailPageType === 'VIDEO_DETAIL') {
    return { pattern: '/news/{categorySlug}.html', detailPattern: '/video/{categorySlug}/{videoSlug}.html' };
  }
  return { pattern: '/news/{categorySlug}.html', detailPattern: '/news/{categorySlug}/{newsSlug}.html' };
}

function tdkTemplatesForPageTypes(
  pageType: PageType,
  detailPageType: PageType,
): {
  titleTemplate: string;
  keywordsTemplate: string;
  descriptionTemplate: string;
  detailTitleTemplate: string;
  detailKeywordsTemplate: string;
  detailDescriptionTemplate: string;
} {
  if (pageType === 'MATCH_CATEGORY') {
    return {
      titleTemplate: '{columnName}_高清直播在线_{siteName}',
      keywordsTemplate: '{columnName},高清直播,{siteName}',
      descriptionTemplate: '{siteName}提供{columnName}、赛程、球队动态和多线路直播入口。',
      detailTitleTemplate: '{title}_{columnName}_{siteName}',
      detailKeywordsTemplate: '{title},{columnName},{siteName}',
      detailDescriptionTemplate: '{summary}',
    };
  }
  if (pageType === 'VIDEO_CATEGORY' || detailPageType === 'VIDEO_DETAIL') {
    return {
      titleTemplate: '{columnName}_比赛回放_{siteName}',
      keywordsTemplate: '{columnName},比赛回放,{siteName}',
      descriptionTemplate: '{siteName}整理{columnName}录像回放、比赛集锦和赛后资讯。',
      detailTitleTemplate: '{title}录像回放_{siteName}',
      detailKeywordsTemplate: '{title}录像,{title}回放,{siteName}',
      detailDescriptionTemplate: '观看{title}录像回放、比赛集锦和赛后数据。',
    };
  }
  return {
    titleTemplate: '最新{columnName}-{siteName}',
    keywordsTemplate: '{columnName},体育新闻,{siteName}',
    descriptionTemplate: '{siteName}{columnName}栏目提供最新体育资讯、赛事动态和直播信息。',
    detailTitleTemplate: '{title}_{siteName}',
    detailKeywordsTemplate: '{title},{columnName},{siteName}',
    detailDescriptionTemplate: '{summary}',
  };
}

function categoryIdsForConfig(categories: CategoryRecord[], pageType: PageType): string[] {
  return categories
    .filter((category) => categoryMatchesPageType(category, pageType))
    .map((category) => category.id);
}

function urlRulesForCategories(
  categories: CategoryRecord[],
  pageType: PageType,
  pattern: string,
  detailPageType?: PageType,
  detailPattern?: string,
): UrlConfigRecord['rules'] {
  return categoryIdsForConfig(categories, pageType).map((categoryId) => ({
    id: `rule-url-${pageType.toLowerCase()}-${categoryId}`,
    categoryId,
    pageType,
    pattern,
    detailRules:
      detailPageType && detailPattern
        ? [
            {
              id: `rule-url-${detailPageType.toLowerCase()}-${categoryId}`,
              label: `${pageType}内页`,
              pageType: detailPageType,
              pattern: detailPattern,
            },
          ]
        : [],
  }));
}

function tdkRulesForCategories(
  categories: CategoryRecord[],
  template:
    | Pick<TdkConfigRecord, 'id' | 'pageType' | 'titleTemplate' | 'keywordsTemplate' | 'descriptionTemplate'>
    | (Pick<TdkConfigRecord, 'id' | 'pageType' | 'titleTemplate' | 'keywordsTemplate' | 'descriptionTemplate'> & {
        detailPageType: PageType;
        detailTitleTemplate: string;
        detailKeywordsTemplate?: string;
        detailDescriptionTemplate?: string;
      }),
): TdkConfigRecord['rules'] {
  const pageType = template.pageType;
  if (!pageType) {
    return [];
  }

  return categoryIdsForConfig(categories, pageType).map((categoryId) => ({
    id: `rule-${template.id}-${categoryId}`,
    categoryId,
    pageType,
    titleTemplate: template.titleTemplate ?? '',
    keywordsTemplate: template.keywordsTemplate,
    descriptionTemplate: template.descriptionTemplate,
    detailRules:
      'detailPageType' in template
        ? [
            {
              id: `rule-${template.id}-${template.detailPageType.toLowerCase()}-${categoryId}`,
              label: `${template.pageType}内页`,
              pageType: template.detailPageType,
              titleTemplate: template.detailTitleTemplate,
              keywordsTemplate: template.detailKeywordsTemplate,
              descriptionTemplate: template.detailDescriptionTemplate,
            },
          ]
        : [],
  }));
}

function categoriesForSite(categories: CategoryRecord[], siteId: string): CategoryRecord[] {
  const slugMap: Record<string, string[]> = {
    'site-frontline': ['football-live', 'basketball-live', 'match-replay', 'sports-news'],
    'site-courtside': ['nba-news', 'cba-schedule', 'football-schedule', 'match-analysis'],
  };
  const slugs = slugMap[siteId];
  return slugs?.length ? categories.filter((category) => slugs.includes(category.slug)) : categories;
}

function categoryMatchesPageType(category: CategoryRecord, pageType: PageType): boolean {
  const listPageType = inferCategoryListPageType(category);
  const detailPageType = detailPageTypeForCategory(category);

  if (pageType === 'NEWS_DETAIL') {
    return true;
  }

  return pageType === listPageType || pageType === detailPageType;
}

function detailPageTypeForCategory(category: CategoryRecord): PageType {
  const listPageType = inferCategoryListPageType(category);
  if (listPageType === 'MATCH_CATEGORY') return 'MATCH_DETAIL';
  if (listPageType === 'VIDEO_CATEGORY') return 'VIDEO_DETAIL';
  return 'NEWS_DETAIL';
}

function inferCategoryListPageType(category: CategoryRecord): PageType {
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

function createLeagues(): SportLeagueRecord[] {
  return [
    league('league-premier', 'FOOTBALL', '英格兰超级联赛', 'premier-league', 'Premier League', 'yingchao', '英国', true),
    league('league-cba', 'BASKETBALL', '中国男子篮球职业联赛', 'cba', 'CBA', 'cba', '中国', true),
  ];
}

function league(
  id: string,
  sport: 'FOOTBALL' | 'BASKETBALL',
  name: string,
  slug: string,
  englishName: string,
  pinyin: string,
  country: string,
  isHot: boolean,
): SportLeagueRecord {
  return {
    id,
    sport,
    name,
    slug,
    englishName,
    pinyin,
    country,
    isHot,
    createdAt: now,
    updatedAt: now,
  };
}

function createTeams(): SportTeamRecord[] {
  return [
    team('team-arsenal', 'FOOTBALL', 'league-premier', '阿森纳', 'arsenal', 'Arsenal', 'asenna', '英国', true),
    team('team-city', 'FOOTBALL', 'league-premier', '曼城', 'manchester-city', 'Manchester City', 'mancheng', '英国', true),
    team('team-liaoning', 'BASKETBALL', 'league-cba', '辽宁男篮', 'liaoning-flying-leopards', 'Liaoning', 'liaoning', '中国', true),
    team('team-guangdong', 'BASKETBALL', 'league-cba', '广东男篮', 'guangdong-southern-tigers', 'Guangdong', 'guangdong', '中国', true),
  ];
}

function team(
  id: string,
  sport: 'FOOTBALL' | 'BASKETBALL',
  leagueId: string,
  name: string,
  slug: string,
  englishName: string,
  pinyin: string,
  country: string,
  isHot: boolean,
): SportTeamRecord {
  return {
    id,
    sport,
    leagueId,
    name,
    slug,
    englishName,
    pinyin,
    country,
    isHot,
    createdAt: now,
    updatedAt: now,
  };
}

function createMatches(leagues: SportLeagueRecord[], teams: SportTeamRecord[]): SportMatchRecord[] {
  const findLeague = (id: string) => leagues.find((leagueRecord) => leagueRecord.id === id) ?? null;
  const findTeam = (id: string) => teams.find((teamRecord) => teamRecord.id === id) ?? null;

  return [
    match('match-1', 'site-frontline', 'FOOTBALL', '英超焦点战：阿森纳 vs 曼城', 'league-premier', 'team-arsenal', 'team-city', findLeague, findTeam, 1),
    match('match-2', 'site-frontline', 'BASKETBALL', 'CBA 半决赛：辽宁男篮 vs 广东男篮', 'league-cba', 'team-liaoning', 'team-guangdong', findLeague, findTeam, 2),
    match('match-3', 'site-courtside', 'FOOTBALL', '英超争冠观察：曼城 vs 阿森纳', 'league-premier', 'team-city', 'team-arsenal', findLeague, findTeam, 3),
    match('match-4', 'site-courtside', 'BASKETBALL', 'CBA 常规赛：广东男篮 vs 辽宁男篮', 'league-cba', 'team-guangdong', 'team-liaoning', findLeague, findTeam, 4),
    match('match-5', 'site-courtside', 'BASKETBALL', 'CBA 季后赛前瞻：辽宁男篮训练日', 'league-cba', 'team-liaoning', 'team-guangdong', findLeague, findTeam, 5),
  ];
}

function createLiveProducts(): LiveProductRecord[] {
  return [
    liveProduct(
      'live-product-frontline',
      '星火体育直播',
      'https://live.xinghuosports.com/jump',
      'admin',
      true,
      8,
      true,
      'replay.xinghuosports.com',
      '/room/{matchId}',
      true,
    ),
    liveProduct(
      'live-product-frontline-aux',
      '风驰体育直播',
      'https://watch.xinghuosports.com/jump',
      'admin',
      true,
      8,
      true,
      'replay.xinghuosports.com',
      '/watch/{matchId}',
      true,
    ),
    liveProduct(
      'live-product-courtside',
      '赛点体育直播',
      'https://live.fengchisports.com/jump',
      'admin',
      true,
      8,
      true,
      'replay.fengchisports.com',
      '/room/{matchId}',
      true,
    ),
    liveProduct(
      'live-product-courtside-aux',
      '绿茵体育直播',
      'https://watch.fengchisports.com/jump',
      'admin',
      true,
      8,
      true,
      'replay.fengchisports.com',
      '/watch/{matchId}',
      true,
    ),
  ];
}

function liveProduct(
  id: string,
  name: string,
  jumpUrl: string,
  ownerUserId: string,
  supportWildcard: boolean,
  wildcardLength: number,
  enableReplayJumpDomain: boolean,
  replayJumpDomain: string,
  roomSuffix: string,
  appendRoomSuffix: boolean,
): LiveProductRecord {
  return {
    id,
    name,
    jumpUrl,
    ownerUserId,
    supportWildcard,
    wildcardLength,
    enableReplayJumpDomain,
    replayJumpDomain,
    roomSuffix,
    appendRoomSuffix,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
}

function createSignalDomains(): SignalDomainRecord[] {
  return [
    signalDomain('signal-domain-main', '足球直播', 'signal.xinghuosports.com', true, 4),
    signalDomain('signal-domain-backup', '篮球直播', 'stream.xinghuosports.com', false, 0),
    signalDomain('signal-domain-basketball', '篮球直播', 'signal.fengchisports.com', true, 6),
  ];
}

function signalDomain(
  id: string,
  category: string,
  name: string,
  supportWildcard: boolean,
  wildcardPrefixCount: number,
): SignalDomainRecord {
  return {
    id,
    category,
    name,
    supportWildcard,
    wildcardPrefixCount,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
}

function createSignalSourceNames(): SignalSourceNameRecord[] {
  return [
    signalSourceName('signal-source-frontline-1', '星火体育直播'),
    signalSourceName('signal-source-frontline-2', '风驰体育直播'),
    signalSourceName('signal-source-frontline-3', '赛点体育直播'),
    signalSourceName('signal-source-frontline-4', '绿茵体育直播'),
    signalSourceName('signal-source-courtside-1', '极光体育直播'),
    signalSourceName('signal-source-courtside-2', '热浪体育直播'),
    signalSourceName('signal-source-courtside-3', '速看体育直播'),
    signalSourceName('signal-source-courtside-4', '飞越体育直播'),
  ];
}

function signalSourceName(id: string, name: string): SignalSourceNameRecord {
  return {
    id,
    name,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
}

function match(
  id: string,
  siteId: string,
  sport: 'FOOTBALL' | 'BASKETBALL',
  title: string,
  leagueId: string,
  homeTeamId: string,
  awayTeamId: string,
  findLeague: (id: string) => SportLeagueRecord | null,
  findTeam: (id: string) => SportTeamRecord | null,
  dayOffset: number,
): SportMatchRecord {
  return {
    id,
    siteId,
    sport,
    title,
    slug: title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    leagueId,
    league: findLeague(leagueId),
    homeTeamId,
    homeTeam: findTeam(homeTeamId),
    awayTeamId,
    awayTeam: findTeam(awayTeamId),
    isTop: dayOffset < 3,
    status: 'SCHEDULED',
    startTime: new Date(now.getTime() + dayOffset * 86400 * 1000),
    liveUrl: 'https://live.xinghuosports.com/room/{matchId}',
    createdAt: now,
    updatedAt: now,
  };
}
