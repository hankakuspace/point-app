// extensions/pointman-account-history/src/ProfileHistoryBlockExtension.jsx
import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default async () => {
  render(<ProfileHistoryBlockExtension />, document.body);
};

function ProfileHistoryBlockExtension() {
  return (
    <s-section heading="ポイント履歴">
      <s-stack direction="block" gap="base" paddingBlockStart="base">
        <s-text color="subdued">
          ポイント履歴は、現在準備中です。
        </s-text>
      </s-stack>
    </s-section>
  );
}
