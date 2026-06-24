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
        <s-box padding="base" border="base" borderRadius="base">
          <s-stack direction="block" gap="small">
            <s-text color="subdued">保有ポイント</s-text>
            <s-text type="strong">表示テスト：0 pt</s-text>
          </s-stack>
        </s-box>
      </s-stack>
    </s-section>
  );
}
