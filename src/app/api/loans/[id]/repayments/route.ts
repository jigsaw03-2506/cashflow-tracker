import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  databaseError,
  getRouteClient,
  ownerColumnError,
  sameOriginError,
  setTransactionOwner,
  validationError,
} from "@/lib/api";
import { repaymentSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const originError = sameOriginError(request);
  if (originError) return originError;
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return apiError("Invalid loan id.", 400);
  const body: unknown = await request.json().catch(() => null);
  const parsed = repaymentSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { client, response } = await getRouteClient();
  if (response) return response;
  const ownerError = await ownerColumnError(client, parsed.data.for_person_id);
  if (ownerError) return ownerError;
  const { data, error } = await client.rpc("record_loan_repayment", {
    p_request_key: parsed.data.request_key,
    p_loan_id: id,
    p_account_id: parsed.data.account_id,
    p_amount: parsed.data.amount,
    p_paid_at: parsed.data.paid_at,
    p_notes: parsed.data.notes || null,
  });
  if (error) return databaseError(error);
  if (parsed.data.for_person_id) {
    const ownerSaveError = await setTransactionOwner(client, data as string, parsed.data.for_person_id);
    if (ownerSaveError) return ownerSaveError;
  }
  return NextResponse.json({ id: data }, { status: 201 });
}
