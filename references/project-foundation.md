# 体育新闻资讯站：AI 开发启动文档

版本：v0.1  
用途：交给 Codex / 代码代理 / 新加入工程师，作为项目第一天的产品、架构、SEO、高并发和开发顺序基准。  
项目关键词：多站点、多模板、体育新闻、赛事直播信息、后台 CMS、SEO 优先、服务端 HTML、高并发、CDN 缓存。

---

## 0. 一句话目标

建设一套可管理多个体育资讯站点的 CMS + 前台渲染系统。后台可以添加站点、分组、模板、栏目、新闻、赛事、球队、联赛、直播产品、信号源、URL 规则和 TDK 规则；前台根据不同域名输出不同站点和模板，并且必须生成高质量 SEO HTML 页面，能承受大量匿名用户访问。

---

## 1. 最高优先级原则

### 1.1 SEO 是架构约束，不是页面优化

公共前台页面必须是 HTML-first：

- 页面首屏、标题、正文、列表、分页、导航、面包屑、canonical、meta、结构化数据必须由服务端输出。
- 禁止把主要内容做成“空 HTML + 浏览器 JS 调 API 渲染”。
- 可以使用少量客户端 JS 做交互，例如菜单展开、比分刷新、收藏按钮，但这不能影响搜索引擎读取主要内容。
- 搜索、筛选、登录态后台页面可以更动态，但公共可收录页面必须稳定可抓取。

Google 官方说明动态渲染只是 JavaScript 内容问题的绕过方案，不是长期推荐方案；更推荐服务端渲染、静态渲染或 hydration。因此本项目从第一天采用服务端/静态 HTML 输出，而不是 CSR 后补预渲染。

### 1.2 多站点是核心模型

所有公共请求都必须先解析站点：

```text
Host -> SiteDomain -> Site -> Group -> Template + URL Config + TDK Config + Feature Flags
```

不能在代码里写死单站点配置。所有 URL、TDK、模板、统计代码、百度推送配置、站长验证码、直播配置都要能按站点或分组覆盖。

### 1.3 高并发靠缓存体系，而不是单纯堆服务器

访问量主要来自匿名用户看前台页面。架构目标是让大多数请求命中 CDN 或应用缓存：

```text
Browser
  -> CDN / Edge Cache
  -> Next.js public renderer cache / Redis cache
  -> API service
  -> PostgreSQL read model / indexed query
```

后台发布内容后触发精准缓存失效，而不是全站清空缓存。

---

## 2. 推荐技术架构

### 2.1 技术栈选择

推荐 TypeScript 全栈 monorepo：

| 层级 | 推荐技术 | 原因 |
|---|---|---|
| Monorepo | pnpm workspace + Turborepo | 统一类型、共享 schema、适合多应用 |
| 公共前台 | Next.js App Router | 支持服务端组件、SSR/SSG/ISR、metadata、sitemap、robots |
| 后台管理 | Next.js Admin 或独立 React Admin | 后台 SEO 不重要，可更多客户端交互 |
| API 服务 | NestJS | 模块化清晰，适合复杂后台、权限、队列、任务 |
| ORM | Prisma | 类型清晰，Codex 易生成和维护 |
| 数据库 | PostgreSQL | 适合 CMS、多租户、全文索引、事务 |
| 缓存 | Redis | 站点配置、热门列表、页面数据、锁、限流 |
| 队列 | BullMQ | 导入、推送、同步、图片处理、sitemap 生成 |
| 对象存储 | S3/R2/OSS | 模板封面、新闻图片、球队/联赛 LOGO |
| CDN | Cloudflare 或同类 CDN | 边缘缓存、WAF、压缩、抗并发 |
| 搜索 | PostgreSQL FTS，后期 OpenSearch/Meilisearch | MVP 简化，后期扩展 |

> 备选：如果团队更熟 PHP，可用 Laravel + Blade + Octane + Redis 实现同样的 HTML-first 架构。但给 Codex 开发时，TypeScript + Next.js + Prisma 的一致性和代码生成体验更好。

### 2.2 仓库结构

