import { describe, expect, it, vi } from 'vitest';

const headerValues = new Map<string, string>();

vi.mock('next/headers', () => ({
  headers: () => ({
    get: (name: string) => headerValues.get(name.toLowerCase()) ?? null,
  }),
}));

describe('getRequestHost', () => {
  it('prefers the first forwarded host before the internal reverse proxy host', async () => {
    headerValues.clear();
    headerValues.set('x-forwarded-host', 'site-a.example.com, internal.proxy');
    headerValues.set('host', '127.0.0.1:3000');

    const { getRequestHost } = await import('./headers');

    expect(getRequestHost()).toBe('site-a.example.com');
  });

  it('falls back to the host header when forwarded host is absent', async () => {
    headerValues.clear();
    headerValues.set('host', 'site-b.example.com');

    const { getRequestHost } = await import('./headers');

    expect(getRequestHost()).toBe('site-b.example.com');
  });
});
