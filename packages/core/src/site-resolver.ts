import { domainMatchesHost, normalizeHost } from './host';
import type { SiteRecord } from './types';

export type SiteResolution =
  | {
      ok: true;
      site: SiteRecord;
      host: string;
    }
  | {
      ok: false;
      host: string;
      reason: 'SITE_NOT_FOUND' | 'SITE_DELETED' | 'SITE_DISABLED' | 'SITE_MAINTENANCE';
      site?: SiteRecord;
    };

export function resolveSiteByHost(hostHeader: string | null | undefined, sites: SiteRecord[]): SiteResolution {
  const host = normalizeHost(hostHeader);
  const exactMatches = sites.filter((candidate) =>
    siteDomains(candidate).some((domain) => normalizeHost(domain) === host),
  );
  const fuzzyMatches = sites.filter(
    (candidate) =>
      !exactMatches.includes(candidate) &&
      siteDomains(candidate).some((domain) => domainMatchesHost(domain, host)),
  );
  const site =
    firstAvailableSite(exactMatches) ??
    firstAvailableSite(fuzzyMatches) ??
    exactMatches[0] ??
    fuzzyMatches[0];

  if (!site) {
    return { ok: false, host, reason: 'SITE_NOT_FOUND' };
  }

  if (site.deletedAt) {
    return { ok: false, host, reason: 'SITE_DELETED', site };
  }

  if (site.status === 'DISABLED') {
    return { ok: false, host, reason: 'SITE_DISABLED', site };
  }

  if (site.status === 'MAINTENANCE') {
    return { ok: false, host, reason: 'SITE_MAINTENANCE', site };
  }

  return { ok: true, site, host };
}

function firstAvailableSite(sites: SiteRecord[]): SiteRecord | undefined {
  return sites.find((site) => !site.deletedAt);
}

function siteDomains(site: SiteRecord): string[] {
  return [
    site.primaryDomain,
    ...site.domains.filter((domain) => domain.status === 'ACTIVE').map((domain) => domain.domain),
  ];
}