```text
sports-news-platform/
  apps/
    web/                  # 公共前台：SEO 页面渲染
    admin/                # 后台管理
    api/                  # NestJS API / Jobs / Admin API
  packages/
    db/                   # Prisma schema, migrations, db client
    core/                 # site resolver, url builder, tdk resolver, permissions
    templates/            # 前台模板注册表和模板组件
    ui/                   # 后台/前台共享 UI 基础组件
    seo/                  # JSON-LD, sitemap, robots, canonical helpers
    config/               # env schema, constants
  infra/
    docker/
    nginx/
    k6/
  docs/
    architecture.md
    seo.md
    caching.md
```

### 2.3 运行时分工

```text
apps/web
  - 只负责公共页面 HTML 渲染
  - 不直接暴露后台 CRUD
  - 可直接读数据库，也可读 API；需要配合缓存

apps/admin
  - 站点、模板、内容、赛事、SEO 管理
  - 登录、RBAC、审计日志

apps/api
  - 后台业务 API
  - 导入 Excel
  - 百度推送
  - 数据同步任务
  - sitemap 生成任务
  - 缓存失效 webhook
```

---

## 3. 产品范围：根据 Excel 整理

完整清单见 `REQUIREMENTS_FROM_EXCEL.md`。MVP 范围建议分 4 层。

### 3.1 第一层：站点和 SEO 基座

必须先做：

- 站点管理。
- 分组管理。
- 模板管理。
- URL 配置。
- TDK 配置。
- Host 解析站点。
- TDK resolver。
- URL builder。
- robots.txt。
- sitemap.xml。

没有这层，后面的内容都无法满足多站点和 SEO。

### 3.2 第二层：内容 CMS

- 栏目管理。
- 新闻资讯 CRUD。
- 新闻列表页。
- 新闻详情页。
- 首页推荐/最新新闻。
- 标签页。

### 3.3 第三层：体育数据

- 赛事管理。
- 联赛管理。
- 球队管理。
- 赛程列表。
- 赛事详情。
- 热门联赛/球队。

Excel 中赛事/联赛/球队标注“自动???”，所以设计上必须预留 `externalSource`、`externalId`、`lastSyncedAt`、导入任务和同步任务。

### 3.4 第四层：直播和信号

- 直播产品。
- 信号域名。
- 信号源名称。
- 跳转 URL。
- iframe 跳转。
- 泛域名配置。
- 随机信号源名称。

这层涉及跳转、iframe、泛域名和统计代码，必须加强安全审核和白名单。

---

## 4. 页面与路由设计

### 4.1 页面类型枚举

```ts
export type PageType =
  | 'home'
  | 'news_category'
  | 'news_detail'
  | 'match_category'
  | 'match_detail'
  | 'video_category'
  | 'video_detail'
  | 'tag'
  | 'team'
  | 'league'
  | 'live_room'
  | 'search';
```

### 4.2 URL 配置原则

所有前台 URL 必须由 URL 配置生成，不允许散落在组件里硬编码。

示例规则：

```text
/news/{categorySlug}/
/news/{categorySlug}/{newsSlug}.html
/matches/{sport}/
/match/{matchId}-{slug}.html
/team/{teamSlug}/
/league/{leagueSlug}/
/tag/{tagSlug}/
```

后台 URL 配置支持按页面类型设置：

- 赛程栏目。
- 录像栏目。
- 新闻栏目。
- 标签。
- 赛程详情页。
- 录像详情页。
- 新闻详情页。
- 球队。
- 联赛。

### 4.3 URL builder 示例

```ts
type BuildUrlInput = {
  site: Site;
  pageType: PageType;
  data?: Record<string, string | number | Date | null>;
};

export function buildPublicUrl(input: BuildUrlInput): string {
  const pattern = resolveUrlPattern(input.site, input.pageType);
  return fillPattern(pattern, input.data);
}
```

---

## 5. SEO 体系设计

### 5.1 TDK 配置

TDK = Title、Description、Keywords。虽然部分搜索引擎对 keywords 权重有限，但后台仍按需求支持。

TDK 配置按以下层级覆盖：

