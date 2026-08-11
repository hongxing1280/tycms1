'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import { useAdmin } from './AdminContext';

type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'multiselect'
  | 'tags'
  | 'datetime'
  | 'url'
  | 'image'
  | 'url-rules'
  | 'tdk-rules';

type FieldOption = {
  label: string;
  value: string;
  meta?: Record<string, unknown>;
};

type FieldConfig = {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  options?: FieldOption[];
  allowEmpty?: boolean;
  emptyValue?: unknown;
};

type ModuleConfig = {
  key: string;
  group: string;
  label: string;
  endpoint: string;
  permission: string;
  readPermission?: string;
  summary: string;
  listFields: string[];
  sample: Record<string, unknown>;
};
type FormTabConfig = {
  key: string;
  label: string;
  description: string;
  fields: string[];
};

type FormValues = Record<string, string | boolean>;
type TableRow = Record<string, unknown>;
type TableColumn = {
  key: string;
  label: string;
};
type CategoryTreeNode = {
  row: TableRow;
  children: CategoryTreeNode[];
};
type TableStatus = {
  tone: 'idle' | 'success' | 'danger' | 'info';
  message: string;
};
type ToastTone = 'success' | 'danger' | 'info';
type ToastMessage = {
  id: string;
  tone: ToastTone;
  title: string;
  message: string;
};
type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'danger' | 'primary';
  onConfirm: () => Promise<void> | void;
};
type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
type FetchRowsResult = {
  rows: TableRow[];
  pagination: PaginationState;
};
type UploadImageResponse = {
  url?: string;
  duplicated?: boolean;
};
type SiteImportResponse = {
  totalRows?: number;
  message?: string;
  created?: Array<{ rowNumber?: number; id?: string; name?: string; domain?: string }>;
  skipped?: Array<{ rowNumber?: number; domain?: string; reason?: string }>;
  failed?: Array<{ rowNumber?: number; domain?: string; message?: string }>;
};
type ModalMode = 'create' | 'edit' | null;
type DynamicOptions = Record<string, FieldOption[]>;
type ReferenceConfig = {
  endpoint: string;
  multiple?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  label: (row: TableRow) => string;
  value?: (row: TableRow) => string | undefined;
};

const activeStatusOptions = [
  { label: '启用', value: 'ACTIVE' },
  { label: '禁用', value: 'DISABLED' },
];

const siteStatusOptions = [
  ...activeStatusOptions,
  { label: '维护中', value: 'MAINTENANCE' },
];

const publishStatusOptions = [
  { label: '草稿', value: 'DRAFT' },
  { label: '已发布', value: 'PUBLISHED' },
  { label: '定时发布', value: 'SCHEDULED' },
  { label: '归档', value: 'ARCHIVED' },
];

