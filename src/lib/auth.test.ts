import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  getAuthConfig,
  passwordMatches,
  safeRedirectPath,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from "@/lib/auth";

const config = { password: "correct horse battery", secret: "s".repeat(32) };

describe("sign-in configuration", () => {
  it("requires a long enough password and secret", () => {
    expect(getAuthConfig({ APP_PASSWORD: config.password, SESSION_SECRET: config.secret })).toEqual(config);
    expect(getAuthConfig({ APP_PASSWORD: "short", SESSION_SECRET: config.secret })).toBeNull();
    expect(getAuthConfig({ APP_PASSWORD: config.password, SESSION_SECRET: "short" })).toBeNull();
    expect(getAuthConfig({})).toBeNull();
  });
});

describe("password check", () => {
  it("accepts only the exact password", () => {
    expect(passwordMatches(config, "correct horse battery")).toBe(true);
    expect(passwordMatches(config, "correct horse battery ")).toBe(false);
    expect(passwordMatches(config, "")).toBe(false);
  });
});

describe("session tokens", () => {
  const now = 1_800_000_000_000;

  it("verifies a fresh token", () => {
    expect(verifySessionToken(config, createSessionToken(config, now), now)).toBe(true);
  });

  it("rejects expired, tampered, or missing tokens", () => {
    const token = createSessionToken(config, now);
    const later = now + SESSION_MAX_AGE_SECONDS * 1000 + 1;
    const [expires, signature] = token.split(".");

    expect(verifySessionToken(config, token, later)).toBe(false);
    expect(verifySessionToken(config, `${Number(expires) + 1000}.${signature}`, now)).toBe(false);
    expect(verifySessionToken(config, `${expires}.${signature}x`, now)).toBe(false);
    expect(verifySessionToken(config, undefined, now)).toBe(false);
    expect(verifySessionToken(config, "garbage", now)).toBe(false);
  });

  it("signs out every session when the password or secret changes", () => {
    const token = createSessionToken(config, now);
    expect(verifySessionToken({ ...config, password: "a different password" }, token, now)).toBe(false);
    expect(verifySessionToken({ ...config, secret: "t".repeat(32) }, token, now)).toBe(false);
  });
});

describe("redirect after sign-in", () => {
  it("keeps same-site paths and drops anything else", () => {
    expect(safeRedirectPath("/people/abc?x=1")).toBe("/people/abc?x=1");
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
  });
});
