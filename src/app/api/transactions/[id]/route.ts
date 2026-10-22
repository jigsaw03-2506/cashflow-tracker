import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  databaseError,
  getRouteClient,
  ownerColumnError,
  ownerColumnExists,
  sameOriginError,
  setTransactionOwner,
  validationError,
} from "@/lib/api";
import { historyEditSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

async function transactionId(context: RouteContext) {
  const { id } = await context.params;
  return z.string().uuid().safeParse(id).success ? id : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const originError = sameOriginError(request);
  if (originError) return originError;
  const id = await transactionId(context);
  if (!id) return apiError("Invalid record id.", 400);
  const body: unknown = await request.json().catch(() => null);
  const parsed = historyEditSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { client, response } = await getRouteClient();
  if (response) return response;
  const ownerError = await ownerColumnError(client, parsed.data.for_person_id);
  if (ownerError) return ownerError;
  const { error } = await client.rpc("edit_history_entry", {
    p_transaction_id: id,
    p_amount: parsed.data.amount,
    p_occurred_at: parsed.data.occurred_at,
    p_account_id: parsed.data.account_id ?? null,
    p_notes: parsed.data.notes || null,
    p_expected_date: parsed.data.expected_date ?? null,
    p_money_type: parsed.data.money_type ?? null,
  });
  if (error) return databaseError(error);
  // Clearing the owner is only possible (and only needed) once the column exists.
  if (parsed.data.for_person_id !== undefined && (await ownerColumnExists(client))) {
    const ownerSaveError = await setTransactionOwner(client, id, parsed.data.for_person_id ?? null);
    if (ownerSaveError) return ownerSaveError;
  }
  return NextResponse.json({ id });
}

export async function DELETE(request: Request, context: RouteContext) {
  const originError = sameOriginError(request);
  if (originError) return originError;
  const id = await transactionId(context);
  if (!id) return apiError("Invalid record id.", 400);

  const { client, response } = await getRouteClient();
  if (response) return response;
  const { error } = await client.rpc("delete_history_entry", { p_transaction_id: id });
  if (error) return databaseError(error);
  return NextResponse.json({ id });
}