const matchStatusOptions = [
  { label: '未开始', value: 'SCHEDULED' },
  { label: '直播中', value: 'LIVE' },
  { label: '已结束', value: 'FINISHED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '延期', value: 'POSTPONED' },
];

const scheduledTaskStatusOptions = [
  { label: '启用', value: 'ACTIVE' },
  { label: '暂停', value: 'PAUSED' },
];

const scheduledTaskTypeOptions = [
  { label: '赛事数据同步', value: 'SPORTS_SYNC' },
  { label: '懂球帝新闻采集', value: 'NEWS_CRAWL' },
  { label: '直播录像采集', value: 'LIVE_REPLAY_SYNC' },
];

const adminPageSize = 20;
const referencePageSize = 100;

const pageTypeOptions: FieldOption[] = [
  { label: '首页', value: 'HOME' },
  { label: '直播栏目', value: 'MATCH_CATEGORY' },
  { label: '直播详情', value: 'MATCH_DETAIL' },
  { label: '新闻栏目', value: 'NEWS_CATEGORY' },
  { label: '新闻详情', value: 'NEWS_DETAIL' },
  { label: '录像栏目', value: 'VIDEO_CATEGORY' },
  { label: '录像详情', value: 'VIDEO_DETAIL' },
  { label: '标签页', value: 'TAG' },
  { label: '球队页', value: 'TEAM' },
  { label: '联赛页', value: 'LEAGUE' },
  { label: '直播间', value: 'LIVE_ROOM' },
  { label: '搜索页', value: 'SEARCH' },
];

const categoryPageTypeOptions = pageTypeOptions.filter((option) =>
  ['MATCH_CATEGORY', 'NEWS_CATEGORY', 'VIDEO_CATEGORY'].includes(option.value),
);

const detailPageTypeOptions = pageTypeOptions.filter((option) =>
  ['MATCH_DETAIL', 'NEWS_DETAIL', 'VIDEO_DETAIL'].includes(option.value),
);

const tdkExampleRows = [
  {
    item: '直播栏目',
    rule: '{columnName}_高清直播在线_{siteName}',
    sample: '英超直播_高清直播在线_乐球直播',
    variables: '{columnName} {siteName}',
  },
  {
    item: '录像栏目',
    rule: '{columnName}_比赛回放_{siteName}',
    sample: '英超录像_比赛回放_乐球直播',
    variables: '{columnName} {siteName}',
  },
  {
    item: '新闻栏目',
    rule: '最新{columnName}-{siteName}',
    sample: '最新英超新闻-乐球直播',
    variables: '{columnName} {siteName}',
  },
  {
    item: '赛事详情页',
    rule: '{homeTeam}VS{awayTeam}{leagueName}高清直播无插件_{siteName}',
    sample: '德国VS苏格兰欧洲杯高清直播无插件_乐球直播',
    variables: '{homeTeam} {awayTeam} {leagueName} {matchTime2} {siteName}',
  },
];

const tdkVariableGroups = [
  ['网站名', '{siteName}'],
  ['栏目名', '{columnName}'],
  ['标签名', '{labelName}'],
  ['球队中文名', '{teamName}'],
  ['球队英文名', '{teamNameEn}'],
  ['球队 ID', '{teamId}'],
  ['球员中文名', '{playerName}'],
  ['球员英文名', '{playerNameEn}'],
  ['球员 ID', '{playerId}'],
  ['年', '{year}'],
  ['月', '{mouth}'],
  ['日', '{day}'],
  ['联赛名', '{leagueName}'],
  ['主队名', '{homeTeam}'],
  ['客队名', '{awayTeam}'],
  ['开赛时间', '{matchTime}'],
  ['开赛日期', '{matchTime2}'],
  ['新闻标题', '{title}'],
  ['新闻摘要', '{summary}'],
];

const urlExampleRows = [
  { item: '直播栏目', pattern: '/live/{categorySlug}.html', note: '一级目录可改，示例使用 live。' },
  { item: '直播详情', pattern: '/live/{categorySlug}/{matchId}-{slug}.html', note: '赛事详情页，建议保留 matchId 或 slug。' },
  { item: '新闻栏目', pattern: '/article/{categorySlug}.html', note: '一级目录可改，示例使用 article。' },
  { item: '新闻详情', pattern: '/article/{categorySlug}/{articleSlug}.html', note: '新闻详情页，和栏目规则保持同一前缀更清晰。' },
  { item: '录像栏目', pattern: '/replay/{categorySlug}.html', note: '一级目录可改，示例使用 replay。' },
  { item: '录像详情', pattern: '/replay/{categorySlug}/{videoSlug}.html', note: '录像详情页，建议保留 videoSlug。' },
];

const urlVariableGroups = [
  ['栏目 Slug', '{categorySlug}'],
  ['新闻 Slug', '{newsSlug}'],
  ['文章 Slug', '{articleSlug}'],
  ['录像 Slug', '{videoSlug}'],
  ['赛事 ID', '{matchId}'],
  ['页面 Slug', '{slug}'],
  ['运动类型', '{sport}'],
  ['球队 Slug', '{teamSlug}'],
  ['联赛 Slug', '{leagueSlug}'],
  ['标签 Slug', '{tagSlug}'],
];

const siteFormTabs: FormTabConfig[] = [
  {
    key: 'base',
    label: '基础信息',
    description: '绑定站点分组、域名、模板和启用状态。',
    fields: ['groupId', 'name', 'primaryDomain', 'status', 'templateId'],
  },
  {
    key: 'seo',
    label: 'SEO',
    description: '站点只选择一套 URL 规则和一套 TDK 规则；规则本体到 URL 配置、TDK 配置里维护多个栏目和内页规则。',
    fields: ['urlConfigId', 'tdkConfigId', 'seoTitle', 'seoKeywords', 'seoDescription'],
  },
  {
    key: 'tracking',
    label: '统计/验证',
    description: '只维护统计代码和百度站长验证代码。',
    fields: ['analyticsCode', 'baiduVerifyCode'],
  },
];

const fieldMeta: Record<string, Partial<FieldConfig>> = {
  username: { label: '用户名' },
  email: { label: '邮箱' },
  displayName: { label: '显示名称' },
  password: { label: '登录密码', type: 'text' },
  roleIds: { label: '角色', type: 'multiselect', help: '从已有角色中选择，可多选。' },
  key: { label: 'Key' },
  label: { label: '显示名称' },
  action: { label: '权限动作' },
  permissionActions: { label: '权限动作', type: 'multiselect', help: '从已有权限中选择，可多选。' },
  group: { label: '分组' },
  groupId: { label: '分组名' },
  siteId: { label: '所属站点' },
  urlConfigId: {
    label: '默认 URL 规则',
    help: '从 URL 配置模块选择当前站点使用的一套规则；栏目链接和内页链接都在这套规则里维护。',
  },
  tdkConfigId: {
    label: '默认 TDK 规则',
    help: '从 TDK 配置模块选择当前站点使用的一套规则；栏目页和内页 Title/Keywords/Description 都在这套规则里维护。',
  },
  categoryId: { label: '所属栏目' },
  categoryIds: { label: '绑定栏目', type: 'multiselect', help: '可多选，一个 URL 或 TDK 配置可以绑定多个栏目。' },
  rules: { label: '栏目规则', help: '上面绑定栏目页，下面可继续添加多个内页规则。' },
  parentId: { label: '父栏目' },
  templateId: { label: '模板', help: '真正决定前台样式的是模板包 folder；不同记录如果 folder 一样，前台样式也一样。' },
  promotionTypeId: { label: '推广类型' },
  name: { label: '名称' },
  primaryDomain: {
    label: '站点首页链接',
    type: 'url',
    placeholder: 'http://www.example.com',
    help: '填写 http 或 https 首页链接均可，系统会保存协议和域名，用于站点识别、打开站点和 canonical。',
  },
  status: { label: '状态' },
  showSignalSources: { label: '展示信号源' },
  seoTitle: { label: '首页 SEO 标题', help: '直接修改首页 title；首页优先使用这里的 TDK。' },
  seoKeywords: { label: '首页 SEO 关键词', type: 'textarea' },
  seoDescription: { label: '首页 SEO 描述', type: 'textarea' },
  seoIndexStatus: { label: '收录策略' },
  analyticsCode: { label: '统计代码', type: 'textarea', help: '用于放置统计脚本或统计平台验证片段。' },
  baiduPushToken: { label: '百度推送 Token' },
  baiduVerifyCode: { label: '百度站长验证代码', type: 'textarea' },
  remark: { label: '备注', type: 'textarea' },
  newsUpdateCount: { label: '新闻更新数量' },
  liveProductIds: { label: '直播产品', type: 'multiselect', help: '从直播产品管理中选择，可多选；前台直播信号源块会按勾选数量展示多个产品入口。' },
  enableDeviceSignalCheck: { label: '开启 PC/移动端信号源判断', help: '开启后，前台会先判断分组是否选择了直播产品，再展示直播信号源块。' },
  pcSignalSourceEnabled: { label: 'PC 端有信号源' },
  mobileSignalSourceEnabled: { label: '移动端有信号源' },
  randomSignalSourceEnabled: { label: '随机调用信号源名称', help: '开启后，前台从全局“信号源名称”列表随机取名称展示，不需要在分组里选择名称。' },
  folder: { label: '模板文件夹' },
  author: { label: '作者' },
  coverUrl: { label: '模板封面', type: 'image', help: '可直接上传图片，重复图片会自动返回已有链接。' },
  pageType: { label: '页面类型' },
  pattern: {
    label: 'URL 规则',
    placeholder: '/article/{categorySlug}/{articleSlug}.html',
    help: '一级目录不固定，可用 /article、/news、/live、/replay 等；关键是栏目规则和内页规则变量完整、前缀一致。',
  },
  description: { label: '说明', type: 'textarea' },
  titleTemplate: { label: 'Title 模板', help: '用于生成页面 <title>，建议唯一且包含核心关键词。' },
  keywordsTemplate: { label: 'Keywords 模板', type: 'textarea', help: '用于生成 meta keywords，多个关键词用英文逗号分隔。' },
  descriptionTemplate: { label: 'Description 模板', type: 'textarea', help: '用于生成 meta description，建议概括页面内容。' },
  slug: { label: 'Slug' },
  language: { label: '语言' },
  sortOrder: { label: '排序' },
  title: { label: '标题' },
  summary: { label: '摘要', type: 'textarea' },
  content: { label: '正文', type: 'textarea' },
  coverImageUrl: { label: '封面图', type: 'image', help: '上传后自动写入图片桶链接，也可以粘贴已有图片 URL。' },
  coverImageWidth: { label: '封面宽度' },
  coverImageHeight: { label: '封面高度' },
  sourceName: { label: '来源名称' },
  sourceUrl: { label: '来源 URL' },
  publicUrl: { label: '前台内页' },
  create_time: { label: '创建时间戳', type: 'number' },
  home_team: { label: '主队名称' },
  away_team: { label: '客队名称' },
  play_url: { label: '视频流地址' },
  isTop: { label: '置顶' },
  publishedAt: { label: '发布时间', type: 'datetime' },
  canonicalUrl: { label: 'Canonical URL' },
  sport: { label: '运动类型' },
  englishName: { label: '英文名' },
  pinyin: { label: '拼音' },
  logoUrl: { label: 'LOGO', type: 'image', help: '上传后自动写入图片桶链接，也可以粘贴已有图片 URL。' },
  country: { label: '国家/地区' },
  isHot: { label: '热门' },
  externalSource: { label: '外部来源' },
  externalId: { label: '外部 ID' },
  lastSyncedAt: { label: '同步时间', type: 'datetime' },
  leagueId: { label: '所属联赛' },
  homeTeamId: { label: '主队' },
  awayTeamId: { label: '客队' },
  startTime: { label: '开赛时间', type: 'datetime' },
  liveUrl: { label: '直播 URL' },
  replayUrl: { label: '回放 URL' },
  jumpUrl: { label: '产品跳转 URL', placeholder: 'https://121311.com' },
  ownerUserId: { label: '所属用户' },
  supportWildcard: { label: '支持泛域名' },
  wildcardLength: { label: '泛域名长度' },
  enableReplayJumpDomain: { label: '内页播放跳转域名', help: '保留旧配置；赛事录像现在统一跳转到产品跳转 URL 首页。' },
  replayJumpDomain: { label: '内页播放跳转域名' },
  roomSuffix: { label: '拼接地址', placeholder: '/liveMatchesTwo', help: '例如 /liveMatchesTwo；开启直播间拼接后会自动拼成 /liveMatchesTwo/赛事外部ID。' },
  appendRoomSuffix: { label: '开启直播间拼接', help: '开启后调用“产品跳转 URL + 拼接地址 + 赛事外部ID”；关闭后只跳转产品跳转 URL。' },
  wildcardPrefixCount: { label: '泛前缀个数' },
  category: { label: '分类' },
  slot: { label: '展示位置' },
  renderStyle: { label: '展示样式' },
  subtitle: { label: '副标题', type: 'textarea' },
  targetUrl: { label: '推广目标 URL' },
  imageUrl: { label: '推广图片', type: 'image', help: '上传后自动写入图片桶链接，也可以粘贴已有图片 URL。' },
  relNofollow: { label: 'nofollow' },
  relSponsored: { label: 'sponsored' },
  openInNewTab: { label: '新窗口打开' },
  device: { label: '投放设备' },
  weight: { label: '权重' },
  startAt: { label: '开始时间', type: 'datetime' },
  endAt: { label: '结束时间', type: 'datetime' },
  type: { label: '任务类型' },
  scheduleTime: { label: '每日执行时间', placeholder: '03:10', help: '24 小时制 HH:mm，到点自动执行一次。' },
  timezone: { label: '时区', placeholder: 'Asia/Shanghai' },
  lastRunAt: { label: '上次执行时间', type: 'datetime' },
  nextRunAt: { label: '下次执行时间', type: 'datetime' },
  lastStatus: { label: '上次结果' },
  lastMessage: { label: '执行消息', type: 'textarea' },
  runCount: { label: '成功次数' },
  failureCount: { label: '失败次数' },
  config: {
    label: '任务配置 JSON',
    type: 'textarea',
    help: '赛事同步可填 {"sourceUrl":"https://jk.jktgedc.com/app/encryptionMatchOther?check_type=17","typeId":"17"}；多站点新闻/录像采集必须填写真实 siteId，例如 {"sourceUrl":"https://www.dongqiudi.com/news","siteId":"你的站点ID","categoryId":"新闻栏目ID","limit":10}。',
  },
};

const referenceConfigs: Record<string, ReferenceConfig> = {
  siteId: {
    endpoint: '/admin/sites',
    emptyLabel: '全站默认（所有站点共用）',
    label: (row) => `${textValue(row.name)} · ${textValue(row.primaryDomain)}`,
  },
  groupId: {
    endpoint: '/admin/groups',
    allowEmpty: true,
    emptyLabel: '不选择分组',
    label: (row) => textValue(row.name),
  },
  templateId: {
    endpoint: '/admin/templates',
    allowEmpty: true,
    emptyLabel: '不选择模板',
    label: (row) => `${textValue(row.name)} · 模板包:${textValue(row.folder)} · key:${textValue(row.key)}`,
  },
  urlConfigId: {
    endpoint: '/admin/url-configs',
    label: (row) => `${textValue(row.name)} · ${seoConfigScopeLabel(row)} · ${countRules(row)} 个栏目规则 · ${statusText(row.status)}`,
  },
  tdkConfigId: {
    endpoint: '/admin/tdk-configs',
    label: (row) => `${textValue(row.name)} · ${seoConfigScopeLabel(row)} · ${countRules(row)} 个栏目规则 · ${statusText(row.status)}`,
  },
  liveProductIds: {
    endpoint: '/admin/live-products',
    multiple: true,
    label: (row) => `${textValue(row.name)} · ${textValue(row.jumpUrl)}`,
  },
  parentId: {
    endpoint: '/admin/categories',
    allowEmpty: true,
    emptyLabel: '无父栏目',
    label: (row) => `${textValue(row.name)} · ${textValue(row.slug)}`,
  },
  categoryId: {
    endpoint: '/admin/categories',
    allowEmpty: true,
    emptyLabel: '不绑定栏目',
    label: (row) => `${textValue(row.name)} · ${textValue(row.slug)}`,
  },
  categoryIds: {
    endpoint: '/admin/categories',
    multiple: true,
    label: (row) => `${textValue(row.name)} · ${textValue(row.slug)}`,
  },
  rules: {
    endpoint: '/admin/categories',
    label: (row) => `${textValue(row.name)} · ${textValue(row.slug)}`,
  },
  promotionTypeId: {
    endpoint: '/admin/promotion-types',
    label: (row) => `${textValue(row.name)} · ${textValue(row.siteId)} · ${textValue(row.slot)}`,
  },
  leagueId: {
    endpoint: '/admin/leagues',
    allowEmpty: true,
    emptyLabel: '不绑定联赛',
    label: (row) => `${textValue(row.name)} · ${textValue(row.sport)}`,
  },
  homeTeamId: {
    endpoint: '/admin/teams',
    allowEmpty: true,
    emptyLabel: '不选择主队',
    label: (row) => `${textValue(row.name)} · ${textValue(row.sport)}`,
  },
  awayTeamId: {
    endpoint: '/admin/teams',
    allowEmpty: true,
    emptyLabel: '不选择客队',
    label: (row) => `${textValue(row.name)} · ${textValue(row.sport)}`,
  },
  ownerUserId: {
    endpoint: '/admin/users',
    allowEmpty: true,
    emptyLabel: '不绑定用户',
    label: (row) => `${textValue(row.displayName)} · ${textValue(row.username)}`,
  },
  roleIds: {
    endpoint: '/admin/roles',
    multiple: true,
    label: (row) => `${textValue(row.name)} · ${textValue(row.key)}`,
  },
  permissionActions: {
    endpoint: '/admin/permissions',
    multiple: true,
    label: (row) => `${textValue(row.label)} · ${textValue(row.action)}`,
    value: (row) => (typeof row.action === 'string' ? row.action : undefined),
  },
};

const modules: ModuleConfig[] = [
  {
    key: 'users',
    group: '账号权限',
    label: '用户管理',
    endpoint: '/admin/users',
    permission: 'user:write',
    readPermission: 'user:read',
    summary: '新增、编辑、禁用、删除后台账号；给不同用户分配角色。',
    listFields: ['ID', '用户名', '邮箱', '显示名称', '状态', '角色', '最后登录', '创建时间'],
    sample: {
      username: 'matchops',
      email: 'matchops@sports.local',
      displayName: '赛事运营',
      password: 'MatchOps123',
      status: 'ACTIVE',
      roleIds: ['role-site-admin'],
    },
  },
  {
    key: 'roles',
    group: '账号权限',
    label: '角色管理',
    endpoint: '/admin/roles',
    permission: 'role:write',
    readPermission: 'role:read',
    summary: '维护后台角色和授权范围。',
    listFields: ['ID', '角色 Key', '角色名称', '状态', '权限动作', '描述', '创建时间'],
    sample: {
      name: '赛事运营',
      description: '负责赛事、联赛、球队、直播产品和信号配置。',
      status: 'ACTIVE',
      permissionActions: ['admin:access', 'sports:write', 'live:write', 'signal:write', 'promotion:read'],
    },
  },
  {
    key: 'permissions',
    group: '账号权限',
    label: '权限管理',
    endpoint: '/admin/permissions',
    permission: 'permission:write',
    readPermission: 'permission:read',
    summary: '维护权限动作、分组和说明。',
    listFields: ['ID', '权限动作', '权限名称', '分组', '状态', '说明'],
    sample: {
      label: '查看运营报表',
      group: '系统审计',
      description: '允许查看后台运营统计报表。',
      status: 'ACTIVE',
    },
  },
  {
    key: 'scheduled-tasks',
    group: '系统管理',
    label: '计划任务',
    endpoint: '/admin/scheduled-tasks',
    permission: 'task:write',
    readPermission: 'task:read',
    summary: '每天自动拉取赛事接口、懂球帝新闻和直播录像；支持暂停、改执行时间、手动立即执行。',
    listFields: ['ID', '任务名称', '任务类型', '状态', '每日执行时间', '上次结果', '上次执行', '下次执行', '执行消息'],
    sample: {
      type: 'SPORTS_SYNC',
      name: '每日赛事数据同步',
      status: 'ACTIVE',
      scheduleTime: '03:10',
      timezone: 'Asia/Shanghai',
      config: {},
    },
  },
  {
    key: 'sites',
    group: '站点与分组',
    label: '站点管理',
    endpoint: '/admin/sites',
    permission: 'site:write',
    summary: '包含基础信息、模板、首页 SEO、文章数量，并选择当前站点使用的一套 URL 规则和一套 TDK 规则。',
    listFields: ['ID', '站点分组', '站点名称', '站点域名', '文章数量', '模板', '状态', '创建时间'],
    sample: {
      groupId: 'group-national',
      name: '新体育站',
      primaryDomain: 'https://www.example-sports.com',
      status: 'ACTIVE',
      templateId: 'template-jinqiu-live',
      urlConfigId: 'url-default-rules',
      tdkConfigId: 'tdk-default-rules',
      newsUpdateCount: 10,
      seoTitle: '新体育站 - 体育新闻与赛事直播',
      seoKeywords: '新体育站,体育新闻,赛事直播',
      seoDescription: '新体育站提供体育新闻、赛程直播与赛事分析。',
      analyticsCode: 'analytics-placeholder',
      baiduVerifyCode: 'baidu-verify-placeholder',
    },
  },
  {
    key: 'groups',
    group: '站点与分组',
    label: '分组管理',
    endpoint: '/admin/groups',
    permission: 'site:write',
    summary: '分组负责调用直播产品，并控制 PC/移动端展示；随机名称直接从全局信号源名称列表取。',
    listFields: ['ID', '分组名称', '新闻更新数量', '直播产品', 'PC/移动端信号源', '随机信号源', '站点状态', '创建时间'],
    sample: {
      name: '华东体育站群',
      status: 'ACTIVE',
      newsUpdateCount: 10,
      liveProductIds: [],
      enableDeviceSignalCheck: true,
      pcSignalSourceEnabled: true,
      mobileSignalSourceEnabled: true,
      randomSignalSourceEnabled: true,
    },
  },
  {
    key: 'categories',
    group: '内容管理',
    label: '栏目管理',
    endpoint: '/admin/categories',
    permission: 'category:write',
    summary: '维护全局栏目、子栏目、语言、状态和排序；所有站点共用，URL / TDK 配置负责调用栏目。',
    listFields: ['父子栏目树', '栏目名称', 'Slug', '状态', '排序'],
    sample: {
      parentId: '',
      name: '网球资讯',
      language: 'zh-CN',
      status: 'ACTIVE',
      description: '网球赛事、球员动态和直播资讯。',
      sortOrder: 50,
    },
  },
  {
    key: 'news',
    group: '内容管理',
    label: '新闻资讯',
    endpoint: '/admin/news',
    permission: 'news:write',
    summary: '新闻新增、编辑、删除、发布；内容会在前台服务端渲染输出。',
    listFields: ['标题', '所属栏目', '所属站点', '所属分组', '状态', '发布时间', '操作'],
    sample: {
      siteId: '',
      categoryId: '',
      title: '新赛季赛程发布，焦点战集中在周末黄金档',
      summary: '新赛季赛程发布后，多场焦点战被安排在周末黄金档。',
      content: '新赛季赛程发布后，多场焦点战被安排在周末黄金档。\n\n球队会根据密集赛程调整轮换。',
      coverImageUrl: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80',
      coverImageWidth: 1200,
      coverImageHeight: 800,
      author: '后台编辑',
      sourceName: '本站原创',
      status: 'DRAFT',
      isTop: false,
      seoTitle: '新赛季赛程发布 - 体育新闻',
      seoKeywords: '新赛季赛程,体育新闻,直播',
      seoDescription: '新赛季赛程和焦点战直播信息整理。',
    },
  },
  {
    key: 'live-replays',
    group: '内容管理',
    label: '直播录像',
    endpoint: '/admin/live-replays',
    permission: 'news:write',
    summary: '拉取直播录像接口并保存为录像栏目内容；前台点击列表进入本地录像详情页，不直连播放流。',
    listFields: ['标题', '创建时间', '主队名称', '客队名称', '视频流地址', '前台内页', '操作'],
    sample: {
      title: '【墨女超】蒙特雷女足VS美洲狮女足',
      create_time: 1775106158,
      home_team: '蒙特雷女足',
      away_team: '美洲狮女足',
      play_url: 'https://1324291601.vod-qcloud.com/3cca9635vodsgp1324291601/307490925145403721954995398/playlist_eof.m3u8',
    },
  },
  {
    key: 'promotion-types',
    group: '推广管理',
    label: '推广类型',
    endpoint: '/admin/promotion-types',
    permission: 'promotion:write',
    readPermission: 'promotion:read',
    summary: '按站点维护展示位和渲染样式，不同站点可以有不同推广类型。',
    listFields: ['ID', '所属站点', 'Key', '名称', '展示位置', '展示样式', '状态', '排序'],
    sample: {
      siteId: 'site-frontline',
      name: '体育前线 新闻底部卡片',
      slot: 'NEWS_BOTTOM',
      renderStyle: 'CARD',
      description: '新闻详情页正文底部推广卡片。',
      status: 'ACTIVE',
      sortOrder: 50,
    },
  },
  {
    key: 'promotion-links',
    group: '推广管理',
    label: '推广链接',
    endpoint: '/admin/promotion-links',
    permission: 'promotion:write',
    readPermission: 'promotion:read',
    summary: '按站点、栏目、推广类型、设备、时间和权重配置具体推广链接。',
    listFields: ['ID', '所属站点', '所属栏目', '推广类型', '标题', '目标 URL', '设备', '权重', '状态', '时间范围'],
    sample: {
      siteId: 'site-frontline',
      categoryId: 'cat-frontline-football',
      promotionTypeId: 'promo-type-frontline-category-banner',
      title: '足球直播专题入口',
      subtitle: '英超、中超、欧冠热门场次集中整理。',
      targetUrl: 'https://live.xinghuosports.com/go/football-special',
      imageUrl: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80',
      relNofollow: true,
      relSponsored: true,
      openInNewTab: true,
      device: 'ALL',
      weight: 160,
      status: 'ACTIVE',
      sortOrder: 20,
    },
  },
  {
    key: 'matches',
    group: '体育赛事',
    label: '赛事管理',
    endpoint: '/admin/matches',
    permission: 'sports:write',
    summary: '足球/篮球赛事编辑，可先拉取接口样例数据；前台只展示近 2 小时赛事。',
    listFields: ['ID', '赛事标题', '联赛名称', '主队名称', '客队名称', '置顶', '赛事状态', '赛事时间'],
    sample: {
      sport: 'FOOTBALL',
      title: '英超焦点战：阿森纳 vs 曼城',
      leagueId: 'league-premier',
      homeTeamId: 'team-arsenal',
      awayTeamId: 'team-city',
      isTop: true,
      status: 'SCHEDULED',
      startTime: '2026-05-20T12:00:00.000Z',
      liveUrl: 'https://live.xinghuosports.com/room/arsenal-city',
      externalSource: 'manual',
    },
  },
  {
    key: 'leagues',
    group: '体育赛事',
    label: '联赛管理',
    endpoint: '/admin/leagues',
    permission: 'sports:write',
    summary: '足球/篮球联赛编辑，可先拉取接口样例数据，后期替换为真实接口。',
    listFields: ['ID', '赛事名称', '赛事 LOGO', '是否热门', '操作'],
    sample: {
      sport: 'FOOTBALL',
      name: '西班牙足球甲级联赛',
      englishName: 'LaLiga',
      pinyin: 'xijia',
      logoUrl: 'https://img.xinghuosports.com/leagues/laliga.png',
      country: '西班牙',
      isHot: true,
      externalSource: 'manual',
    },
  },
  {
    key: 'teams',
    group: '体育赛事',
    label: '球队管理',
    endpoint: '/admin/teams',
    permission: 'sports:write',
    summary: '足球/篮球球队编辑，可先拉取接口样例数据，后期替换为真实接口。',
    listFields: ['ID', '球队名称', '所属国家', '球队 LOGO', '是否热门', '操作'],
    sample: {
      sport: 'FOOTBALL',
      leagueId: 'league-premier',
      name: '利物浦',
      englishName: 'Liverpool',
      pinyin: 'liwupu',
      country: '英国',
      logoUrl: 'https://img.xinghuosports.com/teams/liverpool.png',
      isHot: true,
      externalSource: 'manual',
    },
  },
  {
    key: 'live-products',
    group: '直播与信号',
    label: '直播产品',
    endpoint: '/admin/live-products',
    permission: 'live:write',
    summary: '支持泛域名、产品跳转 URL、拼接地址和直播间拼接开关。',
    listFields: ['ID', '直播产品名称', '产品跳转 URL', '拼接地址', '所属用户', '内页播放跳转域名', '是否支持泛域名', '开启直播间拼接', '状态'],
    sample: {
      name: '星火体育直播',
      jumpUrl: 'https://121311.com',
      roomSuffix: '/liveMatchesTwo',
      ownerUserId: 'admin',
      supportWildcard: true,
      wildcardLength: 8,
      enableReplayJumpDomain: true,
      appendRoomSuffix: false,
      status: 'ACTIVE',
    },
  },
  {
    key: 'signal-domains',
    group: '直播与信号',
    label: '信号域名',
    endpoint: '/admin/signal-domains',
    permission: 'signal:write',
    summary: '支持分类、泛域名和泛前缀个数。',
    listFields: ['ID', '分类', '名称', '是否支持泛域名', '泛前缀个数', '操作'],
    sample: {
      category: '足球',
      name: 'signal.xinghuosports.com',
      supportWildcard: true,
      wildcardPrefixCount: 5,
      status: 'ACTIVE',
    },
  },
  {
    key: 'signal-source-names',
    group: '直播与信号',
    label: '信号源名称',
    endpoint: '/admin/signal-source-names',
    permission: 'signal:write',
    summary: '维护多个随机信号源名称。',
    listFields: ['ID', '名称', '状态', '操作'],
    sample: {
      name: '赛点体育直播',
      status: 'ACTIVE',
    },
  },
  {
    key: 'templates',
    group: '模板与 SEO',
    label: '模板管理',
    endpoint: '/admin/templates',
    permission: 'template:write',
    summary: '只维护模板名称、文件夹和状态；模板 Key 由系统根据文件夹自动生成。',
    listFields: ['模板名称', '文件夹', '状态'],
    sample: {
      name: '波佳管业企业模板',
      folder: 'lybo-industrial',
      status: 'ACTIVE',
    },
  },
  {
    key: 'url-configs',
    group: '模板与 SEO',
    label: 'URL 配置',
    endpoint: '/admin/url-configs',
    permission: 'url-config:write',
    summary: 'URL 控制模板，一个配置里可以给多个栏目分别设置不同路径规则。',
    listFields: ['名称', '适用范围', '状态', '栏目规则', '说明'],
    sample: {
      siteId: '',
      name: '默认全站 URL 规则',
      status: 'ACTIVE',
      rules: [
        {
          categoryId: '',
          pageType: 'HOME',
          pattern: '/',
          detailRules: [],
        },
        {
          categoryId: 'cat-frontline-football',
          pageType: 'MATCH_CATEGORY',
          pattern: '/zhibo/{categorySlug}.html',
          detailRules: [
            {
              label: '直播内页',
              pageType: 'MATCH_DETAIL',
              pattern: '/zhibo/{matchId}-{slug}.html',
            },
          ],
        },
        {
          categoryId: 'cat-frontline-news',
          pageType: 'NEWS_CATEGORY',
          pattern: '/news/{categorySlug}.html',
          detailRules: [
            {
              label: '新闻内页',
              pageType: 'NEWS_DETAIL',
              pattern: '/news/{categorySlug}/{newsSlug}.html',
            },
          ],
        },
        {
          categoryId: 'cat-frontline-replay',
          pageType: 'VIDEO_CATEGORY',
          pattern: '/video/{categorySlug}.html',
          detailRules: [
            {
              label: '录像内页',
              pageType: 'VIDEO_DETAIL',
              pattern: '/video/{categorySlug}/{videoSlug}.html',
            },
          ],
        },
      ],
      description: '直播、新闻、录像栏目路径规则',
    },
  },
  {
    key: 'tdk-configs',
    group: '模板与 SEO',
    label: 'TDK 配置',
    endpoint: '/admin/tdk-configs',
    permission: 'tdk-config:write',
    summary: 'TDK 模板，一个配置里可以给多个栏目分别设置 Title、Keywords、Description。',
    listFields: ['名称', '适用范围', '状态', '栏目规则'],
    sample: {
      siteId: '',
      name: '默认全站 TDK',
      status: 'ACTIVE',
      rules: [
        {
          categoryId: '',
          pageType: 'HOME',
          titleTemplate: '{siteName} - 今日体育新闻、直播赛程与赛事分析',
          keywordsTemplate: '{siteName},体育新闻,赛事直播,足球赛程,篮球赛程',
          descriptionTemplate: '{siteName}实时整理足球、篮球、热门赛事、球队动态和直播信息。',
          detailRules: [],
        },
        {
          categoryId: 'cat-frontline-football',
          pageType: 'MATCH_CATEGORY',
          titleTemplate: '{columnName}_高清直播在线_{siteName}',
          keywordsTemplate: '{columnName},高清直播,{siteName}',
          descriptionTemplate: '{siteName}提供{columnName}、赛程和多线路直播入口。',
          detailRules: [
            {
              label: '直播内页',
              pageType: 'MATCH_DETAIL',
              titleTemplate: '{homeTeam}VS{awayTeam}{leagueName}高清直播无插件_{siteName}',
              keywordsTemplate: '{homeTeam},{awayTeam},{leagueName}直播,{siteName}',
              descriptionTemplate: '{homeTeam}对阵{awayTeam}，{leagueName}比赛时间{matchTime2}，在{siteName}查看直播入口和赛前分析。',
            },
          ],
        },
        {
          categoryId: 'cat-frontline-news',
          pageType: 'NEWS_CATEGORY',
          titleTemplate: '最新{columnName}-{siteName}',
          keywordsTemplate: '{columnName},体育新闻,{siteName}',
          descriptionTemplate: '{siteName}{columnName}栏目提供最新体育资讯。',
          detailRules: [
            {
              label: '新闻内页',
              pageType: 'NEWS_DETAIL',
              titleTemplate: '{title}_{siteName}',
              keywordsTemplate: '{title},{columnName},{siteName}',
              descriptionTemplate: '{summary}',
            },
          ],
        },
      ],
    },
  },
];

export function AdminCrudPanel(props: { activeModuleKey?: string }) {
  const { session, logout, apiBaseUrl } = useAdmin();

  const permissionSet = useMemo(() => new Set(session?.permissions || []), [session?.permissions]);
  const activeKey = props.activeModuleKey || 'news';
  const active = useMemo(() => modules.find((module) => module.key === activeKey) || modules[0], [activeKey]);
  const [dynamicOptions, setDynamicOptions] = useState<DynamicOptions>({});
  const fields = useMemo(() => buildFields(active, dynamicOptions), [active, dynamicOptions]);
  const siteLabelMap = useMemo(() => optionLabelMap(dynamicOptions.siteId), [dynamicOptions.siteId]);

  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const filteredRows = useMemo(() => {
    if (active.key === 'categories') {
      return filterCategoryRows(tableRows, searchQuery);
    }
    if (!searchQuery.trim()) return tableRows;
    const q = searchQuery.toLowerCase();
    return tableRows.filter((row) => {
      return rowMatchesSearch(row, q);
    });
  }, [active.key, tableRows, searchQuery]);
  const [tableStatus, setTableStatus] = useState<TableStatus>({
    tone: 'info',
    message: '正在准备自动加载列表数据。',
  });
  const [pagination, setPagination] = useState<PaginationState>(() => defaultPagination());
  const [recordId, setRecordId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [siteImporting, setSiteImporting] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(() => initialFormValues(fields, active.sample));
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
  const tableColumns = useMemo(() => buildTableColumns(active, tableRows), [active, tableRows]);
  const canWrite = permissionSet.has(active.permission);
  const canRead = permissionSet.has(active.readPermission ?? active.permission) || canWrite;
  const canPublish = permissionSet.has('news:publish');
  const accessToken = session?.accessToken;
  const [siteFilter, setSiteFilter] = useState('');
  const moduleFilters = useMemo(
    () => (['news', 'live-replays'].includes(active.key) && siteFilter ? { siteId: siteFilter } : {}),
    [active.key, siteFilter],
  );

  function pushToast(tone: ToastTone, title: string, message: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current.slice(-3), { id, tone, title, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function closeConfirmDialog() {
    setConfirmDialog(null);
  }

  const fetchCurrentRows = useCallback(async (page = 1): Promise<FetchRowsResult> => {
    if (!accessToken) {
      return { rows: [], pagination: defaultPagination() };
    }
    if (active.key === 'categories') {
      const rows = await fetchReferenceRows(apiBaseUrl, accessToken, active.endpoint);
      return {
        rows,
        pagination: defaultPagination(rows.length, 1, Math.max(rows.length, adminPageSize)),
      };
    }
    const result = await fetch(`${apiBaseUrl}${withPagination(active.endpoint, page, adminPageSize, moduleFilters)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    const parsed = parseResponseBody(await result.text());
    if (result.status === 401) {
      logout();
    }
    if (!result.ok) {
      throw new Error(extractErrorMessage(parsed));
    }
    const rows = normalizeRows(parsed);
    return {
      rows,
      pagination: normalizePagination(parsed, page, adminPageSize, rows.length),
    };
  }, [accessToken, active.endpoint, active.key, apiBaseUrl, logout, moduleFilters]);

  const refreshCurrentList = useCallback(async (page = 1): Promise<FetchRowsResult> => {
    let result = await fetchCurrentRows(page);
    if (!result.rows.length && result.pagination.total > 0 && result.pagination.page > 1) {
      result = await fetchCurrentRows(result.pagination.page - 1);
    }
    setTableRows(result.rows);
    setPagination(result.pagination);
    setSelectedIds([]);
    return result;
  }, [fetchCurrentRows]);

  useEffect(() => {
    setFormValues(initialFormValues(buildFields(active, {}), active.sample));
    setTableRows([]);
    setPagination(defaultPagination());
    setTableStatus({
      tone: 'info',
      message: '正在自动加载列表数据。',
    });
    setRecordId('');
    setSelectedIds([]);
    setModalMode(null);
    setSiteFilter('');
    setExpandedCategoryIds([]);
  }, [activeKey, active]);

  useEffect(() => {
    if (active.key !== 'categories') return;
    setExpandedCategoryIds(categoryIdsWithChildren(tableRows));
  }, [active.key, tableRows]);

  useEffect(() => {
    if (!accessToken) return;
    let alive = true;
    const referenceNames = unique([
      ...Object.keys(active.sample).filter((name) => referenceConfigs[name]),
      ...(['url-configs', 'tdk-configs'].includes(active.key) ? ['rules'] : []),
    ]);

    if (!referenceNames.length) {
      setDynamicOptions({});
      return;
    }

    setDynamicOptions(
      referenceNames.reduce<DynamicOptions>((options, name) => {
        options[name] = [];
        return options;
      }, {}),
    );

    Promise.all(
      referenceNames.map(async (name) => {
        const config = name === 'rules' ? referenceConfigs.categoryId : referenceConfigs[name];
        const rows = await fetchReferenceRows(apiBaseUrl, accessToken, config.endpoint);
        return [
          name,
          ['parentId', 'categoryId', 'categoryIds', 'rules'].includes(name)
            ? categoryOptionsFromRows(rows)
            : rows
              .map((row) => optionFromRow(row, config))
              .filter((option): option is FieldOption => Boolean(option)),
        ] as const;
      }),
    ).then((entries) => {
      if (!alive) return;
      setDynamicOptions(Object.fromEntries(entries));
    });

    return () => {
      alive = false;
    };
  }, [accessToken, active, apiBaseUrl]);

  useEffect(() => {
    if (!accessToken) return;
    setSearchQuery('');
    if (!canRead) {
      setTableRows([]);
      setPagination(defaultPagination());
      setSelectedIds([]);
      setTableStatus({ tone: 'danger', message: '当前账号没有查看该模块的权限。' });
      return;
    }

    let alive = true;
    setTableStatus({ tone: 'info', message: '正在自动加载列表数据。' });

    fetchCurrentRows(1)
      .then((result) => {
        if (!alive) return;
        setTableRows(result.rows);
        setPagination(result.pagination);
        setSelectedIds([]);
        setTableStatus({ tone: 'success', message: listLoadedMessage('已自动加载', result.pagination) });
      })
      .catch((error) => {
        if (!alive) return;
        setTableRows([]);
        setPagination(defaultPagination());
        setSelectedIds([]);
        setTableStatus({ tone: 'danger', message: `自动加载失败：${errorMessage(error)}` });
      });

    return () => {
      alive = false;
    };
  }, [accessToken, activeKey, canRead, fetchCurrentRows]);

  async function request(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path?: string, body?: unknown): Promise<boolean> {
    if (!session) return false;
    const basePath = path ?? active.endpoint;
    const needsRecordId = path === undefined && (method === 'PATCH' || method === 'DELETE');
    const targetId = recordId.trim();

    if (needsRecordId && targetId.length === 0) {
      const message = '请先填写记录 ID。';
      setTableRows([]);
      setTableStatus({ tone: 'danger', message });
      pushToast('danger', '操作失败', message);
      return false;
    }

    const listPath = method === 'GET' && path === undefined
      ? withPagination(basePath, pagination.page, adminPageSize, moduleFilters)
      : basePath;
    const url = `${apiBaseUrl}${listPath}${needsRecordId ? `/${encodeURIComponent(targetId)}` : ''}`;
    const label = operationLabel(method, path);
    pushToast('info', '请求已提交', `正在执行${label}。`);
    try {
      const requestBody = method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body ?? buildPayload(fields, formValues));
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.accessToken}`,
      };
      if (requestBody) {
        headers['Content-Type'] = 'application/json';
      }
      const result = await fetch(url, {
        method,
        headers,
        body: requestBody,
      });
      const text = await result.text();
      const parsed = parseResponseBody(text);
      if (result.status === 401) {
        logout();
      }

      if (!result.ok) {
        const message = `${label}失败（HTTP ${result.status}）：${extractErrorMessage(parsed)}`;
        setTableRows(normalizeRows(parsed));
        setTableStatus({
          tone: 'danger',
          message,
        });
        pushToast('danger', `${label}失败`, message);
        return false;
      }

      if (method === 'GET') {
        const rows = normalizeRows(parsed);
        const nextPagination = normalizePagination(parsed, pagination.page, adminPageSize, rows.length);
        setTableRows(rows);
        setPagination(nextPagination);
        setSelectedIds([]);
        const message = listLoadedMessage('刷新成功', nextPagination);
        setTableStatus({ tone: 'success', message });
        pushToast('success', '刷新成功', message);
        return true;
      }

      try {
        const refreshed = await refreshCurrentList(pagination.page);
        const operationNotice = extractOperationNotice(parsed);
        const message = `${label}成功，已刷新列表，共 ${refreshed.pagination.total} 条记录。${operationNotice ? ` ${operationNotice}` : ''}`;
        setTableStatus({
          tone: 'success',
          message,
        });
        pushToast('success', `${label}成功`, message);
        if (operationNotice) {
          pushToast('info', '请立即检查规则', operationNotice);
        }
      } catch {
        const rows = normalizeRows(parsed);
        const operationNotice = extractOperationNotice(parsed);
        const message = `${label}成功，当前表格展示本次操作返回的数据。${operationNotice ? ` ${operationNotice}` : ''}`;
        setTableRows(rows);
        setPagination(defaultPagination(rows.length));
        setTableStatus({
          tone: 'success',
          message,
        });
        pushToast('success', `${label}成功`, message);
        if (operationNotice) {
          pushToast('info', '请立即检查规则', operationNotice);
        }
      }
      return true;
    } catch (e) {
      const message = `请求失败：${String(e)}`;
      setTableRows([]);
      setTableStatus({ tone: 'danger', message });
      pushToast('danger', `${label}失败`, message);
      return false;
    }
  }

  async function handleManualRefresh() {
    if (!canRead) {
      const message = '当前账号没有查看该模块的权限。';
      setTableStatus({ tone: 'danger', message });
      pushToast('danger', '无权查看', message);
      return;
    }
    pushToast('info', '请求已提交', '正在刷新列表数据。');
    setTableStatus({ tone: 'info', message: '正在刷新列表数据。' });
    try {
      const refreshed = await refreshCurrentList(pagination.page);
      const message = listLoadedMessage('刷新成功', refreshed.pagination);
      setTableStatus({ tone: 'success', message });
      pushToast('success', '刷新成功', message);
    } catch (error) {
      const message = `刷新失败：${errorMessage(error)}`;
      setTableRows([]);
      setPagination(defaultPagination());
      setSelectedIds([]);
      setTableStatus({ tone: 'danger', message });
      pushToast('danger', '刷新失败', message);
    }
  }

  async function handlePageChange(page: number) {
    if (page === pagination.page || page < 1 || page > pagination.totalPages) return;
    pushToast('info', '请求已提交', `正在加载第 ${page} 页。`);
    setTableStatus({ tone: 'info', message: `正在加载第 ${page} 页。` });
    try {
      const refreshed = await refreshCurrentList(page);
      const message = listLoadedMessage('分页加载完成', refreshed.pagination);
      setTableStatus({ tone: 'success', message });
      pushToast('success', '分页加载完成', message);
    } catch (error) {
      const message = `分页加载失败：${errorMessage(error)}`;
      setTableStatus({ tone: 'danger', message });
      pushToast('danger', '分页加载失败', message);
    }
  }

  async function handleSiteImportFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (active.key !== 'sites') {
      const message = '请先进入站点管理再导入站点表格。';
      setTableStatus({ tone: 'danger', message });
      pushToast('danger', '批量导入失败', message);
      return;
    }
    if (!session) {
      const message = '请先登录后台。';
      setTableStatus({ tone: 'danger', message });
      pushToast('danger', '批量导入失败', message);
      return;
    }
    if (!canWrite) {
      const message = '当前账号没有站点写入权限。';
      setTableStatus({ tone: 'danger', message });
      pushToast('danger', '批量导入失败', message);
      return;
    }
    if (!/\.xlsx$/i.test(file.name)) {
      const message = '只支持上传 .xlsx 格式的站点导入表。';
      setTableStatus({ tone: 'danger', message });
      pushToast('danger', '批量导入失败', message);
      return;
    }
    if (file.size > 7 * 1024 * 1024) {
      const message = '导入表格不能超过 7MB，请拆分后再上传。';
      setTableStatus({ tone: 'danger', message });
      pushToast('danger', '批量导入失败', message);
      return;
    }

    setSiteImporting(true);
    setTableStatus({ tone: 'info', message: `正在导入 ${file.name}。` });
    pushToast('info', '批量导入中', `正在读取并创建 ${file.name} 里的站点。`);
    try {
      const dataBase64 = await fileToBase64(file);
      const result = await fetch(`${apiBaseUrl}/admin/sites/import-excel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          dataBase64,
        }),
      });
      const parsed = parseResponseBody(await result.text()) as SiteImportResponse;
      if (result.status === 401) {
        logout();
      }
      if (!result.ok) {
        throw new Error(extractErrorMessage(parsed));
      }

      const refreshed = await refreshCurrentList(1);
      const message = `${siteImportSummary(parsed)} 已刷新列表，共 ${refreshed.pagination.total} 条记录。`;
      const tone = parsed.failed?.length ? 'danger' : 'success';
      setTableStatus({ tone, message });
      pushToast(tone, '批量导入完成', message);
    } catch (error) {
      const message = `批量导入失败：${errorMessage(error)}`;
      setTableStatus({ tone: 'danger', message });
      pushToast('danger', '批量导入失败', message);
    } finally {
      setSiteImporting(false);
    }
  }

  async function uploadImage(file: File): Promise<string> {
    if (!session) {
      const message = '请先登录后台。';
      pushToast('danger', '图片上传失败', message);
      throw new Error(message);
    }
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    if (!allowedTypes.has(file.type)) {
      const message = '只支持 jpg、png、webp、gif 图片。';
      pushToast('danger', '图片上传失败', message);
      throw new Error(message);
    }
    if (file.size > 5 * 1024 * 1024) {
      const message = '图片不能超过 5MB。';
      pushToast('danger', '图片上传失败', message);
      throw new Error(message);
    }

    pushToast('info', '图片上传中', `正在上传 ${file.name}。`);
    const dataBase64 = await fileToBase64(file);
    let result: Response;
    try {
      result = await fetch(`${apiBaseUrl}/admin/uploads/images`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          dataBase64,
        }),
      });
    } catch (error) {
      const message = `上传请求失败：${errorMessage(error)}`;
      pushToast('danger', '图片上传失败', message);
      throw new Error(message);
    }
    const parsed = parseResponseBody(await result.text()) as UploadImageResponse;
    if (result.status === 401) {
      logout();
    }
    if (!result.ok || !parsed.url) {
      const message = extractErrorMessage(parsed);
      pushToast('danger', '图片上传失败', message);
      throw new Error(message);
    }

    pushToast(
      'success',
      parsed.duplicated ? '图片已存在' : '图片上传成功',
      parsed.duplicated ? '检测到重复图片，已返回图片桶原链接。' : '已自动回填图片桶链接。',
    );
    return parsed.url;
  }

  async function bulkDelete() {
    if (!selectedIds.length) {
      const message = '请先勾选要删除的记录。';
      setTableRows([]);
      setTableStatus({ tone: 'danger', message });
      pushToast('danger', '操作失败', message);
      return;
    }
    setConfirmDialog({
      title: '确认批量删除',
      message: `将删除已选中的 ${selectedIds.length} 条记录。删除后列表会自动刷新，请确认是否继续。`,
      confirmLabel: '删除选中',
      tone: 'danger',
      onConfirm: async () => {
        closeConfirmDialog();
        await request('POST', `${active.endpoint}/bulk-delete`, { ids: selectedIds });
      },
    });
  }

  async function syncSportsData() {
    if (!['matches', 'leagues', 'teams'].includes(active.key)) {
      return;
    }
    setTableStatus({ tone: 'info', message: '正在拉取赛事接口数据。' });
    await request('POST', `${active.endpoint}/sync`, {});
  }

  async function syncLiveReplayData() {
    if (active.key !== 'live-replays') {
      return;
    }
    setTableStatus({ tone: 'info', message: '正在拉取直播录像接口数据。' });
    await request('POST', `${active.endpoint}/sync`, siteFilter ? { siteId: siteFilter } : {});
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) => (checked ? unique([...current, id]) : current.filter((item) => item !== id)));
  }

  function toggleAllVisible(checked: boolean) {
    const visibleIds = filteredRows.map((row) => row.id).filter((id): id is string => typeof id === 'string');
    setSelectedIds(checked ? visibleIds : []);
  }

  function toggleCategoryExpanded(id: string) {
    setExpandedCategoryIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function expandAllCategories() {
    setExpandedCategoryIds(categoryIdsWithChildren(filteredRows));
  }

  function collapseAllCategories() {
    setExpandedCategoryIds([]);
  }

  function openCreateModal(defaultValues?: Partial<FormValues>) {
    setRecordId('');
    const baseValues = initialFormValues(fields, active.sample);
    if (defaultValues) {
      const cleanValues = { ...baseValues };
      Object.entries(defaultValues).forEach(([key, val]) => {
        if (val !== undefined) {
          cleanValues[key] = val;
        }
      });
      setFormValues(cleanValues);
    } else {
      setFormValues(baseValues);
    }
    setModalMode('create');
  }

  function openEditModal(row: TableRow) {
    const rowId = row.id;
    setRecordId(typeof rowId === 'string' ? rowId : '');
    setFormValues((current) =>
      fields.reduce<FormValues>((values, field) => {
        if (field.name === 'primaryDomain' && Object.prototype.hasOwnProperty.call(row, field.name)) {
          values[field.name] = siteHomeUrl(row[field.name], row.primaryProtocol) || formatFieldValue(field, row[field.name]);
        } else {
          values[field.name] = Object.prototype.hasOwnProperty.call(row, field.name)
            ? formatFieldValue(field, row[field.name])
            : current[field.name] ?? '';
        }
        return values;
      }, {}),
    );
    setModalMode('edit');
    setTableStatus({ tone: 'info', message: '已打开编辑弹窗，修改后提交即可刷新表格。' });
  }

  async function submitModal() {
    const ok = modalMode === 'create' ? await request('POST') : await request('PATCH');
    if (ok) {
      setModalMode(null);
    }
  }

  async function deleteRow(row: TableRow) {
    if (!canWrite || typeof row.id !== 'string') return;
    const rowId = row.id;
    const label = fullCellValue(row.name ?? row.title ?? row.username ?? row.key ?? row.id);
    setConfirmDialog({
      title: '确认删除记录',
      message: `将删除“${label}”。这个操作提交后会刷新当前列表。`,
      confirmLabel: '确认删除',
      tone: 'danger',
      onConfirm: async () => {
        closeConfirmDialog();
        await request('DELETE', `${active.endpoint}/${encodeURIComponent(rowId)}`);
      },
    });
  }

  async function publishRow(row: TableRow) {
    if (!canPublish || active.key !== 'news' || typeof row.id !== 'string') return;
    await request('POST', `${active.endpoint}/${encodeURIComponent(row.id)}/publish`, {});
  }

  async function runTaskRow(row: TableRow) {
    if (!canWrite || active.key !== 'scheduled-tasks' || typeof row.id !== 'string') return;
    await request('POST', `${active.endpoint}/${encodeURIComponent(row.id)}/run`, {});
  }

  function viewSite(row: TableRow) {
    const href = siteHomeUrl(row.primaryDomain, row.primaryProtocol);
    if (!href) {
      const message = '当前站点没有可打开的首页链接。';
      setTableStatus({ tone: 'danger', message });
      pushToast('danger', '无法打开站点', message);
      return;
    }
    pushToast('success', '已打开站点', `正在新窗口打开：${href}`);
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="crud-container">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <div className="card data-card">
        <div className="card-header">
          <div>
            <h2 className="card-title">{active.label}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>{active.summary}</p>
          </div>
          <span style={{ fontSize: '12px', background: 'var(--bg-accent)', padding: '4px 8px', borderRadius: '4px', fontWeight: '600' }}>
            {active.readPermission ? `${active.readPermission} / ${active.permission}` : active.permission}
          </span>
        </div>

        <div className="card-body">
          <div className="module-toolbar" aria-label={`${active.label}操作`}>
            <div className="module-toolbar-actions" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px', flexWrap: 'wrap' }}>
                {['news', 'live-replays'].includes(active.key) ? (
                  <select
                    aria-label={active.key === 'live-replays' ? '按站点筛选直播录像' : '按站点筛选新闻'}
                    className="form-input search-input"
                    onChange={(event) => {
                      setSiteFilter(event.target.value);
                      pushToast(
                        'info',
                        '筛选已切换',
                        event.target.value
                          ? `正在按站点加载${active.key === 'live-replays' ? '直播录像' : '新闻'}。`
                          : `正在加载全部站点${active.key === 'live-replays' ? '直播录像' : '新闻'}。`,
                      );
                    }}
                    style={{ maxWidth: '240px', margin: 0, height: '36px', borderRadius: '6px' }}
                    value={siteFilter}
                  >
                    <option value="">全部站点{active.key === 'live-replays' ? '直播录像' : '新闻'}</option>
                    {(dynamicOptions.siteId ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                <input
                  type="text"
                  placeholder="在当前列表中实时模糊搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input search-input"
                  style={{ maxWidth: '320px', margin: 0, height: '36px', borderRadius: '6px' }}
                />
                {searchQuery && (
                  <button className="btn btn-secondary" style={{ padding: '0 12px', height: '36px' }} onClick={() => setSearchQuery('')}>
                    清除
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['matches', 'leagues', 'teams'].includes(active.key) ? (
                  <button className="btn btn-secondary" style={{ height: '36px' }} disabled={!canWrite} onClick={syncSportsData}>
                    拉取赛事接口
                  </button>
                ) : null}
                {active.key === 'live-replays' ? (
                  <button className="btn btn-secondary" style={{ height: '36px' }} disabled={!canWrite} onClick={syncLiveReplayData}>
                    拉取录像接口
                  </button>
                ) : null}
                {active.key === 'sites' ? (
                  <label
                    className="btn btn-secondary"
                    style={{
                      alignItems: 'center',
                      cursor: canWrite && !siteImporting ? 'pointer' : 'not-allowed',
                      display: 'inline-flex',
                      height: '36px',
                      opacity: canWrite && !siteImporting ? 1 : 0.62,
                    }}
                    title="按 Excel 字段行批量创建站点"
                  >
                    {siteImporting ? '导入中...' : '批量导入'}
                    <input
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      disabled={!canWrite || siteImporting}
                      onChange={handleSiteImportFile}
                      style={{ display: 'none' }}
                      type="file"
                    />
                  </label>
                ) : null}
                <button className="btn btn-secondary" style={{ height: '36px' }} disabled={!canRead} onClick={handleManualRefresh}>
                  刷新列表
                </button>
                <button className="btn btn-primary" style={{ height: '36px' }} disabled={!canWrite} onClick={() => openCreateModal()}>
                  新增记录
                </button>
                <button className="btn btn-danger" style={{ height: '36px' }} disabled={!selectedIds.length || !canWrite} onClick={bulkDelete}>
                  删除选中
                </button>
              </div>
            </div>
            <p className="toolbar-hint">进入模块会自动加载列表；输入关键词可对本地数据的所有字段进行秒级实时检索。</p>
          </div>

          <div className="field-chip-row">
            {active.listFields.map((field) => (
              <span className="field-chip" key={field}>
                {field}
              </span>
            ))}
          </div>

          {active.key === 'categories' ? (
            <CategoryTreeTable
              canWrite={canWrite}
              expandedIds={expandedCategoryIds}
              onCollapseAll={collapseAllCategories}
              onDelete={deleteRow}
              onEdit={openEditModal}
              onExpandAll={expandAllCategories}
              onToggleAll={toggleAllVisible}
              onToggleExpand={toggleCategoryExpanded}
              onToggleRow={toggleSelected}
              rows={filteredRows}
              selectedIds={selectedIds}
              status={tableStatus}
              onAddSub={(parentId) => openCreateModal({ parentId })}
            />
          ) : (
            <DataTable
              activeKey={active.key}
              canPublish={canPublish}
              canWrite={canWrite}
              columns={tableColumns}
              onDelete={deleteRow}
              onEdit={openEditModal}
              onPublish={publishRow}
              onRunTask={runTaskRow}
              onViewSite={viewSite}
              onPageChange={handlePageChange}
              onToggleAll={toggleAllVisible}
              onToggleRow={toggleSelected}
              pagination={pagination}
              rows={filteredRows}
              selectedIds={selectedIds}
              siteLabels={siteLabelMap}
              status={tableStatus}
            />
          )}
        </div>
      </div>

      {modalMode ? (
        <CrudModal
          fields={fields}
          formValues={formValues}
          mode={modalMode}
          moduleKey={active.key}
          moduleLabel={active.label}
          onChange={(name, value) => setFormValues((current) => ({ ...current, [name]: value }))}
          onClose={() => setModalMode(null)}
          onSubmit={submitModal}
          onUploadImage={uploadImage}
          recordId={recordId}
        />
      ) : null}
      {confirmDialog ? (
        <ConfirmDialog
          confirmLabel={confirmDialog.confirmLabel}
          message={confirmDialog.message}
          onCancel={closeConfirmDialog}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          tone={confirmDialog.tone}
        />
      ) : null}
    </div>
  );
}

function CategoryTreeTable(props: {
  canWrite: boolean;
  rows: TableRow[];
  selectedIds: string[];
  status: TableStatus;
  expandedIds: string[];
  onEdit: (row: TableRow) => void;
  onDelete: (row: TableRow) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleRow: (id: string, checked: boolean) => void;
  onToggleExpand: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onAddSub: (parentId: string) => void;
}) {
  const selectableIds = props.rows.map((row) => row.id).filter((id): id is string => typeof id === 'string');
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => props.selectedIds.includes(id));
  const tree = buildCategoryTree(props.rows);
  const visibleNodes = flattenCategoryTree(tree, new Set(props.expandedIds));
  const childCount = props.rows.filter((row) => typeof row.parentId === 'string' && row.parentId.length > 0).length;

  return (
    <div className="category-tree-shell">
      <div className={`table-status table-status-${props.status.tone}`}>{props.status.message}</div>
      <div className="category-tree-toolbar">
        <label className="category-tree-check-all">
          <input
            aria-label="全选当前栏目"
            checked={allSelected}
            disabled={!selectableIds.length}
            onChange={(event) => props.onToggleAll(event.target.checked)}
            type="checkbox"
          />
          <span>全选当前栏目</span>
        </label>
        <div className="category-tree-summary">
          共 {props.rows.length} 个栏目，{Math.max(0, props.rows.length - childCount)} 个父栏目，{childCount} 个子栏目
        </div>
        <div className="category-tree-actions">
          <button className="table-action-button" onClick={props.onExpandAll} type="button">
            全部展开
          </button>
          <button className="table-action-button" onClick={props.onCollapseAll} type="button">
            全部收起
          </button>
        </div>
      </div>
      <div className="category-tree-list" role="tree" aria-label="父子栏目树">
        {visibleNodes.length ? (
          visibleNodes.map(({ node, depth }) => (
            <CategoryTreeRow
              canWrite={props.canWrite}
              depth={depth}
              expanded={typeof node.row.id === 'string' && props.expandedIds.includes(node.row.id)}
              key={rowKey(node.row, depth)}
              node={node}
              onDelete={props.onDelete}
              onEdit={props.onEdit}
              onAddSub={props.onAddSub}
              onToggleExpand={props.onToggleExpand}
              onToggleRow={props.onToggleRow}
              selected={typeof node.row.id === 'string' && props.selectedIds.includes(node.row.id)}
            />
          ))
        ) : props.status.tone === 'info' ? (
          <div className="category-tree-empty">正在加载栏目树。</div>
        ) : (
          <div className="category-tree-empty">暂无栏目数据。新增父栏目后，可以继续给它添加子栏目。</div>
        )}
      </div>
    </div>
  );
}

function CategoryTreeRow(props: {
  canWrite: boolean;
  depth: number;
  expanded: boolean;
  node: CategoryTreeNode;
  selected: boolean;
  onEdit: (row: TableRow) => void;
  onDelete: (row: TableRow) => void;
  onAddSub: (parentId: string) => void;
  onToggleRow: (id: string, checked: boolean) => void;
  onToggleExpand: (id: string) => void;
}) {
  const { row, children } = props.node;
  const id = typeof row.id === 'string' ? row.id : '';
  const hasChildren = children.length > 0;
  const name = fullCellValue(row.name);
  const slug = fullCellValue(row.slug);
  const description = fullCellValue(row.description);
  const language = fullCellValue(row.language);
  const sortOrder = fullCellValue(row.sortOrder);
  const status = typeof row.status === 'string' ? row.status : '';

  return (
    <div
      className={`category-tree-row ${props.depth > 0 ? 'is-child' : 'is-root'}`}
      role="treeitem"
      aria-expanded={hasChildren ? props.expanded : undefined}
      aria-selected={props.selected}
      style={{ '--category-depth': props.depth } as CSSProperties}
    >
      <div className="category-tree-main">
        <input
          aria-label={`选择 ${name}`}
          checked={props.selected}
          disabled={!id}
          onChange={(event) => props.onToggleRow(id, event.target.checked)}
          type="checkbox"
        />
        {hasChildren ? (
          <button
            aria-label={`${props.expanded ? '收起' : '展开'} ${name}`}
            className={`category-tree-toggle ${props.expanded ? 'is-expanded' : ''}`}
            onClick={() => props.onToggleExpand(id)}
            type="button"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        ) : (
          <span className="category-tree-toggle-spacer" />
        )}
        <div className="category-tree-copy">
          <div className="category-tree-title-line">
            <strong>{name}</strong>
            <span className={`category-tree-pill ${props.depth === 0 ? 'is-parent' : ''}`}>{props.depth === 0 ? '父栏目' : '子栏目'}</span>
            {hasChildren ? <span className="category-tree-pill is-info">{children.length} 个子栏目</span> : null}
            {status ? (
              <span className={`status-badge status-badge-${statusBadgeTone(status)}`}>
                {statusText(status)}
              </span>
            ) : null}
          </div>
          <div className="category-tree-meta">
            <span>Slug：{slug}</span>
            <span>语言：{language}</span>
            <span>排序：{sortOrder}</span>
            {id ? <span>ID：{id}</span> : null}
          </div>
          {description !== '-' ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="category-tree-row-actions">
        <button
          className="table-action-button success"
          disabled={!props.canWrite || !id}
          onClick={() => props.onAddSub(id)}
          title="在此栏目下添加子栏目"
          type="button"
        >
          添加子栏目
        </button>
        <button
          className="table-action-button"
          disabled={!props.canWrite || !id}
          onClick={() => props.onEdit(row)}
          type="button"
        >
          编辑
        </button>
        <button
          className="table-action-button danger"
          disabled={!props.canWrite || !id}
          onClick={() => props.onDelete(row)}
          type="button"
        >
          删除
        </button>
      </div>
    </div>
  );
}

function DataTable(props: {
  activeKey: string;
  canPublish: boolean;
  canWrite: boolean;
  columns: TableColumn[];
  rows: TableRow[];
  selectedIds: string[];
  status: TableStatus;
  onEdit: (row: TableRow) => void;
  onDelete: (row: TableRow) => void;
  onPublish: (row: TableRow) => void;
  onRunTask: (row: TableRow) => void;
  onViewSite: (row: TableRow) => void;
  onPageChange: (page: number) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleRow: (id: string, checked: boolean) => void;
  pagination: PaginationState;
  siteLabels: Record<string, string>;
}) {
  const selectableIds = props.rows.map((row) => row.id).filter((id): id is string => typeof id === 'string');
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => props.selectedIds.includes(id));

  return (
    <div className="data-table-shell">
      <div className={`table-status table-status-${props.status.tone}`}>{props.status.message}</div>
      <div className="data-table-scroll">
        <table className="data-table" style={{ minWidth: tableMinWidth(props.columns.length) }}>
          <thead>
            <tr>
              <th className="table-select-cell">
                <input
                  aria-label="全选当前表格记录"
                  checked={allSelected}
                  disabled={!selectableIds.length}
                  onChange={(event) => props.onToggleAll(event.target.checked)}
                  type="checkbox"
                />
              </th>
              {props.columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th className="table-action-cell" style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.length ? (
              props.rows.map((row, index) => (
                <tr key={rowKey(row, index)}>
                  <td className="table-select-cell">
                    {typeof row.id === 'string' ? (
                      <input
                        aria-label={`选择 ${fullCellValue(row.name ?? row.title ?? row.username ?? row.id)}`}
                        checked={props.selectedIds.includes(row.id)}
                        onChange={(event) => props.onToggleRow(String(row.id), event.target.checked)}
                        type="checkbox"
                      />
                    ) : null}
                  </td>
                  {props.columns.map((column) => {
                    const rawCellValue = row[column.key];
                    const cellUrl =
                      column.key === 'primaryDomain'
                        ? siteHomeUrl(rawCellValue, row.primaryProtocol)
                        : typeof rawCellValue === 'string' && /^https?:\/\//i.test(rawCellValue)
                          ? rawCellValue
                          : '';
                    return (
                      <td key={column.key}>
                        {cellUrl ? (
                          <a href={cellUrl} rel="noreferrer" target="_blank" title={cellUrl}>
                            {formatCellValue(cellUrl)}
                          </a>
                        ) : (
                          <CellValue
                            activeKey={props.activeKey}
                            columnKey={column.key}
                            siteLabels={props.siteLabels}
                            value={row[column.key]}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="table-action-cell">
                    <div className="table-row-actions" style={{ justifyContent: 'flex-end' }}>
                      <button
                        className="table-action-button"
                        disabled={!props.canWrite || typeof row.id !== 'string'}
                        onClick={() => props.onEdit(row)}
                        type="button"
                      >
                        编辑
                      </button>
                      <button
                        className="table-action-button danger"
                        disabled={!props.canWrite || typeof row.id !== 'string'}
                        onClick={() => props.onDelete(row)}
                        type="button"
                      >
                        删除
                      </button>
                      {props.activeKey === 'news' ? (
                        <button
                          className="table-action-button success"
                          disabled={!props.canPublish || typeof row.id !== 'string'}
                          onClick={() => props.onPublish(row)}
                          type="button"
                        >
                          发布
                        </button>
                      ) : null}
                      {props.activeKey === 'scheduled-tasks' ? (
                        <button
                          className="table-action-button success"
                          disabled={!props.canWrite || typeof row.id !== 'string'}
                          onClick={() => props.onRunTask(row)}
                          type="button"
                        >
                          立即执行
                        </button>
                      ) : null}
                      {props.activeKey === 'sites' ? (
                        <button
                          className="table-action-button success"
                          disabled={!siteHomeUrl(row.primaryDomain, row.primaryProtocol)}
                          onClick={() => props.onViewSite(row)}
                          type="button"
                        >
                          查看站点
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : props.status.tone === 'info' ? (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={`skeleton-${i}`} className="skeleton-row">
                    <td className="table-select-cell">
                      <div className="skeleton-element skeleton-checkbox"></div>
                    </td>
                    {props.columns.map((col) => (
                      <td key={`skeleton-cell-${col.key}`}>
                        <div className="skeleton-element skeleton-text"></div>
                      </td>
                    ))}
                    <td className="table-action-cell">
                      <div className="skeleton-element skeleton-button" style={{ marginLeft: 'auto' }}></div>
                    </td>
                  </tr>
                ))}
              </>
            ) : (
              <tr>
                <td className="table-empty" colSpan={props.columns.length + 2}>
                  正在加载或暂无表格数据。新增、修改、删除后列表会自动刷新。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {props.pagination.total > props.pagination.pageSize ? (
        <TablePagination pagination={props.pagination} onPageChange={props.onPageChange} />
      ) : null}
    </div>
  );
}

function CellValue(props: { activeKey: string; columnKey: string; siteLabels: Record<string, string>; value: unknown }) {
  const display = formatCellDisplayValue(props.activeKey, props.columnKey, props.value, props.siteLabels);
  const full = fullCellDisplayValue(props.activeKey, props.columnKey, props.value, props.siteLabels);

  if (isBadgeColumn(props.columnKey, props.value)) {
    return (
      <span className={`status-badge status-badge-${statusBadgeTone(String(props.value))}`} title={full}>
        {display}
      </span>
    );
  }

  return <span title={full}>{display}</span>;
}

function TablePagination(props: { pagination: PaginationState; onPageChange: (page: number) => void }) {
  const { pagination } = props;
  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.total, pagination.page * pagination.pageSize);

  return (
    <div className="table-pagination" aria-label="表格分页">
      <div className="pagination-summary">
        显示 {start}-{end} 条，共 {pagination.total} 条
      </div>
      <div className="pagination-actions">
        <button
          className="pagination-button"
          disabled={pagination.page <= 1}
          onClick={() => props.onPageChange(pagination.page - 1)}
          type="button"
        >
          上一页
        </button>
        {visiblePageNumbers(pagination.page, pagination.totalPages).map((page) => (
          <button
            aria-current={page === pagination.page ? 'page' : undefined}
            className={`pagination-button ${page === pagination.page ? 'active' : ''}`}
            key={page}
            onClick={() => props.onPageChange(page)}
            type="button"
          >
            {page}
          </button>
        ))}
        <button
          className="pagination-button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => props.onPageChange(pagination.page + 1)}
          type="button"
        >
          下一页
        </button>
      </div>
    </div>
  );
}

function ToastStack(props: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  if (!props.toasts.length) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-label="操作提示">
      {props.toasts.map((toast) => (
        <div className={`toast toast-${toast.tone}`} key={toast.id}>
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
          </div>
          <button aria-label="关闭提示" onClick={() => props.onDismiss(toast.id)} type="button">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog(props: {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  return (
    <div aria-labelledby="confirm-dialog-title" aria-modal="true" className="modal-backdrop confirm-backdrop" onClick={props.onCancel} role="dialog">
      <div className="confirm-panel" onClick={(event) => event.stopPropagation()}>
        <div className={`confirm-icon confirm-icon-${props.tone}`}>!</div>
        <div className="confirm-copy">
          <h2 id="confirm-dialog-title">{props.title}</h2>
          <p>{props.message}</p>
        </div>
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={props.onCancel} type="button">
            取消
          </button>
          <button
            className={props.tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => {
              void props.onConfirm();
            }}
            type="button"
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function CrudModal(props: {
  fields: FieldConfig[];
  formValues: FormValues;
  mode: Exclude<ModalMode, null>;
  moduleKey: string;
  moduleLabel: string;
  onChange: (name: string, value: string | boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
  onUploadImage: (file: File) => Promise<string>;
  recordId: string;
}) {
  const title = props.mode === 'create' ? `新增${props.moduleLabel}` : `修改${props.moduleLabel}`;
  const isSiteModule = props.moduleKey === 'sites';
  const isTdkModule = props.moduleKey === 'tdk-configs';
  const isUrlModule = props.moduleKey === 'url-configs';
  const [activeTab, setActiveTab] = useState(siteFormTabs[0].key);
  const tabConfig = siteFormTabs.find((tab) => tab.key === activeTab) ?? siteFormTabs[0];
  const visibleFields = visibleModalFields(props.fields, {
    isSiteModule,
    isTdkModule,
    tabConfig,
  });
  const isSeoModule = isTdkModule || isUrlModule;

  return (
    <div aria-labelledby="crud-modal-title" aria-modal="true" className="modal-backdrop" onClick={props.onClose} role="dialog">
      <div
        className={`drawer-panel ${isSiteModule ? 'site-editor-modal' : ''} ${isSeoModule ? 'seo-config-modal' : ''}`}
        style={{ maxWidth: isSiteModule || isSeoModule ? '1620px' : '800px', maxHeight: '85vh', borderRadius: '12px', margin: 'auto', animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <h2 id="crud-modal-title">{title}</h2>
            {props.mode === 'edit' ? <p>正在修改已选记录，保存后表格会自动刷新。</p> : <p>填写字段后提交，成功后表格会自动刷新。</p>}
          </div>
          <button aria-label="关闭弹窗" className="drawer-close" onClick={props.onClose} type="button">
            ×
          </button>
        </div>
        <div className="drawer-body">
          {isSiteModule ? (
            <div className="site-modal-tabs" aria-label="站点编辑模块">
              {siteFormTabs.map((tab) => (
                <button
                  aria-current={tab.key === activeTab ? 'page' : undefined}
                  className={`site-modal-tab ${tab.key === activeTab ? 'active' : ''}`}
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}
          {isSiteModule ? <p className="site-modal-tab-desc">{tabConfig.description}</p> : null}
          {isSeoModule ? (
            <div className="seo-config-layout">
              <SeoConfigHelpPanel type={isTdkModule ? 'tdk' : 'url'} />
              <div className="seo-config-form">
                <div className="modal-form-grid seo-form-grid">
                  {visibleFields.map((field) => (
                    <FormField
                      field={field}
                      key={field.name}
                      value={props.formValues[field.name] ?? ''}
                      onChange={(value) => props.onChange(field.name, value)}
                      onUploadImage={props.onUploadImage}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="modal-form-grid">
              {visibleFields.map((field) => (
                <FormField
                  field={field}
                  key={field.name}
                  value={props.formValues[field.name] ?? ''}
                  onChange={(value) => props.onChange(field.name, value)}
                  onUploadImage={props.onUploadImage}
                />
              ))}
            </div>
          )}
        </div>
        <div className="drawer-footer">
          <button className="btn btn-secondary" onClick={props.onClose} type="button">
            取消
          </button>
          <button className="btn btn-primary" onClick={props.onSubmit} type="button">
            {props.mode === 'create' ? '提交新增' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
}

function visibleModalFields(
  fields: FieldConfig[],
  input: {
    isSiteModule: boolean;
    isTdkModule: boolean;
    tabConfig: FormTabConfig;
  },
): FieldConfig[] {
  if (input.isSiteModule) {
    return input.tabConfig.fields
      .map((name) => fields.find((field) => field.name === name))
      .filter((field): field is FieldConfig => Boolean(field));
  }

  if (input.isTdkModule) {
    return ['siteId', 'name', 'status', 'rules']
      .map((name) => fields.find((field) => field.name === name))
      .filter((field): field is FieldConfig => Boolean(field));
  }

  return fields;
}

function SeoConfigHelpPanel(props: { type: 'tdk' | 'url' }) {
  const isTdk = props.type === 'tdk';
  const rows = isTdk ? tdkExampleRows : urlExampleRows;
  const variables = isTdk ? tdkVariableGroups : urlVariableGroups;

  return (
    <aside className="seo-help-panel" aria-label={isTdk ? 'TDK 模板说明' : 'URL 配置说明'}>
      <div className="seo-help-section">
        <h3>{isTdk ? 'TDK 模板说明' : 'URL 控制说明'}</h3>
        <p>
          {isTdk
            ? '这里控制首页、栏目页、内页的 Title、Keywords、Description。模板变量会在前台服务端渲染时替换。'
            : '这里控制首页、栏目页和内页链接结构。一级目录不固定，可以用 article、news、live、replay 等；栏目规则和内页规则保持同一前缀即可。'}
        </p>
      </div>
      <div className="seo-help-table-wrap">
        <table className="seo-help-table">
          <thead>
            <tr>
              <th>项目</th>
              <th>{isTdk ? '默认规则' : '默认 URL'}</th>
              <th>{isTdk ? '示例' : '说明'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.item}>
                <td>{row.item}</td>
                <td>{'rule' in row ? row.rule : row.pattern}</td>
                <td>{'sample' in row ? row.sample : row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="seo-variable-box">
        <h4>可用变量</h4>
        <div className="seo-variable-grid">
          {variables.map(([label, token]) => (
            <span key={token}>
              {label}:<code>{token}</code>
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}

function FormField(props: {
  field: FieldConfig;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
  onUploadImage?: (file: File) => Promise<string>;
}) {
  const { field, value, onChange, onUploadImage } = props;
  const [isUploading, setIsUploading] = useState(false);

  async function handleImageFileChange(file: File | undefined) {
    if (!file || !onUploadImage) return;
    setIsUploading(true);
    try {
      const uploadedUrl = await onUploadImage(file);
      onChange(uploadedUrl);
    } finally {
      setIsUploading(false);
    }
  }

  if (field.type === 'checkbox') {
    return (
      <label className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '26px' }}>
        <input checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
        <span className="form-label" style={{ margin: 0 }}>{field.label}</span>
      </label>
    );
  }

  if (field.type === 'multiselect') {
    const selected = selectedValues(value);
    if (field.name === 'liveProductIds') {
      const selectedLabels =
        field.options
          ?.filter((option) => selected.includes(option.value))
          .map((option) => option.label.split(' · ')[0])
          .join('、') || '请选择直播产品';

      return (
        <div className="form-group">
          <label className="form-label">{field.label}</label>
          <details className="multi-select-dropdown">
            <summary>{selectedLabels}</summary>
            <div className="checkbox-list">
              {field.options?.length ? (
                field.options.map((option) => (
                  <label className="checkbox-option" key={option.value}>
                    <input
                      checked={selected.includes(option.value)}
                      onChange={(event) => onChange(toggleValue(selected, option.value, event.target.checked).join(', '))}
                      type="checkbox"
                    />
                    <span>{option.label}</span>
                  </label>
                ))
              ) : (
                <span className="empty-options">暂无可选直播产品</span>
              )}
            </div>
          </details>
          {field.help ? <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '6px 0 0' }}>{field.help}</p> : null}
        </div>
      );
    }

    return (
      <div className="form-group">
        <label className="form-label">{field.label}</label>
        <div className="checkbox-list">
          {field.options?.length ? (
            field.options.map((option) => (
              <label className="checkbox-option" key={option.value}>
                <input
                  checked={selected.includes(option.value)}
                  onChange={(event) => onChange(toggleValue(selected, option.value, event.target.checked).join(', '))}
                  type="checkbox"
                />
                <span>{option.label}</span>
              </label>
            ))
          ) : (
            <span className="empty-options">暂无可选项</span>
          )}
        </div>
        {field.help ? <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '6px 0 0' }}>{field.help}</p> : null}
      </div>
    );
  }

  if (field.type === 'url-rules' || field.type === 'tdk-rules') {
    return (
      <SeoRulesField
        field={field}
        mode={field.type === 'url-rules' ? 'url' : 'tdk'}
        onChange={(rules) => onChange(JSON.stringify(rules))}
        value={parseSeoRules(value)}
      />
    );
  }

  if (field.type === 'image') {
    const imageUrl = String(value);

    return (
      <div className="form-group image-upload-field">
        <label className="form-label">{field.label}</label>
        <input
          className="form-input"
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder ?? 'https://img.example.com/path/image.webp'}
          type="url"
          value={imageUrl}
        />
        <div className="image-upload-row">
          <label className={`btn btn-secondary image-upload-button ${isUploading ? 'disabled' : ''}`}>
            {isUploading ? '上传中...' : '选择图片上传'}
            <input
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={isUploading}
              onChange={(event) => {
                handleImageFileChange(event.target.files?.[0]).catch((error) => {
                  console.error(error);
                });
                event.currentTarget.value = '';
              }}
              type="file"
            />
          </label>
          {imageUrl ? (
            <a className="image-upload-link" href={imageUrl} rel="noreferrer" target="_blank">
              打开图片
            </a>
          ) : null}
        </div>
        {imageUrl ? (
          <span
            aria-label={`${field.label}预览`}
            className="image-upload-preview"
            role="img"
            style={{ backgroundImage: `url("${imageUrl}")` }}
          />
        ) : null}
        {field.help ? <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '6px 0 0' }}>{field.help}</p> : null}
      </div>
    );
  }

  return (
    <div className="form-group">
      <label className="form-label">{field.label}</label>
      {field.type === 'textarea' ? (
        <textarea
          className="form-textarea"
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          style={{ minHeight: field.name === 'content' ? '180px' : '96px' }}
          value={String(value)}
        />
      ) : field.type === 'select' ? (
        <select className="form-input" onChange={(event) => onChange(event.target.value)} value={String(value)}>
          {field.allowEmpty ? <option value="">{referenceConfigs[field.name]?.emptyLabel ?? '不选择'}</option> : null}
          {!field.options?.length && !field.allowEmpty ? <option value="">暂无可选项</option> : null}
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="form-input"
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          type={
            field.type === 'number'
              ? 'number'
              : field.type === 'datetime'
                ? 'datetime-local'
                : field.type === 'url'
                  ? 'url'
                  : 'text'
          }
          value={String(value)}
        />
      )}
      {field.help ? <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '6px 0 0' }}>{field.help}</p> : null}
    </div>
  );
}

type SeoDetailRuleDraft = {
  id?: string;
  label: string;
  pageType: string;
  pattern?: string;
  titleTemplate?: string;
  keywordsTemplate?: string;
  descriptionTemplate?: string;
};

type SeoRuleDraft = {
  id?: string;
  categoryId: string;
  pageType: string;
  pattern?: string;
  titleTemplate?: string;
  keywordsTemplate?: string;
  descriptionTemplate?: string;
  detailRules: SeoDetailRuleDraft[];
};

type SeoRuleTreeNode = {
  rule: SeoRuleDraft;
  index: number;
  children: SeoRuleTreeNode[];
};

function SeoRulesField(props: {
  field: FieldConfig;
  mode: 'url' | 'tdk';
  onChange: (rules: SeoRuleDraft[]) => void;
  value: SeoRuleDraft[];
}) {
  const onRulesChange = props.onChange;
  const categories = useMemo(() => props.field.options ?? [], [props.field.options]);
  const rules = useMemo(
    () => normalizeSeoRulesForEditor(props.value, props.mode, categories),
    [categories, props.mode, props.value],
  );
  const ruleTree = useMemo(() => buildSeoRuleTree(rules, categories), [categories, rules]);
  const serializedInputRules = JSON.stringify(props.value);
  const serializedEditorRules = JSON.stringify(rules);

  useEffect(() => {
    if (serializedInputRules !== serializedEditorRules) {
      onRulesChange(rules);
    }
  }, [onRulesChange, rules, serializedEditorRules, serializedInputRules]);

  const updateRule = (index: number, patch: Partial<SeoRuleDraft>) => {
    props.onChange(
      rules.map((rule, ruleIndex) =>
        ruleIndex === index
          ? {
              ...rule,
              ...patch,
              detailRules:
                patch.pageType && rule.detailRules.length
                  ? [defaultSeoDetailRule(props.mode, String(patch.pageType), patch.pattern ?? rule.pattern)]
                  : rule.detailRules,
            }
          : rule,
      ),
    );
  };
  const updateRuleCategory = (index: number, categoryId: string) => {
    props.onChange(replaceSeoRuleWithCategorySubtree(rules, index, props.mode, categories, categoryId));
  };
  const addRule = () => {
    const missingCategoryId = nextMissingCategoryId(rules, categories);
    if (!missingCategoryId) return;
    props.onChange(addSeoRuleSubtree(rules, props.mode, categories, missingCategoryId));
  };
  const completeAllRules = () => props.onChange(completeSeoRules(rules, props.mode, categories));
  const removeRule = (index: number) => props.onChange(removeSeoRuleSubtree(rules, categories, index));
  const moveRule = (index: number, direction: 'up' | 'down') =>
    props.onChange(moveSeoRuleSubtree(rules, categories, index, direction));
  const updateDetailRule = (ruleIndex: number, detailIndex: number, patch: Partial<SeoDetailRuleDraft>) => {
    props.onChange(
      rules.map((rule, currentRuleIndex) => {
        if (currentRuleIndex !== ruleIndex) return rule;
        return {
          ...rule,
          detailRules: rule.detailRules.map((detail, currentDetailIndex) =>
            currentDetailIndex === detailIndex ? { ...detail, ...patch } : detail,
          ),
        };
      }),
    );
  };
  const addDetailRule = (ruleIndex: number) => {
    props.onChange(
      rules.map((rule, currentRuleIndex) =>
        currentRuleIndex === ruleIndex
          ? { ...rule, detailRules: [...rule.detailRules, defaultSeoDetailRule(props.mode, rule.pageType, rule.pattern)] }
          : rule,
      ),
    );
  };
  const removeDetailRule = (ruleIndex: number, detailIndex: number) => {
    props.onChange(
      rules.map((rule, currentRuleIndex) => {
        if (currentRuleIndex !== ruleIndex) return rule;
        return {
          ...rule,
          detailRules: rule.detailRules.filter((_detail, currentDetailIndex) => currentDetailIndex !== detailIndex),
        };
      }),
    );
  };

  return (
    <div className="form-group seo-rules-field">
      <div className="seo-rules-head">
        <div>
          <label className="form-label">{props.field.label}</label>
          <p>{props.mode === 'url' ? '一个 URL 配置里统一维护多个栏目页链接和对应内页链接。' : '一个 TDK 配置里统一维护多个栏目页 TDK 和对应内页 TDK。'}</p>
          <p>全站首页规则不绑定栏目，用来控制首页 `/` 的 URL/TDK；栏目规则才绑定具体父栏目或子栏目。</p>
        </div>
        <button className="btn btn-secondary" onClick={addRule} type="button">
          添加栏目规则
        </button>
        <button className="btn btn-secondary" onClick={completeAllRules} type="button">
          一键补齐全部栏目规则
        </button>
      </div>
      <div className="seo-rules-notice">
        当前配置已选择 {rules.filter((rule) => !isGlobalSeoRule(rule)).length} 个栏目规则；前台 tab 数量就按这些栏目规则展示。只有点击“一键补齐全部栏目规则”才会把所有父子栏目补进来。
      </div>
      <div className="seo-rules-stack">
        {ruleTree.map((node) => (
          <SeoRuleNodeCard
            categories={categories}
            depth={0}
            key={node.rule.id ?? `${node.rule.categoryId}-${node.index}`}
            mode={props.mode}
            node={node}
            onAddDetailRule={addDetailRule}
            onMoveRule={moveRule}
            onRemoveDetailRule={removeDetailRule}
            onRemoveRule={removeRule}
            onUpdateDetailRule={updateDetailRule}
            onUpdateRule={updateRule}
            onUpdateRuleCategory={updateRuleCategory}
          />
        ))}
      </div>
      {props.field.help ? <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '6px 0 0' }}>{props.field.help}</p> : null}
    </div>
  );
}

function SeoRuleNodeCard(props: {
  categories: FieldOption[];
  depth: number;
  mode: 'url' | 'tdk';
  node: SeoRuleTreeNode;
  onAddDetailRule: (ruleIndex: number) => void;
  onMoveRule: (ruleIndex: number, direction: 'up' | 'down') => void;
  onRemoveDetailRule: (ruleIndex: number, detailIndex: number) => void;
  onRemoveRule: (ruleIndex: number) => void;
  onUpdateDetailRule: (ruleIndex: number, detailIndex: number, patch: Partial<SeoDetailRuleDraft>) => void;
  onUpdateRule: (index: number, patch: Partial<SeoRuleDraft>) => void;
  onUpdateRuleCategory: (index: number, categoryId: string) => void;
}) {
  const { rule, index, children } = props.node;
  const category = props.categories.find((option) => option.value === rule.categoryId);
  const isGlobalRule = isGlobalSeoRule(rule);
  const isChild = Boolean(categoryParentId(category));
  const pageTypeChoices = isGlobalRule ? pageTypeOptions.filter((option) => option.value === 'HOME') : categoryPageTypeOptions;

  return (
    <section
      className={`seo-rule-card ${props.mode} ${isGlobalRule ? 'is-global-rule' : isChild ? 'is-child-rule' : 'is-parent-rule'} ${children.length ? 'has-child-rules' : ''}`}
      style={{ '--seo-rule-depth': props.depth } as CSSProperties}
    >
      <div className="seo-rule-card-header">
        <div>
          <strong>{isGlobalRule ? '全站首页规则' : isChild ? '子栏目规则' : '父栏目规则'}</strong>
          <span>{categoryLabel(props.categories, rule.categoryId)}</span>
          <div className="seo-rule-badges">
            <b className={`seo-rule-badge ${isGlobalRule ? 'global' : isChild ? 'child' : 'parent'}`}>
              {isGlobalRule ? '全站默认' : isChild ? '子栏目' : '父栏目'}
            </b>
            {children.length ? <b className="seo-rule-badge info">{children.length} 个子栏目规则在下方</b> : null}
          </div>
        </div>
        {!isGlobalRule ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="table-action-button" onClick={() => props.onMoveRule(index, 'up')} type="button">
              上移
            </button>
            <button className="table-action-button" onClick={() => props.onMoveRule(index, 'down')} type="button">
              下移
            </button>
            <button className="table-action-button danger" onClick={() => props.onRemoveRule(index)} type="button">
              移除规则
            </button>
          </div>
        ) : null}
      </div>
      <div className="seo-rule-grid">
        <label className="seo-rule-control">
          <span>绑定栏目</span>
          <select className="form-input" onChange={(event) => props.onUpdateRuleCategory(index, event.target.value)} value={rule.categoryId}>
            <option value="">全站首页（不绑定栏目）</option>
            <CategorySelectOptions categories={props.categories} />
          </select>
        </label>
        <label className="seo-rule-control">
          <span>页面用途</span>
          <select className="form-input" onChange={(event) => props.onUpdateRule(index, { pageType: event.target.value })} value={rule.pageType}>
            {pageTypeChoices.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {props.mode === 'url' ? (
          <label className="seo-rule-control">
            <span>栏目链接规则</span>
            <input
              className="form-input"
              onChange={(event) => props.onUpdateRule(index, { pattern: event.target.value })}
              placeholder="/article/{categorySlug}.html"
              value={rule.pattern ?? ''}
            />
          </label>
        ) : (
          <div className="tdk-rule-inputs">
            <input
              className="form-input"
              onChange={(event) => props.onUpdateRule(index, { titleTemplate: event.target.value })}
              placeholder="{columnName}_{siteName}"
              value={rule.titleTemplate ?? ''}
            />
            <input
              className="form-input"
              onChange={(event) => props.onUpdateRule(index, { keywordsTemplate: event.target.value })}
              placeholder="{columnName},{siteName}"
              value={rule.keywordsTemplate ?? ''}
            />
            <textarea
              className="form-textarea"
              onChange={(event) => props.onUpdateRule(index, { descriptionTemplate: event.target.value })}
              placeholder="{siteName}提供{columnName}最新内容。"
              value={rule.descriptionTemplate ?? ''}
            />
          </div>
        )}
      </div>

      {!isGlobalRule ? <div className="seo-detail-section">
        <div className="seo-detail-header">
          <strong>内页规则</strong>
          <button className="btn btn-secondary" onClick={() => props.onAddDetailRule(index)} type="button">
            添加内页规则
          </button>
        </div>
        {rule.detailRules.length ? (
          <div className="seo-detail-list">
            {rule.detailRules.map((detail, detailIndex) => (
              <div className={`seo-detail-row ${props.mode}`} key={detail.id ?? `${rule.id ?? index}-${detailIndex}`}>
                <div className="seo-detail-grid">
                  <input
                    className="form-input"
                    onChange={(event) => props.onUpdateDetailRule(index, detailIndex, { label: event.target.value })}
                    placeholder="内页规则名称"
                    value={detail.label}
                  />
                  <select
                    className="form-input"
                    onChange={(event) => props.onUpdateDetailRule(index, detailIndex, { pageType: event.target.value })}
                    value={detail.pageType}
                  >
                    {detailPageTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {props.mode === 'url' ? (
                    <input
                      className="form-input"
                      onChange={(event) => props.onUpdateDetailRule(index, detailIndex, { pattern: event.target.value })}
                      placeholder="/article/{categorySlug}/{articleSlug}.html"
                      value={detail.pattern ?? ''}
                    />
                  ) : (
                    <div className="tdk-rule-inputs">
                      <input
                        className="form-input"
                        onChange={(event) => props.onUpdateDetailRule(index, detailIndex, { titleTemplate: event.target.value })}
                        placeholder="{title}_{siteName}"
                        value={detail.titleTemplate ?? ''}
                      />
                      <input
                        className="form-input"
                        onChange={(event) => props.onUpdateDetailRule(index, detailIndex, { keywordsTemplate: event.target.value })}
                        placeholder="{title},{siteName}"
                        value={detail.keywordsTemplate ?? ''}
                      />
                      <textarea
                        className="form-textarea"
                        onChange={(event) => props.onUpdateDetailRule(index, detailIndex, { descriptionTemplate: event.target.value })}
                        placeholder="{summary}"
                        value={detail.descriptionTemplate ?? ''}
                      />
                    </div>
                  )}
                </div>
                <button className="table-action-button danger" onClick={() => props.onRemoveDetailRule(index, detailIndex)} type="button">
                  删除
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="seo-empty-state">还没有内页规则，点击上方按钮添加。</div>
        )}
      </div> : null}

      {children.length ? (
        <div className="seo-rule-children">
          <div className="seo-rule-children-title">子栏目规则</div>
          {children.map((child) => (
            <SeoRuleNodeCard
              categories={props.categories}
              depth={props.depth + 1}
              key={child.rule.id ?? `${child.rule.categoryId}-${child.index}`}
              mode={props.mode}
              node={child}
              onAddDetailRule={props.onAddDetailRule}
              onMoveRule={props.onMoveRule}
              onRemoveDetailRule={props.onRemoveDetailRule}
              onRemoveRule={props.onRemoveRule}
              onUpdateDetailRule={props.onUpdateDetailRule}
              onUpdateRule={props.onUpdateRule}
              onUpdateRuleCategory={props.onUpdateRuleCategory}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function parseSeoRules(value: string | boolean): SeoRuleDraft[] {
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(normalizeSeoRuleDraft).filter((rule): rule is SeoRuleDraft => Boolean(rule));
  } catch {
    return [];
  }
}

function CategorySelectOptions(props: { categories: FieldOption[] }) {
  const groups = buildCategoryOptionGroups(props.categories);
  if (!groups.length) {
    return <option value="">暂无栏目</option>;
  }

  return (
    <>
      {groups.map((group) =>
        group.children.length ? (
          <optgroup key={group.parent.value} label={`父栏目：${categoryOptionName(group.parent)}`}>
            <option value={group.parent.value}>{categoryOptionSelectLabel(group.parent, '父栏目')}</option>
            {group.children.map((child) => (
              <option key={child.value} value={child.value}>
                {categoryOptionSelectLabel(child, '子栏目')}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={group.parent.value} value={group.parent.value}>
            {categoryOptionSelectLabel(group.parent, categoryParentId(group.parent) ? '子栏目' : '父栏目')}
          </option>
        ),
      )}
    </>
  );
}

function normalizeSeoRulesForEditor(rules: SeoRuleDraft[], mode: 'url' | 'tdk', categories: FieldOption[]): SeoRuleDraft[] {
  const sourceRules = rules.length ? rules : [defaultSeoRule(mode, categories, '')];
  const normalizedRules = sourceRules.map((rule) => ensureSeoRuleHasDetailRule(rule, mode));
  if (normalizedRules.some(isGlobalSeoRule)) {
    return normalizedRules;
  }

  return [defaultSeoRule(mode, categories, ''), ...normalizedRules];
}

function addSeoRuleSubtree(
  rules: SeoRuleDraft[],
  mode: 'url' | 'tdk',
  categories: FieldOption[],
  categoryId: string,
): SeoRuleDraft[] {
  const existingCategoryIds = new Set(rules.map((rule) => rule.categoryId));
  const baseRule = defaultSeoRule(mode, categories, categoryId);
  const subtreeRules = [
    baseRule,
    ...descendantCategories(categories, categoryId).map((category) => cloneSeoRuleForCategory(baseRule, mode, category.value, categories)),
  ].filter((rule) => !existingCategoryIds.has(rule.categoryId));

  if (!subtreeRules.length) {
    return rules;
  }

  const globalRules = rules.filter(isGlobalSeoRule);
  const existingRules = rules.filter((rule) => !isGlobalSeoRule(rule));
  return [...globalRules, ...subtreeRules, ...existingRules];
}

function replaceSeoRuleWithCategorySubtree(
  rules: SeoRuleDraft[],
  index: number,
  mode: 'url' | 'tdk',
  categories: FieldOption[],
  categoryId: string,
): SeoRuleDraft[] {
  const currentRule = rules[index];
  if (!currentRule) return rules;

  const removeCategoryIds = new Set(categorySubtreeIds(categories, currentRule.categoryId));
  const replacementRules = addSeoRuleSubtree([], mode, categories, categoryId).map((rule, ruleIndex) =>
    ruleIndex === 0 ? { ...rule, id: currentRule.id } : rule,
  );
  const replacementCategoryIds = new Set(replacementRules.map((rule) => rule.categoryId));
  const before = rules.slice(0, index).filter((rule) => !removeCategoryIds.has(rule.categoryId));
  const after = rules
    .slice(index + 1)
    .filter((rule) => !removeCategoryIds.has(rule.categoryId) && !replacementCategoryIds.has(rule.categoryId));

  return [...before, ...replacementRules, ...after];
}

function removeSeoRuleSubtree(rules: SeoRuleDraft[], categories: FieldOption[], index: number): SeoRuleDraft[] {
  const rule = rules[index];
  if (!rule) return rules;

  const removeCategoryIds = new Set(categorySubtreeIds(categories, rule.categoryId));
  return rules.filter((candidate, ruleIndex) => ruleIndex !== index && !removeCategoryIds.has(candidate.categoryId));
}

function moveSeoRuleSubtree(
  rules: SeoRuleDraft[],
  categories: FieldOption[],
  index: number,
  direction: 'up' | 'down',
): SeoRuleDraft[] {
  const rule = rules[index];
  if (!rule || isGlobalSeoRule(rule)) return rules;

  const blockCategoryIds = new Set(categorySubtreeIds(categories, rule.categoryId));
  const blockIndices = rules
    .map((candidate, candidateIndex) => (blockCategoryIds.has(candidate.categoryId) ? candidateIndex : -1))
    .filter((candidateIndex) => candidateIndex >= 0);
  if (!blockIndices.length) return rules;

  const blockStart = Math.min(...blockIndices);
  const block = rules.filter((_candidate, candidateIndex) => blockIndices.includes(candidateIndex));
  const remaining = rules.filter((_candidate, candidateIndex) => !blockIndices.includes(candidateIndex));
  const remainingStart = rules.slice(0, blockStart).filter((_candidate, candidateIndex) => !blockIndices.includes(candidateIndex)).length;

  if (direction === 'up') {
    const previousIndex = findPreviousMovableRuleIndex(remaining, remainingStart - 1);
    if (previousIndex < 0) return rules;
    const insertIndex = topPresentAncestorRuleIndex(remaining, categories, previousIndex);
    return [...remaining.slice(0, insertIndex), ...block, ...remaining.slice(insertIndex)];
  }

  const nextIndex = findNextMovableRuleIndex(remaining, remainingStart);
  if (nextIndex < 0) return rules;
  const nextRootIndex = topPresentAncestorRuleIndex(remaining, categories, nextIndex);
  const nextBlockIds = new Set(categorySubtreeIds(categories, remaining[nextRootIndex]?.categoryId ?? ''));
  const nextBlockEnd = remaining.reduce(
    (lastIndex, candidate, candidateIndex) => (nextBlockIds.has(candidate.categoryId) ? candidateIndex : lastIndex),
    nextRootIndex,
  );
  const insertIndex = Math.min(nextBlockEnd + 1, remaining.length);
  return [...remaining.slice(0, insertIndex), ...block, ...remaining.slice(insertIndex)];
}

function findPreviousMovableRuleIndex(rules: SeoRuleDraft[], startIndex: number): number {
  for (let index = startIndex; index >= 0; index -= 1) {
    if (!isGlobalSeoRule(rules[index])) {
      return index;
    }
  }
  return -1;
}

function findNextMovableRuleIndex(rules: SeoRuleDraft[], startIndex: number): number {
  for (let index = startIndex; index < rules.length; index += 1) {
    if (!isGlobalSeoRule(rules[index])) {
      return index;
    }
  }
  return -1;
}

function topPresentAncestorRuleIndex(rules: SeoRuleDraft[], categories: FieldOption[], index: number): number {
  let currentIndex = index;
  let category = categories.find((candidate) => candidate.value === rules[currentIndex]?.categoryId);
  while (category) {
    const parentId = categoryParentId(category);
    const parentIndex = parentId ? rules.findIndex((rule) => rule.categoryId === parentId) : -1;
    if (parentIndex < 0) break;
    currentIndex = parentIndex;
    category = categories.find((candidate) => candidate.value === parentId);
  }
  return currentIndex;
}

function cloneSeoRuleForCategory(
  sourceRule: SeoRuleDraft,
  mode: 'url' | 'tdk',
  categoryId: string,
  categories: FieldOption[],
): SeoRuleDraft {
  const fallback = defaultSeoRule(mode, categories, categoryId);
  if (mode === 'url') {
    return {
      ...fallback,
      pageType: sourceRule.pageType,
      pattern: sourceRule.pattern ?? fallback.pattern,
      detailRules: sourceRule.detailRules.length
        ? sourceRule.detailRules.map((detail, index) => ({
            ...detail,
            id: undefined,
            label: `${categoryOptionName(categories.find((category) => category.value === categoryId) ?? { label: '栏目', value: categoryId })}内页${index ? index + 1 : ''}`,
          }))
        : fallback.detailRules,
    };
  }

  return {
    ...fallback,
    pageType: sourceRule.pageType,
    titleTemplate: sourceRule.titleTemplate ?? fallback.titleTemplate,
    keywordsTemplate: sourceRule.keywordsTemplate ?? fallback.keywordsTemplate,
    descriptionTemplate: sourceRule.descriptionTemplate ?? fallback.descriptionTemplate,
    detailRules: sourceRule.detailRules.length
      ? sourceRule.detailRules.map((detail, index) => ({
          ...detail,
          id: undefined,
          label: `${categoryOptionName(categories.find((category) => category.value === categoryId) ?? { label: '栏目', value: categoryId })}内页${index ? index + 1 : ''}`,
        }))
      : fallback.detailRules,
  };
}

function categorySubtreeIds(categories: FieldOption[], categoryId: string): string[] {
  if (!categoryId) return [categoryId];
  return [categoryId, ...descendantCategories(categories, categoryId).map((category) => category.value)];
}

function descendantCategories(categories: FieldOption[], parentId: string): FieldOption[] {
  const descendants: FieldOption[] = [];
  const visit = (categoryId: string) => {
    categories
      .filter((category) => categoryParentId(category) === categoryId)
      .forEach((child) => {
        descendants.push(child);
        visit(child.value);
      });
  };
  visit(parentId);
  return descendants;
}

function completeSeoRules(rules: SeoRuleDraft[], mode: 'url' | 'tdk', categories: FieldOption[]): SeoRuleDraft[] {
  const categoryIds = categories.map((category) => category.value).filter(Boolean);
  const sourceRules = rules.length ? rules : [];
  const globalRule = sourceRules.find(isGlobalSeoRule);
  const ruleByCategoryId = new Map(
    sourceRules
      .filter((rule) => !isGlobalSeoRule(rule))
      .map((rule) => [rule.categoryId, ensureSeoRuleHasDetailRule(rule, mode)]),
  );

  categoryIds.forEach((categoryId) => {
    if (!ruleByCategoryId.has(categoryId)) {
      ruleByCategoryId.set(categoryId, defaultSeoRule(mode, categories, categoryId));
    }
  });

  const completedRules = [
    ensureSeoRuleHasDetailRule(globalRule ?? defaultSeoRule(mode, categories, ''), mode),
    ...sourceRules
      .filter((rule) => !isGlobalSeoRule(rule))
      .map((rule) => ruleByCategoryId.get(rule.categoryId))
      .filter((rule): rule is SeoRuleDraft => Boolean(rule)),
    ...categoryIds
      .filter((categoryId) => !sourceRules.some((rule) => rule.categoryId === categoryId))
      .map((categoryId) => ruleByCategoryId.get(categoryId))
      .filter((rule): rule is SeoRuleDraft => Boolean(rule)),
  ];

  return completedRules.length ? completedRules : [defaultSeoRule(mode, categories, '')];
}

function buildSeoRuleTree(rules: SeoRuleDraft[], categories: FieldOption[]): SeoRuleTreeNode[] {
  const categoryById = new Map(categories.map((category) => [category.value, category]));
  const nodeByCategoryId = new Map<string, SeoRuleTreeNode>();
  const nodes = rules.map((rule, index) => {
    const node = { rule, index, children: [] };
    nodeByCategoryId.set(rule.categoryId, node);
    return node;
  });
  const roots: SeoRuleTreeNode[] = [];

  nodes.forEach((node) => {
    const category = categoryById.get(node.rule.categoryId);
    const parentId = categoryParentId(category);
    const parentNode = parentId ? nodeByCategoryId.get(parentId) : undefined;
    if (parentNode && parentNode !== node) {
      parentNode.children.push(node);
      return;
    }
    roots.push(node);
  });

  return roots;
}

function buildCategoryOptionGroups(categories: FieldOption[]): Array<{ parent: FieldOption; children: FieldOption[] }> {
  const categoryById = new Map(categories.map((category) => [category.value, category]));
  const childrenByParentId = new Map<string, FieldOption[]>();
  const roots: FieldOption[] = [];

  categories.forEach((category) => {
    const parentId = categoryParentId(category);
    if (parentId && categoryById.has(parentId)) {
      const children = childrenByParentId.get(parentId) ?? [];
      children.push(category);
      childrenByParentId.set(parentId, children);
      return;
    }
    roots.push(category);
  });

  return roots.map((parent) => ({
    parent,
    children: childrenByParentId.get(parent.value) ?? [],
  }));
}

function categoryParentId(category?: FieldOption): string {
  return typeof category?.meta?.parentId === 'string' ? category.meta.parentId : '';
}

function categoryOptionName(category: FieldOption): string {
  const name = textValue(category.meta?.name);
  return name === '-' ? category.label : name;
}

function categoryOptionSlug(category: FieldOption): string {
  const slug = textValue(category.meta?.slug);
  return slug === '-' ? category.value : slug;
}

function categoryOptionSelectLabel(category: FieldOption, level: '父栏目' | '子栏目'): string {
  return `${level}：${categoryOptionName(category)} · ${categoryOptionSlug(category)}`;
}

function isGlobalSeoRule(rule: Pick<SeoRuleDraft, 'categoryId' | 'pageType'>): boolean {
  return rule.pageType === 'HOME' || rule.categoryId.trim() === '';
}

function ensureSeoRuleHasDetailRule(rule: SeoRuleDraft, mode: 'url' | 'tdk'): SeoRuleDraft {
  if (isGlobalSeoRule(rule)) {
    return {
      ...rule,
      categoryId: '',
      pageType: 'HOME',
      detailRules: [],
    };
  }

  return {
    ...rule,
    detailRules: rule.detailRules.length ? rule.detailRules : [defaultSeoDetailRule(mode, rule.pageType, rule.pattern)],
  };
}

function nextMissingCategoryId(rules: SeoRuleDraft[], categories: FieldOption[]): string | undefined {
  const used = new Set(rules.map((rule) => rule.categoryId));
  return categories.find((category) => !used.has(category.value))?.value;
}

function defaultSeoRule(mode: 'url' | 'tdk', categories: FieldOption[], categoryId = categories[0]?.value ?? ''): SeoRuleDraft {
  if (!categoryId) {
    if (mode === 'url') {
      return {
        categoryId: '',
        pageType: 'HOME',
        pattern: '/',
        detailRules: [],
      };
    }

    return {
      categoryId: '',
      pageType: 'HOME',
      titleTemplate: '{siteName} - 今日体育新闻、直播赛程与赛事分析',
      keywordsTemplate: '{siteName},体育新闻,赛事直播,足球赛程,篮球赛程',
      descriptionTemplate: '{siteName}实时整理足球、篮球、热门赛事、球队动态和直播信息。',
      detailRules: [],
    };
  }

  const category = categories.find((option) => option.value === categoryId);
  const pageType = defaultCategoryPageType(category);
  if (mode === 'url') {
    const pattern = defaultCategoryUrlPattern(pageType);
    return {
      categoryId,
      pageType,
      pattern,
      detailRules: [defaultSeoDetailRule(mode, pageType, pattern)],
    };
  }

  return {
    categoryId,
    pageType,
    titleTemplate: defaultCategoryTitleTemplate(pageType),
    keywordsTemplate: defaultCategoryKeywordsTemplate(pageType),
    descriptionTemplate: defaultCategoryDescriptionTemplate(pageType),
    detailRules: [defaultSeoDetailRule(mode, pageType)],
  };
}

function defaultCategoryPageType(category?: FieldOption): string {
  const value = `${category?.label ?? ''} ${textValue(category?.meta?.name)} ${textValue(category?.meta?.slug)}`;
  if (/录像|回放|视频|replay|video/i.test(value)) return 'VIDEO_CATEGORY';
  if (/新闻|资讯|快讯|动态|分析|观察|情报|news|article|info|analysis|insight|update/i.test(value)) return 'NEWS_CATEGORY';
  if (/直播|赛程|live|schedule|zhibo|足球|篮球|football|basketball|nba|cba/i.test(value)) return 'MATCH_CATEGORY';
  return 'NEWS_CATEGORY';
}

function defaultCategoryUrlPattern(pageType: string): string {
  if (pageType === 'MATCH_CATEGORY') return '/zhibo/{categorySlug}.html';
  if (pageType === 'VIDEO_CATEGORY') return '/video/{categorySlug}.html';
  return '/news/{categorySlug}.html';
}

function defaultCategoryTitleTemplate(pageType: string): string {
  if (pageType === 'MATCH_CATEGORY') return '{columnName}_高清直播在线_{siteName}';
  if (pageType === 'VIDEO_CATEGORY') return '{columnName}_比赛回放_{siteName}';
  return '{columnName}-{siteName}';
}

function defaultCategoryKeywordsTemplate(pageType: string): string {
  if (pageType === 'MATCH_CATEGORY') return '{columnName},高清直播,{siteName}';
  if (pageType === 'VIDEO_CATEGORY') return '{columnName},录像回放,{siteName}';
  return '{columnName},{siteName}';
}

function defaultCategoryDescriptionTemplate(pageType: string): string {
  if (pageType === 'MATCH_CATEGORY') return '{siteName}提供{columnName}、赛程和多线路直播入口。';
  if (pageType === 'VIDEO_CATEGORY') return '{siteName}{columnName}栏目提供热门比赛录像、集锦和回放入口。';
  return '{siteName}提供{columnName}最新内容。';
}

function defaultSeoDetailRule(mode: 'url' | 'tdk', parentPageType: string, parentPattern?: string): SeoDetailRuleDraft {
  const detailPageType = defaultDetailPageTypeForPageType(parentPageType);
  if (mode === 'url') {
    return {
      label: '内页规则 1',
      pageType: detailPageType,
      pattern: defaultDetailUrlPattern(detailPageType, parentPattern),
    };
  }

  const titleTemplate =
    detailPageType === 'MATCH_DETAIL'
      ? '{homeTeam}VS{awayTeam}{leagueName}高清直播无插件_{siteName}'
      : detailPageType === 'VIDEO_DETAIL'
        ? '{title}录像回放_{siteName}'
        : '{title}_{siteName}';
  const keywordsTemplate =
    detailPageType === 'MATCH_DETAIL'
      ? '{homeTeam},{awayTeam},{leagueName}直播,{siteName}'
      : detailPageType === 'VIDEO_DETAIL'
        ? '{title}录像,{title}回放,{siteName}'
        : '{title},{siteName}';
  const descriptionTemplate =
    detailPageType === 'MATCH_DETAIL'
      ? '{homeTeam}对阵{awayTeam}，{leagueName}比赛时间{matchTime2}，在{siteName}查看直播入口和赛前分析。'
      : detailPageType === 'VIDEO_DETAIL'
        ? '观看{title}录像回放、比赛集锦和赛后数据。'
        : '{summary}';

  return {
    label: '内页规则 1',
    pageType: detailPageType,
    titleTemplate,
    keywordsTemplate,
    descriptionTemplate,
  };
}

function defaultDetailUrlPattern(detailPageType: string, parentPattern?: string): string {
  const suffix =
    detailPageType === 'MATCH_DETAIL'
      ? '{matchId}-{slug}'
      : detailPageType === 'VIDEO_DETAIL'
        ? '{videoSlug}'
        : '{articleSlug}';
  const fallback =
    detailPageType === 'MATCH_DETAIL'
      ? `/zhibo/{categorySlug}/${suffix}.html`
      : detailPageType === 'VIDEO_DETAIL'
        ? `/video/{categorySlug}/${suffix}.html`
        : `/news/{categorySlug}/${suffix}.html`;

  const normalizedParentPattern = parentPattern?.trim();
  if (!normalizedParentPattern || normalizedParentPattern === '/') {
    return fallback;
  }

  const extensionMatch = normalizedParentPattern.match(/(\.[a-z0-9]+)$/i);
  const extension = extensionMatch?.[1] ?? '';
  const withoutExtension = extension ? normalizedParentPattern.slice(0, -extension.length) : normalizedParentPattern;
  const withoutTrailingSlash = withoutExtension.replace(/\/+$/, '');
  return `${withoutTrailingSlash}/${suffix}${extension}`;
}

function defaultDetailPageTypeForPageType(pageType: string): string {
  if (pageType === 'MATCH_CATEGORY') return 'MATCH_DETAIL';
  if (pageType === 'VIDEO_CATEGORY') return 'VIDEO_DETAIL';
  return 'NEWS_DETAIL';
}

function normalizeSeoRuleDraft(value: unknown): SeoRuleDraft | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const categoryId = typeof value.categoryId === 'string' ? value.categoryId.trim() : '';
  const pageType = typeof value.pageType === 'string' ? value.pageType.trim() : '';
  if (!pageType || (!categoryId && pageType !== 'HOME')) {
    return undefined;
  }

  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    categoryId,
    pageType,
    pattern: typeof value.pattern === 'string' ? value.pattern : undefined,
    titleTemplate: typeof value.titleTemplate === 'string' ? value.titleTemplate : undefined,
    keywordsTemplate: typeof value.keywordsTemplate === 'string' ? value.keywordsTemplate : undefined,
    descriptionTemplate: typeof value.descriptionTemplate === 'string' ? value.descriptionTemplate : undefined,
    detailRules: Array.isArray(value.detailRules)
      ? value.detailRules.map(normalizeSeoDetailRuleDraft).filter((rule): rule is SeoDetailRuleDraft => Boolean(rule))
      : [],
  };
}

function normalizeSeoDetailRuleDraft(value: unknown): SeoDetailRuleDraft | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const label = typeof value.label === 'string' ? value.label.trim() : '';
  const pageType = typeof value.pageType === 'string' ? value.pageType.trim() : '';
  if (!label || !pageType) {
    return undefined;
  }

  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    label,
    pageType,
    pattern: typeof value.pattern === 'string' ? value.pattern : undefined,
    titleTemplate: typeof value.titleTemplate === 'string' ? value.titleTemplate : undefined,
    keywordsTemplate: typeof value.keywordsTemplate === 'string' ? value.keywordsTemplate : undefined,
    descriptionTemplate: typeof value.descriptionTemplate === 'string' ? value.descriptionTemplate : undefined,
  };
}

function sanitizeSeoRules(rules: SeoRuleDraft[], mode: 'url' | 'tdk'): SeoRuleDraft[] {
  return rules.map((rule) => sanitizeSeoRuleDraft(rule, mode)).filter((rule): rule is SeoRuleDraft => Boolean(rule));
}

function sanitizeSeoRuleDraft(rule: SeoRuleDraft, mode: 'url' | 'tdk'): SeoRuleDraft | undefined {
  const categoryId = rule.categoryId.trim();
  const pageType = rule.pageType.trim();
  if (!pageType || (!categoryId && pageType !== 'HOME')) {
    return undefined;
  }

  if (pageType === 'HOME') {
    if (mode === 'url') {
      const pattern = rule.pattern?.trim();
      if (!pattern) {
        return undefined;
      }
      return {
        ...rule,
        categoryId: '',
        pageType: 'HOME',
        pattern,
        titleTemplate: undefined,
        keywordsTemplate: undefined,
        descriptionTemplate: undefined,
        detailRules: [],
      };
    }

    const titleTemplate = rule.titleTemplate?.trim();
    if (!titleTemplate) {
      return undefined;
    }
    return {
      ...rule,
      categoryId: '',
      pageType: 'HOME',
      pattern: undefined,
      titleTemplate,
      keywordsTemplate: rule.keywordsTemplate?.trim() || undefined,
      descriptionTemplate: rule.descriptionTemplate?.trim() || undefined,
      detailRules: [],
    };
  }

  const detailRules = rule.detailRules
    .map((detail) => sanitizeSeoDetailRuleDraft(detail, mode))
    .filter((detail): detail is SeoDetailRuleDraft => Boolean(detail));
  if (mode === 'url') {
    const pattern = rule.pattern?.trim();
    if (!pattern) {
      return undefined;
    }
    const safeDetailRules = detailRules.length ? detailRules : [defaultSeoDetailRule(mode, pageType, pattern)];

    return {
      ...rule,
      categoryId,
      pageType,
      pattern,
      titleTemplate: undefined,
      keywordsTemplate: undefined,
      descriptionTemplate: undefined,
      detailRules: safeDetailRules,
    };
  }

  const safeDetailRules = detailRules.length ? detailRules : [defaultSeoDetailRule(mode, pageType)];
  const titleTemplate = rule.titleTemplate?.trim();
  if (!titleTemplate) {
    return undefined;
  }

  return {
    ...rule,
    categoryId,
    pageType,
    pattern: undefined,
    titleTemplate,
    keywordsTemplate: rule.keywordsTemplate?.trim() || undefined,
    descriptionTemplate: rule.descriptionTemplate?.trim() || undefined,
    detailRules: safeDetailRules,
  };
}

function sanitizeSeoDetailRuleDraft(detail: SeoDetailRuleDraft, mode: 'url' | 'tdk'): SeoDetailRuleDraft | undefined {
  const label = detail.label.trim();
  const pageType = detail.pageType.trim();
  if (!label || !pageType) {
    return undefined;
  }

  if (mode === 'url') {
    const pattern = detail.pattern?.trim();
    if (!pattern) {
      return undefined;
    }

    return {
      ...detail,
      label,
      pageType,
      pattern,
      titleTemplate: undefined,
      keywordsTemplate: undefined,
      descriptionTemplate: undefined,
    };
  }

  const titleTemplate = detail.titleTemplate?.trim();
  if (!titleTemplate) {
    return undefined;
  }

  return {
    ...detail,
    label,
    pageType,
    pattern: undefined,
    titleTemplate,
    keywordsTemplate: detail.keywordsTemplate?.trim() || undefined,
    descriptionTemplate: detail.descriptionTemplate?.trim() || undefined,
  };
}

function buildFields(module: ModuleConfig, dynamicOptions: DynamicOptions): FieldConfig[] {
  return Object.entries(module.sample).map(([name, value]) => {
    const meta = fieldMeta[name] ?? { label: name };
    const reference = referenceConfigs[name];
    const isSeoConfigScopeField = ['url-configs', 'tdk-configs'].includes(module.key) && name === 'siteId';
    const options =
      name === 'rules' && ['url-configs', 'tdk-configs'].includes(module.key)
        ? dynamicOptions.rules ?? []
        : reference
          ? dynamicOptions[name] ?? []
          : selectOptions(module.key, name);
    const type =
      name === 'rules' && module.key === 'url-configs'
        ? 'url-rules'
        : name === 'rules' && module.key === 'tdk-configs'
          ? 'tdk-rules'
          : reference?.multiple
            ? 'multiselect'
            : meta.type ?? inferFieldType(name, value, options);

    return {
      name,
      label: isSeoConfigScopeField ? '适用范围' : meta.label ?? name,
      type,
      placeholder: meta.placeholder,
      help: isSeoConfigScopeField
        ? '不选择就是全站默认，所有站点都能复用；选择站点则只给该站点专用。'
        : reference
          ? meta.help ?? '从系统已有数据中选择，不需要手动填写 ID。'
          : meta.help,
      options,
      allowEmpty: reference?.allowEmpty || isSeoConfigScopeField,
      emptyValue: isSeoConfigScopeField ? null : undefined,
    };
  });
}

function inferFieldType(name: string, value: unknown, options?: FieldOption[]): FieldType {
  if (options) return 'select';
  if (Array.isArray(value)) return 'tags';
  if (typeof value === 'boolean') return 'checkbox';
  if (typeof value === 'number') return 'number';
  if (name.endsWith('At') || name.endsWith('Time')) return 'datetime';
  if (['content', 'summary', 'description', 'remark', 'analyticsCode', 'seoKeywords', 'seoDescription'].includes(name)) {
    return 'textarea';
  }
  return 'text';
}

function selectOptions(moduleKey: string, name: string): FieldOption[] | undefined {
  if (name === 'status') {
    if (moduleKey === 'sites') return siteStatusOptions;
    if (moduleKey === 'news') return publishStatusOptions;
    if (moduleKey === 'matches') return matchStatusOptions;
    if (moduleKey === 'scheduled-tasks') return scheduledTaskStatusOptions;
    return activeStatusOptions;
  }
  if (name === 'type' && moduleKey === 'scheduled-tasks') {
    return scheduledTaskTypeOptions;
  }
  if (name === 'seoIndexStatus') {
    return [
      { label: '允许收录', value: 'INDEX' },
      { label: '不收录但跟踪链接', value: 'NOINDEX' },
      { label: '仅跟踪', value: 'FOLLOW_ONLY' },
    ];
  }
  if (name === 'pageType') {
    return pageTypeOptions;
  }
  if (name === 'sport') {
    return [
      { label: '足球', value: 'FOOTBALL' },
      { label: '篮球', value: 'BASKETBALL' },
    ];
  }
  if (name === 'slot') {
    return [
      { label: '首页首屏', value: 'HOME_HERO' },
      { label: '首页资讯后', value: 'HOME_AFTER_NEWS' },
      { label: '栏目顶部', value: 'CATEGORY_TOP' },
      { label: '栏目侧栏', value: 'CATEGORY_SIDEBAR' },
      { label: '新闻顶部', value: 'NEWS_TOP' },
      { label: '新闻正文中', value: 'NEWS_INLINE' },
      { label: '新闻底部', value: 'NEWS_BOTTOM' },
      { label: '全站浮动', value: 'GLOBAL_FLOAT' },
    ];
  }
  if (name === 'renderStyle') {
    return [
      { label: '文字链接', value: 'TEXT_LINK' },
      { label: '图片横幅', value: 'IMAGE_BANNER' },
      { label: '按钮', value: 'BUTTON' },
      { label: '卡片', value: 'CARD' },
      { label: '浮动入口', value: 'FLOATING' },
    ];
  }
  if (name === 'device') {
    return [
      { label: '全部设备', value: 'ALL' },
      { label: '桌面端', value: 'DESKTOP' },
      { label: '移动端', value: 'MOBILE' },
    ];
  }
  return undefined;
}

function optionFromRow(row: TableRow, config: ReferenceConfig): FieldOption | undefined {
  const value = config.value?.(row) ?? (typeof row.id === 'string' ? row.id : undefined);
  if (!value) {
    return undefined;
  }
  return {
    value,
    label: config.label(row),
    meta: row,
  };
}

function categoryOptionsFromRows(rows: TableRow[]): FieldOption[] {
  const rowById = new Map<string, TableRow>();
  rows.forEach((row) => {
    if (typeof row.id === 'string') {
      rowById.set(row.id, row);
    }
  });

  const options: FieldOption[] = [];
  [...rows]
    .sort((left, right) => categorySortValue(left) - categorySortValue(right) || fullCellValue(left.name).localeCompare(fullCellValue(right.name)))
    .forEach((row) => {
      const id = typeof row.id === 'string' ? row.id : '';
      if (!id) return;
      const path = categoryNamePath(row, rowById);
      const isChild = typeof row.parentId === 'string' && row.parentId.length > 0;
      options.push({
        value: id,
        label: `${isChild ? '子栏目' : '父栏目'}：${path} · ${textValue(row.slug)}`,
        meta: row,
      });
    });
  return options;
}

function categoryNamePath(row: TableRow, rowById: Map<string, TableRow>): string {
  const names = [textValue(row.name)];
  let parentId = typeof row.parentId === 'string' ? row.parentId : '';
  const seen = new Set<string>();

  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = rowById.get(parentId);
    if (!parent) break;
    names.unshift(textValue(parent.name));
    parentId = typeof parent.parentId === 'string' ? parent.parentId : '';
  }

  return names.join(' / ');
}

function selectedValues(value: string | boolean): string[] {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function toggleValue(values: string[], value: string, checked: boolean): string[] {
  return checked ? unique([...values, value]) : values.filter((item) => item !== value);
}

function initialFormValues(fields: FieldConfig[], sample: Record<string, unknown>): FormValues {
  return fields.reduce<FormValues>((values, field) => {
    values[field.name] = formatFieldValue(field, sample[field.name]);
    return values;
  }, {});
}

function formatFieldValue(field: FieldConfig, value: unknown): string | boolean {
  if (field.type === 'checkbox') {
    return Boolean(value);
  }
  if ((field.type === 'tags' || field.type === 'multiselect') && Array.isArray(value)) {
    return value.join(', ');
  }
  if ((field.type === 'url-rules' || field.type === 'tdk-rules') && Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (field.type === 'datetime' && typeof value === 'string') {
    return toDatetimeLocal(value);
  }
  if (field.name === 'primaryDomain' && typeof value === 'string' && value.length > 0) {
    return siteHomeUrl(value, protocolFromUrlInput(value)) || value;
  }
  if (field.name === 'config' && isRecord(value)) {
    return JSON.stringify(value, null, 2);
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

function buildPayload(fields: FieldConfig[], values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    const value = values[field.name];
    if (field.type !== 'checkbox' && (value === undefined || value === '')) {
      if (field.emptyValue !== undefined) {
        payload[field.name] = field.emptyValue;
      }
      continue;
    }

    if (field.type === 'checkbox') {
      payload[field.name] = Boolean(value);
    } else if (field.type === 'number') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        payload[field.name] = parsed;
      }
    } else if (field.type === 'tags' || field.type === 'multiselect') {
      payload[field.name] = String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (field.type === 'url-rules' || field.type === 'tdk-rules') {
      payload[field.name] = sanitizeSeoRules(parseSeoRules(value), field.type === 'url-rules' ? 'url' : 'tdk');
    } else if (field.type === 'datetime') {
      payload[field.name] = new Date(String(value)).toISOString();
    } else if (field.name === 'primaryDomain') {
      payload[field.name] = normalizeDomainInput(String(value));
      payload.primaryProtocol = protocolFromUrlInput(String(value));
    } else if (field.name === 'config') {
      payload[field.name] = parseJsonObjectField(String(value));
    } else {
      payload[field.name] = value;
    }
  }

  return payload;
}

function parseJsonObjectField(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('任务配置 JSON 必须是对象，例如 {"limit":10}。');
  }
  return parsed;
}

function toDatetimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const hiddenTableColumns = new Set(['password', 'passwordHash', 'rawPayload', 'randomProductNames']);
const hiddenTableColumnsByModule: Record<string, Set<string>> = {
  sites: new Set(['urlConfigId', 'tdkConfigId', 'showSignalSources', 'seoIndexStatus', 'baiduPushToken', 'remark']),
  groups: new Set([
    'remark',
    'defaultTdkId',
    'defaultUrlId',
    'liveJumpMode',
    'liveSecondLevelJumpUrl',
    'liveIframeJumpUrl',
    'liveProductName',
    'liveProductNames',
    'randomProductNames',
  ]),
  categories: new Set(['parentId', 'categoryUrlConfigId', 'detailUrlConfigId', 'categoryTdkConfigId', 'detailTdkConfigId']),
  matches: new Set(['siteId']),
  'url-configs': new Set(['pageType', 'pattern', 'categoryIds']),
  'tdk-configs': new Set(['pageType', 'titleTemplate', 'keywordsTemplate', 'descriptionTemplate', 'categoryIds']),
  'live-products': new Set(['siteId', 'replayJumpDomain']),
  'signal-domains': new Set(['siteId']),
  'signal-source-names': new Set(['siteId']),
  templates: new Set(['id', 'key', 'author', 'coverUrl', 'createdAt', 'updatedAt']),
};
const tableColumnLabels: Record<string, string> = {
  id: 'ID',
  createdAt: '创建时间',
  updatedAt: '更新时间',
  deletedAt: '删除时间',
  lastLoginAt: '最后登录',
  publishedAt: '发布时间',
  startAt: '开始时间',
  endAt: '结束时间',
  domains: '域名',
  group: '分组详情',
  template: '模板详情',
  roles: '角色',
  permissions: '权限',
  category: '栏目详情',
  rules: '栏目规则',
  promotionType: '推广类型详情',
  league: '联赛详情',
  homeTeam: '主队详情',
  awayTeam: '客队详情',
  invalidationJob: '缓存失效任务',
  type: '任务类型',
  scheduleTime: '每日执行时间',
  timezone: '时区',
  lastRunAt: '上次执行',
  nextRunAt: '下次执行',
  lastStatus: '上次结果',
  lastMessage: '执行消息',
  runCount: '成功次数',
  failureCount: '失败次数',
  config: '任务配置',
};

function buildTableColumns(module: ModuleConfig, rows: TableRow[]): TableColumn[] {
  const moduleHiddenColumns = hiddenTableColumnsByModule[module.key] ?? new Set<string>();
  const preferredKeys = [
    'id',
    ...Object.keys(module.sample),
    'createdAt',
    'updatedAt',
    'deletedAt',
    'lastLoginAt',
    'publishedAt',
    'startAt',
    'endAt',
  ];
  const rowKeys = rows.flatMap((row) => Object.keys(row));
  const keys = unique([...preferredKeys, ...rowKeys]).filter((key) => !hiddenTableColumns.has(key) && !moduleHiddenColumns.has(key));
  const visibleKeys = rows.length ? keys.filter((key) => rows.some((row) => row[key] !== undefined)) : keys;

  return visibleKeys.map((key) => ({
    key,
    label: tableColumnLabel(module, key),
  }));
}

function tableColumnLabel(module: ModuleConfig, key: string): string {
  if (['url-configs', 'tdk-configs'].includes(module.key) && key === 'siteId') {
    return '适用范围';
  }
  return tableColumnLabels[key] ?? fieldMeta[key]?.label ?? key;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function filterCategoryRows(rows: TableRow[], searchQuery: string): TableRow[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return rows;

  const rowById = new Map<string, TableRow>();
  const childrenByParentId = new Map<string, TableRow[]>();
  rows.forEach((row) => {
    if (typeof row.id === 'string') {
      rowById.set(row.id, row);
    }
    if (typeof row.parentId === 'string' && row.parentId.length > 0) {
      const children = childrenByParentId.get(row.parentId) ?? [];
      children.push(row);
      childrenByParentId.set(row.parentId, children);
    }
  });

  const included = new Set<string>();
  const includeAncestors = (row: TableRow) => {
    let parentId = typeof row.parentId === 'string' ? row.parentId : '';
    while (parentId) {
      const parent = rowById.get(parentId);
      if (!parent || typeof parent.id !== 'string' || included.has(parent.id)) break;
      included.add(parent.id);
      parentId = typeof parent.parentId === 'string' ? parent.parentId : '';
    }
  };
  const includeDescendants = (row: TableRow) => {
    if (typeof row.id !== 'string') return;
    for (const child of childrenByParentId.get(row.id) ?? []) {
      if (typeof child.id !== 'string' || included.has(child.id)) continue;
      included.add(child.id);
      includeDescendants(child);
    }
  };

  rows.forEach((row) => {
    if (typeof row.id !== 'string' || !rowMatchesSearch(row, q)) return;
    included.add(row.id);
    includeAncestors(row);
    includeDescendants(row);
  });

  return rows.filter((row) => typeof row.id === 'string' && included.has(row.id));
}

function rowMatchesSearch(row: TableRow, query: string): boolean {
  return Object.values(row).some((val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val).toLowerCase().includes(query);
      } catch {
        return false;
      }
    }
    return String(val).toLowerCase().includes(query);
  });
}

function buildCategoryTree(rows: TableRow[]): CategoryTreeNode[] {
  const rowById = new Map<string, TableRow>();
  rows.forEach((row) => {
    if (typeof row.id === 'string') {
      rowById.set(row.id, row);
    }
  });

  const nodeById = new Map<string, CategoryTreeNode>();
  rows.forEach((row) => {
    if (typeof row.id === 'string') {
      nodeById.set(row.id, { row, children: [] });
    }
  });

  const roots: CategoryTreeNode[] = [];
  nodeById.forEach((node) => {
    const parentId = typeof node.row.parentId === 'string' ? node.row.parentId : '';
    const parentNode = parentId ? nodeById.get(parentId) : undefined;
    if (parentNode && rowById.has(parentId)) {
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  });

  sortCategoryNodes(roots);
  return roots;
}

function sortCategoryNodes(nodes: CategoryTreeNode[]): void {
  nodes.sort((left, right) => categorySortValue(left.row) - categorySortValue(right.row) || fullCellValue(left.row.name).localeCompare(fullCellValue(right.row.name)));
  nodes.forEach((node) => sortCategoryNodes(node.children));
}

function categorySortValue(row: TableRow): number {
  const value = Number(row.sortOrder);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function flattenCategoryTree(nodes: CategoryTreeNode[], expandedIds: Set<string>, depth = 0): Array<{ node: CategoryTreeNode; depth: number }> {
  return nodes.flatMap((node) => {
    const current = [{ node, depth }];
    if (typeof node.row.id !== 'string' || !expandedIds.has(node.row.id)) {
      return current;
    }
    return [...current, ...flattenCategoryTree(node.children, expandedIds, depth + 1)];
  });
}

function categoryIdsWithChildren(rows: TableRow[]): string[] {
  const childParentIds = new Set(
    rows
      .map((row) => (typeof row.parentId === 'string' && row.parentId.length > 0 ? row.parentId : undefined))
      .filter((id): id is string => Boolean(id)),
  );
  return rows
    .map((row) => (typeof row.id === 'string' && childParentIds.has(row.id) ? row.id : undefined))
    .filter((id): id is string => Boolean(id));
}

function textValue(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : '-';
}

function optionLabelMap(options: FieldOption[] = []): Record<string, string> {
  return Object.fromEntries(options.map((option) => [option.value, option.label]));
}

function countRules(row: TableRow): number {
  return Array.isArray(row.rules)
    ? row.rules.filter((rule) => isRecord(rule) && typeof rule.categoryId === 'string' && rule.categoryId.trim().length > 0).length
    : 0;
}

function seoConfigScopeLabel(row: TableRow): string {
  return typeof row.siteId === 'string' && row.siteId.length > 0 ? `站点专用:${row.siteId}` : '全站默认';
}

function statusText(value: unknown): string {
  return typeof value === 'string' ? commonStatusLabels[value] ?? value : '-';
}

function categoryLabel(options: FieldOption[], value: string): string {
  if (!value) {
    return '全站首页（不绑定栏目）';
  }
  return options.find((option) => option.value === value)?.label ?? '未选择栏目';
}

function parseResponseBody(text: string): unknown {
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function fetchReferenceRows(apiBaseUrl: string, accessToken: string, endpoint: string): Promise<TableRow[]> {
  const rows: TableRow[] = [];
  let page = 1;

  while (page <= 100) {
    const result = await fetch(`${apiBaseUrl}${withPagination(endpoint, page, referencePageSize)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!result.ok) {
      return rows;
    }

    const parsed = parseResponseBody(await result.text());
    const pageRows = normalizeRows(parsed);
    const pagination = normalizePagination(parsed, page, referencePageSize, pageRows.length);
    rows.push(...pageRows);

    if (page >= pagination.totalPages || pageRows.length === 0) {
      break;
    }
    page += 1;
  }

  return rows;
}

function withPagination(endpoint: string, page: number, pageSize: number, filters: Record<string, string | undefined> = {}): string {
  const separator = endpoint.includes('?') ? '&' : '?';
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return `${endpoint}${separator}${params.toString()}`;
}

function normalizeRows(input: unknown): TableRow[] {
  if (Array.isArray(input)) {
    return input.map(toTableRow);
  }

  if (!isRecord(input)) {
    return input === undefined || input === null ? [] : [{ value: input }];
  }

  if (Array.isArray(input.data)) {
    return input.data.map(toTableRow);
  }

  if (isRecord(input.article)) {
    return [input.article];
  }

  if (isRecord(input.user)) {
    return [input.user];
  }

  return [input];
}

function normalizePagination(input: unknown, fallbackPage: number, fallbackPageSize: number, rowCount: number): PaginationState {
  if (isRecord(input)) {
    const total = positiveInteger(input.total);
    const page = positiveInteger(input.page);
    const pageSize = positiveInteger(input.pageSize);
    const totalPages = positiveInteger(input.totalPages);
    if (total !== undefined && page !== undefined && pageSize !== undefined) {
      return {
        page,
        pageSize,
        total,
        totalPages: totalPages ?? Math.max(1, Math.ceil(total / pageSize)),
      };
    }
  }

  return defaultPagination(rowCount, fallbackPage, fallbackPageSize);
}

function defaultPagination(total = 0, page = 1, pageSize = adminPageSize): PaginationState {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function positiveInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

function listLoadedMessage(prefix: string, pagination: PaginationState): string {
  if (pagination.total > pagination.pageSize) {
    return `${prefix}，第 ${pagination.page}/${pagination.totalPages} 页，共 ${pagination.total} 条记录。`;
  }
  return `${prefix}，共 ${pagination.total} 条记录。`;
}

function siteImportSummary(input: SiteImportResponse): string {
  const created = input.created?.length ?? 0;
  const skipped = input.skipped?.length ?? 0;
  const failed = input.failed?.length ?? 0;
  const base = input.message || `导入完成：新增 ${created} 个，跳过 ${skipped} 个，失败 ${failed} 个。`;
  const skippedExamples = (input.skipped ?? [])
    .slice(0, 2)
    .map((row) => `第${row.rowNumber ?? '-'}行 ${row.domain || '-'}：${row.reason || '已跳过'}`);
  const failedExamples = (input.failed ?? [])
    .slice(0, 3)
    .map((row) => `第${row.rowNumber ?? '-'}行 ${row.domain || '-'}：${row.message || '导入失败'}`);
  const details = [...failedExamples, ...skippedExamples];
  return details.length ? `${base} ${details.join('；')}` : base;
}

function visiblePageNumbers(currentPage: number, totalPages: number): number[] {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const adjustedStart = Math.max(1, end - 4);
  return Array.from({ length: end - adjustedStart + 1 }, (_item, index) => adjustedStart + index);
}

function toTableRow(value: unknown): TableRow {
  return isRecord(value) ? value : { value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractErrorMessage(input: unknown): string {
  if (!isRecord(input)) {
    return localizeErrorMessage(String(input || '未知错误'));
  }
  if (typeof input.message === 'string') {
    return localizeErrorMessage(input.message);
  }
  if (typeof input.error === 'string') {
    return localizeErrorMessage(input.error);
  }
  return '请求没有返回可读错误信息。';
}

function extractOperationNotice(input: unknown): string {
  if (isRecord(input) && typeof input.seoRuleNotice === 'string') {
    return input.seoRuleNotice;
  }
  return '';
}

function errorMessage(error: unknown): string {
  return localizeErrorMessage(error instanceof Error ? error.message : String(error || '未知错误'));
}

function localizeErrorMessage(message: string): string {
  const duplicateCategoryMatch = /^Duplicate category name in same level:\s*(.+)$/i.exec(message.trim());
  if (duplicateCategoryMatch?.[1]) {
    return `栏目名不能重复：${duplicateCategoryMatch[1]}`;
  }
  return message;
}

function operationLabel(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path?: string): string {
  if (path?.includes('/bulk-delete')) return '批量删除';
  if (path?.includes('/publish')) return '发布';
  if (path?.includes('/run')) return '执行计划任务';
  if (path?.includes('/live-replays') && path?.includes('/sync')) return '同步直播录像接口';
  if (path?.includes('/sync-fake')) return '同步接口样例数据';
  if (path?.includes('/sync')) return '同步赛事接口';
  if (method === 'GET') return '查询';
  if (method === 'POST') return '新增';
  if (method === 'PATCH') return '更新';
  if (method === 'DELETE') return '删除';
  return '操作';
}

function rowKey(row: TableRow, index: number): string {
  return typeof row.id === 'string' ? row.id : `row-${index}`;
}

function tableMinWidth(columnCount: number): string {
  return `max(100%, ${196 + columnCount * 190}px)`;
}

function formatCellDisplayValue(
  activeKey: string,
  columnKey: string,
  value: unknown,
  siteLabels: Record<string, string> = {},
): string {
  const full = fullCellDisplayValue(activeKey, columnKey, value, siteLabels);
  return full.length > 96 ? `${full.slice(0, 96)}...` : full;
}

function fullCellDisplayValue(
  activeKey: string,
  columnKey: string,
  value: unknown,
  siteLabels: Record<string, string> = {},
): string {
  if (['url-configs', 'tdk-configs'].includes(activeKey) && columnKey === 'siteId') {
    return typeof value === 'string' && value.length > 0
      ? `站点专用：${siteLabels[value] ?? value}`
      : '全站默认';
  }
  if (columnKey === 'siteId' && typeof value === 'string' && value.length > 0) {
    return siteLabels[value] ?? value;
  }

  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'string') {
    return enumDisplayLabel(activeKey, columnKey, value) ?? formatMaybeDate(value);
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      return '-';
    }
    if (columnKey === 'rules') {
      return value.map((item) => ruleDisplayValue(item)).join('；');
    }
    return value.map((item) => fullCellDisplayValue(activeKey, columnKey, item, siteLabels)).join(', ');
  }
  return fullCellValue(value);
}

function ruleDisplayValue(value: unknown): string {
  if (!isRecord(value)) {
    return fullCellValue(value);
  }
  const category = value.categoryId === '' ? '全站首页' : fullCellValue(value.categoryId);
  const pageType = typeof value.pageType === 'string' ? enumDisplayLabels.pageType?.[value.pageType] ?? value.pageType : '-';
  const content = value.pattern ?? value.titleTemplate ?? value.descriptionTemplate ?? '';
  const detailRules = Array.isArray(value.detailRules) ? value.detailRules : [];
  const firstDetailPreview = detailRules.length ? detailRuleDisplayValue(detailRules[0]) : '';
  const detailPreview = detailRules.length ? ` / 内页${detailRules.length}条${firstDetailPreview ? ` · ${firstDetailPreview}` : ''}` : '';
  return `${category} / ${pageType} / ${fullCellValue(content)}${detailPreview}`;
}

function detailRuleDisplayValue(value: unknown): string {
  if (!isRecord(value)) {
    return fullCellValue(value);
  }
  const pageType = typeof value.pageType === 'string' ? enumDisplayLabels.pageType?.[value.pageType] ?? value.pageType : '-';
  const content = value.pattern ?? value.titleTemplate ?? value.descriptionTemplate ?? '';
  const label = typeof value.label === 'string' ? value.label : '';
  return [label, pageType, fullCellValue(content)].filter((item) => item && item !== '-').join(' / ');
}

function formatCellValue(value: unknown): string {
  const full = fullCellValue(value);
  return full.length > 96 ? `${full.slice(0, 96)}...` : full;
}

function fullCellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    return formatMaybeDate(value);
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      return '-';
    }
    return value.map((item) => fullCellValue(item)).join(', ');
  }
  if (isRecord(value)) {
    const readable = ['name', 'title', 'displayName', 'username', 'key', 'action', 'id']
      .map((key) => value[key])
      .find((item) => typeof item === 'string' && item.length > 0);
    if (typeof readable === 'string') {
      return readable;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  return String(value);
}

function enumDisplayLabel(activeKey: string, columnKey: string, value: string): string | undefined {
  if (columnKey === 'status') {
    return statusDisplayLabel(activeKey, value);
  }
  return enumDisplayLabels[columnKey]?.[value] ?? enumDisplayLabels.global[value];
}

function statusDisplayLabel(activeKey: string, value: string): string | undefined {
  if (activeKey === 'matches') {
    return matchStatusLabels[value] ?? commonStatusLabels[value];
  }

  if (activeKey === 'news') {
    return newsStatusLabels[value] ?? commonStatusLabels[value];
  }

  return commonStatusLabels[value] ?? newsStatusLabels[value] ?? matchStatusLabels[value];
}

function isBadgeColumn(columnKey: string, value: unknown): boolean {
  return typeof value === 'string' && ['status', 'seoIndexStatus', 'lastStatus'].includes(columnKey);
}

function statusBadgeTone(value: string): 'success' | 'danger' | 'warning' | 'neutral' {
  if (['ACTIVE', 'PUBLISHED', 'LIVE', 'INDEX', 'SUCCESS'].includes(value)) {
    return 'success';
  }
  if (['DISABLED', 'CANCELLED', 'NOINDEX', 'FAILED'].includes(value)) {
    return 'danger';
  }
  if (['DRAFT', 'SCHEDULED', 'MAINTENANCE', 'POSTPONED', 'ARCHIVED', 'FOLLOW_ONLY', 'RUNNING', 'PAUSED'].includes(value)) {
    return 'warning';
  }
  return 'neutral';
}

const commonStatusLabels: Record<string, string> = {
  ACTIVE: '启用',
  DISABLED: '禁用',
  MAINTENANCE: '维护中',
  PAUSED: '暂停',
};

const newsStatusLabels: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  SCHEDULED: '定时发布',
  ARCHIVED: '归档',
};

const matchStatusLabels: Record<string, string> = {
  SCHEDULED: '未开始',
  LIVE: '直播中',
  FINISHED: '已结束',
  CANCELLED: '已取消',
  POSTPONED: '延期',
};

const enumDisplayLabels: Record<string, Record<string, string>> = {
  global: {
    ACTIVE: '启用',
    DISABLED: '禁用',
    MAINTENANCE: '维护中',
    DRAFT: '草稿',
    PUBLISHED: '已发布',
    ARCHIVED: '归档',
    PAUSED: '暂停',
  },
  type: {
    SPORTS_SYNC: '赛事数据同步',
    NEWS_CRAWL: '懂球帝新闻采集',
    LIVE_REPLAY_SYNC: '直播录像采集',
  },
  lastStatus: {
    IDLE: '未执行',
    RUNNING: '执行中',
    SUCCESS: '成功',
    FAILED: '失败',
  },
  sport: {
    FOOTBALL: '足球',
    BASKETBALL: '篮球',
  },
  seoIndexStatus: {
    INDEX: '允许收录',
    NOINDEX: '不收录',
    FOLLOW_ONLY: '仅跟踪',
  },
  pageType: {
    HOME: '首页',
    NEWS_CATEGORY: '新闻栏目',
    NEWS_DETAIL: '新闻详情',
    MATCH_CATEGORY: '直播栏目',
    MATCH_DETAIL: '直播详情',
    VIDEO_CATEGORY: '录像栏目',
    VIDEO_DETAIL: '录像详情',
    TAG: '标签页',
    TEAM: '球队页',
    LEAGUE: '联赛页',
    LIVE_ROOM: '直播间',
    SEARCH: '搜索页',
  },
  slot: {
    HOME_HERO: '首页首屏',
    HOME_AFTER_NEWS: '首页资讯后',
    CATEGORY_TOP: '栏目顶部',
    CATEGORY_SIDEBAR: '栏目侧栏',
    NEWS_TOP: '新闻顶部',
    NEWS_INLINE: '新闻正文中',
    NEWS_BOTTOM: '新闻底部',
    GLOBAL_FLOAT: '全站浮动',
  },
  renderStyle: {
    TEXT_LINK: '文字链接',
    IMAGE_BANNER: '图片横幅',
    BUTTON: '按钮',
    CARD: '卡片',
    FLOATING: '浮动入口',
  },
  device: {
    ALL: '全部设备',
    DESKTOP: '桌面端',
    MOBILE: '移动端',
  },
};

function normalizeDomainInput(value: string): string {
  const withoutProtocol = value.trim().replace(/^https?:\/\//i, '');
  const host = withoutProtocol.split('/')[0] ?? '';
  return host.trim().toLowerCase();
}

function protocolFromUrlInput(value: unknown): 'http' | 'https' {
  const raw = fullCellValue(value).trim();
  if (/^https:\/\//i.test(raw)) return 'https';
  if (/^http:\/\//i.test(raw)) return 'http';
  return 'http';
}

function siteHomeUrl(value: unknown, protocolValue?: unknown): string {
  const raw = fullCellValue(value).trim();
  if (!raw || raw === '-') return '';

  try {
    const protocol = protocolValue === 'https' ? 'https' : protocolValue === 'http' ? 'http' : protocolFromUrlInput(raw);
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `${protocol}://${raw}`);
    return `${url.protocol}//${url.host}/`;
  } catch {
    return '';
  }
}

function formatMaybeDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
