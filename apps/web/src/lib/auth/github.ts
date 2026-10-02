import "server-only";

import { githubCallbackUrl, githubClientId, githubClientSecret } from "./env";
import type { SessionUser } from "./session";

export function authorizeUrl(state: string, requestUrl?: string): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", githubClientId());
  url.searchParams.set("redirect_uri", githubCallbackUrl(requestUrl));
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  return url.toString();
}

interface GithubToken {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GithubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
}

export async function exchangeCode(code: string, requestUrl?: string): Promise<SessionUser> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: githubClientId(),
      client_secret: githubClientSecret(),
      code,
      redirect_uri: githubCallbackUrl(requestUrl),
    }),
  });
  if (!tokenRes.ok) throw new Error("GitHub token exchange failed");
  const token = (await tokenRes.json()) as GithubToken;
  if (!token.access_token) {
    throw new Error(token.error_description ?? token.error ?? "GitHub did not return a token");
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token.access_token}`,
      "User-Agent": "metastack",
    },
  });
  if (!userRes.ok) throw new Error("GitHub user lookup failed");
  const user = (await userRes.json()) as GithubUser;
  return {
    id: String(user.id),
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
  };
}
