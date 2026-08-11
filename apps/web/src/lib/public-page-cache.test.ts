import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('public page cache policy', () => {
  it('keeps host-based public pages out of the Next route cache', () => {
    const source = readFileSync(resolve(process.cwd(), 'apps/web/app/[[...slug]]/page.tsx'), 'utf8');

    expect(source).toContain("export const dynamic = 'force-dynamic'");
    expect(source).toContain('export const revalidate = 0');
    expect(source).toContain("export const fetchCache = 'force-no-store'");
    expect(source).toContain('noStore();');
    expect(source).not.toContain('export const revalidate = 30');
  });

  it('prevents shared proxy caches from reusing one host page for another host', () => {
    const source = readFileSync(resolve(process.cwd(), 'apps/web/next.config.mjs'), 'utf8');
    const middlewareSource = readFileSync(resolve(process.cwd(), 'apps/web/middleware.ts'), 'utf8');

    expect(source).toContain("value: 'private, no-cache, no-store, max-age=0, must-revalidate'");
    expect(source).toContain('Host, X-Forwarded-Host');
    expect(source).not.toContain('s-maxage=30');
    expect(middlewareSource).toContain("response.headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate')");
    expect(middlewareSource).toContain("'Host', 'X-Forwarded-Host'");
  });
});
