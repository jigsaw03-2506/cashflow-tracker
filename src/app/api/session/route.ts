import { NextResponse } from "next/server";
import { apiError, sameOriginError, validationError } from "@/lib/api";
import {
  createSessionToken,
  getAuthConfig,
  passwordMatches,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { signInSchema } from "@/lib/validation";

const WRONG_PASSWORD_DELAY_MS = 1000;

export async function POST(request: Request) {
  const originError = sameOriginError(request);
  if (originError) return originError;

  const config = getAuthConfig();
  if (!config) {
    console.error(
      "Sign-in is not set up: APP_PASSWORD (12+ characters) and SESSION_SECRET (32+ characters) are required.",
    );
    return apiError("Sign-in is not set up. Follow the setup instructions.", 503);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = signInSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  if (!passwordMatches(config, parsed.data.password)) {
    // Slows down password guessing.
    await new Promise((resolve) => setTimeout(resolve, WRONG_PASSWORD_DELAY_MS));
    return apiError("Wrong password.", 401);
  }

  const response = NextResponse.json({ signedIn: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(config), sessionCookieOptions());
  return response;
}

export async function DELETE(request: Request) {
  const originError = sameOriginError(request);
  if (originError) return originError;

  const response = NextResponse.json({ signedIn: false });
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
