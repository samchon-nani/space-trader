import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { cleanCallsign, FACTIONS, isSameSite } from '@/lib/gameRules';
import { callApi, COOKIE, cookieOptions, fail, matchesInvite } from '@/lib/spacetraders.server';

// GET: is there a saved session, and is agent creation turned on?
export async function GET() {
  const jar = await cookies();
  return NextResponse.json({
    active: Boolean(jar.get(COOKIE)),
    canCreate: Boolean(process.env.SPACETRADERS_ACCOUNT_TOKEN && process.env.INVITE_CODE),
  });
}

// POST: sign in with an agent token, or create an agent with the site's account.
export async function POST(request: NextRequest) {
  if (!isSameSite(request.headers.get('origin'), request.headers.get('host'))) return fail('Request blocked.', 403);
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== 'object') return fail('Invalid request.', 400);

  let agentToken = '';
  let agent: unknown = null;
  try {
    if (input.mode === 'create') {
      const accountToken = process.env.SPACETRADERS_ACCOUNT_TOKEN;
      const invite = process.env.INVITE_CODE;
      if (!accountToken || !invite) return fail('Creating agents is not turned on. Try the simulator.', 503);
      if (!matchesInvite(input.invite, invite)) return fail('That invite code is not correct.', 403);
      const symbol = cleanCallsign(input.symbol);
      if (!symbol) return fail('Callsign must be 3-14 letters, numbers, dashes or underscores.', 400);
      if (!FACTIONS.includes(input.faction)) return fail('Choose a faction from the list.', 400);
      const result = await callApi('/register', accountToken, { method: 'POST', body: JSON.stringify({ symbol, faction: input.faction }) });
      const json = await result.json().catch(() => null);
      if (!result.ok || !json?.data?.token) return fail(json?.error?.message ?? 'Could not create the agent.', result.ok ? 502 : result.status);
      agentToken = json.data.token;
      agent = json.data.agent;
    } else {
      agentToken = typeof input.token === 'string' ? input.token.trim() : '';
      if (!agentToken || /\s/.test(agentToken) || agentToken.length > 3000) return fail('Enter a valid agent token.', 400);
      const result = await callApi('/my/agent', agentToken);
      const json = await result.json().catch(() => null);
      if (result.status === 401) return fail('That token did not work. Tokens stop working after the weekly reset.', 401);
      if (!result.ok) return fail(json?.error?.message ?? 'Could not sign in.', result.status);
      agent = json?.data;
    }
  } catch {
    return fail('Could not reach SpaceTraders. Please try again.', 502);
  }

  const response = NextResponse.json({ data: { agent } }); // the token is never sent to the page
  response.cookies.set(COOKIE, agentToken, cookieOptions);
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isSameSite(request.headers.get('origin'), request.headers.get('host'))) return fail('Request blocked.', 403);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, '', { ...cookieOptions, maxAge: 0 });
  return response;
}
