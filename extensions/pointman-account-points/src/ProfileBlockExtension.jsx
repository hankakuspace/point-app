// extensions/pointman-account-points/src/ProfileBlockExtension.jsx
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
  const [points, setPoints] = useState(null);
  const [message, setMessage] = useState("ポイント情報を確認しています。");

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
          setPoints(pointsJson.points || 0);
          setMessage("");
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setPoints(0);
          setMessage("ポイント情報を取得できませんでした。");
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
        {message || `保有ポイント：${points ?? 0} pt`}
      </s-text>
    </s-banner>
  );
}
