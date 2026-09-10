import { NextRequest, NextResponse } from 'next/server';

// Presentation PDFs live on Cloudflare R2 (R2_PUBLIC_URL) — some older
// records may still point at the legacy Supabase bucket. Only these hosts
// may be proxied; anything else is rejected to avoid turning this route
// into an open fetch proxy.
const ALLOWED_PREFIXES = [process.env.R2_PUBLIC_URL, 'https://ezogujldmpxycodwboos.supabase.co'].filter(
  (v): v is string => Boolean(v)
);

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url');

  if (!target) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  if (!ALLOWED_PREFIXES.some((prefix) => target.startsWith(prefix))) {
    return NextResponse.json({ error: 'URL is not from an allowed source' }, { status: 403 });
  }

  try {
    const upstream = await fetch(target, { cache: 'no-store' });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Failed to fetch PDF (status ${upstream.status})` },
        { status: 502 }
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[view-pdf] proxy fetch failed:', error);
    return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 502 });
  }
}
