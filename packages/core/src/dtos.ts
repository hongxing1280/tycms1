import { z } from 'zod';
import { normalizeHost, protocolFromUrlInput } from './host';

export const statusSchema = z.enum(['ACTIVE', 'DISABLED', 'MAINTENANCE']);
export const activeStatusSchema = z.enum(['ACTIVE', 'DISABLED']);
export const publishStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']);
export const sportTypeSchema = z.enum(['FOOTBALL', 'BASKETBALL']);
export const matchStatusSchema = z.enum(['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED', 'POSTPONED']);
export const promotionStatusSchema = z.enum(['ACTIVE', 'DISABLED']);
export const promotionSlotSchema = z.enum([
  'HOME_HERO',
  'HOME_AFTER_NEWS',
  'CATEGORY_TOP',
  'CATEGORY_SIDEBAR',
  'NEWS_TOP',
  'NEWS_INLINE',
  'NEWS_BOTTOM',
  'GLOBAL_FLOAT',
]);
export const promotionRenderStyleSchema = z.enum(['TEXT_LINK', 'IMAGE_BANNER', 'BUTTON', 'CARD', 'FLOATING']);
export const promotionDeviceSchema = z.enum(['ALL', 'DESKTOP', 'MOBILE']);
export const scheduledTaskTypeSchema = z.enum(['SPORTS_SYNC', 'NEWS_CRAWL', 'LIVE_REPLAY_SYNC']);
export const scheduledTaskStatusSchema = z.enum(['ACTIVE', 'PAUSED']);
export const scheduledTaskRunStatusSchema = z.enum(['IDLE', 'RUNNING', 'SUCCESS', 'FAILED']);
export const adminPermissionActionSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/, 'Permission action must use resource:action format.');
export const pageTypeSchema = z.enum([
  'HOME',
  'NEWS_CATEGORY',
  'NEWS_DETAIL',
  'MATCH_CATEGORY',
  'MATCH_DETAIL',
  'VIDEO_CATEGORY',
  'VIDEO_DETAIL',
  'TAG',
  'TEAM',
  'LEAGUE',
  'LIVE_ROOM',
  'SEARCH',
]);

export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase words separated by hyphens.');

export const safeUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      return ['https:', 'http:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, {
    message: 'Only http and https URLs are allowed.',
  });

const relativePathSchema = z
  .string()
  .regex(/^\/(?:[A-Za-z0-9._~!$&'()*+,;=:@%-]+\/?)*(?:\?[A-Za-z0-9._~!$&'()*+,;=:@/?%-]*)?$/, {
    message: 'Only root-relative paths are allowed.',
  });

export const signalPathOrUrlSchema = z.union([safeUrlSchema, relativePathSchema]);

export const imageUploadSchema = z.object({
  filename: z.string().min(1).max(180),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  dataBase64: z.string().min(8).max(8_000_000),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const primaryDomainSchema = z
  .string()
  .min(3)
  .max(240)
  .transform((value) => normalizeHost(value))
  .pipe(z.string().min(3).max(120));

export const siteProtocolSchema = z.enum(['http', 'https']);

export const adminLoginSchema = z.object({
  identity: z.string().min(2).max(120),
  password: z.string().min(6).max(120),
  safeEntry: z.string().max(120).optional(),
  totpCode: z.string().max(12).optional(),
});

export const adminUserCreateSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username may contain letters, numbers, dot, underscore and hyphen.'),
  email: z.string().email().max(120).toLowerCase(),
  displayName: z.string().min(2).max(80),
  password: z.string().min(8).max(120),
  totpEnabled: z.boolean().default(false),
  totpSecret: z.string().max(128).optional(),
  status: activeStatusSchema.default('ACTIVE'),
  roleIds: z.array(z.string().min(1)).min(1).max(20),
});

export const adminUserUpdateSchema = adminUserCreateSchema
  .omit({ password: true })
  .partial()
  .extend({
    password: z.string().min(8).max(120).optional(),
  });

export const securitySettingsUpdateSchema = z.object({
  adminSafeEntry: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, '安全入口只能包含字母、数字、下划线和横线。')
    .optional()
    .or(z.literal('')),
  totpRequired: z.boolean().optional(),
  totpSecret: z.string().trim().max(128).optional().or(z.literal('')),
});

export const adminRoleCreateSchema = z.object({
  key: slugSchema.optional(),
  name: z.string().min(2).max(80),
  description: z.string().max(240).optional(),
  status: activeStatusSchema.default('ACTIVE'),
  permissionActions: z.array(adminPermissionActionSchema).min(1).max(80),
});

