import "server-only";

/** Read a required server secret. Never log the value. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function githubClientId(): string {
  return requireEnv("GITHUB_CLIENT_ID");
}

export function githubClientSecret(): string {
  return requireEnv("GITHUB_CLIENT_SECRET");
}

export function authSecret(): string {
  return requireEnv("AUTH_SECRET");
}

/** Neon URL. Accepts either name so local files and Vercel stay interchangeable. */
export function databaseUrl(): string {
  const url = process.env.NEON_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("NEON_URL or DATABASE_URL is not set");
  return url;
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.NEON_URL ?? process.env.DATABASE_URL);
}

/**
 * Public origin. In development the incoming request wins, and `127.0.0.1`
 * is rewritten to `localhost`, so the GitHub callback stays
 * `http://localhost:<port>/api/auth/callback/github` — the URL registered on
 * the dev OAuth app. `NEXT_PUBLIC_SITE_URL` still applies in production.
 */
export function siteUrl(requestUrl?: string): string {
  if (process.env.NODE_ENV !== "production" && requestUrl) return requestOrigin(requestUrl);
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (requestUrl) return requestOrigin(requestUrl);
  return "https://www.metastack.app";
}

function requestOrigin(requestUrl: string): string {
  const u = new URL(requestUrl);
  if (u.hostname === "127.0.0.1") u.hostname = "localhost";
  return u.origin;
}

export function githubCallbackUrl(requestUrl?: string): string {
  return `${siteUrl(requestUrl)}/api/auth/callback/github`;
}
