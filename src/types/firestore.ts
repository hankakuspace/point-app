// src/types/firestore.ts
import type { Timestamp } from "firebase/firestore";

/**
 * Firestore ドキュメントに `id` を含めた型
 */
export type WithId<T> = T & { id: string };

/**
 * 顧客情報
 * Shopify の customerId と紐付ける
 */
export interface Customer {
  shopDomain: string;           // 所属するShopifyショップのドメイン
  customerId: number;           // Shopify Customer ID
  email?: string;               // メールアドレス
  name?: string;                // 顧客名
  points: number;               // 現在の保有ポイント
  rank?: string;                // 顧客ランク（例: "gold", "silver"）
  createdAt: Timestamp;         // 作成日時
  updatedAt: Timestamp;         // 更新日時
}

/**
 * ポイント履歴ログ
 * 付与 / 利用 / 失効 などのイベントを記録
 */
export interface PointLog {
  shopDomain: string;           // Shopify ショップのドメイン
  customerId: number;           // 対象の顧客
  type: "earn" | "use" | "expire"; // 種別
  points: number;               // 増減ポイント（正なら付与、負なら減算）
  reason?: string;              // 任意の理由や備考
  orderId?: number;             // 紐付く注文ID（利用や付与元が注文の場合）
  createdAt: Timestamp;         // ログ作成日時
}

/**
 * アプリ全体の設定
 * ポイント付与ルールや除外商品などを保持
 */
export interface Settings {
  shopDomain: string;           // Shopify ショップのドメイン
  includeShipping: boolean;     // 送料をポイント計算に含めるか
  excludedProductIds?: number[];   // ポイント付与対象外のProduct ID
  excludedCollectionIds?: number[]; // 対象外コレクションID
  excludedTags?: string[];      // 対象外タグ
  pointRate: number;            // 購入金額に対するポイント率（例: 1 = 1%）
  maxUsePoints?: number;        // 利用できるポイント上限
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Shopify ショップ情報
 * 認証後に保存するアクセストークンなど
 */
export interface Shop {
  shopDomain: string;           // Shopify ショップのドメイン
  accessToken: string;          // Shopify API アクセストークン
  installedAt: Timestamp;       // アプリインストール日時
  updatedAt: Timestamp;         // 最終更新日時
  uninstalled?: boolean;        // アンインストール済みかどうか
}
