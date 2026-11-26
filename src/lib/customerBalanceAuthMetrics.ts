// Presence counters only: never include token, customer, shop, URL or request data.
export function recordCustomerBalanceAuth(authorization: string | null) {
  const counts = { missing: 0, bearer: 0, other: 0 };
  if (!authorization || !authorization.trim()) counts.missing = 1;
  else if (/^Bearer [^\s]+$/i.test(authorization)) counts.bearer = 1;
  else counts.other = 1;

  try {
    console.info(JSON.stringify({ event: "pointman_customer_balance_auth", ...counts }));
  } catch {
    // Observability failure must never interrupt balance display.
  }
}
