import { Fragment } from 'react';
import { createSignalJumpToken } from '@sports/core';
import type {
  CategoryRecord,
  LiveProductRecord,
  NewsArticleRecord,
  SignalSourceNameRecord,
  SportMatchRecord,
} from '@sports/core';
import type {
  TemplateCategoryPageProps,
  TemplateMatchDetailPageProps,
  TemplateNewsDetailPageProps,
  TemplatePackage,
  TemplatePageProps,
  TemplateVideoDetailPageProps,
} from '../types';
import { PromotionBlocks, buildCategoryNavItems, formatDate } from '../shared';

type BuildUrl = TemplatePageProps['buildUrl'];

function HomePage(props: TemplatePageProps) {
  const lead = props.topNews[0] ?? props.latestNews[0];
  const secondary = props.latestNews.filter((article) => article.id !== lead?.id).slice(0, 6);
  const featuredCategories = buildCategoryNavItems(props.categories).map((item) => item.category).slice(0, 8);

  return (
    <>
      <LyboHeader siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
      <main className="lybo-page">
        <section className="lybo-hero" aria-labelledby="lybo-home-title">
          <div className="lybo-shell lybo-hero-grid">
            <div className="lybo-hero-copy">
              <p className="lybo-kicker">PIPELINE TEMPLATE / DATA DRIVEN</p>
              <h1 id="lybo-home-title">{props.site.name}</h1>
              <p>{props.site.seoDescription ?? `${props.site.name}提供栏目内容、新闻资讯和项目动态。`}</p>
              <div className="lybo-hero-actions">
                {featuredCategories[0] ? (
                  <a className="lybo-button" href={categoryHref(props.buildUrl, featuredCategories[0])}>
                    查看栏目
                  </a>
                ) : null}
                {lead ? <a href={articleHref(props.buildUrl, lead)}>最新动态</a> : null}
              </div>
            </div>
            <div className="lybo-hero-card" aria-label="站点数据概览">
              <span>已接入后台数据</span>
              <strong>{props.latestNews.length}</strong>
              <p>文章内容自动渲染，栏目、URL 与 TDK 均来自后台配置。</p>
              <div className="lybo-gauge">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        </section>

        <PromotionBlocks promotions={props.promotions} slot="HOME_HERO" limit={2} />

        <section className="lybo-shell lybo-category-band" aria-labelledby="lybo-category-title">
          <div>
            <p className="lybo-kicker">PRODUCT CATALOG</p>
            <h2 id="lybo-category-title">栏目导航</h2>
          </div>
          <div className="lybo-category-grid">
            {featuredCategories.map((category) => (
              <a href={categoryHref(props.buildUrl, category)} key={category.id}>
                <span>{category.name}</span>
                <small>{props.categoryArticleCounts[category.id] ?? 0} 条内容</small>
              </a>
            ))}
          </div>
        </section>

        <section className="lybo-shell lybo-split-section" aria-labelledby="lybo-feature-title">
          <div className="lybo-section-head">
            <p className="lybo-kicker">NEWS FEED</p>
            <h2 id="lybo-feature-title">推荐内容</h2>
          </div>
          <div className="lybo-feature-grid">
            {lead ? <LyboArticleCard article={lead} href={articleHref(props.buildUrl, lead)} lead /> : null}
            <div className="lybo-news-stack">
              {secondary.map((article) => (
                <LyboArticleCard article={article} href={articleHref(props.buildUrl, article)} key={article.id} />
              ))}
            </div>
          </div>
        </section>

        <LyboMatchPanel matches={props.matches} categories={props.categories} buildUrl={props.buildUrl} />
        <PromotionBlocks promotions={props.promotions} slot="HOME_AFTER_NEWS" limit={3} />
      </main>
      <LyboFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
    </>
  );
}

function NewsListPage(props: TemplateCategoryPageProps) {
  return (
    <>
      <LyboHeader siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
      <main className="lybo-page lybo-inner-page">
        <LyboBreadcrumbs
          items={[
            { name: '首页', url: props.buildUrl('HOME') },
            { name: props.category.name, url: categoryHref(props.buildUrl, props.category) },
          ]}
        />
        <section className="lybo-shell lybo-list-hero">
          <p className="lybo-kicker">CATEGORY</p>
          <h1>{props.category.name}</h1>
          {props.category.description ? <p>{props.category.description}</p> : null}
        </section>
        <PromotionBlocks promotions={props.promotions} slot="CATEGORY_TOP" limit={2} />
        <section className="lybo-shell lybo-list-grid" aria-label={`${props.category.name}内容列表`}>
          {props.latestNews.length ? (
            props.latestNews.map((article) => (
              <LyboArticleCard
                article={article}
                href={articleHref(props.buildUrl, article, props.category.slug)}
                key={article.id}
              />
            ))
          ) : (
            <p className="lybo-empty">暂无内容，发布后会自动展示。</p>
          )}
        </section>
        <LyboPagination page={props.page} totalPages={props.totalPages} baseHref={categoryHref(props.buildUrl, props.category)} />
      </main>
      <LyboFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
    </>
  );
}

