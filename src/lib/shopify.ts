export async function registerOrderPaidWebhook(shop: string, accessToken: string) {
  const endpoint = `https://${shop}/admin/api/2025-01/graphql.json`;

  const query = `
    mutation {
      webhookSubscriptionCreate(
        topic: ORDERS_PAID,
        webhookSubscription: {
          callbackUrl: "${process.env.SHOPIFY_APP_URL}/api/webhooks/orders/paid"
          format: JSON
        }
      ) {
        userErrors { field message }
        webhookSubscription { id }
      }
    }
  `;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();
  console.log("📦 Webhook registration result:", JSON.stringify(result, null, 2));
  return result;
}
