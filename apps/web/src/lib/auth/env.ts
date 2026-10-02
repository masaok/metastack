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

export function siteUrl(requestUrl?: string): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (requestUrl) {
    const u = new URL(requestUrl);
    return `${u.protocol}//${u.host}`;
  }
  return "https://www.metastack.app";
}

export function githubCallbackUrl(requestUrl?: string): string {
  return `${siteUrl(requestUrl)}/api/auth/callback/github`;
}
