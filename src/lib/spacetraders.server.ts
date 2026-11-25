import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

export const API = 'https://api.spacetraders.io/v2';
export const COOKIE = 'st_agent';

// The weekly reset ends every session, so nothing needs to last longer than that.
export const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api',
  maxAge: 7 * 24 * 60 * 60,
};

export function fail(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export function matchesInvite(given: unknown, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(String(given ?? '')), digest(expected));
}

export async function callApi(path: string, token: string, init: RequestInit = {}) {
  return fetch(API + path, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}
