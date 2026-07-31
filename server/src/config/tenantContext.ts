import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  organizationId: number;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/** Returns the current request's organizationId, or undefined outside a tenant context. */
export function getOrganizationId(): number | undefined {
  return tenantStorage.getStore()?.organizationId;
}

/** Returns the current request's organizationId or throws (for code paths that must be tenant-scoped). */
export function requireOrganizationId(): number {
  const orgId = getOrganizationId();
  if (orgId === undefined) throw new Error('No tenant context — this operation requires an organization scope');
  return orgId;
}
