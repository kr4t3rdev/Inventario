import type { Prisma } from '@/generated/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';

export type BackupActorScope =
  | { kind: 'platform' }
  | { kind: 'tenant'; tenantId: string };

export function resolveBackupActorScope(user: AuthenticatedUser): BackupActorScope {
  if (user.role === 'admin') return { kind: 'platform' };

  requireFeature(user, 'backups-tiempo-real', 'gestión de backups');
  return { kind: 'tenant', tenantId: requireTenant(user) };
}

export function backupLogWhere(
  scope: BackupActorScope,
  where: Prisma.BackupLogWhereInput = {},
): Prisma.BackupLogWhereInput {
  if (scope.kind === 'platform') return where;
  return { ...where, tenantId: scope.tenantId, type: 'tenant' };
}

export function backupPlanWhere(
  scope: BackupActorScope,
  where: Prisma.BackupPlanWhereInput = {},
): Prisma.BackupPlanWhereInput {
  if (scope.kind === 'platform') return where;
  return { ...where, tenantId: scope.tenantId, type: 'tenant' };
}
