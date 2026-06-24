// extensions/pointman-account-points/src/OrderStatusBlock.jsx
import '@shopify/ui-extensions/preact';
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

export default async () => {
  render(<Extension />, document.body);
};

function getNumericCustomerId(value) {
  return String(value || "").split("/").pop() || "";
}

function Extension() {
  const [displayText, setDisplayText] = useState("ポイント情報を確認しています。");

  useEffect(() => {
    let cancelled = false;

    async function fetchPoints() {
      try {
        const customerResponse = await fetch(
          "shopify:customer-account/api/2026-04/graphql.json",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: `query {
                customer {
                  id
                }
              }`,
            }),
          }
        );

        const customerJson = await customerResponse.json();

        if (!customerResponse.ok || customerJson.errors) {
          throw new Error(
            `Customer Account API error: ${JSON.stringify(customerJson.errors || customerJson)}`
          );
        }

        const customerGid = customerJson?.data?.customer?.id || "";
        const customerId = getNumericCustomerId(customerGid);

        if (!customerId) {
          throw new Error("customerId not found");
        }

        const pointsResponse = await fetch(
          `https://point-app-gamma.vercel.app/api/customer-account/points?customerId=${encodeURIComponent(customerId)}`,
          {
            method: "GET",
          }
        );

        const pointsJson = await pointsResponse.json();

        if (!pointsResponse.ok || !pointsJson.success) {
          throw new Error(pointsJson.error || "points fetch failed");
        }

        if (!cancelled) {
          setDisplayText(`保有ポイント：${pointsJson.points || 0} pt`);
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setDisplayText(
            `ポイント情報を取得できませんでした。${error?.message ? ` (${error.message})` : ""}`
          );
        }
      }
    }

    fetchPoints();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <s-banner>
      <s-text>
        {displayText}
      </s-text>
    </s-banner>
  );
}
