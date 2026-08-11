export type SiteStatus = 'ACTIVE' | 'DISABLED' | 'MAINTENANCE';
export type SiteProtocol = 'http' | 'https';
export type PublishStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';
export type SeoIndexStatus = 'INDEX' | 'NOINDEX' | 'FOLLOW_ONLY';
export type SportType = 'FOOTBALL' | 'BASKETBALL';
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED' | 'POSTPONED';
export type AdminUserStatus = 'ACTIVE' | 'DISABLED';
export type PromotionStatus = 'ACTIVE' | 'DISABLED';
export type PromotionRenderStyle = 'TEXT_LINK' | 'IMAGE_BANNER' | 'BUTTON' | 'CARD' | 'FLOATING';
export type PromotionSlot =
  | 'HOME_HERO'
  | 'HOME_AFTER_NEWS'
  | 'CATEGORY_TOP'
  | 'CATEGORY_SIDEBAR'
  | 'NEWS_TOP'
  | 'NEWS_INLINE'
  | 'NEWS_BOTTOM'
  | 'GLOBAL_FLOAT';
export type PromotionDevice = 'ALL' | 'DESKTOP' | 'MOBILE';
export type ScheduledTaskType = 'SPORTS_SYNC' | 'NEWS_CRAWL' | 'LIVE_REPLAY_SYNC';
export type ScheduledTaskStatus = 'ACTIVE' | 'PAUSED';
export type ScheduledTaskRunStatus = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export type AdminPermissionAction =
  | 'admin:access'
  | 'user:read'
  | 'user:write'
  | 'role:read'
  | 'role:write'
  | 'permission:read'
  | 'permission:write'
  | 'site:write'
  | 'template:write'
  | 'url-config:write'
  | 'tdk-config:write'
  | 'category:write'
  | 'news:write'
  | 'news:publish'
  | 'sports:write'
  | 'live:write'
  | 'signal:write'
  | 'promotion:read'
  | 'promotion:write'
  | 'task:read'
  | 'task:write'
  | 'cache:read'
  | 'audit:read';

export type PageType =
  | 'HOME'
  | 'NEWS_CATEGORY'
  | 'NEWS_DETAIL'
  | 'MATCH_CATEGORY'
  | 'MATCH_DETAIL'
  | 'VIDEO_CATEGORY'
  | 'VIDEO_DETAIL'
  | 'TAG'
  | 'TEAM'
  | 'LEAGUE'
  | 'LIVE_ROOM'
  | 'SEARCH';

export type SiteDomainRecord = {
  id: string;
  siteId: string;
  domain: string;
  isPrimary: boolean;
  status: string;
};

export type AdminPermissionRecord = {
  id: string;
  action: AdminPermissionAction | string;
  label: string;
  group: string;
  description?: string | null;
  status: AdminUserStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminRoleRecord = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  status: AdminUserStatus;
  permissionActions: Array<AdminPermissionAction | string>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type AdminUserRecord = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  passwordHash: string;
  status: AdminUserStatus;
  roleIds: string[];
  roles?: AdminRoleRecord[];
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type AdminUserPublicRecord = Omit<AdminUserRecord, 'passwordHash'> & {
  permissions: Array<AdminPermissionAction | string>;
};

export type AdminSessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date;
};

