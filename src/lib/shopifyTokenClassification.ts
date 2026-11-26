import { ShopifyTokenError } from './shopifyTokenErrors';
import type { StoredShopToken } from './shopifyTokenManager';
export interface TokenClassification {
  kind: 'legacy_offline_record' | 'expiring_response';
  shop: string; clientId: string; generation: number; revision: number;
  verifiedAt: string; evidenceId?: string;
}
export function tokenDate(value: unknown): number {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;
}
export function classifyStoredToken(d: StoredShopToken, context?: { shop: string; clientId: string }) {
  const invalid = () => { throw new ShopifyTokenError('TOKEN_DATA_INVALID'); };
  for (const n of [d.authGeneration, d.tokenRevision]) if (n !== undefined && (!Number.isSafeInteger(n) || n < 0)) invalid();
  if (typeof d.accessToken !== 'string' || !d.accessToken.trim()) invalid();
  if (d.tokenType === 'expiring_offline') {
    if (typeof d.refreshToken !== 'string' || !d.refreshToken.trim() ||
        !Number.isFinite(tokenDate(d.accessTokenExpiresAt)) || !Number.isFinite(tokenDate(d.refreshTokenExpiresAt)) ||
        tokenDate(d.accessTokenExpiresAt) > tokenDate(d.refreshTokenExpiresAt)) invalid();
    const p = d.tokenClassification;
    if (p && (!context || p.kind !== 'expiring_response' || p.shop !== context.shop || p.clientId !== context.clientId ||
        p.generation !== (d.authGeneration ?? 0) || p.revision !== (d.tokenRevision ?? 0) || !Number.isFinite(tokenDate(p.verifiedAt)))) invalid();
    return 'expiring_offline' as const;
  }
  if (d.tokenType !== 'offline' || d.refreshToken != null || d.accessTokenExpiresAt != null || d.refreshTokenExpiresAt != null) invalid();
  const p = d.tokenClassification;
  if (!context || !p || p.kind !== 'legacy_offline_record' || typeof p.evidenceId !== 'string' || !p.evidenceId.trim() ||
      p.shop !== context.shop || p.clientId !== context.clientId || !context.clientId ||
      p.generation !== (d.authGeneration ?? 0) || p.revision !== (d.tokenRevision ?? 0) ||
      !Number.isFinite(tokenDate(p.verifiedAt))) invalid();
  return 'offline' as const;
}
