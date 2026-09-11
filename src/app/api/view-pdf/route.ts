import { NextRequest, NextResponse } from 'next/server';

// Presentation PDFs live on Cloudflare R2 (R2_PUBLIC_URL) — some older
// records may still point at the legacy Supabase bucket. Only these hosts
// may be proxied; anything else is rejected to avoid turning this route
// into an open fetch proxy.
const ALLOWED_PREFIXES = [process.env.R2_PUBLIC_URL, 'https://ezogujldmpxycodwboos.supabase.co'].filter(
  (v): v is string => Boolean(v)
);

// The Android app's rep pages run from a locally-bundled, offline-capable
// shell (a different origin than this live site — see
// scripts/build-capacitor.js) and call this route with an absolute URL,
// so the browser enforces CORS on the response. Without these headers the
// fetch was silently failing/being served something other than the PDF
// bytes (Invalid PDF structure downstream in pdf.js) instead of a clear
// network error. Wide open ('*') is fine here: this route only ever
// forwards a presentation PDF that's already publicly readable at its
// direct R2/Supabase URL — it adds no new exposure.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url');

  if (!target) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400, headers: CORS_HEADERS });
  }

  if (!ALLOWED_PREFIXES.some((prefix) => target.startsWith(prefix))) {
    return NextResponse.json({ error: 'URL is not from an allowed source' }, { status: 403, headers: CORS_HEADERS });
  }

  try {
    const upstream = await fetch(target, { cache: 'no-store' });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Failed to fetch PDF (status ${upstream.status})` },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, max-age=3600',
        ...CORS_HEADERS,
      },
    });
  } catch (error) {
    console.error('[view-pdf] proxy fetch failed:', error);
    return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 502, headers: CORS_HEADERS });
  }
}
