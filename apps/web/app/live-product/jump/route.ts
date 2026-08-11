import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return scriptResponse("document.body && (document.body.textContent = '播放源地址已更新');", 404);
}

function scriptResponse(source: string, status = 200): NextResponse {
  return new NextResponse(source, {
    status,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