```text
页面对象自定义 SEO
  > 站点页面类型 TDK 配置
  > 分组页面类型 TDK 配置
  > 系统默认 TDK 模板
```

### 5.2 TDK 模板变量

建议支持：

```text
{siteName}
{groupName}
{categoryName}
{title}
{summary}
{tagName}
{teamName}
{teamEnglishName}
{teamPinyin}
{leagueName}
{leagueEnglishName}
{leaguePinyin}
{homeTeam}
{awayTeam}
{matchTime}
{sportName}
{date}
{year}
```

### 5.3 每个公共页面必须输出

```html
<title>...</title>
<meta name="description" content="..." />
<meta name="keywords" content="..." />
<link rel="canonical" href="https://example.com/news/football/a.html" />
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:type" content="article" />
<meta property="og:url" content="..." />
```

新闻详情页必须输出 `NewsArticle` JSON-LD，栏目/详情页必须输出 `BreadcrumbList` JSON-LD。

### 5.4 canonical 规则

- 每个内容对象只有一个规范 URL。
- 移动端、自适应、带统计参数的 URL 都指向 canonical。
- 分页页 canonical 指向自身，不全部指向第一页。
- 搜索页、筛选页默认 `noindex,follow`，除非后台明确开放。
- 删除内容返回 410；未发布内容返回 404 或后台预览专用 token。

### 5.5 sitemap 规则

每个站点独立生成 sitemap：

```text
https://site-a.com/sitemap.xml
https://site-a.com/sitemaps/news-1.xml
https://site-a.com/sitemaps/matches-1.xml
```

建议：

- sitemap index 分片。
- 每个 sitemap 不超过协议限制，优先按类型和更新时间拆分。
- 新闻、栏目、球队、联赛、赛事详情均可进入 sitemap。
- `lastmod` 使用内容实际更新时间。
- 发布/下线后进入队列增量更新 sitemap。

Next.js App Router 支持通过 `sitemap.ts` 生成 sitemap，适合 MVP；内容量变大后改为后台队列生成静态 XML 文件并上传对象存储/CDN。

### 5.6 robots 规则

每个站点独立 robots：

```text
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /preview/
Disallow: /search?
Sitemap: https://{domain}/sitemap.xml
```

Next.js App Router 支持 `robots.ts` 生成 robots。多站点需要根据 Host 输出不同 Sitemap。

### 5.7 百度 SEO/推送

后台站点管理已包含：

- 百度推送配置。
- 百度站长验证码。
- 统计代码。

实现建议：

- 新内容发布后，把 canonical URL 放入 `UrlSubmitJob`。
- 支持按站点配置百度 API token。
- 支持失败重试、提交日志、每日额度记录。
- 快速收录只作为发现加速，不保证一定收录。

### 5.8 SEO 自动化测试

为核心页面写测试：

- `view-source` 或 SSR HTML 包含 H1、正文、内链。
- meta title/description/canonical 存在。
- JSON-LD 可 JSON.parse。
- 列表分页有普通 `<a href>`。
- 页面无空 title、重复 canonical、错误 noindex。

---

## 6. 模板系统设计

### 6.1 模板不是“前端皮肤”，而是服务端渲染包

后台可以新增/编辑模板记录，但模板代码必须由开发部署进入仓库，不能允许管理员上传任意可执行代码。

模板记录字段：

- 模板名称。
- 文件夹/模板 key。
- 作者。
- 封面。
- 状态。
- 使用站点数。
- 添加时间。

### 6.2 模板目录

```text
packages/templates/
  registry.ts
  base/
    manifest.ts
    HomePage.tsx
    NewsListPage.tsx
    NewsDetailPage.tsx
    MatchListPage.tsx
    MatchDetailPage.tsx
    TeamPage.tsx
    LeaguePage.tsx
    styles.css
  modern-sports/
    manifest.ts
    ...
```

### 6.3 模板 Manifest

```ts
export type TemplateManifest = {
  key: string;
  name: string;
  version: string;
  supportedPageTypes: PageType[];
  slots: Array<'header' | 'footer' | 'sidebar' | 'hero' | 'content'>;
};
```

