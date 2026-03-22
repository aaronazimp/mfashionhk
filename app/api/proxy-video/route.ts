import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const range = request.headers.get('range') || undefined;

    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    if (range) fetchHeaders['Range'] = range;

    const res = await fetch(videoUrl, { headers: fetchHeaders });

    if (!res.ok && res.status !== 206) {
      console.error(`Proxy fetch failed: ${res.status} ${res.statusText} for ${videoUrl}`);
      return new NextResponse(`Failed to fetch video: ${res.statusText}`, { status: res.status });
    }

    // Mirror upstream headers but ensure CORS is allowed
    const headers = new Headers(res.headers as HeadersInit);
    headers.set('Access-Control-Allow-Origin', '*');
    // allow range requests from the browser
    if (!headers.get('Accept-Ranges')) headers.set('Accept-Ranges', 'bytes');

    // Stream the response body directly to avoid buffering large videos
    const body = res.body;

    return new NextResponse(body, {
      status: res.status,
      headers,
    });
  } catch (error) {
    console.error('Proxy video error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
