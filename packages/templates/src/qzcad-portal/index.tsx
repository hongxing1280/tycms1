import { Fragment } from 'react';
import {
  createSignalJumpToken,
  type CategoryRecord,
  type LiveProductRecord,
  type NewsArticleRecord,
  type SignalSourceNameRecord,
  type SportLeagueRecord,
  type SportMatchRecord,
} from '@sports/core';
import type {
  TemplateCategoryPageProps,
  TemplateMatchDetailPageProps,
  TemplateNewsDetailPageProps,
  TemplatePackage,
  TemplatePageProps,
  TemplateVideoDetailPageProps,
} from '../types';
import { PromotionBlocks } from '../shared';

type BuildUrl = TemplatePageProps['buildUrl'];
type SignalEntry = { label: string; href: string };
type QzcadNavItem = { category: CategoryRecord; children: CategoryRecord[] };

function HomePage(props: TemplatePageProps) {
  const newsArticles = props.latestNews.filter((article) => !isVideoCategory(article.category));
  const replayArticles = props.latestNews.filter((article) => isVideoCategory(article.category));
  const liveMatches = props.matches;
  const footballCategory = findSportCategory(props.categories, 'FOOTBALL');
  const basketballCategory = findSportCategory(props.categories, 'BASKETBALL');

  return (
    <>
      <QzcadHeader siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
      <main className="qzcad-page">
        <div className="qzcad-container qzcad-layout">
          <section className="qzcad-card qzcad-match-card" aria-labelledby="qzcad-home-matches">
            <PanelTitle title="热门赛事" id="qzcad-home-matches" />
            <div className="qzcad-tabs" aria-label="赛事筛选">
              <span className="is-active">正在直播</span>
              <a href={props.buildUrl('HOME')}>热门赛事</a>
              {footballCategory ? <a href={categoryHref(props.buildUrl, footballCategory)}>足球直播</a> : null}
              {basketballCategory ? <a href={categoryHref(props.buildUrl, basketballCategory)}>篮球直播</a> : null}
            </div>
            <MatchTable matches={liveMatches} categories={props.categories} buildUrl={props.buildUrl} />
          </section>
          <QzcadSidebar {...props} newsArticles={newsArticles} replayArticles={replayArticles} newsTitle="头条新闻" />
        </div>
      </main>
      <QzcadFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} matches={props.matches} />
    </>
  );
}

function NewsListPage(props: TemplateCategoryPageProps) {
  const isReplayList = props.pageType === 'VIDEO_CATEGORY' || isVideoCategory(props.category);
  const newsArticles = props.latestNews.filter((article) => !isVideoCategory(article.category));
  const replayArticles = props.latestNews.filter((article) => isVideoCategory(article.category));
  const title = isReplayList ? '录像回放' : props.category.name;

  return (
    <>
      <QzcadHeader siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} activeCategoryId={props.category.id} />
      <main className="qzcad-page">
        <QzcadBreadcrumbs items={[{ name: '首页', url: props.buildUrl('HOME') }, { name: props.category.name, url: categoryHref(props.buildUrl, props.category) }]} />
        <div className="qzcad-container qzcad-layout">
          <section className="qzcad-card qzcad-list-card" aria-labelledby="qzcad-list-title">
            <PanelTitle title={title} id="qzcad-list-title" />
            {isReplayList ? (
              <ReplayRows articles={props.latestNews} buildUrl={props.buildUrl} fallbackCategorySlug={props.category.slug} />
            ) : (
              <NewsRows articles={props.latestNews} buildUrl={props.buildUrl} fallbackCategorySlug={props.category.slug} />
            )}
            <QzcadPagination page={props.page} totalPages={props.totalPages} baseHref={categoryHref(props.buildUrl, props.category)} />
          </section>
          <QzcadSidebar {...props} newsArticles={newsArticles} replayArticles={replayArticles} />
        </div>
      </main>
      <QzcadFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} matches={props.matches} />
    </>
  );
}

