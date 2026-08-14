/**
 * Auth UI flags (Azerbaijani app).
 * After the first admin account exists, set PUBLIC_SIGNUP_ENABLED to false
 * so /qeydiyyat is closed — invite links (?token=) still work.
 */
export const PUBLIC_SIGNUP_ENABLED = false

/**
 * When true, every user must enroll TOTP MFA and verify a one-time code on each login.
 * Requires MFA (TOTP) enabled in Supabase Dashboard → Authentication → Multi-Factor.
 * Set false to allow password-only login until a user chooses to enroll.
 */
export const MFA_REQUIRED = false

export const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Menecer',
}