### 6.4 模板验收

每个模板必须满足：

- 所有主要内容服务端渲染。
- 语义化 HTML：header、nav、main、article、section、footer。
- 有且仅有一个 H1。
- 列表项使用真实 a 标签。
- 不把正文藏在 canvas、iframe、纯 JS 中。
- CSS 不阻塞主要内容阅读。
- 图片有 alt、width、height 或 aspect ratio。
- 移动端自适应。

---

## 7. 高并发与缓存设计

### 7.1 缓存层级

```text
L1 CDN Edge Cache
  - 缓存公共匿名 HTML、图片、CSS、JS、sitemap、robots

L2 Next.js Route/Data Cache
  - ISR、revalidatePath、revalidateTag

L3 Redis
  - site config
  - tdk config
  - url config
  - hot news list
  - hot matches
  - rendered page data

L4 PostgreSQL
  - 强索引
  - 分页查询
  - 必要时读副本
```

Next.js ISR 适合大量内容页：已知页面可构建/生成，访问后缓存；过期后先返回旧页面，同时后台再生成新页面。后台发布时使用 path/tag 精确失效。

### 7.2 Cache-Control 建议

公共页面：

```text
Cache-Control: public, s-maxage=300, stale-while-revalidate=86400
```

热点详情页：

```text
Cache-Control: public, s-maxage=600, stale-while-revalidate=86400
```

实时比分模块：

- 不影响主页面 SEO HTML。
- 可用独立 API 短缓存，例如 5-15 秒。
- 前台用小组件增强，不改变主 HTML 内容。

Cloudflare 对 `stale-while-revalidate` 的支持可以在缓存过期后先给用户返回旧内容，并在后台重新验证/刷新，能降低源站压力。

### 7.3 缓存 key

必须包含：

```text
host + pathname + normalized_query + device_variant?
```

不要把后台登录 cookie 混入公共缓存。公共页面不得读取用户 cookie，否则会破坏缓存。

### 7.4 缓存失效事件

| 事件 | 失效范围 |
|---|---|
| 新闻发布/编辑 | 新闻详情、所属栏目列表、首页、tag 页、sitemap |
| 新闻下线 | 新闻详情、栏目列表、首页、sitemap |
| 栏目编辑 | 栏目页、导航、相关新闻页 |
| TDK 配置更新 | 对应站点 + 页面类型 |
| URL 配置更新 | 对应站点全量重建 URL，旧 URL 301 或 404 策略 |
| 模板切换 | 对应站点所有公共页面 |
| 赛事更新 | 赛事详情、赛程列表、球队/联赛页 |

### 7.5 数据库索引原则

常用索引：

- `SiteDomain.domain` 唯一。
- `Site.groupId,status`。
- `News.siteId,status,publishedAt`。
- `News.categoryId,status,publishedAt`。
- `News.slug` 与 `siteId` 唯一。
- `Match.siteId,sport,status,startTime`。
- `Team.slug`、`League.slug`。
- 全文搜索列使用 PostgreSQL GIN 索引，MVP 可以先对新闻 title/summary/content 做 tsvector。

---

## 8. 数据模型草案

完整 Prisma 草案见 `PRISMA_SCHEMA_DRAFT.prisma`。核心实体：

```text
User, Role, Permission
SiteGroup, Site, SiteDomain
Template
UrlConfig, TdkConfig
Category
NewsArticle, Tag, NewsTag
SportLeague, SportTeam, SportMatch
LiveProduct, SignalDomain, SignalSourceName
MediaAsset
SeoSubmitLog
AuditLog
CacheInvalidationJob
```

### 8.1 多租户策略

本项目不是 SaaS 多租户，而是“一个后台管理多个站点”。建议每个核心业务表都带 `siteId`，能按站点隔离和缓存。

站点分组 `SiteGroup` 用于批量配置：TDK、URL、新闻更新数量、直播产品默认值。

### 8.2 状态枚举