function MatchListPage(props: TemplateCategoryPageProps) {
  const matches = props.league ? matchesForLeague(props.league, props.matches) : matchesForCategory(props.category, props.matches);
  const newsArticles = props.latestNews.filter((article) => !isVideoCategory(article.category));
  const replayArticles = props.latestNews.filter((article) => isVideoCategory(article.category));
  const activeCategory = props.league ? findSportCategory(props.categories, props.league.sport) : props.category;
  const title = props.league ? `${props.league.name}直播赛程表` : `${props.category.name}赛程表`;
  const breadcrumbItem = props.league
    ? { name: props.league.name, url: leagueHref(props.buildUrl, props.league) }
    : { name: props.category.name, url: categoryHref(props.buildUrl, props.category) };
  const paginationBaseHref = props.league ? leagueHref(props.buildUrl, props.league) : categoryHref(props.buildUrl, props.category);

  return (
    <>
      <QzcadHeader siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} activeCategoryId={activeCategory?.id ?? props.category.id} />
      <main className="qzcad-page">
        <QzcadBreadcrumbs items={[{ name: '首页', url: props.buildUrl('HOME') }, breadcrumbItem]} />
        <div className="qzcad-container qzcad-layout">
          <section className="qzcad-card qzcad-match-card" aria-labelledby="qzcad-match-list-title">
            <PanelTitle title={title} id="qzcad-match-list-title" />
            <MatchTable matches={matches} categories={props.categories} buildUrl={props.buildUrl} large />
            <QzcadPagination page={props.page} totalPages={props.totalPages} baseHref={paginationBaseHref} />
          </section>
          <QzcadSidebar {...props} newsArticles={newsArticles} replayArticles={replayArticles} />
        </div>
      </main>
      <QzcadFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} matches={props.matches} />
    </>
  );
}

function NewsDetailPage(props: TemplateNewsDetailPageProps) {
  const newsArticles = props.latestNews.filter((article) => !isVideoCategory(article.category));
  const replayArticles = props.latestNews.filter((article) => isVideoCategory(article.category));

  return (
    <>
      <QzcadHeader siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} activeCategoryId={props.article.categoryId} />
      <main className="qzcad-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.newsArticleJsonLd }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.breadcrumbJsonLd }} />
        <QzcadBreadcrumbs items={props.breadcrumbs} />
        <div className="qzcad-container qzcad-layout">
          <ArticleDetail article={props.article} siteName={props.site.name} promotions={props.promotions} />
          <QzcadSidebar {...props} newsArticles={newsArticles} replayArticles={replayArticles} />
        </div>
      </main>
      <QzcadFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} matches={props.matches} />
    </>
  );
}

function VideoDetailPage(props: TemplateVideoDetailPageProps) {
  const newsArticles = props.latestNews.filter((article) => !isVideoCategory(article.category));
  const replayArticles = props.latestNews.filter((article) => isVideoCategory(article.category));
  const relatedReplayArticles = replayArticles.filter((article) => article.id !== props.article.id);
  const signals = buildSignalEntries({
    article: props.article,
    liveProducts: props.liveProducts,
    signalSourceNames: props.signalSourceNames,
    mode: 'replay',
  });

  return (
    <>
      <QzcadHeader siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} activeCategoryId={props.article.categoryId} />
      <main className="qzcad-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.videoObjectJsonLd }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.breadcrumbJsonLd }} />
        <QzcadBreadcrumbs items={props.breadcrumbs} />
        <div className="qzcad-container qzcad-layout">
          <div className="qzcad-main-stack">
            <ReplayDetailArticle
              article={props.article}
              siteName={props.site.name}
              signals={signals}
              siblings={relatedReplayArticles}
              buildUrl={props.buildUrl}
            />
            <ReplayLeagueRecommendCard title={`${props.article.category?.name ?? '赛事'}推荐`} articles={relatedReplayArticles} buildUrl={props.buildUrl} />
          </div>
          <QzcadSidebar {...props} newsArticles={newsArticles} replayArticles={replayArticles} />
        </div>
      </main>
      <QzcadFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} matches={props.matches} />
    </>
  );
}

function MatchDetailPage(props: TemplateMatchDetailPageProps) {
  const newsArticles = props.latestNews.filter((article) => !isVideoCategory(article.category));
  const replayArticles = props.latestNews.filter((article) => isVideoCategory(article.category));
  const activeCategory = findSportCategory(props.categories, props.match.sport);
  const relatedMatches = props.match.league
    ? matchesForLeague(props.match.league, props.matches).filter((match) => match.id !== props.match.id)
    : props.matches.filter((match) => match.sport === props.match.sport && match.id !== props.match.id);
  const signals = buildSignalEntries({
    match: props.match,
    liveProducts: props.liveProducts,
    signalSourceNames: props.signalSourceNames,
    mode: 'live',
  });

  return (
    <>
      <QzcadHeader siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} activeCategoryId={activeCategory?.id} />
      <main className="qzcad-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.breadcrumbJsonLd }} />
        <QzcadBreadcrumbs items={props.breadcrumbs} />
        <div className="qzcad-container qzcad-layout">
          <div className="qzcad-main-stack">
            <LiveMatchCard match={props.match} signals={signals} />
            <MatchIntroCard match={props.match} matches={relatedMatches} categories={props.categories} buildUrl={props.buildUrl} />
          </div>
          <QzcadSidebar
            {...props}
            newsArticles={newsArticles}
            replayArticles={replayArticles}
            relatedTitle={`${props.match.league?.name ?? '赛事'}相关赛事`}
            relatedMatches={relatedMatches}
          />
        </div>
      </main>
      <QzcadFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} matches={props.matches} />
    </>
  );
}