export const adminRoleUpdateSchema = adminRoleCreateSchema.partial();

export const adminPermissionCreateSchema = z.object({
  action: adminPermissionActionSchema.optional(),
  label: z.string().min(2).max(80),
  group: z.string().min(2).max(40),
  description: z.string().max(240).optional(),
  status: activeStatusSchema.default('ACTIVE'),
});

export const adminPermissionUpdateSchema = adminPermissionCreateSchema.partial();

const siteBaseSchema = z.object({
  groupId: z.string().optional(),
  name: z.string().min(2).max(80),
  primaryDomain: z.string().min(3).max(240),
  primaryProtocol: siteProtocolSchema.optional(),
  status: statusSchema.default('ACTIVE'),
  templateId: z.string().optional(),
  urlConfigId: z.string().optional(),
  tdkConfigId: z.string().optional(),
  newsUpdateCount: z.number().int().min(0).max(200).default(0),
  showSignalSources: z.boolean().default(false),
  seoTitle: z.string().max(120).optional(),
  seoKeywords: z.string().max(240).optional(),
  seoDescription: z.string().max(240).optional(),
  seoIndexStatus: z.enum(['INDEX', 'NOINDEX', 'FOLLOW_ONLY']).default('INDEX'),
  analyticsCode: z.string().max(2000).optional(),
  baiduPushToken: z.string().max(200).optional(),
  baiduVerifyCode: z.string().max(500).optional(),
  remark: z.string().max(500).optional(),
});

function normalizeSitePayload<T extends { primaryDomain?: string; primaryProtocol?: 'http' | 'https' }>(input: T): T {
  if (!input.primaryDomain) {
    return input;
  }

  const primaryDomain = normalizeHost(input.primaryDomain);
  return {
    ...input,
    primaryDomain,
    primaryProtocol: input.primaryProtocol ?? protocolFromUrlInput(input.primaryDomain),
  };
}

export const siteCreateSchema = siteBaseSchema
  .refine((input) => primaryDomainSchema.safeParse(input.primaryDomain).success, {
    message: '请输入有效的站点域名或首页链接。',
    path: ['primaryDomain'],
  })
  .transform(normalizeSitePayload);

export const siteUpdateSchema = siteBaseSchema
  .partial()
  .refine((input) => !input.primaryDomain || primaryDomainSchema.safeParse(input.primaryDomain).success, {
    message: '请输入有效的站点域名或首页链接。',
    path: ['primaryDomain'],
  })
  .transform(normalizeSitePayload);

export const groupCreateSchema = z.object({
  name: z.string().min(2).max(80),
  status: activeStatusSchema.default('ACTIVE'),
  newsUpdateCount: z.number().int().min(0).default(0),
  createdById: z.string().optional(),
  liveProductIds: z.array(z.string().min(1)).max(20).default([]),
  enableDeviceSignalCheck: z.boolean().default(true),
  pcSignalSourceEnabled: z.boolean().default(true),
  mobileSignalSourceEnabled: z.boolean().default(true),
  randomSignalSourceEnabled: z.boolean().default(false),
});

export const groupUpdateSchema = groupCreateSchema.partial();

export const templateCreateSchema = z.object({
  name: z.string().min(2).max(80),
  key: slugSchema.optional(),
  folder: z.string().min(2).max(120),
  author: z.string().max(80).optional(),
  coverUrl: safeUrlSchema.optional(),
  status: activeStatusSchema.default('ACTIVE'),
});

export const templateUpdateSchema = templateCreateSchema.partial();

export const urlRuleSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().default(''),
  pageType: pageTypeSchema,
  pattern: z.string().min(1).max(180).startsWith('/'),
  detailRules: z.array(
    z.object({
      id: z.string().optional(),
      label: z.string().min(2).max(80),
      pageType: pageTypeSchema,
      pattern: z.string().min(1).max(180).startsWith('/'),
    }),
  ).default([]),
}).superRefine((rule, ctx) => {
  if (rule.pageType !== 'HOME' && !rule.categoryId.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['categoryId'],
      message: '栏目规则必须选择栏目；只有首页规则可以不绑定栏目。',
    });
  }
});

export const urlConfigCreateSchema = z.object({
  siteId: z.string().nullable().optional(),
  name: z.string().min(2).max(80),
  status: activeStatusSchema.default('ACTIVE'),
  rules: z.array(urlRuleSchema).min(1).max(80),
  description: z.string().max(240).optional(),
});

export const urlConfigUpdateSchema = urlConfigCreateSchema.partial();

