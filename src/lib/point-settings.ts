// src/lib/point-settings.ts
export interface PointSettings {
  pointRate: number;
  includeShipping: boolean;
  excludedTags: string[];
  minUsePoints: number;
  maxUsePoints: number;
}

export const DEFAULT_POINT_SETTINGS: PointSettings = {
  pointRate: 0.03,
  includeShipping: false,
  excludedTags: [],
  minUsePoints: 100,
  maxUsePoints: 1000,
};

export function getPointSettingsDocId(shop?: string | null) {
  const normalizedShop = String(shop || "").trim().toLowerCase();
  return normalizedShop || "default";
}

export function normalizePointSettings(data: any): PointSettings {
  return {
    pointRate:
      typeof data?.pointRate === "number" && Number.isFinite(data.pointRate)
        ? data.pointRate
        : DEFAULT_POINT_SETTINGS.pointRate,
    includeShipping: Boolean(data?.includeShipping),
    excludedTags: Array.isArray(data?.excludedTags)
      ? data.excludedTags
          .map((tag: unknown) => String(tag || "").trim())
          .filter(Boolean)
      : typeof data?.excludedTags === "string"
        ? data.excludedTags
            .split(",")
            .map((tag: string) => tag.trim())
            .filter(Boolean)
        : DEFAULT_POINT_SETTINGS.excludedTags,
    minUsePoints:
      typeof data?.minUsePoints === "number" && Number.isFinite(data.minUsePoints)
        ? data.minUsePoints
        : DEFAULT_POINT_SETTINGS.minUsePoints,
    maxUsePoints:
      typeof data?.maxUsePoints === "number" && Number.isFinite(data.maxUsePoints)
        ? data.maxUsePoints
        : DEFAULT_POINT_SETTINGS.maxUsePoints,
  };
}

export async function getPointSettings(db: any, shop?: string | null): Promise<PointSettings> {
  const docId = getPointSettingsDocId(shop);

  if (docId !== "default") {
    const shopSettingsSnap = await db.collection("settings").doc(docId).get();

    if (shopSettingsSnap.exists) {
      return normalizePointSettings(shopSettingsSnap.data());
    }
  }

  const defaultSettingsSnap = await db.collection("settings").doc("default").get();

  if (defaultSettingsSnap.exists) {
    return normalizePointSettings(defaultSettingsSnap.data());
  }

  return DEFAULT_POINT_SETTINGS;
}

export async function savePointSettings(
  db: any,
  data: any,
  shop?: string | null
): Promise<PointSettings> {
  const docId = getPointSettingsDocId(shop);
  const settings = normalizePointSettings(data);

  await db.collection("settings").doc(docId).set(settings, { merge: true });

  return settings;
}
