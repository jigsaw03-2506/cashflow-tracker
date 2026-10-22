import { NextResponse } from "next/server";
import {
  databaseError,
  getRouteClient,
  ownerColumnError,
  sameOriginError,
  setTransactionOwner,
  validationError,
} from "@/lib/api";
import { loanSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const originError = sameOriginError(request);
  if (originError) return originError;
  const body: unknown = await request.json().catch(() => null);
  const parsed = loanSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { client, response } = await getRouteClient();
  if (response) return response;
  const ownerError = await ownerColumnError(client, parsed.data.for_person_id);
  if (ownerError) return ownerError;
  const tagOwner = async (transactionId: string) =>
    parsed.data.for_person_id
      ? setTransactionOwner(client, transactionId, parsed.data.for_person_id)
      : null;
  if (parsed.data.is_opening_balance) {
    const openingArgs = {
      p_request_key: parsed.data.request_key,
      p_direction: parsed.data.direction,
      p_person_id: parsed.data.person_id,
      p_amount: parsed.data.amount,
      p_occurred_at: parsed.data.occurred_at,
      p_expected_date: parsed.data.expected_date || null,
      p_notes: parsed.data.notes || null,
    };
    let { data, error } = await client.rpc("record_opening_loan", {
      ...openingArgs,
      p_money_type: parsed.data.money_type ?? null,
    });
    // Before migration 20261021000300 runs, the function has no money-type parameter.
    if (error?.code === "PGRST202") {
      ({ data, error } = await client.rpc("record_opening_loan", openingArgs));
    }
    if (error) return databaseError(error);
    const ownerSaveError = await tagOwner(data as string);
    if (ownerSaveError) return ownerSaveError;
    return NextResponse.json({ id: data }, { status: 201 });
  }
  if (!parsed.data.account_id) {
    return NextResponse.json({ error: "An account is required for a new loan." }, { status: 400 });
  }
  const { data, error } = await client.rpc("record_transaction", {
    p_request_key: parsed.data.request_key,
    p_kind: parsed.data.direction === "lent" ? "lending" : "borrowing",
    p_account_id: parsed.data.account_id,
    p_amount: parsed.data.amount,
    p_occurred_at: parsed.data.occurred_at,
    p_category: parsed.data.direction === "lent" ? "Money lent" : "Money borrowed",
    p_description:
      parsed.data.direction === "lent" ? "Loan given" : "Loan received",
    p_notes: parsed.data.notes || null,
    p_to_account_id: null,
    p_person_id: parsed.data.person_id,
    p_expected_date: parsed.data.expected_date || null,
  });
  if (error) return databaseError(error);
  const ownerSaveError = await tagOwner(data as string);
  if (ownerSaveError) return ownerSaveError;
  return NextResponse.json({ id: data }, { status: 201 });
}
