import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Single-password sign-in. The session cookie holds an expiry time signed with
 * HMAC-SHA256; the signing key mixes in the password, so changing APP_PASSWORD or
 * SESSION_SECRET signs every browser out.
 */
export const SESSION_COOKIE = "cashflow_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const MIN_PASSWORD_LENGTH = 12;
const MIN_SECRET_LENGTH = 32;

export type AuthConfig = { password: string; secret: string };

/** Null when sign-in is not set up, or the password or secret is too short to be safe. */
export function getAuthConfig(
  env: Record<string, string | undefined> = process.env,
): AuthConfig | null {
  const password = env.APP_PASSWORD ?? "";
  const secret = env.SESSION_SECRET ?? "";
  if (password.length < MIN_PASSWORD_LENGTH || secret.length < MIN_SECRET_LENGTH) return null;
  return { password, secret };
}

function sign(key: string, message: string) {
  return createHmac("sha256", key).update(message).digest();
}

function sessionSignature(config: AuthConfig, expiresAt: number) {
  return sign(`${config.secret}:${config.password}`, `session:${expiresAt}`);
}

export function passwordMatches(config: AuthConfig, attempt: string) {
  // Comparing fixed-length digests keeps the check constant-time whatever the input length.
  return timingSafeEqual(
    sign(config.secret, `password:${attempt}`),
    sign(config.secret, `password:${config.password}`),
  );
}

export function createSessionToken(config: AuthConfig, now = Date.now()) {
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  return `${expiresAt}.${sessionSignature(config, expiresAt).toString("base64url")}`;
}

export function verifySessionToken(config: AuthConfig, token: string | undefined, now = Date.now()) {
  const [expiresText, signatureText, ...rest] = token?.split(".") ?? [];
  if (!expiresText || !signatureText || rest.length > 0) return false;
  const expiresAt = Number(expiresText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
  const expected = sessionSignature(config, expiresAt);
  const actual = Buffer.from(signatureText, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isSignedIn(token: string | undefined) {
  const config = getAuthConfig();
  return config !== null && verifySessionToken(config, token);
}

/** Only same-site paths, so the login page cannot be used to redirect elsewhere. */
export function safeRedirectPath(path: string | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  return path;
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