function MatchListPage(props: TemplateCategoryPageProps) {
  return (
    <>
      <LyboHeader siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
      <main className="lybo-page lybo-inner-page">
        <LyboBreadcrumbs
          items={[
            { name: '首页', url: props.buildUrl('HOME') },
            { name: props.category.name, url: categoryHref(props.buildUrl, props.category) },
          ]}
        />
        <section className="lybo-shell lybo-list-hero">
          <p className="lybo-kicker">SCHEDULE</p>
          <h1>{props.category.name}</h1>
          {props.category.description ? <p>{props.category.description}</p> : null}
        </section>
        <section className="lybo-shell lybo-match-table" aria-label={`${props.category.name}列表`}>
          {props.matches.length ? (
            props.matches.slice(0, 48).map((match) => (
              <a href={matchHref(props.buildUrl, props.categories, match)} key={match.id}>
                <time dateTime={match.startTime.toISOString()}>{formatDate(match.startTime)}</time>
                <strong>{match.title}</strong>
                <span>{match.league?.name ?? '项目动态'}</span>
              </a>
            ))
          ) : (
            <p className="lybo-empty">暂无排期数据。</p>
          )}
        </section>
      </main>
      <LyboFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
    </>
  );
}

function NewsDetailPage(props: TemplateNewsDetailPageProps) {
  return (
    <>
      <LyboHeader siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
      <main className="lybo-page lybo-inner-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.newsArticleJsonLd }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.breadcrumbJsonLd }} />
        <LyboBreadcrumbs items={props.breadcrumbs} />
        <LyboArticleDetail
          article={props.article}
          siteName={props.site.name}
          promotions={props.promotions}
        />
      </main>
      <LyboFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
    </>
  );
}

function VideoDetailPage(props: TemplateVideoDetailPageProps) {
  const signalEntries = buildSignalEntries({
    article: props.article,
    liveProducts: props.liveProducts,
    signalSourceNames: props.signalSourceNames,
    mode: 'replay',
  });

  return (
    <>
      <LyboHeader siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
      <main className="lybo-page lybo-inner-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.videoObjectJsonLd }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.breadcrumbJsonLd }} />
        <LyboBreadcrumbs items={props.breadcrumbs} />
        <LyboArticleDetail
          article={props.article}
          siteName={props.site.name}
          promotions={props.promotions}
          signalEntries={signalEntries}
        />
      </main>
      <LyboFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
    </>
  );
}

function MatchDetailPage(props: TemplateMatchDetailPageProps) {
  const signalEntries = buildSignalEntries({
    match: props.match,
    liveProducts: props.liveProducts,
    signalSourceNames: props.signalSourceNames,
    mode: 'live',
  });

  return (
    <>
      <LyboHeader siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
      <main className="lybo-page lybo-inner-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.breadcrumbJsonLd }} />
        <LyboBreadcrumbs items={props.breadcrumbs} />
        <article className="lybo-shell lybo-match-detail">
          <p className="lybo-kicker">{props.match.league?.name ?? 'MATCH DETAIL'}</p>
          <h1>{props.match.title}</h1>
          <div className="lybo-match-score">
            <span>{props.match.homeTeam?.name ?? '主队'}</span>
            <b>VS</b>
            <span>{props.match.awayTeam?.name ?? '客队'}</span>
          </div>
          <p>开赛时间：{formatDate(props.match.startTime)}</p>
          <LyboSignalPanel title="直播信号源" entries={signalEntries} emptyText="暂无可用直播信号源。" />
        </article>
      </main>
      <LyboFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
    </>
  );
}

