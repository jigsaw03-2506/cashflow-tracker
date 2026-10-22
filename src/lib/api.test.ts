import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn() }));

import { sameOriginError } from "@/lib/api";

describe("same-origin request validation", () => {
  it("accepts a browser origin matching the Host header", () => {
    const request = new Request("http://localhost:3000/api/people", {
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
      },
    });

    expect(sameOriginError(request)).toBeNull();
  });

  it("uses the forwarded protocol for requests behind TLS termination", () => {
    const request = new Request("http://localhost:3000/api/people", {
      headers: {
        host: "cashflow.example",
        origin: "https://cashflow.example",
        "x-forwarded-proto": "https",
      },
    });

    expect(sameOriginError(request)).toBeNull();
  });

  it("rejects a request from a different origin", async () => {
    const request = new Request("http://localhost:3000/api/people", {
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://attacker.example",
      },
    });

    const response = sameOriginError(request);
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: "A same-origin request is required.",
    });
  });
});
