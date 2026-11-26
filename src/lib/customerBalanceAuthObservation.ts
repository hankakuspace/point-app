// Temporary compatible observation: never changes authorization or response data.
export async function observeCustomerBalanceIdentity(
  authorization: string | null, customerId: string, exists: boolean, ownerShop: unknown,
) {
  let result = "skipped";
  let reason = "not_bearer";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (/^Bearer [^\s]+$/i.test(authorization || "")) {
      const validation = import("./customerAccountToken").then(m => m.inspectCustomerAccountToken(authorization));
      const inspection = await Promise.race([
        validation,
        new Promise<"timeout">(resolve => { timer = setTimeout(() => resolve("timeout"), 800); }),
      ]);
      if (inspection === "timeout") { result = "timeout"; reason = "timeout"; }
      else {
        const { identity } = inspection;
        reason = inspection.reason;
        if (!identity) result = "token_invalid";
        else if (identity.customerId !== customerId) result = "customer_mismatch";
        else if (!exists) result = "customer_missing";
        else if (ownerShop !== identity.shop) result = "shop_mismatch";
        else result = "signed_identity_match";
      }
    }
  } catch {
    result = "verification_error";
    reason = "verification_error";
  } finally {
    if (timer) clearTimeout(timer);
  }
  try {
    console.info(JSON.stringify({ event: "pointman_customer_balance_verification", result, reason, count: 1 }));
  } catch {
    // Logging must not affect the existing balance response.
  }
}
