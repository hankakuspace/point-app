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

// Fixed-schema client diagnostics only. Never log claims, identifiers or errors.
function recordDiagnostic(event, value = 1) {
  const allowed = new Set([
    "customer_lookup_failed", "token_success", "token_failed", "sub_present",
    "sub_missing", "sub_unreadable", "api_sent", "api_response", "api_network_failed",
    "api_payload_failed", "api_http_failed", "balance_ready", "balance_failed",
  ]);
  if (!allowed.has(event)) return;
  const safeValue = event === "api_response"
    ? (Number.isInteger(value) && value >= 100 && value <= 599 ? value : 0)
    : 1;
  try {
    console.info(JSON.stringify({ event: "pointman_balance_diagnostic", kind: event, value: safeValue }));
  } catch {
    // Diagnostics must never interrupt points display.
  }
}

function recordSubPresence(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || typeof atob !== "function") throw new Error();
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")));
    recordDiagnostic(typeof claims.sub === "string" && claims.sub.length > 0 ? "sub_present" : "sub_missing");
  } catch {
    recordDiagnostic("sub_unreadable");
  }
  // Presence is diagnostic only; signature and identity are verified by the C API.
}

function Extension() {
  const [displayText, setDisplayText] = useState("ポイント情報を確認しています。");

  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setDisplayText("ポイント情報を確認しています。");

    async function fetchPoints() {
      let phase = "customer";
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

        if (cancelled) return;

        if (!customerId) {
          throw new Error("customerId not found");
        }

        phase = "token";
        const token = await shopify.sessionToken.get();
        if (cancelled) return;
        if (!token) throw new Error("Authentication unavailable");
        recordDiagnostic("token_success");
        recordSubPresence(token);
        phase = "network";
        recordDiagnostic("api_sent");

        const pointsResponse = await fetch(
          `https://point-app-gamma.vercel.app/api/customer-account/points?customerId=${encodeURIComponent(customerId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (cancelled) return;
        recordDiagnostic("api_response", pointsResponse.status);
        phase = pointsResponse.ok ? "payload" : "http";
        const pointsJson = await pointsResponse.json();

        if (!pointsResponse.ok || !pointsJson.success) {
          throw new Error(pointsJson.error || "points fetch failed");
        }

        if (!cancelled) {
          setDisplayText(`保有ポイント：${pointsJson.points || 0} pt`);
          setStatus("success");
          recordDiagnostic("balance_ready");
        }
      } catch {
        if (!cancelled) {
          const failure = { customer: "customer_lookup_failed", token: "token_failed", network: "api_network_failed", payload: "api_payload_failed", http: "api_http_failed" };
          recordDiagnostic(failure[phase]);
          recordDiagnostic("balance_failed");
          setStatus("error");
          setDisplayText(
            "ポイント情報を取得できませんでした。"
          );
        }
      }
    }

    fetchPoints();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    if (status !== "error") return;
    setDisplayText("ポイント情報を確認しています。");
    setStatus("loading");
    setAttempt((current) => current + 1);
  }

  return (
    <s-banner>
      <s-text>
        {displayText}
      </s-text>
      {status === "error" && (
        <s-button onClick={retry}>再試行</s-button>
      )}
    </s-banner>
  );
}
