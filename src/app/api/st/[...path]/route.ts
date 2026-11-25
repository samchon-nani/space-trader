import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { isAllowedGamePath, isSameSite } from '@/lib/gameRules';
import { callApi, COOKIE, cookieOptions, fail } from '@/lib/spacetraders.server';

type Context = { params: Promise<{ path: string[] }> };

// Passes game requests to SpaceTraders and adds the agent token on the server.
async function relay(request: NextRequest, { params }: Context) {
  const { path } = await params;
  if (!isAllowedGamePath(request.method, path)) return fail('That game route is not available.', 404);
  if (request.method !== 'GET' && !isSameSite(request.headers.get('origin'), request.headers.get('host'))) return fail('Request blocked.', 403);
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return fail('Please sign in first.', 401);

  const body = request.method === 'GET' ? undefined : await request.text();
  if (body && body.length > 10000) return fail('Request is too large.', 413);
  try {
    const result = await callApi(`/${path.join('/')}${request.nextUrl.search}`, token, { method: request.method, body: body || undefined });
    if (result.status === 401) {
      const response = fail('Your session ended. Tokens reset every week, so start again with a new agent.', 401);
      response.cookies.set(COOKIE, '', { ...cookieOptions, maxAge: 0 });
      return response;
    }
    const text = await result.text();
    return new NextResponse(text || null, { status: result.status, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return fail('Could not reach SpaceTraders. Please try again.', 502);
  }
}

export { relay as GET, relay as POST, relay as PATCH };
