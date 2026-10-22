import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, databaseError, getRouteClient, sameOriginError, validationError } from "@/lib/api";
import { MAX_AMOUNT } from "@/lib/validation";

const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  kind: z.enum([
    "kbz_bank",
    "cb_bank",
    "aya_bank",
    "wave_money",
    "kbzpay",
    "physical_cash",
    "custom",
  ]).optional(),
  initial_balance: z.number().finite().min(0).max(MAX_AMOUNT).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  is_active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const originError = sameOriginError(request);
  if (originError) return originError;
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return apiError("Invalid account id.", 400);
  const body: unknown = await request.json().catch(() => null);
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  if (Object.keys(parsed.data).length === 0) return apiError("No changes were provided.", 400);

  const { client, response } = await getRouteClient();
  if (response) return response;
  const { data, error } = await client
    .from("accounts")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return databaseError(error);
  if (!data) return apiError("Account was not found.", 404);
  return NextResponse.json({ account: data });
}
