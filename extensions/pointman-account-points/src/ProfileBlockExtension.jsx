// extensions/pointman-account-points/src/ProfileBlockExtension.jsx
import "@shopify/ui-extensions/preact";

import { render } from "preact";

export default async () => {
  render(<BlockExtension />, document.body);
};

function BlockExtension() {
  return (
    <s-section>
      <s-stack
        direction="inline"
        justifyContent="space-between"
        alignItems="center"
      >
        <s-stack direction="block" gap="small-400">
          <s-heading>ポイントMAN</s-heading>
          <s-text>保有ポイント</s-text>
          <s-text>表示テスト：0 pt</s-text>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
