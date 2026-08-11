export const dynamic = 'force-static';

export function GET() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    '<rect width="64" height="64" rx="12" fill="#101611"/>',
    '<circle cx="32" cy="32" r="21" fill="none" stroke="#e9f36a" stroke-width="5"/>',
    '<path d="M17 32h30M32 11v42M20 20c8 5 16 5 24 0M20 44c8-5 16-5 24 0" stroke="#e9f36a" stroke-width="4" fill="none" stroke-linecap="round"/>',
    '</svg>',
  ].join('');

  return new Response(svg, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'image/svg+xml; charset=utf-8',
    },
  });
}
