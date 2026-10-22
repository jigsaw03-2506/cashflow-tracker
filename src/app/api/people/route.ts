import { NextResponse } from "next/server";
import { databaseError, getRouteClient, sameOriginError, validationError } from "@/lib/api";
import { personSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const originError = sameOriginError(request);
  if (originError) return originError;
  const body: unknown = await request.json().catch(() => null);
  const parsed = personSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { client, response } = await getRouteClient();
  if (response) return response;
  const { data, error } = await client
    .from("people")
    .insert({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
    })
    .select("*")
    .single();
  if (error) return databaseError(error);
  return NextResponse.json({ person: data }, { status: 201 });
}
