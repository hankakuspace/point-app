// extensions/pointman-account-points/src/ProfileBlockExtension.jsx
import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default () => {
  render(<ProfileBlockExtension />, document.body);
};

function ProfileBlockExtension() {
  return (
    <s-card>
      <s-stack direction="block" gap="base">
        <s-text type="strong">ポイントMAN</s-text>
        <s-text color="subdued">保有ポイント</s-text>
        <s-text type="strong">表示テスト：0 pt</s-text>
      </s-stack>
    </s-card>
  );
}
