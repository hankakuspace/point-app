// extensions/pointman-account-points/src/ProfileBlockExtension.jsx
export default async () => {
  const wrapper = document.createElement("div");
  wrapper.style.padding = "16px";
  wrapper.style.border = "1px solid #ddd";
  wrapper.style.borderRadius = "12px";
  wrapper.style.background = "#fff";
  wrapper.style.margin = "12px 0";

  const title = document.createElement("div");
  title.textContent = "ポイントMAN";
  title.style.fontWeight = "700";
  title.style.marginBottom = "8px";

  const label = document.createElement("div");
  label.textContent = "保有ポイント";

  const points = document.createElement("div");
  points.textContent = "表示テスト：0 pt";
  points.style.fontWeight = "700";
  points.style.fontSize = "20px";
  points.style.marginTop = "4px";

  wrapper.appendChild(title);
  wrapper.appendChild(label);
  wrapper.appendChild(points);

  document.body.appendChild(wrapper);
};
