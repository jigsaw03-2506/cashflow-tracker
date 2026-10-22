import { NextResponse } from "next/server";
import { databaseError, getRouteClient, sameOriginError, validationError } from "@/lib/api";
import { accountSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const originError = sameOriginError(request);
  if (originError) return originError;
  const body: unknown = await request.json().catch(() => null);
  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { client, response } = await getRouteClient();
  if (response) return response;
  const { data, error } = await client
    .from("accounts")
    .insert({
      ...parsed.data,
      notes: parsed.data.notes || null,
      currency: parsed.data.currency.toUpperCase(),
    })
    .select("*")
    .single();
  if (error) return databaseError(error);
  return NextResponse.json({ account: data }, { status: 201 });
}
