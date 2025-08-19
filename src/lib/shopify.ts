export async function registerOrderPaidWebhook(shop: string, accessToken: string) {
  const endpoint = `https://${shop}/admin/api/2025-01/webhooks.json`;

  const body = {
    webhook: {
      topic: "orders/paid",
      address: `${process.env.SHOPIFY_APP_URL}/api/webhooks/orders/paid`,
      format: "json",
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  console.log("📦 Webhook registration result:", JSON.stringify(result, null, 2));
  return result;
}
