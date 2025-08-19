export default function SuccessPage() {
  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      height: "100vh", 
      fontFamily: "sans-serif" 
    }}>
      <div style={{ textAlign: "center" }}>
        <h1>✅ 認証が完了しました</h1>
        <p>Shopify アプリのインストールが正常に完了しました。</p>
        <p>この画面を閉じて管理画面に戻ってください。</p>
      </div>
    </div>
  );
}
