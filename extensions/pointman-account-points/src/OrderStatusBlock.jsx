// extensions/pointman-account-points/src/OrderStatusBlock.jsx
import '@shopify/ui-extensions/preact';
import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  return (
    <s-banner>
      <s-text>
        Point MAN Account Points 表示テスト：0 pt
      </s-text>
    </s-banner>
  );
}
