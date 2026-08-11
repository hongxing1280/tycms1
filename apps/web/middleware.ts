import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  if (!isPublicPagePath(pathname)) {
    return response;
  }

  response.headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Vary', mergeVary(response.headers.get('Vary')));
  response.headers.set('X-Sports-Host-Cache', 'no-store');

  return response;
}

export const config = {
  matcher: ['/((?!api|admin|_next/static|_next/image|favicon.ico).*)'],
};

function isPublicPagePath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.endsWith('.html') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.startsWith('/video/')
  );
}

function mergeVary(current: string | null): string {
  const values = new Set(
    (current ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

  ['Host', 'X-Forwarded-Host', 'RSC', 'Next-Router-State-Tree', 'Next-Router-Prefetch', 'Accept-Encoding'].forEach((item) =>
    values.add(item),
  );

  return [...values].join(', ');
}