function LiveMatchCard(props: { match: SportMatchRecord; signals: SignalEntry[] }) {
  const homeName = props.match.homeTeam?.name ?? '主队';
  const awayName = props.match.awayTeam?.name ?? '客队';
  const leagueName = props.match.league?.name ?? '赛事';

  return (
    <article className="qzcad-card qzcad-live-detail-card">
      <section className="qzcad-live-scoreboard" aria-labelledby="qzcad-live-title">
        <div className="qzcad-live-team qzcad-live-home">
          {props.match.homeTeam?.logoUrl ? <img src={props.match.homeTeam.logoUrl} alt={`${homeName}logo`} width={72} height={72} /> : null}
          <strong>{homeName}</strong>
        </div>
        <div className="qzcad-live-center">
          <em>{leagueName}</em>
          <div>
            <b>0</b>
            <span>{matchStatusLabel(props.match.status)}</span>
            <b>0</b>
          </div>
          <time dateTime={props.match.startTime.toISOString()}>{formatMonthDay(props.match.startTime)} {formatTime(props.match.startTime)}</time>
        </div>
        <div className="qzcad-live-team qzcad-live-away">
          {props.match.awayTeam?.logoUrl ? (
            <img src={props.match.awayTeam.logoUrl} alt={`${awayName}logo`} width={72} height={72} />
          ) : props.match.league?.logoUrl ? (
            <img src={props.match.league.logoUrl} alt={`${leagueName}logo`} width={72} height={72} />
          ) : null}
          <strong id="qzcad-live-title">{awayName}</strong>
        </div>
      </section>
      <section className="qzcad-live-signal-strip" aria-labelledby="qzcad-live-signal-title">
        <h2 id="qzcad-live-signal-title">直播信号源</h2>
        {props.signals.length ? (
          <div className="qzcad-live-signal-buttons">
            {props.signals.map((entry, index) => (
              <a href={entry.href} target="_blank" rel="nofollow sponsored noopener noreferrer" key={`${entry.label}-${entry.href}-${index}`}>
                {entry.label}
              </a>
            ))}
          </div>
        ) : (
          <p className="qzcad-empty">暂无直播信号源，后台配置后自动展示。</p>
        )}
      </section>
    </article>
  );
}

function MatchIntroCard(props: {
  match: SportMatchRecord;
  matches: SportMatchRecord[];
  categories: CategoryRecord[];
  buildUrl: BuildUrl;
}) {
  const homeName = props.match.homeTeam?.name ?? '主队';
  const awayName = props.match.awayTeam?.name ?? '客队';
  const leagueName = props.match.league?.name ?? '赛事';
  const headToHead = props.matches.filter((match) => participates(match, homeName) && participates(match, awayName)).slice(0, 5);
  const homeMatches = props.matches.filter((match) => participates(match, homeName)).slice(0, 5);
  const awayMatches = props.matches.filter((match) => participates(match, awayName)).slice(0, 5);

  return (
    <article className="qzcad-card qzcad-match-intro">
      <PanelTitle title="赛事介绍" id="qzcad-match-intro-title" />
      <div className="qzcad-match-intro-body">
        <p><strong>【赛事名称】</strong>{leagueName} {homeName} VS {awayName}</p>
        <p><strong>【赛事分类】</strong>{leagueName}</p>
        <p><strong>【开赛时间】</strong>{formatDateTime(props.match.startTime)}</p>
        <p><strong>【对阵双方】</strong>{homeName} VS {awayName}</p>
        <p>
          <strong>【比赛详情】</strong>北京时间：{formatDateTime(props.match.startTime)}，{leagueName}【{homeName} VS {awayName}】准时开始，喜欢看{leagueName}比赛的朋友可以提前收藏本页面，以免错过直播。
        </p>
        <MatchHistoryBlock title="近5次交锋" matches={headToHead} categories={props.categories} buildUrl={props.buildUrl} />
        <MatchHistoryBlock title={`${homeName}近5场战绩`} matches={homeMatches} categories={props.categories} buildUrl={props.buildUrl} />
        <MatchHistoryBlock title={`${awayName}近5场战绩`} matches={awayMatches} categories={props.categories} buildUrl={props.buildUrl} />
      </div>
    </article>
  );
}