function LyboHeader(props: { siteName: string; categories: CategoryRecord[]; buildUrl: BuildUrl }) {
  const navItems = buildCategoryNavItems(props.categories).slice(0, 8);

  return (
    <header className="lybo-header">
      <div className="lybo-shell lybo-header-grid">
        <a className="lybo-logo" href={props.buildUrl('HOME')} aria-label={`${props.siteName}首页`}>
          <span>LB</span>
          <strong>{props.siteName}</strong>
        </a>
        <nav className="lybo-nav" aria-label="主导航">
          <a href={props.buildUrl('HOME')}>首页</a>
          {navItems.map(({ category, children }) => (
            <span className={children.length ? 'lybo-nav-item has-children' : 'lybo-nav-item'} key={category.id}>
              <a href={categoryHref(props.buildUrl, category)}>{category.name}</a>
              {children.length ? (
                <span className="lybo-nav-dropdown">
                  {children.map((child) => (
                    <a href={categoryHref(props.buildUrl, child)} key={child.id}>
                      {child.name}
                    </a>
                  ))}
                </span>
              ) : null}
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}

function LyboFooter(props: { siteName: string; categories: CategoryRecord[]; buildUrl: BuildUrl }) {
  const categories = buildCategoryNavItems(props.categories).map((item) => item.category).slice(0, 8);

  return (
    <footer className="lybo-footer">
      <div className="lybo-shell lybo-footer-grid">
        <div>
          <span className="lybo-footer-mark">{props.siteName}</span>
          <p>模板采用后台数据渲染，栏目、内容、URL 与 TDK 均跟随站点配置。</p>
          <p>Copyright © {new Date().getFullYear()} {props.siteName} 版权所有</p>
        </div>
        <nav aria-label="页脚导航">
          {categories.map((category) => (
            <a href={categoryHref(props.buildUrl, category)} key={category.id}>
              {category.name}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}

function LyboArticleCard(props: { article: NewsArticleRecord; href: string; lead?: boolean }) {
  return (
    <article className={props.lead ? 'lybo-article-card is-lead' : 'lybo-article-card'}>
      {props.article.coverImageUrl ? (
        <a className="lybo-card-image" href={props.href} aria-label={props.article.title}>
          <img
            src={props.article.coverImageUrl}
            alt={`${props.article.title}封面图`}
            width={props.article.coverImageWidth ?? 1200}
            height={props.article.coverImageHeight ?? 800}
            loading={props.lead ? 'eager' : 'lazy'}
          />
        </a>
      ) : (
        <a className="lybo-card-image lybo-card-placeholder" href={props.href} aria-label={props.article.title}>
          <span>{props.article.category?.name ?? '内容'}</span>
        </a>
      )}
      <div>
        <p className="lybo-meta">
          {props.article.category?.name ?? '新闻资讯'}
          {props.article.publishedAt ? ` / ${formatDate(props.article.publishedAt)}` : ''}
        </p>
        <h3>
          <a href={props.href}>{props.article.title}</a>
        </h3>
        {props.article.summary ? <p>{props.article.summary}</p> : null}
      </div>
    </article>
  );
}

function LyboArticleDetail(props: {
  article: NewsArticleRecord;
  siteName: string;
  promotions: TemplatePageProps['promotions'];
  signalEntries?: SignalEntry[];
}) {
  const paragraphs = props.article.content.split(/\n{2,}/).filter(Boolean);

  return (
    <article className="lybo-shell lybo-article-detail">
      <header>
        <p className="lybo-kicker">{props.article.category?.name ?? 'NEWS'}</p>
        <h1>{props.article.title}</h1>
        {props.article.summary ? <p className="lybo-article-summary">{props.article.summary}</p> : null}
        <p className="lybo-meta">
          {props.article.author ?? props.siteName}
          {props.article.publishedAt ? ` / ${formatDate(props.article.publishedAt)}` : ''}
          {props.article.sourceName ? ` / ${props.article.sourceName}` : ''}
        </p>
      </header>
      <PromotionBlocks promotions={props.promotions} slot="NEWS_TOP" limit={1} />
      {props.article.coverImageUrl ? (
        <img
          className="lybo-detail-cover"
          src={props.article.coverImageUrl}
          alt={`${props.article.title}封面图`}
          width={props.article.coverImageWidth ?? 1200}
          height={props.article.coverImageHeight ?? 800}
        />
      ) : null}
      {props.signalEntries ? (
        <LyboSignalPanel title="录像播放入口" entries={props.signalEntries} emptyText="暂无可用录像播放入口。" />
      ) : null}
      <div className="lybo-article-body">
        {paragraphs.map((paragraph, index) => (
          <Fragment key={`${props.article.id}-${index}`}>
            <p>{paragraph}</p>
            {index === 0 ? <PromotionBlocks promotions={props.promotions} slot="NEWS_INLINE" limit={1} /> : null}
          </Fragment>
        ))}
      </div>
      <PromotionBlocks promotions={props.promotions} slot="NEWS_BOTTOM" limit={2} />
    </article>
  );
}

function LyboSignalPanel(props: { title: string; entries: SignalEntry[]; emptyText: string }) {
  return (
    <section className="lybo-signal-panel" aria-labelledby="lybo-signal-title">
      <div className="lybo-section-head">
        <p className="lybo-kicker">SIGNAL SOURCE</p>
        <h2 id="lybo-signal-title">{props.title}</h2>
      </div>
      {props.entries.length ? (
        <div className="lybo-signal-grid">
          {props.entries.map((entry, index) => (
            <a href={entry.href} target="_blank" rel="nofollow sponsored noopener noreferrer" key={`${entry.label}-${entry.href}-${index}`}>
              <span>{entry.label}</span>
              <b>立即播放</b>
            </a>
          ))}
        </div>
      ) : (
        <p className="lybo-empty">{props.emptyText}</p>
      )}
    </section>
  );
}

function LyboMatchPanel(props: {
  matches: SportMatchRecord[];
  categories: CategoryRecord[];
  buildUrl: BuildUrl;
}) {
  if (!props.matches.length) {
    return null;
  }

  return (
    <section className="lybo-shell lybo-match-panel" aria-labelledby="lybo-match-title">
      <div className="lybo-section-head">
        <p className="lybo-kicker">SCHEDULE</p>
        <h2 id="lybo-match-title">项目排期</h2>
      </div>
      <div className="lybo-match-table">
        {props.matches.slice(0, 8).map((match) => (
          <a href={matchHref(props.buildUrl, props.categories, match)} key={match.id}>
            <time dateTime={match.startTime.toISOString()}>{formatDate(match.startTime)}</time>
            <strong>{match.title}</strong>
            <span>{match.league?.name ?? '项目动态'}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function LyboBreadcrumbs(props: { items: Array<{ name: string; url: string }> }) {
  return (
    <nav className="lybo-shell lybo-breadcrumbs" aria-label="面包屑">
      {props.items.map((item, index) => (
        <span key={`${item.url}-${index}`}>
          {index > 0 ? <b aria-hidden="true">/</b> : null}
          <a href={item.url}>{item.name}</a>
        </span>
      ))}
    </nav>
  );
}

function LyboPagination(props: { page: number; totalPages: number; baseHref: string }) {
  if (props.totalPages <= 1) {
    return null;
  }

  return (
    <nav className="lybo-shell lybo-pagination" aria-label="分页">
      {Array.from({ length: props.totalPages }, (_, index) => index + 1).map((page) => (
        <a
          aria-current={page === props.page ? 'page' : undefined}
          href={`${props.baseHref}${page > 1 ? `?page=${page}` : ''}`}
          key={page}
        >
          {page}
        </a>
      ))}
    </nav>
  );
}

function categoryHref(buildUrl: BuildUrl, category: CategoryRecord): string {
  return buildUrl('NEWS_CATEGORY', { categorySlug: category.slug });
}

function articleHref(buildUrl: BuildUrl, article: NewsArticleRecord, fallbackCategorySlug = 'news'): string {
  const pageType = isVideoCategory(article.category) ? 'VIDEO_DETAIL' : 'NEWS_DETAIL';
  return buildUrl(pageType, {
    categorySlug: article.category?.slug ?? fallbackCategorySlug,
    newsSlug: article.slug,
    videoSlug: article.slug,
  });
}

function matchHref(buildUrl: BuildUrl, categories: CategoryRecord[], match: SportMatchRecord): string {
  const category = findSportCategory(categories, match.sport) ?? categories[0];

  return buildUrl('MATCH_DETAIL', {
    categorySlug: category?.slug ?? 'match',
    matchId: match.id,
    slug: match.slug ?? match.id,
  });
}

type SignalEntry = {
  label: string;
  href: string;
};

function buildSignalEntries(input: {
  match?: SportMatchRecord;
  article?: NewsArticleRecord;
  liveProducts: LiveProductRecord[];
  signalSourceNames: SignalSourceNameRecord[];
  mode: 'live' | 'replay';
}): SignalEntry[] {
  const products = input.liveProducts.filter((product) => product.status === 'ACTIVE' && product.jumpUrl);
  const sourceNames = input.signalSourceNames.filter((source) => source.status === 'ACTIVE');

  const entries = sourceNames.length
    ? sourceNames
        .map((source, index) => {
          const product = findProductForSignal(source.name, products, index);
          const href = product ? resolveProductSignalHref(product, input) : undefined;
          return href ? { label: source.name, href } : undefined;
        })
        .filter((entry): entry is SignalEntry => Boolean(entry))
    : products.map((product) => ({
        label: product.name,
        href: resolveProductSignalHref(product, input),
      }));

  return uniqueSignalEntries(entries);
}

function findProductForSignal(
  sourceName: string,
  products: LiveProductRecord[],
  index: number,
): LiveProductRecord | undefined {
  const normalized = normalizeDisplayText(sourceName);
  return (
    products.find((product) => normalizeDisplayText(product.name) === normalized) ??
    (products.length ? products[index % products.length] : undefined)
  );
}

function resolveProductSignalHref(
  product: LiveProductRecord,
  input: { match?: SportMatchRecord; article?: NewsArticleRecord; mode: 'live' | 'replay' },
): string {
  const token = createSignalJumpToken({
    productId: product.id,
    mode: input.mode,
    sport: input.match?.sport,
    matchId: input.match?.externalId ?? input.match?.id,
    slug: input.match?.slug ?? input.match?.id ?? input.article?.slug,
    newsSlug: input.article?.slug,
    videoSlug: input.article?.slug,
  });

  return `/video/${token}.html`;
}

function resolveReplaySignalBase(product: LiveProductRecord): string {
  const replayBase = normalizeSignalBaseUrl(product.replayJumpDomain ?? product.jumpUrl);
  if (product.appendRoomSuffix && product.roomSuffix) {
    return replayBase;
  }

  return mergeSignalBaseWithJumpPath(replayBase, product.jumpUrl);
}

function mergeSignalBaseWithJumpPath(signalBase: string, jumpUrl: string): string {
  try {
    const signalUrl = new URL(signalBase);
    const jump = new URL(jumpUrl);
    const signalHasPath = signalUrl.pathname !== '/';
    if (signalHasPath || signalUrl.search || signalUrl.hash) {
      return signalUrl.toString();
    }
    signalUrl.pathname = jump.pathname;
    signalUrl.search = jump.search;
    signalUrl.hash = jump.hash;
    return signalUrl.toString();
  } catch {
    return signalBase;
  }
}

function normalizeSignalBaseUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(value) ? `http://${value}` : `https://${value}`;
}

function joinSignalUrl(base: string, suffix: string): string {
  if (!suffix) {
    return base;
  }
  if (base.endsWith('/') && suffix.startsWith('/')) {
    return `${base.slice(0, -1)}${suffix}`;
  }
  if (!base.endsWith('/') && !suffix.startsWith('/')) {
    return `${base}/${suffix}`;
  }
  return `${base}${suffix}`;
}

function fillSignalVariables(
  value: string,
  input: { match?: SportMatchRecord; article?: NewsArticleRecord },
): string {
  if (input.match) {
    return fillMatchVariables(value, input.match);
  }
  const article = input.article;
  return value
    .replaceAll('{matchId}', encodeURIComponent(article?.id ?? ''))
    .replaceAll('{slug}', encodeURIComponent(article?.slug ?? article?.id ?? ''))
    .replaceAll('{videoSlug}', encodeURIComponent(article?.slug ?? article?.id ?? ''))
    .replaceAll('{newsSlug}', encodeURIComponent(article?.slug ?? article?.id ?? ''));
}

function fillMatchVariables(value: string, match: SportMatchRecord): string {
  return value
    .replaceAll('{matchId}', encodeURIComponent(match.id))
    .replaceAll('{slug}', encodeURIComponent(match.slug ?? match.id));
}

function isVideoCategory(category: CategoryRecord | undefined | null): boolean {
  return Boolean(category && /录像|回放|视频|replay|video/i.test(`${category.name} ${category.slug}`));
}

function findSportCategory(categories: CategoryRecord[], sport: SportMatchRecord['sport']): CategoryRecord | undefined {
  const pattern = sport === 'BASKETBALL' ? /篮球|basketball|nba|cba/i : /足球|football|soccer/i;
  const matches = categories.filter((category) => pattern.test(`${category.name} ${category.slug}`));
  return (
    matches.find((category) => /直播|live/i.test(`${category.name} ${category.slug}`)) ??
    matches.find((category) => /赛程|schedule/i.test(`${category.name} ${category.slug}`)) ??
    matches[0]
  );
}

function uniqueSignalEntries(items: SignalEntry[]): SignalEntry[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeDisplayText(item.label) || item.href;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeDisplayText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export const lyboIndustrialTemplate: TemplatePackage = {
  manifest: {
    key: 'lybo-industrial',
    name: '波佳管业企业模板 Lybo Industrial',
    version: '0.1.0',
    supportedPageTypes: ['home', 'newsList', 'matchList', 'matchDetail', 'videoDetail', 'newsDetail'],
    slots: ['header', 'hero', 'categoryGrid', 'newsGrid', 'schedule', 'footer'],
  },
  HomePage,
  NewsListPage,
  MatchListPage,
  NewsDetailPage,
  MatchDetailPage,
  VideoDetailPage,
};