export type SiteGroupRecord = {
  id: string;
  name: string;
  status: string;
  remark?: string | null;
  createdById?: string | null;
  newsUpdateCount: number;
  liveProductIds?: string[];
  liveProductName?: string | null;
  liveProductNames?: string[];
  enableDeviceSignalCheck?: boolean;
  pcSignalSourceEnabled?: boolean;
  mobileSignalSourceEnabled?: boolean;
  randomSignalSourceEnabled?: boolean;
  randomProductNames?: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type TemplateRecord = {
  id: string;
  name: string;
  key: string;
  folder: string;
  author?: string | null;
  coverUrl?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SiteRecord = {
  id: string;
  groupId?: string | null;
  group?: SiteGroupRecord | null;
  name: string;
  primaryDomain: string;
  primaryProtocol?: SiteProtocol;
  status: SiteStatus;
  templateId?: string | null;
  template?: TemplateRecord | null;
  urlConfigId?: string | null;
  tdkConfigId?: string | null;
  newsUpdateCount?: number;
  showSignalSources: boolean;
  seoTitle?: string | null;
  seoKeywords?: string | null;
  seoDescription?: string | null;
  seoIndexStatus: SeoIndexStatus;
  analyticsCode?: string | null;
  baiduPushToken?: string | null;
  baiduVerifyCode?: string | null;
  remark?: string | null;
  domains: SiteDomainRecord[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type UrlRuleRecord = {
  id: string;
  categoryId: string;
  pageType: PageType;
  pattern: string;
  detailRules?: UrlDetailRuleRecord[];
};

export type UrlDetailRuleRecord = {
  id: string;
  label: string;
  pageType: PageType;
  pattern: string;
};

export type UrlConfigRecord = {
  id: string;
  siteId?: string | null;
  rules: UrlRuleRecord[];
  categoryIds?: string[];
  name: string;
  status: string;
  pageType?: PageType;
  pattern?: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TdkRuleRecord = {
  id: string;
  categoryId: string;
  pageType: PageType;
  titleTemplate: string;
  keywordsTemplate?: string | null;
  descriptionTemplate?: string | null;
  detailRules?: TdkDetailRuleRecord[];
};

export type TdkDetailRuleRecord = {
  id: string;
  label: string;
  pageType: PageType;
  titleTemplate: string;
  keywordsTemplate?: string | null;
  descriptionTemplate?: string | null;
};

export type TdkConfigRecord = {
  id: string;
  siteId?: string | null;
  rules: TdkRuleRecord[];
  categoryIds?: string[];
  name: string;
  status: string;
  pageType?: PageType;
  titleTemplate?: string;
  keywordsTemplate?: string | null;
  descriptionTemplate?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryRecord = {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
  language: string;
  status: string;
  description?: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type TagRecord = {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NewsArticleRecord = {
  id: string;
  siteId: string;
  categoryId: string;
  category?: CategoryRecord;
  title: string;
  slug: string;
  summary?: string | null;
  content: string;
  coverImageUrl?: string | null;
  coverImageWidth?: number | null;
  coverImageHeight?: number | null;
  author?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  status: PublishStatus;
  isTop: boolean;
  publishedAt?: Date | null;
  seoTitle?: string | null;
  seoKeywords?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  tags?: TagRecord[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type LiveReplayRecord = {
  id: string;
  siteId: string;
  categoryId: string;
  title: string;
  slug: string;
  createTime: Date;
  homeTeam: string;
  awayTeam: string;
  playUrl: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type PromotionTypeRecord = {
  id: string;
  siteId?: string | null;
  key: string;
  name: string;
  slot: PromotionSlot;
  renderStyle: PromotionRenderStyle;
  description?: string | null;
  status: PromotionStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type PromotionLinkRecord = {
  id: string;
  siteId: string;
  categoryId?: string | null;
  promotionTypeId: string;
  promotionType?: PromotionTypeRecord | null;
  title: string;
  subtitle?: string | null;
  targetUrl: string;
  imageUrl?: string | null;
  relNofollow: boolean;
  relSponsored: boolean;
  openInNewTab: boolean;
  device: PromotionDevice;
  weight: number;
  startAt?: Date | null;
  endAt?: Date | null;
  status: PromotionStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type SportLeagueRecord = {
  id: string;
  sport: SportType;
  name: string;
  slug: string;
  englishName?: string | null;
  pinyin?: string | null;
  logoUrl?: string | null;
  country?: string | null;
  isHot: boolean;
  externalSource?: string | null;
  externalId?: string | null;
  lastSyncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SportTeamRecord = {
  id: string;
  sport: SportType;
  leagueId?: string | null;
  name: string;
  slug: string;
  englishName?: string | null;
  pinyin?: string | null;
  country?: string | null;
  logoUrl?: string | null;
  isHot: boolean;
  externalSource?: string | null;
  externalId?: string | null;
  lastSyncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SportMatchRecord = {
  id: string;
  siteId?: string | null;
  sport: SportType;
  title: string;
  slug?: string | null;
  leagueId?: string | null;
  league?: SportLeagueRecord | null;
  homeTeamId?: string | null;
  homeTeam?: SportTeamRecord | null;
  awayTeamId?: string | null;
  awayTeam?: SportTeamRecord | null;
  isTop: boolean;
  status: MatchStatus;
  startTime: Date;
  liveUrl?: string | null;
  replayUrl?: string | null;
  externalSource?: string | null;
  externalId?: string | null;
  rawPayload?: unknown;
  lastSyncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LiveProductRecord = {
  id: string;
  name: string;
  jumpUrl: string;
  ownerUserId?: string | null;
  supportWildcard: boolean;
  wildcardLength?: number | null;
  enableReplayJumpDomain?: boolean;
  replayJumpDomain?: string | null;
  roomSuffix?: string | null;
  appendRoomSuffix?: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SignalDomainRecord = {
  id: string;
  category?: string | null;
  name: string;
  supportWildcard: boolean;
  wildcardPrefixCount?: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SignalSourceNameRecord = {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BreadcrumbItem = {
  name: string;
  url: string;
};

export type CacheInvalidationJobRecord = {
  id: string;
  siteId?: string | null;
  tags: string[];
  paths: string[];
  reason: string;
  status: 'PENDING' | 'DONE' | 'FAILED';
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ScheduledTaskRecord = {
  id: string;
  type: ScheduledTaskType;
  name: string;
  status: ScheduledTaskStatus;
  scheduleTime: string;
  timezone: string;
  lastRunAt?: Date | null;
  nextRunAt?: Date | null;
  lastStatus: ScheduledTaskRunStatus;
  lastMessage?: string | null;
  runCount: number;
  failureCount: number;
  config?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuditLogRecord = {
  id: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: Date;
};

export type PublicUrlData = Record<string, string | number | Date | null | undefined>;
