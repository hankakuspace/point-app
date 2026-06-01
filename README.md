# Point MAN

Point MAN は、Shopify ストア向けのポイント管理アプリです。

## 主な機能

- 顧客ごとのポイント残高管理
- 購入完了時のポイント付与
- カート画面でのポイント表示
- ポイント利用による割引コード発行
- 顧客管理、ポイント履歴、利用コード、付与設定の管理
- GDPR Webhook 対応

## ストアフロント導入

Point MAN は Shopify App Proxy を利用して、カート画面にポイント表示とポイント利用フォームを表示します。

App Proxy 設定:
- prefix: apps
- subpath: apps
- url: https://point-app-gamma.vercel.app

カート画面では以下の App Proxy URL を呼び出します。

https://{shop-domain}/apps/apps/api/cart-points

必要なクエリ:
- logged_in_customer_id={Shopify customer id}
- cartProductIds={comma separated product ids}

Shopify が App Proxy 経由で shop、path_prefix、timestamp、signature を付与し、アプリ側では signature を検証します。

## ポイント利用フロー

1. 顧客がストアにログインします。
2. カート画面で App Proxy 経由の cart-points を読み込みます。
3. アプリは App Proxy 署名を検証します。
4. 顧客のポイント残高と利用フォームを表示します。
5. use-point-form で署名と pointFormToken を検証します。
6. Shopify Admin GraphQL API で割引コードを発行します。
7. 顧客を割引適用済みのチェックアウトへ誘導します。
8. 注文完了後、orders/paid Webhook によりポイントを付与します。

## 管理画面

Shopify 管理画面内の Point MAN アプリで、顧客管理、ポイント履歴、ポイント付与設定、ポイント利用コード、セットアップを確認できます。

/admin/setup では、App Proxy の確認、カートへの設置方法、テスト手順を確認できます。

## 審査・動作確認項目

- cart-points が 200 で返ること
- カート画面にポイントMANパネルが表示されること
- ポイント利用フォームが表示されること
- ポイント利用後に割引コードが発行されること
- チェックアウトへ遷移すること
- 注文完了後にポイントが付与されること
- 管理APIが Shopify session token なしで取得できないこと
- GDPR Webhook が HMAC なしで拒否されること

## デプロイ

Vercel の GitHub 連携により、main ブランチへの push で自動デプロイされます。
