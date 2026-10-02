/** The only account that is an admin. This is not configurable. */
export const ADMIN_EMAIL = "masaok@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}
