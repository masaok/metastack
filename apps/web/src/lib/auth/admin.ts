/** The only account that is an admin. This is not configurable. */
export const ADMIN_EMAIL = "masaok@gmail.com";
/** GitHub login for that same account. Sessions from before email was stored still carry it. */
export const ADMIN_LOGIN = "masaok";

export function isAdminEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAdminAccount(user: { email?: string | null; login?: string | null }): boolean {
  return isAdminEmail(user.email) || user.login?.trim().toLowerCase() === ADMIN_LOGIN;
}
