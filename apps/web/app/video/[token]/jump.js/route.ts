import { NextResponse, type NextRequest } from 'next/server';
import { resolveSignalJumpTarget } from '../../../../src/lib/signal-jump';

export const dynamic = 'force-dynamic';

type JumpRouteContext = {
  params: {
    token: string;
  };
};

export function GET(request: NextRequest, context: JumpRouteContext) {
  void request;
  const target = resolveSignalJumpTarget(context.params.token);
  if (!target) {
    return scriptResponse("document.body && (document.body.textContent = '播放源地址无效');");
  }

  return scriptResponse(`window.location.replace(${JSON.stringify(target)});`);
}

function scriptResponse(source: string): NextResponse {
  return new NextResponse(source, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