```ts
enum PublishStatus {
  DRAFT
  PUBLISHED
  SCHEDULED
  ARCHIVED
}

enum SiteStatus {
  ACTIVE
  DISABLED
  MAINTENANCE
}

enum SeoIndexStatus {
  INDEX
  NOINDEX
  FOLLOW_ONLY
}
```

---

## 9. 后台模块设计

### 9.1 站点管理

页面能力：

- 新增、编辑、批量导入、批量删除。
- 按站点分组、站点名称、模板、是否设置直播查询。
- 列表每页 20 条。
- 编辑基础信息、SEO、统计/推送。

开发注意：

- 域名必须唯一。
- 支持主域名和别名域名。
- 域名变更需要触发 sitemap/robots/canonical 更新。
- 站点禁用后公共页面策略可配置为 404、410 或维护页。

### 9.2 分组管理

- 分组名称。
- TDK 配置。
- URL 配置。
- 备注。
- 状态。
- 新闻更新数量。
- 直播产品默认配置。

### 9.3 模板管理

- 后台新增的是模板记录，不上传执行代码。
- 模板 key 必须存在于 `packages/templates/registry.ts`。
- 模板切换触发该站点全页面缓存失效。

### 9.4 栏目管理

- 主栏目初始：足球直播、篮球直播、赛事录像、体育新闻。
- 支持父子栏目。
- 支持导入子栏目。
- 栏目 slug 按站点唯一。

### 9.5 新闻资讯

字段建议：

- 标题、slug、摘要、正文。
- 所属栏目、所属站点、所属分组。
- 状态、发布时间、更新时间。
- 封面图、作者、来源。
- 自定义 SEO 标题、关键词、描述。
- canonical URL 覆盖。
- 标签。

### 9.6 赛事/联赛/球队

MVP 先手动和导入，后续自动同步：

- externalSource。
- externalId。
- lastSyncedAt。
- rawPayload。

### 9.7 直播产品和信号

安全要求：

- 跳转 URL 需要白名单协议：`https:` 优先，谨慎允许 `http:`。
- iframe 域名必须白名单。
- 统计代码和验证码必须经过安全模板处理，禁止任意脚本注入到所有页面。
- 泛域名生成必须避免开放跳转漏洞。

---

## 10. API 设计

### 10.1 Admin API 风格

```text
GET    /admin/sites
POST   /admin/sites
GET    /admin/sites/:id
PATCH  /admin/sites/:id
DELETE /admin/sites/:id
POST   /admin/sites/import
POST   /admin/sites/bulk-delete

GET    /admin/news
POST   /admin/news
PATCH  /admin/news/:id
POST   /admin/news/:id/publish
POST   /admin/news/:id/unpublish

POST   /admin/cache/revalidate
GET    /admin/seo/submit-logs
```

### 10.2 Public API

公共 API 只用于增强交互，不承载 SEO 主内容：

```text
GET /api/public/live-score?matchId=...
GET /api/public/search?q=...
```

搜索结果页默认 noindex。

---

## 11. 权限与安全

### 11.1 RBAC

角色建议：

- Super Admin：所有站点和系统配置。
- Site Admin：指定站点配置和内容。
- Editor：新闻、栏目、赛事内容。
- SEO Manager：TDK、URL、sitemap、推送。
- Viewer：只读。

### 11.2 审计日志

所有影响 SEO 和公共页面的操作必须记录：

- 谁改了站点域名。
- 谁改了模板。
- 谁改了 URL 配置。
- 谁发布/下线新闻。
- 谁提交/批量提交 URL。

### 11.3 输入安全

- 富文本正文必须服务端清洗。
- iframe 和统计代码必须白名单。
- 后台导入 Excel 必须校验字段、大小、行数。
- 所有后台接口必须校验权限和 CSRF/Token。
- 管理员上传图片必须限制 MIME、大小、尺寸。

---

## 12. 开发里程碑

### M0：项目骨架

交付：

- pnpm monorepo。
- Next.js public web。
- admin app。
- NestJS API。
- Prisma + PostgreSQL。
- Redis。
- Docker Compose。
- env 校验。
- lint/typecheck/test。

### M1：多站点 + SEO 基座

交付：

