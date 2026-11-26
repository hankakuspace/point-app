import type { Firestore } from "firebase-admin/firestore";
import type { ShopifyTokenManager } from "./shopifyTokenManager";

export interface RecoveryExpectation {
  shop: string;
  operationId: string;
  generation: number;
  revision: number;
}
interface Approval extends RecoveryExpectation { owner: object; expiresAt: number }
const approvals = new WeakMap<object, Approval>();

// No production approval issuer is provided. This is an explicit synthetic-only
// operational capability, separate from HTTP routes and normal token acquisition.
export class LocalTokenRecoveryOperator {
  constructor(private manager: ShopifyTokenManager, private database: Firestore) {
    manager.assertLocalRecoveryTarget(database);
  }
  inspect(shop: string) {
    this.manager.assertLocalRecoveryTarget(this.database);
    return this.manager.inspectTokenRecovery(shop);
  }
  approve(expected: RecoveryExpectation, confirmation: string): object {
    this.manager.assertLocalRecoveryTarget(this.database);
    if (confirmation !== "APPROVE_SYNTHETIC_RECOVERY" || !expected.operationId ||
        !Number.isSafeInteger(expected.generation) || expected.generation < 0 ||
        !Number.isSafeInteger(expected.revision) || expected.revision < 0) {
      throw new Error("INVALID_RECOVERY_APPROVAL");
    }
    const capability = Object.freeze({});
    approvals.set(capability, { ...expected, owner: this.manager, expiresAt: Date.now() + 60000 });
    return capability;
  }
  recover(shop: string, approval: object) {
    this.manager.assertLocalRecoveryTarget(this.database);
    return this.manager.recoverKnownTokenResult(shop, approval);
  }
}

export function consumeLocalRecoveryApproval(owner: object, shop: string, capability: object) {
  const a = capability && approvals.get(capability);
  if (!a || a.owner !== owner || a.shop !== shop || a.expiresAt <= Date.now()) {
    throw new Error("INVALID_RECOVERY_APPROVAL");
  }
  approvals.delete(capability);
  return { operationId: a.operationId, generation: a.generation, revision: a.revision };
}

// Synthetic authentication is deliberately a separate capability from audit IDs.
// No production authenticator/issuer exists. Capabilities cannot be reconstructed
// from JSON, approval IDs, operator names, or persisted Firestore metadata.
export interface OfficialRecoveryExpectation extends RecoveryExpectation {
  projectId: 'demo-pointman-step4b'; databaseId: '(default)';
}
interface SyntheticSession { owner: object; operator: string; shop: string }
const sessions = new WeakMap<object, SyntheticSession>();
interface OfficialGrant extends OfficialRecoveryExpectation {
  owner: object; operator: string; approvalId: string; expiresAt: number;
}
const officialGrants = new WeakMap<object, OfficialGrant>();
export function authenticateSyntheticRecovery(manager: ShopifyTokenManager, database: Firestore, mockAuthenticator: () => { authenticated: true; operator: string; writersStopped: true; requestsDrained: true; noLaterAcquisition: true; shop: string }) {
  manager.assertLocalRecoveryTarget(database);
  const identity = mockAuthenticator();
  if (identity?.authenticated !== true || identity.writersStopped !== true || identity.requestsDrained !== true ||
      identity.noLaterAcquisition !== true || !/^[a-z0-9-]+\.myshopify\.com$/.test(identity.shop) || !/^[a-zA-Z0-9_-]{1,64}$/.test(identity.operator)) throw new Error('SYNTHETIC_AUTH_REQUIRED');
  const session = Object.freeze({}); sessions.set(session, { owner: manager, operator: identity.operator, shop: identity.shop }); return session;
}
export class LocalOfficialRecoveryOperator {
  constructor(private manager: ShopifyTokenManager, database: Firestore, private shop: string, private session: object) {
    manager.assertLocalRecoveryTarget(database);
    if (!sessions.has(session) || sessions.get(session)?.owner !== manager || sessions.get(session)?.shop !== shop) throw new Error('SYNTHETIC_AUTH_REQUIRED');
  }
  auditContext(capability?: object) {
    this.manager.assertLocalRecoveryTarget();
    const grant = capability ? officialGrants.get(capability) : undefined;
    return { projectId: 'demo-pointman-step4b', databaseId: '(default)', shop: this.shop,
      operator: sessions.get(this.session)!.operator,
      ...(grant?.owner === this.manager && grant.shop === this.shop ? { approvalId: grant.approvalId,
        operationId: grant.operationId, generation: grant.generation, revision: grant.revision } : {}) };
  }
  dryRun() { return this.manager.inspectOfficialRecovery(this.shop); }
  approve(expected: OfficialRecoveryExpectation, approvalId: string, expiresAt: number) {
    this.manager.assertLocalRecoveryTarget();
    const session = sessions.get(this.session);
    if (!session || session.owner !== this.manager || expected.shop !== this.shop ||
        expected.projectId !== 'demo-pointman-step4b' || expected.databaseId !== '(default)' ||
        !/^[a-zA-Z0-9_-]{1,64}$/.test(approvalId) || !/^[a-zA-Z0-9_-]{1,128}$/.test(expected.operationId) ||
        !Number.isSafeInteger(expected.generation) || expected.generation < 0 || !Number.isSafeInteger(expected.revision) || expected.revision < 0 ||
        !Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 60000) throw new Error('INVALID_RECOVERY_APPROVAL');
    const capability = Object.freeze({}); officialGrants.set(capability, { ...expected, owner: this.manager, operator: session.operator, approvalId, expiresAt }); return capability;
  }
  execute(approval: object) { return this.manager.recoverOfficialTokenResult(this.shop, approval); }
  prepareReauthentication(approval: object) { return this.manager.prepareOfficialReauthentication(this.shop, approval); }
}
export function consumeOfficialRecoveryApproval(owner: object, shop: string, capability: object) {
  const grant = officialGrants.get(capability);
  if (!grant || grant.owner !== owner || grant.shop !== shop || grant.expiresAt <= Date.now()) throw new Error('INVALID_RECOVERY_APPROVAL');
  officialGrants.delete(capability); return grant;
}

// Reuses the synthetic authenticated session, never an operator-name assertion.
export function assertSyntheticRecoverySession(manager: ShopifyTokenManager, database: Firestore, shop: string, session: object) {
  manager.assertLocalRecoveryTarget(database);
  const identity = sessions.get(session);
  if (!identity || identity.owner !== manager || identity.shop !== shop) throw new Error('SYNTHETIC_AUTH_REQUIRED');
  return identity.operator;
}
