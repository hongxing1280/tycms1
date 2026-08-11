import { headers } from 'next/headers';

export function getRequestHost(): string {
  const requestHeaders = headers();
  return firstHeaderValue(requestHeaders.get('x-forwarded-host')) ?? requestHeaders.get('host') ?? 'www.frontline-sports.com';
}

function firstHeaderValue(value: string | null): string | undefined {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .find(Boolean);
}
