import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ZodError } from "zod";
import { isSignedIn, SESSION_COOKIE } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function sameOriginError(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return apiError("A same-origin request is required.", 403);
  try {
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProtocol || new URL(request.url).protocol.slice(0, -1);
    const requestOrigin = new URL(`${protocol}://${host}`).origin;
    if (new URL(origin).origin !== requestOrigin) {
      return apiError("A same-origin request is required.", 403);
    }
  } catch {
    return apiError("A valid same-origin request is required.", 403);
  }
  return null;
}

export function validationError(error: ZodError) {
  return NextResponse.json(
    {
      error: "The submitted data is invalid.",
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 },
  );
}

export function databaseError(error: { message: string; code?: string }) {
  console.error("CashFlow database operation failed:", error.code, error.message);
  // Messages raised by our own SQL functions are written for the person using the app.
  if (error.code === "P0001") return apiError(error.message, 400);
  if (error.code === "PGRST202") {
    return apiError("Database update needed: run the latest SQL file in Supabase.", 503);
  }
  return apiError("The database operation could not be completed.", 500);
}

const updateNeeded = () =>
  apiError("Database update needed: run the latest SQL file in Supabase.", 503);

/** True once migration 20261021000500 (records kept for another person) has run. */
export async function ownerColumnExists(client: SupabaseClient) {
  const { error } = await client.from("transactions").select("for_person_id").limit(1);
  return !error;
}

/**
 * Call before saving: refuses a record tagged for another person when the database
 * cannot store the tag yet, so nothing is saved half-way.
 */
export async function ownerColumnError(client: SupabaseClient, forPersonId?: string | null) {
  if (!forPersonId || (await ownerColumnExists(client))) return null;
  return updateNeeded();
}

export async function setTransactionOwner(
  client: SupabaseClient,
  transactionId: string,
  forPersonId: string | null,
) {
  const { error } = await client
    .from("transactions")
    .update({ for_person_id: forPersonId })
    .eq("id", transactionId);
  return error ? databaseError(error) : null;
}

export function configurationError(error: unknown) {
  if (
    error instanceof Error &&
    error.message.startsWith("Supabase server configuration is missing.")
  ) {
    console.error(error.message);
    return apiError("Database setup is incomplete. Follow the setup instructions.", 503);
  }
  throw error;
}

/** Refuses requests without a signed-in session before handing out the database client. */
export async function getRouteClient() {
  const cookieStore = await cookies();
  if (!isSignedIn(cookieStore.get(SESSION_COOKIE)?.value)) {
    return { client: null, response: apiError("Sign in to continue.", 401) };
  }
  try {
    return { client: getAdminClient(), response: null };
  } catch (error) {
    return { client: null, response: configurationError(error) };
  }
}
