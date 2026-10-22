import { NextResponse, type NextRequest } from "next/server";
import { isSignedIn, SESSION_COOKIE } from "@/lib/auth";

const publicPaths = new Set(["/login", "/api/session"]);

/** Every page and API route needs a signed-in session; API routes check it again themselves. */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = isSignedIn(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login" && signedIn) return NextResponse.redirect(new URL("/", request.url));
  if (signedIn || publicPaths.has(pathname)) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg$).*)"],
};
