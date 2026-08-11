import type { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { getRequestHost } from '../../src/lib/headers';
import { buildTemplateUrl, resolvePublicRoute, resolveSiteTemplatePackage } from '../../src/lib/public-route';

type PageProps = {
  params: {
    slug?: string[];
  };
  searchParams?: {
    page?: string;
  };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export function generateMetadata(props: PageProps): Metadata {
  noStore();
  const route = resolvePublicRouteForRequest(
    getRequestHost(),
    serializeSlug(props.params.slug),
    parsePage(props.searchParams?.page),
  );

  if (!route) {
    return {
      title: '页面不存在',
      robots: { index: false, follow: false },
    };
  }

  const baiduVerifyCode = normalizeBaiduVerifyCode(route.site.baiduVerifyCode);

  return {
    title: route.tdk.title,
    description: route.tdk.description,
    keywords: route.tdk.keywords,
    alternates: {
      canonical: route.canonical,
    },
    robots: route.tdk.robots === 'noindex,follow' ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: route.tdk.title,
      description: route.tdk.description,
      url: route.canonical,
      siteName: route.site.name,
      type: route.kind === 'news' ? 'article' : 'website',
    },
    other: baiduVerifyCode ? { 'baidu-site-verification': baiduVerifyCode } : undefined,
  };
}

export default function PublicPage(props: PageProps) {
  noStore();
  const route = resolvePublicRouteForRequest(
    getRequestHost(),
    serializeSlug(props.params.slug),
    parsePage(props.searchParams?.page),
  );

  if (!route) {
    notFound();
  }

  const template = resolveSiteTemplatePackage(route.site);
  if (!template) {
    notFound();
  }

  const HomePage = template.HomePage;
  const NewsListPage = template.NewsListPage;
  const MatchListPage = template.MatchListPage;
  const NewsDetailPage = template.NewsDetailPage;
  const MatchDetailPage = template.MatchDetailPage;
  const VideoDetailPage = template.VideoDetailPage;
  const buildUrl = buildTemplateUrl(route.site);

  if (route.kind === 'signal-jump') {
    return withSiteAnalytics(<SignalJumpPage token={route.token} />, route.site.analyticsCode);
  }

  const shared = {
    site: route.site,
    categories: route.categories,
    categoryArticleCounts: route.categoryArticleCounts,
    topNews: route.topNews,
    latestNews: route.latestNews,
    matches: route.matches,
    leagues: route.leagues,
    teams: route.teams,
    promotions: route.promotions,
    liveProducts: route.liveProducts,
    signalDomains: route.signalDomains,
    signalSourceNames: route.signalSourceNames,
    buildUrl,
  };

  if (route.kind === 'home') {
    return withSiteAnalytics(<HomePage {...shared} />, route.site.analyticsCode);
  }

  if (route.kind === 'category') {
    const CategoryPage = (route.pageType === 'MATCH_CATEGORY' || route.pageType === 'LEAGUE') && MatchListPage ? MatchListPage : NewsListPage;
    return withSiteAnalytics(
      <CategoryPage
        {...shared}
        category={route.category}
        league={route.league}
        pageType={route.pageType}
        page={route.page}
        totalPages={route.totalPages}
      />,
      route.site.analyticsCode,
    );
  }

  if (route.kind === 'match') {
    if (MatchDetailPage) {
      return withSiteAnalytics(
        <MatchDetailPage
          {...shared}
          match={route.match}
          breadcrumbs={route.breadcrumbs}
          breadcrumbJsonLd={route.breadcrumbJsonLd}
        />,
        route.site.analyticsCode,
      );
    }

    notFound();
  }

  if (route.pageType === 'VIDEO_DETAIL' && VideoDetailPage) {
    return withSiteAnalytics(
      <VideoDetailPage
        {...shared}
        article={route.article}
        breadcrumbs={route.breadcrumbs}
        breadcrumbJsonLd={route.breadcrumbJsonLd}
        videoObjectJsonLd={route.videoObjectJsonLd ?? route.newsArticleJsonLd}
      />,
      route.site.analyticsCode,
    );
  }

  return withSiteAnalytics(
    <NewsDetailPage
      {...shared}
      article={route.article}
      pageType={route.pageType}
      breadcrumbs={route.breadcrumbs}
      newsArticleJsonLd={route.newsArticleJsonLd}
      breadcrumbJsonLd={route.breadcrumbJsonLd}
    />,
    route.site.analyticsCode,
  );
}

function withSiteAnalytics(content: ReactNode, analyticsCode: string | null | undefined) {
  return (
    <>
      {content}
      <SiteAnalytics code={analyticsCode} />
    </>
  );
}

function SiteAnalytics(props: { code?: string | null }) {
  const code = props.code?.trim();
  if (!code) return null;

  return <div hidden data-site-analytics dangerouslySetInnerHTML={{ __html: code }} />;
}

function parsePage(value: string | undefined): number {
  const parsed = Number(value ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function normalizeBaiduVerifyCode(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const contentMatch = /content\s*=\s*["']([^"']+)["']/i.exec(trimmed);
  return (contentMatch?.[1] ?? trimmed).trim() || undefined;
}

function SignalJumpPage(props: { token: string }) {
  return (
    <main className="live-frame-empty" style={{ minHeight: '100vh', background: '#101318' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '28px' }}>正在连接播放源</h1>
        <p>正在为你打开播放页面，请稍候。</p>
      </div>
      <Script src={`/video/${encodeURIComponent(props.token)}/jump.js`} strategy="afterInteractive" />
    </main>
  );
}

function resolvePublicRouteForRequest(host: string, slugKey: string, page: number) {
  noStore();
  return resolvePublicRoute(host, slugKey ? slugKey.split('/') : [], page);
}

function serializeSlug(slug: string[] | undefined): string {
  return slug?.join('/') ?? '';
}
