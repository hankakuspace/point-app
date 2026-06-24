// extensions/pointman-account-points/src/ProfileBlockExtension.jsx
// @ts-nocheck

import { render } from "preact";

export default async () => {
  render(<PointManProfileBlock />, document.body);
};

function PointManProfileBlock() {
  return (
    <>
      <s-section>
        <s-stack direction="block" gap="large-200">
          <s-heading>
            <s-text>ポイントMAN</s-text>
          </s-heading>

          <s-stack direction="block" gap="small-500">
            <s-text color="subdued">保有ポイント</s-text>
            <s-text>表示テスト：0 pt</s-text>
          </s-stack>
        </s-stack>
      </s-section>
    </>
  );
}