- Site resolver。
- Template registry。
- URL builder。
- TDK resolver。
- robots.ts。
- sitemap.ts。
- canonical helper。
- JSON-LD helper。

### M2：CMS 最小闭环

交付：

- 站点管理。
- 分组管理。
- 模板管理。
- URL/TDK 配置。
- 栏目管理。
- 新闻 CRUD。
- 首页、栏目页、新闻详情页。

### M3：缓存与高并发

交付：

- Redis 缓存。
- Next.js revalidatePath/revalidateTag。
- 发布内容触发缓存失效。
- CDN Cache-Control。
- k6 压测脚本。
- 慢查询日志。

### M4：体育数据和直播

交付：

- 赛事、联赛、球队管理。
- 直播产品。
- 信号域名。
- 信号源名称。
- 导入/同步任务接口。

### M5：上线准备

交付：

- 备份恢复。
- 日志与监控。
- 错误追踪。
- 权限审计。
- SEO 批量检查。
- 数据迁移脚本。

---

## 13. Codex 执行任务拆分

### Task 1：创建仓库骨架

输入：本文件、`AGENTS.md`、`PRISMA_SCHEMA_DRAFT.prisma`。  
输出：可启动 monorepo。

验收：

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm dev
```

### Task 2：数据库模型和种子数据

输出：Prisma schema、migration、seed。

种子数据：

- 2 个站点。
- 2 个模板。
- 2 个分组。
- 4 个栏目。
- 20 篇新闻。
- 4 个球队。
- 2 个联赛。
- 5 场赛事。

### Task 3：站点解析和前台页面

输出：根据 Host 渲染站点，首页/栏目页/详情页服务端 HTML。

验收：

```bash
curl -H "Host: site-a.local" http://localhost:3000/ | grep '<h1'
curl -H "Host: site-a.local" http://localhost:3000/news/foo.html | grep 'application/ld+json'
```

### Task 4：后台 CRUD

输出：站点、分组、模板、URL、TDK、栏目、新闻 CRUD。

验收：能发布新闻，并在前台看到服务端 HTML。

### Task 5：SEO 和缓存

输出：robots、sitemap、canonical、TDK、JSON-LD、缓存失效。

验收：发布新闻后详情页、栏目页、首页更新；sitemap 包含新 URL。

---

## 14. 性能目标

MVP 目标：

- 公共 HTML 页面 CDN 命中时 TTFB < 100ms。
- 源站缓存命中时 TTFB < 300ms。
- 源站缓存未命中时 TTFB < 1000ms。
- 单实例源站至少承受 300-500 RPS 的缓存命中请求。
- 数据库慢查询阈值 200ms。
- 首页 HTML < 150KB，JS 尽量少。
- LCP < 2.5s，CLS < 0.1，INP < 200ms 作为优化目标。

压测脚本放在 `infra/k6`。

---

## 15. 环境变量草案

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sports_news
REDIS_URL=redis://localhost:6379
PUBLIC_WEB_URL=http://localhost:3000
ADMIN_WEB_URL=http://localhost:3001
API_URL=http://localhost:4000
JWT_SECRET=change-me
SESSION_SECRET=change-me
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
BAIDU_PUSH_DEFAULT_TOKEN=
CACHE_REVALIDATE_SECRET=change-me
```

---

## 16. 官方参考资料

- Google Search Central：Dynamic rendering is a workaround，推荐 server-side rendering / static rendering / hydration：`https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering`
- Google Search Central：canonical：`https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls`
- Google Search Central：Article structured data：`https://developers.google.com/search/docs/appearance/structured-data/article`
- Next.js ISR：`https://nextjs.org/docs/app/guides/incremental-static-regeneration`
- Next.js generateMetadata：`https://nextjs.org/docs/app/api-reference/functions/generate-metadata`
- Next.js robots：`https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots`
- Next.js sitemap：`https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap`
- Cloudflare stale-while-revalidate：`https://developers.cloudflare.com/cache/concepts/revalidation/`
- 百度搜索资源平台快速收录：`https://ziyuan.baidu.com/dailysubmit/index`
