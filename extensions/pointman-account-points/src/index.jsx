// extensions/pointman-account-points/src/index.jsx
import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default () => {
  render(<Extension />, document.body);
};

function Extension() {
  return (
    <s-section heading="ポイントMAN">
      <s-stack direction="block" gap="base" paddingBlockStart="base">
        <s-text>保有ポイント</s-text>
        <s-text type="strong">表示テスト：0 pt</s-text>
      </s-stack>
    </s-section>
  );
}
