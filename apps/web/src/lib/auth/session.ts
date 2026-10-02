import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

import { authSecret } from "./env";

export const SESSION_COOKIE = "ms_session";
export const STATE_COOKIE = "ms_oauth_state";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

function secretKey() {
  return new TextEncoder().encode(authSecret());
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function readSession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.login !== "string") return null;
    return {
      id: payload.sub,
      login: payload.login,
      name: typeof payload.name === "string" ? payload.name : null,
      avatarUrl: typeof payload.avatarUrl === "string" ? payload.avatarUrl : null,
    };
  } catch {
    return null;
  }
}

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSession(token);
}

export async function setSessionCookie(user: SessionUser) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(user), {
    ...cookieBase(),
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...cookieBase(), maxAge: 0 });
}

export async function setOAuthState(state: string) {
  const store = await cookies();
  store.set(STATE_COOKIE, state, { ...cookieBase(), maxAge: 10 * 60 });
}

export async function takeOAuthState(): Promise<string | undefined> {
  const store = await cookies();
  const value = store.get(STATE_COOKIE)?.value;
  store.set(STATE_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  return value;
}