function MatchHistoryBlock(props: { title: string; matches: SportMatchRecord[]; categories: CategoryRecord[]; buildUrl: BuildUrl }) {
  return (
    <section className="qzcad-history-block">
      <h3>{props.title}</h3>
      {props.matches.length ? (
        <div className="qzcad-history-list">
          {props.matches.map((match) => (
            <a href={matchHref(props.buildUrl, props.categories, match)} key={match.id}>
              <time dateTime={match.startTime.toISOString()}>{formatTime(match.startTime)}　{formatMonthDay(match.startTime)}</time>
              <em>{match.league?.name ?? '赛事'}</em>
              <strong>{match.homeTeam?.name ?? '主队'} VS {match.awayTeam?.name ?? '客队'}</strong>
              <b>{match.startTime.getTime() > Date.now() ? '即将开始' : '高清直播'}</b>
            </a>
          ))}
        </div>
      ) : (
        <p className="qzcad-history-empty">暂无相关赛事数据。</p>
      )}
    </section>
  );
}

function QzcadHeader(props: {
  siteName: string;
  categories: CategoryRecord[];
  buildUrl: BuildUrl;
  activeCategoryId?: string;
}) {
  const navItems = buildQzcadNavItems(props.categories);

  return (
    <header className="qzcad-header">
      <div className="qzcad-header-inner">
        <a className="qzcad-logo" href={props.buildUrl('HOME')} aria-label={`${props.siteName}首页`}>
          {props.siteName}
        </a>
        <nav className="qzcad-nav" aria-label="主导航">
          <a href={props.buildUrl('HOME')}>首页</a>
          {navItems.map(({ category, children }) => (
            <span className={`qzcad-nav-item${isActiveNavItem(category, children, props.activeCategoryId) ? ' is-active' : ''}`} key={category.id}>
              <a href={categoryHref(props.buildUrl, category)}>{category.name}</a>
              {children.length ? (
                <span className="qzcad-dropdown">
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

function QzcadFooter(props: {
  siteName: string;
  categories: CategoryRecord[];
  buildUrl: BuildUrl;
  matches: SportMatchRecord[];
}) {
  return (
    <footer className="qzcad-footer">
      <div className="qzcad-container">
        <p>本站所有赛事入口均由用户收集或从搜索引擎整理获得，所有内容均来自互联网，我们自身不提供任何视频内容，如有侵犯您的权益请联系我们，我们会第一时间处理。</p>
        <p>Copyright © {new Date().getFullYear()} {props.siteName} 版权所有</p>
        <a href="/sitemap.xml">网站地图</a>
      </div>
    </footer>
  );
}

function QzcadSidebar(props: TemplatePageProps & {
  newsArticles: NewsArticleRecord[];
  replayArticles: NewsArticleRecord[];
  newsTitle?: string;
  relatedMatches?: SportMatchRecord[];
  relatedTitle?: string;
}) {
  return (
    <aside className="qzcad-sidebar" aria-label="侧边栏">
      <HotLeaguesPanel leagues={props.leagues} buildUrl={props.buildUrl} />
      {props.relatedMatches ? <RelatedMatchesPanel title={props.relatedTitle ?? '相关赛事'} matches={props.relatedMatches} categories={props.categories} buildUrl={props.buildUrl} /> : null}
      <RankedNewsPanel title={props.newsTitle ?? '最新新闻'} articles={props.newsArticles.slice(0, 8)} buildUrl={props.buildUrl} />
      <ReplayRecommendPanel articles={props.replayArticles.slice(0, 12)} buildUrl={props.buildUrl} />
    </aside>
  );
}

function PanelTitle(props: { title: string; id: string; href?: string }) {
  return (
    <div className="qzcad-panel-title">
      <h2 id={props.id}>{props.title}</h2>
      {props.href ? <a href={props.href}>更多</a> : null}
    </div>
  );
}

function HotLeaguesPanel(props: { leagues: SportLeagueRecord[]; buildUrl: BuildUrl }) {
  const leagues = props.leagues.filter((league) => league.isHot).slice(0, 17);

  return (
    <section className="qzcad-card qzcad-leagues" aria-labelledby="qzcad-hot-leagues">
      <PanelTitle title="热门联赛" id="qzcad-hot-leagues" />
      {leagues.length ? (
        <div className="qzcad-league-grid">
          {leagues.map((league) => (
            <a className="qzcad-league-item" href={leagueHref(props.buildUrl, league)} key={league.id}>
              <span>
                {league.logoUrl ? <img src={league.logoUrl} alt={`${league.name}logo`} width={74} height={74} loading="lazy" /> : <b>{league.name.slice(0, 2)}</b>}
              </span>
              <strong>{league.name}</strong>
            </a>
          ))}
        </div>
      ) : (
        <p className="qzcad-empty">暂无联赛数据。</p>
      )}
    </section>
  );
}

function RankedNewsPanel(props: { title: string; articles: NewsArticleRecord[]; buildUrl: BuildUrl }) {
  return (
    <section className="qzcad-card qzcad-ranked-news" aria-labelledby="qzcad-ranked-news">
      <PanelTitle title={props.title} id="qzcad-ranked-news" />
      {props.articles.length ? (
        <ol>
          {props.articles.map((article, index) => (
            <li key={article.id}>
              <b>{index + 1}</b>
              <a href={articleHref(props.buildUrl, article)}>{article.title}</a>
            </li>
          ))}
        </ol>
      ) : (
        <p className="qzcad-empty">暂无新闻数据。</p>
      )}
    </section>
  );
}

function ReplayRecommendPanel(props: { articles: NewsArticleRecord[]; buildUrl: BuildUrl }) {
  return (
    <section className="qzcad-card qzcad-replay-panel" aria-labelledby="qzcad-replay-recommend">
      <PanelTitle title="录像推荐" id="qzcad-replay-recommend" />
      {props.articles.length ? (
        <div className="qzcad-replay-links">
          {props.articles.map((article) => (
            <a href={articleHref(props.buildUrl, article, article.category?.slug)} key={article.id}>
              <strong>{article.title}</strong>
              {article.publishedAt ? <time dateTime={article.publishedAt.toISOString()}>{formatDateOnly(article.publishedAt, '/')}</time> : null}
            </a>
          ))}
        </div>
      ) : (
        <p className="qzcad-empty">暂无录像数据。</p>
      )}
    </section>
  );
}

function RelatedMatchesPanel(props: { title: string; matches: SportMatchRecord[]; categories: CategoryRecord[]; buildUrl: BuildUrl }) {
  const matches = props.matches.slice(0, 6);

  return (
    <section className="qzcad-card qzcad-side-matches" aria-labelledby="qzcad-side-matches">
      <PanelTitle title={props.title} id="qzcad-side-matches" />
      {matches.length ? (
        <div className="qzcad-side-match-links">
          {matches.map((match) => (
            <a href={matchHref(props.buildUrl, props.categories, match)} key={match.id}>
              <strong>{match.homeTeam?.name ?? '主队'}</strong>
              <em>{match.league?.name ?? '赛事'}</em>
              <span>{match.awayTeam?.name ?? '客队'}</span>
              <time dateTime={match.startTime.toISOString()}>{formatMonthDay(match.startTime)} {formatTime(match.startTime)}</time>
            </a>
          ))}
        </div>
      ) : (
        <p className="qzcad-empty">暂无相关赛事。</p>
      )}
    </section>
  );
}

function MatchTable(props: {
  matches: SportMatchRecord[];
  categories: CategoryRecord[];
  buildUrl: BuildUrl;
  large?: boolean;
}) {
  if (!props.matches.length) {
    return <p className="qzcad-empty">暂无赛事数据。</p>;
  }

  return (
    <div className={`qzcad-match-table${props.large ? ' is-large' : ''}`}>
      {props.matches.map((match) => (
        <a href={matchHref(props.buildUrl, props.categories, match)} key={match.id}>
          <time dateTime={match.startTime.toISOString()}>{formatTime(match.startTime)}</time>
          <span>{formatMonthDay(match.startTime)}</span>
          <em>{match.league?.name ?? '赛事'}</em>
          <strong>{match.homeTeam?.name ?? '主队'} VS {match.awayTeam?.name ?? '客队'}</strong>
          <b className={match.startTime.getTime() > Date.now() ? 'is-soon' : undefined}>
            {match.startTime.getTime() > Date.now() ? '即将开始' : '高清直播'}
          </b>
        </a>
      ))}
    </div>
  );
}

function NewsRows(props: {
  articles: NewsArticleRecord[];
  buildUrl: BuildUrl;
  fallbackCategorySlug?: string;
}) {
  if (!props.articles.length) {
    return <p className="qzcad-empty">暂无内容，后台发布后自动展示。</p>;
  }

  return (
    <div className="qzcad-news-rows">
      {props.articles.map((article) => (
        <a href={articleHref(props.buildUrl, article, props.fallbackCategorySlug)} key={article.id}>
          <strong>{article.title}</strong>
          {article.publishedAt ? <time dateTime={article.publishedAt.toISOString()}>{formatDateOnly(article.publishedAt, '/')}</time> : null}
        </a>
      ))}
    </div>
  );
}

function ReplayRows(props: {
  articles: NewsArticleRecord[];
  buildUrl: BuildUrl;
  fallbackCategorySlug?: string;
}) {
  if (!props.articles.length) {
    return <p className="qzcad-empty">暂无录像数据。</p>;
  }

  return (
    <div className="qzcad-replay-rows">
      {props.articles.map((article) => (
        <a href={articleHref(props.buildUrl, article, props.fallbackCategorySlug)} key={article.id}>
          <strong>{article.title}</strong>
          {article.publishedAt ? <time dateTime={article.publishedAt.toISOString()}>{formatDateOnly(article.publishedAt, '-')}</time> : null}
        </a>
      ))}
    </div>
  );
}

function ReplayDetailArticle(props: {
  article: NewsArticleRecord;
  siteName: string;
  signals: SignalEntry[];
  siblings: NewsArticleRecord[];
  buildUrl: BuildUrl;
}) {
  const paragraphs = splitParagraphs(props.article.content);
  const previous = props.siblings[0];
  const next = props.siblings[1];

  return (
    <article className="qzcad-card qzcad-video-article">
      <header>
        <h1>{props.article.title}</h1>
        <div className="qzcad-video-meta">
          <span>来源：{props.article.sourceName ?? `${props.article.category?.name ?? props.siteName}录像`}</span>
          {props.article.publishedAt ? <time dateTime={props.article.publishedAt.toISOString()}>{formatDateOnly(props.article.publishedAt, '-')}</time> : null}
        </div>
      </header>
      <div className="qzcad-video-article-body">
        <p>比赛录像↓</p>
        {props.signals.length ? (
          <div className="qzcad-video-watch-links">
            {props.signals.map((entry, index) => (
              <a href={entry.href} target="_blank" rel="nofollow sponsored noopener noreferrer" key={`${entry.label}-${entry.href}-${index}`}>
                {index === 0 ? '[点击观看]' : '[备用观看]'} {props.article.title} 完整录像回放
              </a>
            ))}
          </div>
        ) : (
          <p className="qzcad-video-muted">暂无播放源，后台配置后自动展示。</p>
        )}
        <p>本站所有视频链接均由网友提供，并链接到其他网站播放。</p>
        {paragraphs.map((paragraph, index) => (
          <p key={`${props.article.id}-replay-${index}`}>{paragraph}</p>
        ))}
        <div className="qzcad-prev-next">
          <p>上一篇：{previous ? <a href={articleHref(props.buildUrl, previous, previous.category?.slug)}>{previous.title}</a> : '暂无'}</p>
          <p>下一篇：{next ? <a href={articleHref(props.buildUrl, next, next.category?.slug)}>{next.title}</a> : '暂无'}</p>
        </div>
      </div>
    </article>
  );
}

function ReplayLeagueRecommendCard(props: { title: string; articles: NewsArticleRecord[]; buildUrl: BuildUrl }) {
  return (
    <section className="qzcad-card qzcad-replay-recommend-wide" aria-labelledby="qzcad-replay-wide-title">
      <PanelTitle title={props.title} id="qzcad-replay-wide-title" />
      {props.articles.length ? (
        <div className="qzcad-replay-wide-links">
          {props.articles.slice(0, 6).map((article) => (
            <a href={articleHref(props.buildUrl, article, article.category?.slug)} key={article.id}>
              {article.title}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ArticleDetail(props: {
  article: NewsArticleRecord;
  siteName: string;
  promotions: TemplatePageProps['promotions'];
  signals?: SignalEntry[];
  videoMode?: boolean;
}) {
  const paragraphs = splitParagraphs(props.article.content);
  const primarySignal = props.signals?.[0];

  return (
    <article className="qzcad-card qzcad-detail">
      <PanelTitle title={props.article.category?.name ?? '新闻动态'} id="qzcad-detail-title" />
      <header>
        <h1>{props.article.title}</h1>
        <p className="qzcad-detail-meta">
          {props.article.publishedAt ? formatDateTime(props.article.publishedAt) : ''}
          {props.article.sourceName ? ` · ${props.article.sourceName}` : ` · ${props.siteName}`}
        </p>
        {props.article.summary ? <p className="qzcad-detail-summary">{props.article.summary}</p> : null}
      </header>
      <PromotionBlocks promotions={props.promotions} slot="NEWS_TOP" limit={1} />
      {props.videoMode ? (
        <div className="qzcad-video-box">
          {props.article.coverImageUrl ? (
            <img
              src={props.article.coverImageUrl}
              alt={`${props.article.title}录像封面`}
              width={props.article.coverImageWidth ?? 1200}
              height={props.article.coverImageHeight ?? 675}
            />
          ) : null}
          {primarySignal ? (
            <a href={primarySignal.href} target="_blank" rel="nofollow sponsored noopener noreferrer">播放</a>
          ) : (
            <span>暂无播放源</span>
          )}
        </div>
      ) : props.article.coverImageUrl ? (
        <img
          className="qzcad-detail-cover"
          src={props.article.coverImageUrl}
          alt={`${props.article.title}封面`}
          width={props.article.coverImageWidth ?? 1200}
          height={props.article.coverImageHeight ?? 675}
        />
      ) : null}
      {props.signals ? <SignalPanel title={props.videoMode ? '录像播放源' : '播放入口'} entries={props.signals} emptyText="暂无播放源。" /> : null}
      <div className="qzcad-detail-body">
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

function SignalPanel(props: { title: string; entries: SignalEntry[]; emptyText: string }) {
  return (
    <section className="qzcad-signal-panel" aria-labelledby="qzcad-signal-title">
      <PanelTitle title={props.title} id="qzcad-signal-title" />
      {props.entries.length ? (
        <div className="qzcad-signal-grid">
          {props.entries.map((entry, index) => (
            <a href={entry.href} target="_blank" rel="nofollow sponsored noopener noreferrer" key={`${entry.label}-${entry.href}-${index}`}>
              {entry.label}
            </a>
          ))}
        </div>
      ) : (
        <p className="qzcad-empty">{props.emptyText}</p>
      )}
    </section>
  );
}

function QzcadBreadcrumbs(props: { items: Array<{ name: string; url: string }> }) {
  return (
    <nav className="qzcad-container qzcad-breadcrumbs" aria-label="面包屑">
      当前位置：
      {props.items.map((item, index) => (
        <span key={`${item.url}-${index}`}>
          {index > 0 ? <b aria-hidden="true">&gt;</b> : null}
          <a href={item.url}>{item.name}</a>
        </span>
      ))}
    </nav>
  );
}

function QzcadPagination(props: { page: number; totalPages: number; baseHref: string }) {
  if (props.totalPages <= 1) return null;

  return (
    <nav className="qzcad-pagination" aria-label="分页">
      <a href={props.baseHref}>首页</a>
      <a href={`${props.baseHref}${props.page > 2 ? `?page=${props.page - 1}` : ''}`}>上一页</a>
      {Array.from({ length: props.totalPages }, (_, index) => index + 1).map((page) => (
        <a aria-current={page === props.page ? 'page' : undefined} href={`${props.baseHref}${page > 1 ? `?page=${page}` : ''}`} key={page}>
          {page}
        </a>
      ))}
      <a href={`${props.baseHref}${props.page < props.totalPages ? `?page=${props.page + 1}` : `?page=${props.totalPages}`}`}>下一页</a>
      <a href={`${props.baseHref}${props.totalPages > 1 ? `?page=${props.totalPages}` : ''}`}>尾页</a>
      <span>当前页{props.page}/{props.totalPages}</span>
    </nav>
  );
}

function categoryHref(buildUrl: BuildUrl, category: CategoryRecord): string {
  return buildUrl('NEWS_CATEGORY', { categorySlug: category.slug });
}

function leagueHref(buildUrl: BuildUrl, league: Pick<SportLeagueRecord, 'slug'>): string {
  return buildUrl('LEAGUE', { leagueSlug: league.slug, slug: league.slug });
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
          const href = product ? buildProductSignalJumpHref(product, input) : undefined;
          return href ? { label: source.name, href } : undefined;
        })
        .filter((entry): entry is SignalEntry => Boolean(entry))
    : products.map((product) => ({ label: product.name, href: buildProductSignalJumpHref(product, input) }));

  return uniqueSignalEntries(entries);
}

function findProductForSignal(sourceName: string, products: LiveProductRecord[], index: number): LiveProductRecord | undefined {
  const normalized = normalizeDisplayText(sourceName);
  return products.find((product) => normalizeDisplayText(product.name) === normalized) ?? (products.length ? products[index % products.length] : undefined);
}

function buildProductSignalJumpHref(
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

function findSportCategory(categories: CategoryRecord[], sport: SportMatchRecord['sport']): CategoryRecord | undefined {
  const pattern = sport === 'BASKETBALL' ? /篮球|basketball|nba|cba/i : /足球|football|soccer/i;
  const matches = categories.filter((category) => pattern.test(`${category.name} ${category.slug}`));
  return matches.find((category) => /直播|live/i.test(`${category.name} ${category.slug}`)) ?? matches[0];
}

function isVideoCategory(category: CategoryRecord | undefined | null): boolean {
  return Boolean(category && /录像|回放|视频|replay|video/i.test(`${category.name} ${category.slug}`));
}

function matchesForCategory(category: CategoryRecord, matches: SportMatchRecord[]): SportMatchRecord[] {
  const label = `${category.name} ${category.slug}`;
  if (/篮球|basketball|nba|cba/i.test(label)) {
    return matches.filter((match) => match.sport === 'BASKETBALL');
  }
  if (/足球|football|soccer/i.test(label)) {
    return matches.filter((match) => match.sport === 'FOOTBALL');
  }
  return matches;
}

function matchesForLeague(league: SportLeagueRecord, matches: SportMatchRecord[]): SportMatchRecord[] {
  return matches.filter((match) => match.leagueId === league.id || match.league?.id === league.id || match.league?.slug === league.slug);
}

function participates(match: SportMatchRecord, teamName: string): boolean {
  return match.homeTeam?.name === teamName || match.awayTeam?.name === teamName;
}

function buildQzcadNavItems(categories: CategoryRecord[]): QzcadNavItem[] {
  const sortedCategories = sortCategories(categories);
  const categoryById = new Map(sortedCategories.map((category) => [category.id, category]));
  const childrenByParentId = new Map<string, CategoryRecord[]>();
  const topLevelCategories: CategoryRecord[] = [];

  for (const category of sortedCategories) {
    if (category.parentId && categoryById.has(category.parentId)) {
      const children = childrenByParentId.get(category.parentId) ?? [];
      children.push(category);
      childrenByParentId.set(category.parentId, children);
      continue;
    }

    topLevelCategories.push(category);
  }

  return topLevelCategories.map((category) => ({
    category,
    children: childrenByParentId.get(category.id) ?? [],
  }));
}

function isActiveNavItem(category: CategoryRecord, children: CategoryRecord[], activeCategoryId: string | undefined): boolean {
  return category.id === activeCategoryId || children.some((child) => child.id === activeCategoryId);
}

function sortCategories(categories: CategoryRecord[]): CategoryRecord[] {
  return [...categories].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}

function splitParagraphs(content: string): string[] {
  return content.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function uniqueSignalEntries(items: SignalEntry[]): SignalEntry[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeDisplayText(item.label) || item.href;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDisplayText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatMonthDay(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(date).replace('/', '-');
}

function formatDateOnly(date: Date, separator: '-' | '/'): string {
  const value = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return value.replaceAll('/', separator);
}

function formatDateTime(date: Date): string {
  return `${formatDateOnly(date, '-')} ${formatTime(date)}`;
}

function matchStatusLabel(status: SportMatchRecord['status']): string {
  if (status === 'LIVE') return '进行中';
  if (status === 'FINISHED') return '已结束';
  if (status === 'CANCELLED') return '已取消';
  if (status === 'POSTPONED') return '延期';
  return '未开始';
}

export const qzcadPortalTemplate: TemplatePackage = {
  manifest: {
    key: 'qzcad-portal',
    name: 'QZCAD 红色直播模板',
    version: '0.2.0',
    supportedPageTypes: ['home', 'newsList', 'matchList', 'newsDetail', 'matchDetail', 'videoDetail'],
    slots: ['nav', 'matchList', 'leagueGrid', 'newsList', 'replayList', 'sidebar', 'footer'],
  },
  HomePage,
  NewsListPage,
  MatchListPage,
  NewsDetailPage,
  MatchDetailPage,
  VideoDetailPage,
};
