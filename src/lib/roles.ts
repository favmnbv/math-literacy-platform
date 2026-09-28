// ADMIN remains the curator role for compatibility with existing accounts.
export function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}
export function isSuperAdmin(role: string | undefined) {
  return role === "SUPER_ADMIN";
}