export const tdkRuleSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().default(''),
  pageType: pageTypeSchema,
  titleTemplate: z.string().min(2).max(180),
  keywordsTemplate: z.string().max(260).optional(),
  descriptionTemplate: z.string().max(320).optional(),
  detailRules: z.array(
    z.object({
      id: z.string().optional(),
      label: z.string().min(2).max(80),
      pageType: pageTypeSchema,
      titleTemplate: z.string().min(2).max(180),
      keywordsTemplate: z.string().max(260).optional(),
      descriptionTemplate: z.string().max(320).optional(),
    }),
  ).default([]),
}).superRefine((rule, ctx) => {
  if (rule.pageType !== 'HOME' && !rule.categoryId.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['categoryId'],
      message: '栏目规则必须选择栏目；只有首页规则可以不绑定栏目。',
    });
  }
});

export const tdkConfigCreateSchema = z.object({
  siteId: z.string().nullable().optional(),
  name: z.string().min(2).max(80),
  status: activeStatusSchema.default('ACTIVE'),
  rules: z.array(tdkRuleSchema).min(1).max(80),
});

export const tdkConfigUpdateSchema = tdkConfigCreateSchema.partial();

export const categoryCreateSchema = z.object({
  parentId: z.string().optional(),
  name: z.string().min(2).max(80),
  slug: slugSchema.optional(),
  language: z.string().default('zh-CN'),
  status: activeStatusSchema.default('ACTIVE'),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const newsCreateSchema = z.object({
  siteId: z.string(),
  categoryId: z.string(),
  title: z.string().min(4).max(120),
  slug: slugSchema.optional(),
  summary: z.string().min(20).max(240).optional(),
  content: z.string().min(50),
  coverImageUrl: safeUrlSchema.optional(),
  coverImageWidth: z.number().int().min(1).optional(),
  coverImageHeight: z.number().int().min(1).optional(),
  author: z.string().max(80).optional(),
  sourceName: z.string().max(80).optional(),
  sourceUrl: safeUrlSchema.optional(),
  status: publishStatusSchema.default('DRAFT'),
  isTop: z.boolean().default(false),
  publishedAt: z.coerce.date().optional(),
  seoTitle: z.string().max(120).optional(),
  seoKeywords: z.string().max(240).optional(),
  seoDescription: z.string().max(240).optional(),
  canonicalUrl: safeUrlSchema.optional(),
});

export const newsUpdateSchema = newsCreateSchema.partial();

export const liveReplaySyncSchema = z.object({
  sourceUrl: safeUrlSchema.optional(),
  siteId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const liveReplayCreateSchema = z.object({
  title: z.string().min(2).max(160),
  create_time: z.coerce.number().int().positive(),
  home_team: z.string().min(1).max(80),
  away_team: z.string().min(1).max(80),
  play_url: safeUrlSchema,
  siteId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
});

export const liveReplayUpdateSchema = liveReplayCreateSchema.partial();

export const promotionTypeCreateSchema = z.object({
  siteId: z.string().optional(),
  key: slugSchema.optional(),
  name: z.string().min(2).max(80),
  slot: promotionSlotSchema,
  renderStyle: promotionRenderStyleSchema.default('TEXT_LINK'),
  description: z.string().max(240).optional(),
  status: promotionStatusSchema.default('ACTIVE'),
  sortOrder: z.number().int().min(0).default(0),
});

export const promotionTypeUpdateSchema = promotionTypeCreateSchema.partial();

export const promotionLinkCreateSchema = z.object({
  siteId: z.string(),
  categoryId: z.string().optional(),
  promotionTypeId: z.string(),
  title: z.string().min(2).max(120),
  subtitle: z.string().max(180).optional(),
  targetUrl: safeUrlSchema,
  imageUrl: safeUrlSchema.optional(),
  relNofollow: z.boolean().default(true),
  relSponsored: z.boolean().default(true),
  openInNewTab: z.boolean().default(true),
  device: promotionDeviceSchema.default('ALL'),
  weight: z.number().int().min(0).max(1000).default(100),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  status: promotionStatusSchema.default('ACTIVE'),
  sortOrder: z.number().int().min(0).default(0),
});

export const promotionLinkUpdateSchema = promotionLinkCreateSchema.partial();

export const leagueCreateSchema = z.object({
  sport: sportTypeSchema,
  name: z.string().min(2).max(80),
  slug: slugSchema.optional(),
  englishName: z.string().max(120).optional(),
  pinyin: z.string().max(120).optional(),
  logoUrl: safeUrlSchema.optional(),
  country: z.string().max(80).optional(),
  isHot: z.boolean().default(false),
  externalSource: z.string().max(80).optional(),
  externalId: z.string().max(120).optional(),
  lastSyncedAt: z.coerce.date().optional(),
});

export const leagueUpdateSchema = leagueCreateSchema.partial();

export const teamCreateSchema = z.object({
  sport: sportTypeSchema,
  leagueId: z.string().optional(),
  name: z.string().min(2).max(80),
  slug: slugSchema.optional(),
  englishName: z.string().max(120).optional(),
  pinyin: z.string().max(120).optional(),
  country: z.string().max(80).optional(),
  logoUrl: safeUrlSchema.optional(),
  isHot: z.boolean().default(false),
  externalSource: z.string().max(80).optional(),
  externalId: z.string().max(120).optional(),
  lastSyncedAt: z.coerce.date().optional(),
});

export const teamUpdateSchema = teamCreateSchema.partial();

export const matchCreateSchema = z.object({
  siteId: z.string().optional(),
  sport: sportTypeSchema,
  title: z.string().min(2).max(120),
  slug: slugSchema.optional(),
  leagueId: z.string().optional(),
  homeTeamId: z.string().optional(),
  awayTeamId: z.string().optional(),
  isTop: z.boolean().default(false),
  status: matchStatusSchema.default('SCHEDULED'),
  startTime: z.coerce.date(),
  liveUrl: signalPathOrUrlSchema.optional(),
  replayUrl: signalPathOrUrlSchema.optional(),
  externalSource: z.string().max(80).optional(),
  externalId: z.string().max(120).optional(),
  rawPayload: z.unknown().optional(),
  lastSyncedAt: z.coerce.date().optional(),
});

export const matchUpdateSchema = matchCreateSchema.partial();

export const scheduledTaskCreateSchema = z.object({
  type: scheduledTaskTypeSchema,
  name: z.string().min(2).max(80),
  status: scheduledTaskStatusSchema.default('ACTIVE'),
  scheduleTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, '每日执行时间格式必须是 HH:mm。')
    .default('03:10'),
  timezone: z.string().min(3).max(80).default('Asia/Shanghai'),
  config: z.record(z.unknown()).optional(),
});

export const scheduledTaskUpdateSchema = scheduledTaskCreateSchema.partial();

export const liveProductCreateSchema = z.object({
  name: z.string().min(2).max(80),
  jumpUrl: safeUrlSchema,
  ownerUserId: z.string().max(80).optional(),
  supportWildcard: z.boolean().default(false),
  wildcardLength: z.number().int().min(1).max(32).optional(),
  enableReplayJumpDomain: z.boolean().default(false),
  replayJumpDomain: z.string().max(200).optional(),
  roomSuffix: z.string().max(120).optional(),
  appendRoomSuffix: z.boolean().default(false),
  status: activeStatusSchema.default('ACTIVE'),
});

export const liveProductUpdateSchema = liveProductCreateSchema.partial();

export const signalDomainCreateSchema = z.object({
  category: z.string().max(80).optional(),
  name: z.string().min(2).max(120),
  supportWildcard: z.boolean().default(false),
  wildcardPrefixCount: z.number().int().min(0).max(32).optional(),
  status: activeStatusSchema.default('ACTIVE'),
});

export const signalDomainUpdateSchema = signalDomainCreateSchema.partial();

export const signalSourceNameCreateSchema = z.object({
  name: z.string().min(1).max(80),
  status: activeStatusSchema.default('ACTIVE'),
});

export const signalSourceNameUpdateSchema = signalSourceNameCreateSchema.partial();

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export type SiteCreateInput = z.infer<typeof siteCreateSchema>;
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type NewsCreateInput = z.infer<typeof newsCreateSchema>;
export type LiveReplaySyncInput = z.infer<typeof liveReplaySyncSchema>;
export type LiveReplayCreateInput = z.infer<typeof liveReplayCreateSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>;
export type SecuritySettingsUpdateInput = z.infer<typeof securitySettingsUpdateSchema>;
export type AdminRoleCreateInput = z.infer<typeof adminRoleCreateSchema>;
export type AdminPermissionCreateInput = z.infer<typeof adminPermissionCreateSchema>;
export type PromotionTypeCreateInput = z.infer<typeof promotionTypeCreateSchema>;
export type PromotionLinkCreateInput = z.infer<typeof promotionLinkCreateSchema>;
export type ScheduledTaskCreateInput = z.infer<typeof scheduledTaskCreateSchema>;
export type ImageUploadInput = z.infer<typeof imageUploadSchema>;
