import type {
  BreadcrumbItem,
  CategoryRecord,
  LiveProductRecord,
  NewsArticleRecord,
  PageType,
  PromotionLinkRecord,
  SignalDomainRecord,
  SignalSourceNameRecord,
  SiteRecord,
  SportLeagueRecord,
  SportMatchRecord,
  SportTeamRecord,
} from '@sports/core';

export type TemplatePageProps = {
  site: SiteRecord;
  categories: CategoryRecord[];
  categoryArticleCounts: Record<string, number>;
  topNews: NewsArticleRecord[];
  latestNews: NewsArticleRecord[];
  matches: SportMatchRecord[];
  leagues: SportLeagueRecord[];
  teams: SportTeamRecord[];
  promotions: PromotionLinkRecord[];
  liveProducts: LiveProductRecord[];
  signalDomains: SignalDomainRecord[];
  signalSourceNames: SignalSourceNameRecord[];
  buildUrl: (pageType: PageType, data?: Record<string, string>) => string;
};

export type TemplateCategoryPageProps = TemplatePageProps & {
  category: CategoryRecord;
  league?: SportLeagueRecord;
  pageType?: PageType;
  page: number;
  totalPages: number;
};

export type TemplateNewsDetailPageProps = TemplatePageProps & {
  article: NewsArticleRecord;
  pageType?: PageType;
  breadcrumbs: BreadcrumbItem[];
  newsArticleJsonLd: string;
  breadcrumbJsonLd: string;
};

export type TemplateMatchDetailPageProps = TemplatePageProps & {
  match: SportMatchRecord;
  breadcrumbs: BreadcrumbItem[];
  breadcrumbJsonLd: string;
};

export type TemplateVideoDetailPageProps = TemplatePageProps & {
  article: NewsArticleRecord;
  breadcrumbs: BreadcrumbItem[];
  breadcrumbJsonLd: string;
  videoObjectJsonLd: string;
};

export type TemplatePackage = {
  manifest: {
    key: string;
    name: string;
    version: string;
    supportedPageTypes: string[];
    slots: string[];
  };
  HomePage: (props: TemplatePageProps) => JSX.Element;
  NewsListPage: (props: TemplateCategoryPageProps) => JSX.Element;
  MatchListPage?: (props: TemplateCategoryPageProps) => JSX.Element;
  NewsDetailPage: (props: TemplateNewsDetailPageProps) => JSX.Element;
  MatchDetailPage?: (props: TemplateMatchDetailPageProps) => JSX.Element;
  VideoDetailPage?: (props: TemplateVideoDetailPageProps) => JSX.Element;
};
