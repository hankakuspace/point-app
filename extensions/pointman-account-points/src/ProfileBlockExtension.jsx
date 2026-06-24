// extensions/pointman-account-points/src/ProfileBlockExtension.jsx
import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

export default async () => {
  render(<ProfileBlockExtension />, document.body);
};

function getNumericCustomerId(value) {
  return String(value || "").split("/").pop() || "";
}

function ProfileBlockExtension() {
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchPoints() {
      try {
        const customerResponse = await fetch(
          "shopify:customer-account/api/2025-10/graphql.json",
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
          setErrorMessage("");
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setPoints(0);
          setErrorMessage("ポイント情報を取得できませんでした。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPoints();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <s-section heading="ポイントMAN">
      <s-stack direction="block" gap="base" paddingBlockStart="base">
        <s-grid gridTemplateColumns="1fr" gap="large">
          <s-stack direction="block" gap="small">
            <s-text color="subdued">保有ポイント</s-text>
            <s-text type="strong">
              {loading ? "確認中..." : `${points ?? 0} pt`}
            </s-text>
          </s-stack>
        </s-grid>

        {errorMessage ? (
          <s-text color="subdued">{errorMessage}</s-text>
        ) : null}
      </s-stack>
    </s-section>
  );
}
