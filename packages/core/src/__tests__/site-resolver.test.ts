import { describe, expect, it } from 'vitest';
import { resolveSiteByHost } from '../site-resolver';
import type { SiteRecord } from '../types';

describe('resolveSiteByHost', () => {
  it('prefers a live site over a soft-deleted site with the same domain', () => {
    const deleted = siteRecord('site-old', '127.0.0.1:3000', {
      deletedAt: new Date('2026-05-30T00:00:00Z'),
    });
    const active = siteRecord('site-new', '127.0.0.1:3000');

    const resolution = resolveSiteByHost('127.0.0.1:3000', [deleted, active]);

    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.site.id).toBe('site-new');
    }
  });

  it('still reports a deleted site when there is no available replacement', () => {
    const deleted = siteRecord('site-old', 'example.com', {
      deletedAt: new Date('2026-05-30T00:00:00Z'),
    });

    const resolution = resolveSiteByHost('example.com', [deleted]);

    expect(resolution).toMatchObject({
      ok: false,
      reason: 'SITE_DELETED',
      site: { id: 'site-old' },
    });
  });
});

function siteRecord(id: string, primaryDomain: string, overrides: Partial<SiteRecord> = {}): SiteRecord {
  return {
    id,
    groupId: null,
    name: id,
    primaryDomain,
    primaryProtocol: 'http',
    status: 'ACTIVE',
    templateId: null,
    template: null,
    urlConfigId: null,
    tdkConfigId: null,
    newsUpdateCount: 0,
    showSignalSources: false,
    seoTitle: id,
    seoKeywords: id,
    seoDescription: id,
    seoIndexStatus: 'INDEX',
    domains: [
      {
        id: `${id}-domain`,
        siteId: id,
        domain: primaryDomain,
        isPrimary: true,
        status: 'ACTIVE',
      },
    ],
    createdAt: new Date('2026-05-29T00:00:00Z'),
    updatedAt: new Date('2026-05-29T00:00:00Z'),
    ...overrides,
  };
}
