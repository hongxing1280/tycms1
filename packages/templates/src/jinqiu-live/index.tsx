import { Fragment } from 'react';
import { createSignalJumpToken } from '@sports/core';
import type {
  CategoryRecord,
  LiveProductRecord,
  NewsArticleRecord,
  PageType,
  SignalSourceNameRecord,
  SportLeagueRecord,
  SportMatchRecord,
  SportTeamRecord,
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

type BuildUrl = (pageType: PageType, data?: Record<string, string>) => string;
type SignalEntry = {
  label: string;
  href: string;
};

const introLeagueLinks: Array<{ label: string; sport: SportMatchRecord['sport'] }> = [
  { label: '世界杯', sport: 'FOOTBALL' },
  { label: '英超', sport: 'FOOTBALL' },
  { label: '意甲', sport: 'FOOTBALL' },
  { label: '西甲', sport: 'FOOTBALL' },
  { label: '德甲', sport: 'FOOTBALL' },
  { label: '法甲', sport: 'FOOTBALL' },
  { label: '中超', sport: 'FOOTBALL' },
  { label: '日职联', sport: 'FOOTBALL' },
  { label: '韩K联', sport: 'FOOTBALL' },
  { label: '澳超', sport: 'FOOTBALL' },
  { label: 'NBA', sport: 'BASKETBALL' },
  { label: 'CBA', sport: 'BASKETBALL' },
  { label: 'WNBA', sport: 'BASKETBALL' },
];

function HomePage(props: TemplatePageProps) {
  const latestNewsArticles = props.latestNews.filter((article) => !isReplayArticle(article));
  const lead = props.topNews.find((article) => !isReplayArticle(article)) ?? latestNewsArticles[0];
  const newsWithoutLead = latestNewsArticles.filter((article) => article.id !== lead?.id);
  const replayCategory = findReplayCategory(props.categories);
  const replayArticles = selectReplayArticles(props.latestNews, replayCategory).slice(0, 8);

  return (
    <>
      <JinqiuHeader
        siteName={props.site.name}
        categories={props.categories}
        categoryArticleCounts={props.categoryArticleCounts}
        leagues={props.leagues}
        teams={props.teams}
        matches={props.matches}
        buildUrl={props.buildUrl}
      />
      <main className="jinqiu-page">
        <div className="jinqiu-container">
          <section className="jinqiu-intro" aria-labelledby="jinqiu-home-title">
            <h1 id="jinqiu-home-title" className="jinqiu-visually-hidden">{props.site.name}</h1>
            <IntroLinkRail categories={props.categories} leagues={props.leagues} buildUrl={props.buildUrl} />
          </section>

          <PromotionBlocks promotions={props.promotions} slot="HOME_HERO" limit={2} />

          <div className="jinqiu-layout">
            <div className="jinqiu-main-col">
              <MatchSchedulePanel
                matches={props.matches}
                categories={props.categories}
                buildUrl={props.buildUrl}
              />

              <section className="jinqiu-panel" aria-labelledby="jinqiu-home-news-title">
                <PanelTitle
                  title="最新体育新闻"
                  titleId="jinqiu-home-news-title"
                  moreHref={
                    newsWithoutLead[0]?.category
                      ? props.buildUrl('NEWS_CATEGORY', { categorySlug: newsWithoutLead[0].category.slug })
                      : undefined
                  }
                />
                {lead ? (
                  <FeaturedNewsCard
                    article={lead}
                    href={props.buildUrl('NEWS_DETAIL', {
                      categorySlug: lead.category?.slug ?? props.categories[0]?.slug ?? 'sports-news',
                      newsSlug: lead.slug,
                    })}
                  />
                ) : null}
                <NewsTextList
                  articles={newsWithoutLead.slice(0, 10)}
                  buildUrl={props.buildUrl}
                  fallbackCategorySlug={props.categories[0]?.slug ?? 'sports-news'}
                />
              </section>

              <TeamLeagueDirectory
                categories={props.categories}
                leagues={props.leagues}
                teams={props.teams}
                buildUrl={props.buildUrl}
              />

              <PromotionBlocks promotions={props.promotions} slot="HOME_AFTER_NEWS" limit={3} />
            </div>

            <JinqiuSidebar
              categories={props.categories}
              latestNews={props.latestNews}
              leagues={props.leagues}
              teams={props.teams}
              replayCategory={replayCategory}
              replayArticles={replayArticles}
              buildUrl={props.buildUrl}
            />
          </div>
        </div>
      </main>
      <JinqiuFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
    </>
  );
}

function SidebarReplayPanel(props: {
  categories: CategoryRecord[];
  replayCategory?: CategoryRecord;
  replayArticles: NewsArticleRecord[];
  buildUrl: BuildUrl;
}) {
  if (!props.replayCategory && !props.replayArticles.length) {
    return null;
  }

  const fallbackReplayCategory = props.replayCategory ?? props.categories.find(isVideoCategory) ?? props.categories[0];

  return (
    <section className="jinqiu-panel" aria-labelledby="jinqiu-sidebar-replays">
      <PanelTitle
        title={props.replayCategory?.name ?? '赛事录像'}
        titleId="jinqiu-sidebar-replays"
        moreHref={
          props.replayCategory
            ? props.buildUrl('NEWS_CATEGORY', { categorySlug: props.replayCategory.slug })
            : undefined
        }
      />
      <NewsTextList
        articles={props.replayArticles}
        buildUrl={props.buildUrl}
        fallbackCategorySlug={fallbackReplayCategory?.slug ?? 'match-replay'}
        showSummary
      />
    </section>
  );
}

function NewsListPage(props: TemplateCategoryPageProps) {
  return (
    <>
      <JinqiuHeader
        siteName={props.site.name}
        categories={props.categories}
        categoryArticleCounts={props.categoryArticleCounts}
        leagues={props.leagues}
        teams={props.teams}
        matches={props.matches}
        buildUrl={props.buildUrl}
      />
      <main className="jinqiu-page">
        <div className="jinqiu-container">
          <BreadcrumbLine
            items={[
              { name: '首页', href: props.buildUrl('HOME') },
              { name: props.category.name, href: props.buildUrl('NEWS_CATEGORY', { categorySlug: props.category.slug }) },
            ]}
          />
          <div className="jinqiu-layout">
            <div className="jinqiu-main-col">
              <section className="jinqiu-panel jinqiu-list-panel" aria-labelledby="jinqiu-category-title">
                <PanelTitle as="h1" title={props.category.name} titleId="jinqiu-category-title" />
                {props.category.description ? <p className="jinqiu-category-desc">{props.category.description}</p> : null}
                <NewsTextList
                  articles={props.latestNews}
                  buildUrl={props.buildUrl}
                  fallbackCategorySlug={props.category.slug}
                  showSummary
                />
              </section>
              <Pagination
                page={props.page}
                totalPages={props.totalPages}
                baseHref={props.buildUrl('NEWS_CATEGORY', { categorySlug: props.category.slug })}
              />
              <PromotionBlocks promotions={props.promotions} slot="CATEGORY_TOP" limit={2} />
            </div>
            <JinqiuSidebar
              categories={props.categories}
              latestNews={props.topNews}
              leagues={props.leagues}
              teams={props.teams}
              buildUrl={props.buildUrl}
            />
          </div>
        </div>
      </main>
      <JinqiuFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
    </>
  );
}

function MatchListPage(props: TemplateCategoryPageProps) {
  const sport = sportFromCategory(props.category);
  const matches = sport ? props.matches.filter((match) => match.sport === sport) : props.matches;
  const leagues = uniqueByName(props.leagues.filter((league) => !sport || league.sport === sport)).slice(0, 18);
  const teams = uniqueByName(props.teams.filter((team) => !sport || team.sport === sport)).slice(0, 24);
  const categoryHref = props.buildUrl('NEWS_CATEGORY', { categorySlug: props.category.slug });

  return (
    <>
      <JinqiuHeader
        siteName={props.site.name}
        categories={props.categories}
        categoryArticleCounts={props.categoryArticleCounts}
        leagues={props.leagues}
        teams={props.teams}
        matches={props.matches}
        buildUrl={props.buildUrl}
      />
      <main className="jinqiu-page">
        <div className="jinqiu-container">
          <BreadcrumbLine
            items={[
              { name: '首页', href: props.buildUrl('HOME') },
              { name: props.category.name, href: categoryHref },
            ]}
          />
          <div className="jinqiu-layout">
            <div className="jinqiu-main-col">
              <section className="jinqiu-panel jinqiu-list-panel" aria-labelledby="jinqiu-match-category-title">
                <PanelTitle as="h1" title={props.category.name} titleId="jinqiu-match-category-title" />
                {props.category.description ? <p className="jinqiu-category-desc">{props.category.description}</p> : null}
                <ul className="jinqiu-match-list">
                  {matches.length ? (
                    matches.slice(0, 48).map((match) => (
                      <MatchRow
                        key={match.id}
                        match={match}
                        categories={props.categories}
                        buildUrl={props.buildUrl}
                      />
                    ))
                  ) : (
                    <li className="jinqiu-empty">暂无赛程数据，后台同步或发布赛事后这里会自动更新。</li>
                  )}
                </ul>
                <div className="jinqiu-compact-tags" aria-label={`${props.category.name}相关资料`}>
                  {uniqueLinks([...leagues, ...teams].map((item) => ({ label: item.name, href: categoryHref }))).map((item, index) => (
                    <a href={item.href} key={`${props.category.id}-${item.label}-${index}`}>
                      {item.label}
                    </a>
                  ))}
                </div>
              </section>
              <PromotionBlocks promotions={props.promotions} slot="CATEGORY_TOP" limit={2} />
            </div>
            <JinqiuSidebar
              categories={props.categories}
              latestNews={props.topNews}
              leagues={props.leagues}
              teams={props.teams}
              buildUrl={props.buildUrl}
            />
          </div>
        </div>
      </main>
      <JinqiuFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
    </>
  );
}

function NewsDetailPage(props: TemplateNewsDetailPageProps) {
  const paragraphs = splitParagraphs(props.article.content);

  return (
    <>
      <JinqiuHeader
        siteName={props.site.name}
        categories={props.categories}
        categoryArticleCounts={props.categoryArticleCounts}
        leagues={props.leagues}
        teams={props.teams}
        matches={props.matches}
        buildUrl={props.buildUrl}
      />
      <main className="jinqiu-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.newsArticleJsonLd }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.breadcrumbJsonLd }} />
        <div className="jinqiu-container">
          <BreadcrumbLine items={props.breadcrumbs.map((item) => ({ name: item.name, href: item.url }))} />
          <div className="jinqiu-layout">
            <article className="jinqiu-panel jinqiu-article">
              <header className="jinqiu-article-title">
                <h1>{props.article.title}</h1>
                <p>
                  <span>{props.article.category?.name ?? '体育新闻'}</span>
                  <span>{props.article.author ?? props.site.name}</span>
                  {props.article.publishedAt ? <time dateTime={props.article.publishedAt.toISOString()}>{formatDate(props.article.publishedAt)}</time> : null}
                  {props.article.sourceName ? <span>{props.article.sourceName}</span> : null}
                </p>
              </header>

              <PromotionBlocks promotions={props.promotions} slot="NEWS_TOP" limit={1} />

              {props.article.coverImageUrl ? (
                <img
                  className="jinqiu-article-cover"
                  src={props.article.coverImageUrl}
                  alt={`${props.article.title}封面图`}
                  width={props.article.coverImageWidth ?? 1200}
                  height={props.article.coverImageHeight ?? 675}
                />
              ) : null}

              {props.article.summary ? <p className="jinqiu-article-summary">{props.article.summary}</p> : null}

              <div className="jinqiu-article-content">
                {paragraphs.map((paragraph, index) => (
                  <Fragment key={`${props.article.id}-${index}`}>
                    <p>{paragraph}</p>
                    {index === 0 ? <PromotionBlocks promotions={props.promotions} slot="NEWS_INLINE" limit={1} /> : null}
                  </Fragment>
                ))}
              </div>

              <PromotionBlocks promotions={props.promotions} slot="NEWS_BOTTOM" limit={2} />
            </article>
            <JinqiuSidebar
              categories={props.categories}
              latestNews={props.latestNews}
              leagues={props.leagues}
              teams={props.teams}
              buildUrl={props.buildUrl}
            />
          </div>
        </div>
      </main>
      <JinqiuFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
    </>
  );
}

function MatchDetailPage(props: TemplateMatchDetailPageProps) {
  const homeTeam = props.match.homeTeam?.name ?? '主队';
  const awayTeam = props.match.awayTeam?.name ?? '客队';
  const signalEntries = buildSignalEntries({
    match: props.match,
    liveProducts: props.liveProducts,
    signalSourceNames: props.signalSourceNames,
    mode: 'live',
  });
  const relatedMatches = props.matches
    .filter((match) => match.id !== props.match.id && match.sport === props.match.sport)
    .slice(0, 8);

  return (
    <>
      <JinqiuHeader
        siteName={props.site.name}
        categories={props.categories}
        categoryArticleCounts={props.categoryArticleCounts}
        leagues={props.leagues}
        teams={props.teams}
        matches={props.matches}
        buildUrl={props.buildUrl}
      />
      <main className="jinqiu-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.breadcrumbJsonLd }} />
        <div className="jinqiu-container">
          <BreadcrumbLine items={props.breadcrumbs.map((item) => ({ name: item.name, href: item.url }))} />
          <div className="jinqiu-layout">
            <article className="jinqiu-panel jinqiu-article jinqiu-live-detail">
              <header className="jinqiu-article-title">
                <h1>{homeTeam} VS {awayTeam}直播</h1>
                <p>
                  <span>{props.match.league?.name ?? sportLabel(props.match.sport)}</span>
                  <time dateTime={props.match.startTime.toISOString()}>{formatDate(props.match.startTime)}</time>
                  <span>{matchStatusLabel(props.match.status)}</span>
                </p>
              </header>

              <div className="jinqiu-scoreboard">
                <div>
                  <LogoBubble src={props.match.homeTeam?.logoUrl} label={homeTeam} />
                  <strong>{homeTeam}</strong>
                </div>
                <b>VS</b>
                <div>
                  <LogoBubble src={props.match.awayTeam?.logoUrl} label={awayTeam} />
                  <strong>{awayTeam}</strong>
                </div>
              </div>

              <SignalSourcePanel
                title="直播信号源"
                entries={signalEntries}
                emptyText="暂无直播信号源，后台配置直播产品或赛事直播地址后这里会自动展示。"
              />

              <div className="jinqiu-article-content">
                <p>
                  {props.site.name}为您整理{homeTeam}对阵{awayTeam}的赛事信息，比赛时间为{formatDate(props.match.startTime)}。
                </p>
              </div>

              {relatedMatches.length ? (
                <section className="jinqiu-related-live" aria-labelledby="jinqiu-related-live-title">
                  <PanelTitle title="相关直播" titleId="jinqiu-related-live-title" />
                  <ul className="jinqiu-mini-match-list">
                    {relatedMatches.map((match) => (
                      <li key={match.id}>
                        <a href={matchDetailHref(match, props.categories, props.buildUrl)}>
                          {match.homeTeam?.name ?? '主队'} <b>VS</b> {match.awayTeam?.name ?? '客队'}
                        </a>
                        <span>{formatClock(match.startTime)} · {match.league?.name ?? sportLabel(match.sport)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </article>
            <JinqiuSidebar
              categories={props.categories}
              latestNews={props.latestNews}
              leagues={props.leagues}
              teams={props.teams}
              buildUrl={props.buildUrl}
            />
          </div>
        </div>
      </main>
      <JinqiuFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
    </>
  );
}

function VideoDetailPage(props: TemplateVideoDetailPageProps) {
  const paragraphs = splitParagraphs(props.article.content);
  const signalEntries = buildSignalEntries({
    article: props.article,
    liveProducts: props.liveProducts,
    signalSourceNames: props.signalSourceNames,
    mode: 'replay',
  });
  const primarySignal = signalEntries[0];

  return (
    <>
      <JinqiuHeader
        siteName={props.site.name}
        categories={props.categories}
        categoryArticleCounts={props.categoryArticleCounts}
        leagues={props.leagues}
        teams={props.teams}
        matches={props.matches}
        buildUrl={props.buildUrl}
      />
      <main className="jinqiu-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.videoObjectJsonLd }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.breadcrumbJsonLd }} />
        <div className="jinqiu-container">
          <BreadcrumbLine items={props.breadcrumbs.map((item) => ({ name: item.name, href: item.url }))} />
          <div className="jinqiu-layout">
            <article className="jinqiu-panel jinqiu-article jinqiu-video-detail">
              <header className="jinqiu-article-title">
                <h1>{props.article.title}</h1>
                <p>
                  <span>{props.article.category?.name ?? '赛事录像'}</span>
                  {props.article.publishedAt ? <time dateTime={props.article.publishedAt.toISOString()}>{formatDate(props.article.publishedAt)}</time> : null}
                  {props.article.sourceName ? <span>{props.article.sourceName}</span> : null}
                </p>
              </header>

              <div className="jinqiu-video-stage">
                {props.article.coverImageUrl ? (
                  <img
                    src={props.article.coverImageUrl}
                    alt={`${props.article.title}录像封面`}
                    width={props.article.coverImageWidth ?? 1200}
                    height={props.article.coverImageHeight ?? 675}
                  />
                ) : null}
                {primarySignal ? (
                  <a href={primarySignal.href} target="_blank" rel="nofollow sponsored noopener noreferrer" className="jinqiu-play-button">
                    播放
                  </a>
                ) : (
                  <span className="jinqiu-play-button jinqiu-play-button-disabled">暂无播放源</span>
                )}
              </div>

              <SignalSourcePanel
                title="录像播放源"
                entries={signalEntries}
                emptyText="暂无录像播放源，后台配置直播产品后这里会自动展示。"
              />

              {props.article.summary ? <p className="jinqiu-article-summary">{props.article.summary}</p> : null}
              {props.article.tags?.length ? (
                <div className="jinqiu-compact-tags" aria-label="录像标签">
                  {uniqueByName(props.article.tags).map((tag) => (
                    <span key={tag.id}>{tag.name}</span>
                  ))}
                </div>
              ) : null}

              <div className="jinqiu-article-content">
                {paragraphs.map((paragraph, index) => (
                  <p key={`${props.article.id}-video-${index}`}>{paragraph}</p>
                ))}
              </div>
            </article>
            <JinqiuSidebar
              categories={props.categories}
              latestNews={props.latestNews}
              leagues={props.leagues}
              teams={props.teams}
              buildUrl={props.buildUrl}
            />
          </div>
        </div>
      </main>
      <JinqiuFooter siteName={props.site.name} categories={props.categories} buildUrl={props.buildUrl} />
    </>
  );
}

function JinqiuHeader(props: {
  siteName: string;
  categories: CategoryRecord[];
  categoryArticleCounts: Record<string, number>;
  leagues: SportLeagueRecord[];
  teams: SportTeamRecord[];
  matches: SportMatchRecord[];
  buildUrl: BuildUrl;
}) {
  const navItems = buildCategoryNavItems(props.categories);

  return (
    <header className="jinqiu-header">
      <div className="jinqiu-container jinqiu-header-top">
        <a href={props.buildUrl('HOME')} className="jinqiu-logo" aria-label={`${props.siteName}首页`}>
          <span>{props.siteName.slice(0, 2)}</span>
          <strong>{props.siteName}</strong>
        </a>
      </div>
      <nav className="jinqiu-nav" aria-label="主导航">
        <div className="jinqiu-container">
          <ul>
            <li>
              <a href={props.buildUrl('HOME')}>首页</a>
            </li>
            {navItems.map(({ category, children }) =>
              children.length ? (
                <NavDropdown
                  href={props.buildUrl('NEWS_CATEGORY', { categorySlug: category.slug })}
                  items={children.map((child) => ({
                    label: publicCategoryLabel(child),
                    href: props.buildUrl('NEWS_CATEGORY', { categorySlug: child.slug }),
                  }))}
                  key={category.id}
                  label={publicCategoryLabel(category)}
                />
              ) : (
                <li key={category.id}>
                  <a href={props.buildUrl('NEWS_CATEGORY', { categorySlug: category.slug })}>{publicCategoryLabel(category)}</a>
                </li>
              ),
            )}
          </ul>
        </div>
      </nav>
    </header>
  );
}

function NavDropdown(props: { label?: string; href?: string; items: Array<{ label: string; href: string }> }) {
  const items = uniqueLinks(props.items);
  if (!props.label || !props.href || !items.length) {
    return null;
  }

  return (
    <li className="jinqiu-dropdown">
      <a href={props.href}>{props.label}</a>
      {items.length ? (
        <div className="jinqiu-dropdown-box">
          {items.map((item, index) => (
            <p key={`${props.label}-${item.href}-${item.label}-${index}`}>
              <a href={item.href}>{item.label}</a>
            </p>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function IntroLinkRail(props: {
  categories: CategoryRecord[];
  leagues: SportLeagueRecord[];
  buildUrl: BuildUrl;
}) {
  const links = introLeagueLinks.map((link) => ({
    label: link.label,
    href: sportCategoryHref(link.sport, props.categories, props.buildUrl),
  }));

  return (
    <div className="jinqiu-intro-links" aria-label="热门入口">
      {links.map((link, index) => (
        <Fragment key={`${link.href}-${link.label}-${index}`}>
          {index > 0 ? <span aria-hidden="true">、</span> : null}
          <a href={link.href}>{link.label}</a>
        </Fragment>
      ))}
    </div>
  );
}

function MatchSchedulePanel(props: {
  matches: SportMatchRecord[];
  categories: CategoryRecord[];
  buildUrl: BuildUrl;
}) {
  const titleDate = props.matches[0]?.startTime ?? new Date();

  return (
    <section className="jinqiu-panel jinqiu-match-panel" aria-labelledby="jinqiu-match-title">
      <PanelTitle title={formatScheduleTitle(titleDate)} titleId="jinqiu-match-title" />
      <ul className="jinqiu-match-list">
        {props.matches.length ? (
          props.matches.slice(0, 18).map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              categories={props.categories}
              buildUrl={props.buildUrl}
            />
          ))
        ) : (
          <li className="jinqiu-empty">暂无赛程数据，发布赛事后这里会自动读取后台赛程。</li>
        )}
      </ul>
    </section>
  );
}

function MatchRow(props: {
  match: SportMatchRecord;
  categories: CategoryRecord[];
  buildUrl: BuildUrl;
}) {
  const homeTeam = props.match.homeTeam?.name ?? '主队';
  const awayTeam = props.match.awayTeam?.name ?? '客队';
  const matchUrl = sportCategoryHref(props.match.sport, props.categories, props.buildUrl);
  const detailUrl = matchDetailHref(props.match, props.categories, props.buildUrl);

  return (
    <li className="jinqiu-match-row">
      <div className="jinqiu-match-meta">
        <LogoBubble src={props.match.league?.logoUrl} label={props.match.league?.name ?? sportLabel(props.match.sport)} />
        <time dateTime={props.match.startTime.toISOString()}>{formatClock(props.match.startTime)}</time>
        <a href={matchUrl}>
          {props.match.league?.name ?? sportLabel(props.match.sport)}
        </a>
      </div>
      <a className="jinqiu-teams" href={detailUrl}>
        <span className="jinqiu-home-team">
          {homeTeam}
          <LogoBubble src={props.match.homeTeam?.logoUrl} label={homeTeam} />
        </span>
        <b>VS</b>
        <span className="jinqiu-away-team">
          <LogoBubble src={props.match.awayTeam?.logoUrl} label={awayTeam} />
          {awayTeam}
        </span>
      </a>
      <div className="jinqiu-watch">
        <span>
          {matchStatusLabel(props.match.status)}
        </span>
      </div>
    </li>
  );
}

function TeamLeagueDirectory(props: {
  categories: CategoryRecord[];
  leagues: SportLeagueRecord[];
  teams: SportTeamRecord[];
  buildUrl: BuildUrl;
}) {
  return (
    <section className="jinqiu-panel jinqiu-directory-panel" aria-labelledby="jinqiu-directory-title">
      <PanelTitle title="赛事球队资料" titleId="jinqiu-directory-title" />
      <div className="jinqiu-directory-grid">
        <DirectoryColumn
          title="足球赛事"
          items={uniqueByName(props.leagues.filter((league) => league.sport === 'FOOTBALL')).slice(0, 12)}
          href={sportCategoryHref('FOOTBALL', props.categories, props.buildUrl)}
        />
        <DirectoryColumn
          title="篮球赛事"
          items={uniqueByName(props.leagues.filter((league) => league.sport === 'BASKETBALL')).slice(0, 12)}
          href={sportCategoryHref('BASKETBALL', props.categories, props.buildUrl)}
        />
        <DirectoryColumn
          title="足球球队"
          items={uniqueByName(props.teams.filter((team) => team.sport === 'FOOTBALL')).slice(0, 16)}
          href={sportCategoryHref('FOOTBALL', props.categories, props.buildUrl)}
        />
        <DirectoryColumn
          title="篮球球队"
          items={uniqueByName(props.teams.filter((team) => team.sport === 'BASKETBALL')).slice(0, 16)}
          href={sportCategoryHref('BASKETBALL', props.categories, props.buildUrl)}
        />
      </div>
    </section>
  );
}

function DirectoryColumn(props: {
  title: string;
  items: Array<SportLeagueRecord | SportTeamRecord>;
  href: string;
}) {
  return (
    <div className="jinqiu-directory-column">
      <h3>{props.title}</h3>
      <div>
        {props.items.map((item) => (
          <a href={props.href} key={`${props.title}-${item.id}`}>
            {item.name}
          </a>
        ))}
      </div>
    </div>
  );
}

function JinqiuSidebar(props: {
  categories: CategoryRecord[];
  latestNews: NewsArticleRecord[];
  leagues: SportLeagueRecord[];
  teams: SportTeamRecord[];
  replayCategory?: CategoryRecord;
  replayArticles?: NewsArticleRecord[];
  buildUrl: BuildUrl;
}) {
  const categories = uniqueByName(props.categories);
  const hotLeagues = uniqueByName(props.leagues.filter((league) => league.isHot)).slice(0, 12);
  const hotTeams = uniqueByName(props.teams.filter((team) => team.isHot)).slice(0, 14);
  const leagues = uniqueByName(props.leagues);

  return (
    <aside className="jinqiu-sidebar" aria-label="侧边栏">
      <SidebarReplayPanel
        categories={props.categories}
        replayCategory={props.replayCategory}
        replayArticles={props.replayArticles ?? []}
        buildUrl={props.buildUrl}
      />
      <TagPanel
        title="热门赛事直播"
        items={(hotLeagues.length ? hotLeagues : leagues.slice(0, 12)).map((league) => ({
          label: `${league.name}直播`,
          href: sportCategoryHref(league.sport, props.categories, props.buildUrl),
        }))}
      />
      <LinkListPanel
        title="最新相关信息"
        articles={props.latestNews.slice(0, 10)}
        buildUrl={props.buildUrl}
        fallbackCategorySlug={props.categories[0]?.slug ?? 'sports-news'}
      />
      <TagPanel
        title="热门标签"
        items={[
          ...categories.map((category) => ({
            label: category.name,
            href: props.buildUrl('NEWS_CATEGORY', { categorySlug: category.slug }),
          })),
          ...hotTeams.map((team) => ({
            label: team.name,
            href: sportCategoryHref(team.sport, props.categories, props.buildUrl),
          })),
        ]}
      />
    </aside>
  );
}

function SignalSourcePanel(props: { title: string; entries: SignalEntry[]; emptyText: string }) {
  const titleId = panelId(props.title);

  return (
    <section className="jinqiu-signal-panel" aria-labelledby={titleId}>
      <h2 id={titleId}>{props.title}：</h2>
      {props.entries.length ? (
        <div className="jinqiu-signal-grid">
          {props.entries.map((entry, index) => (
            <a href={entry.href} target="_blank" rel="nofollow sponsored noopener noreferrer" key={`${entry.label}-${entry.href}-${index}`}>
              <span>{entry.label}</span>
              <b>播放</b>
            </a>
          ))}
        </div>
      ) : (
        <div className="jinqiu-empty">{props.emptyText}</div>
      )}
    </section>
  );
}

function TagPanel(props: { title: string; items: Array<{ label: string; href: string }> }) {
  const items = uniqueLinks(props.items);
  if (!items.length) {
    return null;
  }

  const titleId = panelId(props.title);

  return (
    <section className="jinqiu-panel" aria-labelledby={titleId}>
      <PanelTitle title={props.title} titleId={titleId} />
      <div className="jinqiu-tag-cloud">
        {items.map((item, index) => (
          <a href={item.href} key={`${props.title}-${item.href}-${item.label}-${index}`}>
            {item.label}
          </a>
        ))}
      </div>
    </section>
  );
}

function LinkListPanel(props: {
  title: string;
  articles: NewsArticleRecord[];
  buildUrl: BuildUrl;
  fallbackCategorySlug: string;
}) {
  if (!props.articles.length) {
    return null;
  }

  const titleId = panelId(props.title);

  return (
    <section className="jinqiu-panel" aria-labelledby={titleId}>
      <PanelTitle title={props.title} titleId={titleId} />
      <NewsTextList
        articles={props.articles}
        buildUrl={props.buildUrl}
        fallbackCategorySlug={props.fallbackCategorySlug}
      />
    </section>
  );
}

function FeaturedNewsCard(props: { article: NewsArticleRecord; href: string }) {
  return (
    <article className="jinqiu-featured-news">
      {props.article.coverImageUrl ? (
        <a href={props.href} className="jinqiu-featured-thumb" aria-label={props.article.title}>
          <img
            src={props.article.coverImageUrl}
            alt={`${props.article.title}封面图`}
            width={props.article.coverImageWidth ?? 640}
            height={props.article.coverImageHeight ?? 360}
            loading="eager"
          />
        </a>
      ) : null}
      <div>
        <p>{props.article.category?.name ?? '体育新闻'}</p>
        <h2>
          <a href={props.href}>{props.article.title}</a>
        </h2>
        {props.article.summary ? <span>{props.article.summary}</span> : null}
      </div>
    </article>
  );
}

function NewsTextList(props: {
  articles: NewsArticleRecord[];
  buildUrl: BuildUrl;
  fallbackCategorySlug: string;
  showSummary?: boolean;
}) {
  if (!props.articles.length) {
    return <div className="jinqiu-empty">暂无内容</div>;
  }

  return (
    <ul className={props.showSummary ? 'jinqiu-news-list jinqiu-news-list-rich' : 'jinqiu-news-list'}>
      {props.articles.map((article) => {
        const href = props.buildUrl('NEWS_DETAIL', {
          categorySlug: article.category?.slug ?? props.fallbackCategorySlug,
          newsSlug: article.slug,
        });

        return (
          <li key={article.id}>
            <a href={href}>{article.title}</a>
            {props.showSummary && article.summary ? <p>{article.summary}</p> : null}
            <span>{article.publishedAt ? formatDate(article.publishedAt) : article.category?.name ?? '体育新闻'}</span>
          </li>
        );
      })}
    </ul>
  );
}

function PanelTitle(props: { title: string; titleId?: string; moreHref?: string; as?: 'h1' | 'span' }) {
  const TitleTag = props.as === 'h1' ? 'h1' : 'span';

  return (
    <div className="jinqiu-panel-title">
      {props.moreHref ? <a className="jinqiu-more" href={props.moreHref}>更多</a> : null}
      <TitleTag id={props.titleId}>{props.title}</TitleTag>
    </div>
  );
}

function BreadcrumbLine(props: { items: Array<{ name: string; href: string }> }) {
  return (
    <nav className="jinqiu-breadcrumb" aria-label="面包屑">
      {props.items.map((item, index) => (
        <span key={`${item.href}-${index}`}>
          {index > 0 ? <b aria-hidden="true">&gt;</b> : null}
          <a href={item.href}>{item.name}</a>
        </span>
      ))}
    </nav>
  );
}

function Pagination(props: { page: number; totalPages: number; baseHref: string }) {
  return (
    <nav className="jinqiu-pagination" aria-label="分页">
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

function JinqiuFooter(props: { siteName: string; categories: CategoryRecord[]; buildUrl: BuildUrl }) {
  return (
    <footer className="jinqiu-footer">
      <div className="jinqiu-container">
        <nav aria-label="页脚导航">
          <a href={props.buildUrl('HOME')}>首页</a>
          {uniqueByName(props.categories).map((category) => (
            <a href={props.buildUrl('NEWS_CATEGORY', { categorySlug: category.slug })} key={category.id}>
              {category.name}
            </a>
          ))}
          <a href="/sitemap.xml">XML地图</a>
        </nav>
        <p>Copyright © {new Date().getFullYear()} {props.siteName} 版权所有</p>
        <p>{props.siteName}为体育资讯和直播导航站，赛事、新闻、栏目链接均由后台数据生成。</p>
      </div>
    </footer>
  );
}

function LogoBubble(props: { src?: string | null; label: string }) {
  if (props.src) {
    return <img className="jinqiu-logo-bubble" src={props.src} alt={`${props.label}logo`} width={28} height={28} loading="lazy" />;
  }

  return <span className="jinqiu-logo-bubble" aria-hidden="true">{props.label.slice(0, 1)}</span>;
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
          const href = product ? resolveProductSignalHref(product, input) : undefined;
          return href ? { label: source.name, href } : undefined;
        })
        .filter((entry): entry is SignalEntry => Boolean(entry))
    : products.map((product) => ({
        label: product.name,
        href: resolveProductSignalHref(product, input),
      }));

  return uniqueLinks(entries);
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

function formatScheduleTitle(date: Date): string {
  const dayFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const weekFormatter = new Intl.DateTimeFormat('zh-CN', {
    weekday: 'short',
  });
  return `${dayFormatter.format(date).replace(/\//g, '-')} ${weekFormatter.format(date)}`;
}

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function matchStatusLabel(status: SportMatchRecord['status']): string {
  return status === 'SCHEDULED' ? '即将开始' : '高清主播（进行中）';
}

function sportLabel(sport: SportMatchRecord['sport']): string {
  return sport === 'BASKETBALL' ? '篮球赛事' : '足球赛事';
}

function isVideoCategory(category: CategoryRecord): boolean {
  return /录像|回放|视频|replay|video/i.test(`${category.name} ${category.slug}`);
}

function findReplayCategory(categories: CategoryRecord[]): CategoryRecord | undefined {
  return categories.find(isVideoCategory);
}

function uniqueByName<T extends { name: string; sport?: SportMatchRecord['sport'] }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.sport ?? ''}:${normalizeDisplayText(item.name)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueLinks<T extends { label: string; href: string }>(items: T[]): T[] {
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

function publicCategoryLabel(category: CategoryRecord): string {
  const value = `${category.name} ${category.slug}`;
  if (/足球直播|足球赛程|football-live|football-schedule/i.test(value)) {
    return '足球直播';
  }
  if (/篮球直播|CBA\s*赛程|basketball-live|basketball-schedule|cba-schedule/i.test(value)) {
    return '篮球直播';
  }
  return category.name;
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

function sportFromCategory(category: CategoryRecord): SportMatchRecord['sport'] | undefined {
  if (/篮球|basketball|nba|cba/i.test(`${category.name} ${category.slug}`)) {
    return 'BASKETBALL';
  }
  if (/足球|football|soccer/i.test(`${category.name} ${category.slug}`)) {
    return 'FOOTBALL';
  }
  return undefined;
}

function sportCategoryHref(
  sport: SportMatchRecord['sport'],
  categories: CategoryRecord[],
  buildUrl: BuildUrl,
): string {
  const category = findSportCategory(categories, sport);
  return category ? buildUrl('NEWS_CATEGORY', { categorySlug: category.slug }) : buildUrl('HOME');
}

function matchDetailHref(match: SportMatchRecord, categories: CategoryRecord[], buildUrl: BuildUrl): string {
  const category = findSportCategory(categories, match.sport);
  return buildUrl('MATCH_DETAIL', {
    categorySlug: category?.slug ?? (match.sport === 'BASKETBALL' ? 'basketball-live' : 'football-live'),
    matchId: match.id,
    slug: match.slug ?? match.id,
  });
}

function selectReplayArticles(
  articles: NewsArticleRecord[],
  category: CategoryRecord | undefined,
): NewsArticleRecord[] {
  const categoryArticles = category ? selectCategoryBlockArticles(articles, category) : [];
  if (categoryArticles.length) {
    return categoryArticles;
  }

  const replayArticles = articles.filter(isReplayArticle);
  return replayArticles.length ? replayArticles : articles;
}

function selectCategoryBlockArticles(articles: NewsArticleRecord[], category: CategoryRecord): NewsArticleRecord[] {
  if (isVideoCategory(category)) {
    const replayArticles = articles.filter(isReplayArticle);
    return replayArticles.length ? replayArticles : articles;
  }

  if (isBroadNewsCategory(category)) {
    const newsArticles = articles.filter((article) => !isReplayArticle(article));
    return newsArticles.length ? newsArticles : articles;
  }

  const topicArticles = articles.filter((article) => articleMatchesCategoryTopic(article, category));
  if (topicArticles.length) {
    return topicArticles;
  }

  const newsArticles = articles.filter((article) => !isReplayArticle(article));
  return newsArticles.length ? newsArticles : articles;
}

function isBroadNewsCategory(category: CategoryRecord): boolean {
  const value = `${category.name} ${category.slug}`;
  return !isVideoCategory(category) && /体育新闻|sports-news|(^|\s)(新闻|资讯)($|\s)|(^|[-_])news($|[-_])/i.test(value);
}

function isReplayArticle(article: NewsArticleRecord): boolean {
  return Boolean(article.category && isVideoCategory(article.category));
}

function articleMatchesCategoryTopic(article: NewsArticleRecord, category: CategoryRecord): boolean {
  const text = articleTopicText(article);
  return categoryTopicTokens(category).some((token) => text.includes(token));
}

function categoryTopicTokens(category: CategoryRecord): string[] {
  const raw = `${category.name} ${category.slug}`
    .replace(/[-_/]+/g, ' ')
    .split(/\s+/)
    .map(normalizeDisplayText)
    .filter((token) => token.length >= 2);
  const value = `${category.name} ${category.slug}`;
  const aliases = [
    /足球|football|soccer/i.test(value) ? ['足球', 'football', 'soccer'] : [],
    /篮球|basketball|nba|cba/i.test(value) ? ['篮球', 'basketball', 'nba', 'cba'] : [],
    /直播|live|zhibo/i.test(value) ? ['直播', 'live', 'zhibo'] : [],
    /赛程|schedule/i.test(value) ? ['赛程', 'schedule'] : [],
    isVideoCategory(category) ? ['录像', '回放', '视频', 'replay', 'video'] : [],
  ].flat();
  return [...new Set([...raw, ...aliases].map(normalizeDisplayText))];
}

function articleTopicText(article: NewsArticleRecord): string {
  return normalizeDisplayText(
    [
      article.title,
      article.summary,
      article.category?.name,
      article.category?.slug,
      ...(article.tags ?? []).map((tag) => tag.name),
      ...(article.tags ?? []).map((tag) => tag.slug),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function splitParagraphs(content: string): string[] {
  return content.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'panel';
}

function panelId(value: string): string {
  const ascii = slugify(value);
  if (ascii !== 'panel') {
    return `jinqiu-${ascii}`;
  }

  const encoded = Array.from(value)
    .map((char) => char.charCodeAt(0).toString(36))
    .join('-');
  return `jinqiu-panel-${encoded}`;
}

export const jinqiuLiveTemplate: TemplatePackage = {
  manifest: {
    key: 'jinqiu-live',
    name: '劲球直播风格 Jinqiu Live',
    version: '0.1.0',
    supportedPageTypes: ['home', 'newsList', 'matchList', 'matchDetail', 'videoDetail', 'newsDetail'],
    slots: ['header', 'matchSchedule', 'signalSources', 'sidebar', 'newsList', 'footer'],
  },
  HomePage,
  NewsListPage,
  MatchListPage,
  NewsDetailPage,
  MatchDetailPage,
  VideoDetailPage,
};
