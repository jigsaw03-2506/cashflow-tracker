import { NextResponse } from "next/server";
import {
  databaseError,
  getRouteClient,
  ownerColumnError,
  sameOriginError,
  setTransactionOwner,
  validationError,
} from "@/lib/api";
import { depositSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const originError = sameOriginError(request);
  if (originError) return originError;
  const body: unknown = await request.json().catch(() => null);
  const parsed = depositSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { client, response } = await getRouteClient();
  if (response) return response;
  const ownerError = await ownerColumnError(client, parsed.data.for_person_id);
  if (ownerError) return ownerError;
  const isIncome = parsed.data.kind === "income";

  let accountId = parsed.data.account_id;
  let createdAccountId: string | null = null;
  if (parsed.data.new_account) {
    const { data: account, error } = await client
      .from("accounts")
      .insert({
        name: parsed.data.new_account.name,
        kind: parsed.data.new_account.kind,
        initial_balance: 0,
        currency: "MMK",
      })
      .select("id")
      .single();
    if (error) return databaseError(error);
    accountId = account.id as string;
    createdAccountId = accountId;
  }

  const { data, error } = await client.rpc("record_transaction", {
    p_request_key: parsed.data.request_key,
    p_kind: parsed.data.kind,
    p_account_id: accountId,
    p_amount: parsed.data.amount,
    p_occurred_at: parsed.data.occurred_at,
    p_category: isIncome ? "Money added" : "Money taken out",
    p_description: isIncome ? "Money added to account" : "Money taken out of account",
    p_notes: parsed.data.notes || null,
    p_to_account_id: null,
    p_person_id: null,
    p_expected_date: null,
  });
  if (error) {
    // Don't leave an empty account behind when the deposit itself failed.
    if (createdAccountId) await client.from("accounts").delete().eq("id", createdAccountId);
    return databaseError(error);
  }
  if (parsed.data.for_person_id) {
    const ownerSaveError = await setTransactionOwner(client, data as string, parsed.data.for_person_id);
    if (ownerSaveError) return ownerSaveError;
  }
  return NextResponse.json({ id: data, account_id: accountId }, { status: 201 });
}
