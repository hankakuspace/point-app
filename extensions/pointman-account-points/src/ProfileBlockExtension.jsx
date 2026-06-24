// extensions/pointman-account-points/src/ProfileBlockExtension.jsx
import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default async () => {
  render(<ProfileBlockExtension />, document.body);
};

function ProfileBlockExtension() {
  return (
    <s-section heading="ポイントMAN">
      <s-stack direction="block" gap="base" paddingBlockStart="base">
        <s-grid gridTemplateColumns="1fr" gap="large">
          <s-stack direction="block" gap="small">
            <s-text color="subdued">保有ポイント</s-text>
            <s-text type="strong">表示テスト：0 pt</s-text>
          </s-stack>
        </s-grid>
      </s-stack>
    </s-section>
  );
}
