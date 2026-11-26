// Temporary, fixed shop guard. No configuration input can disable it.
export class LegacyTokenWriteBlocked extends Error {
  readonly code = "LEGACY_TOKEN_WRITE_BLOCKED";
  constructor() { super("LEGACY_TOKEN_WRITE_BLOCKED"); }
}
export function assertLegacyTokenWriteAllowed(shop: string): void {
  if (shop.trim().toLowerCase() === "ruhra-store.myshopify.com") {
    throw new LegacyTokenWriteBlocked();
  }
}

export function assertLegacyRefreshAllowed(shop: string): void {
  assertLegacyTokenWriteAllowed(shop);
  if (shop.trim().toLowerCase() === "pointman-dev-07-plus.myshopify.com") {
    throw new LegacyTokenWriteBlocked();
  }
}
