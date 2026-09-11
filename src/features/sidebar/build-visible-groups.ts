import {
  canAccessAccountingItem,
  getAccountingItemFeatureKey,
  shouldHideBasicAccountingItem,
  shouldHideSeparateEmployeeModules,
} from "@/lib/plan-access"
import { canAccessFichaCosto } from "@/features/ficha-costo/lib/access"
import { type TenantRole } from "@/lib/auth/roles"
import { normalizeTenantRole } from "@/lib/auth/roles"
import { getDefaultPermissionsForRole, PERMISSION_REGISTRY, type PermissionCategory } from "@/lib/auth/permission-registry"
import { SIDEBAR_TENANT_PERMISSION_CATEGORY } from "./sidebar-config"
import type { SidebarConfig, SidebarAccessContext, SidebarGroupConfig, SidebarItemConfig } from "./types"

function hasCustomRole(ctx: SidebarAccessContext): boolean {
  if (!ctx.tenantRole || !ctx.permissions) return false
  const fixed = normalizeTenantRole(ctx.tenantRole)
  if (!fixed) return false
  const defaults = [...getDefaultPermissionsForRole(fixed)].sort().join("\u0000")
  const actual = [...ctx.permissions].sort().join("\u0000")
  return defaults !== actual
}

function hasCategoryPermission(ctx: SidebarAccessContext, category: PermissionCategory): boolean {
  if (!ctx.permissions) return false
  const granted = new Set(ctx.permissions)
  return PERMISSION_REGISTRY.some((def) => def.category === category && granted.has(def.key))
}

function canSeeItem(
  itemTitle: string,
  ctx: SidebarAccessContext,
  config: SidebarConfig,
  customRole: boolean,
): boolean {
  const user = {
    role: ctx.role,
    tenantRole: ctx.tenantRole,
    tenantId: ctx.tenantId,
    planFeatures: ctx.planFeatures
      ? Object.fromEntries(
          Object.entries(ctx.planFeatures).filter(([, v]) => v !== undefined) as [string, boolean][]
        ) as Record<string, boolean> | null
      : null,
    planName: ctx.planName ?? null,
  }

  if (user.role === "admin") {
    return itemTitle !== "Ficha de Costo" || canAccessFichaCosto(user)
  }

  if (
    (itemTitle === "Asistencia" ||
      itemTitle === "Vacaciones" ||
      itemTitle === "Nómina") &&
    shouldHideSeparateEmployeeModules(user)
  ) {
    return false
  }

  if (shouldHideBasicAccountingItem(user, itemTitle)) {
    const accountingFeatureKey = getAccountingItemFeatureKey(itemTitle)
    if (
      !accountingFeatureKey ||
      accountingFeatureKey === "transferencias-bancarias" ||
      accountingFeatureKey === "ajustes-bancarios"
    ) {
      return false
    }
  }

  if (getAccountingItemFeatureKey(itemTitle) && !canAccessAccountingItem(user, itemTitle)) {
    return false
  }

  const featureKey = config.featureMap[itemTitle]
  if (featureKey && user.planFeatures?.[featureKey] === false) return false
  if (featureKey === "ficha-costo" && !canAccessFichaCosto(user)) return false

  if (!user.tenantRole) {
    if (ctx.isBusyRoute) return false
    if (!config.tenantlessPublicItems.has(itemTitle)) return false
    return !featureKey || user.planFeatures?.[featureKey] === true
  }

  // Rol personalizado: filtrar por categoría de permiso efectivo.
  if (customRole) {
    const category = SIDEBAR_TENANT_PERMISSION_CATEGORY[itemTitle]
    if (category) return hasCategoryPermission(ctx, category)
  }

  const allowedRoles = config.tenantPermissions[itemTitle]
  if (!allowedRoles) return user.tenantRole === "manager"

  return allowedRoles.includes(user.tenantRole)
}

function filterItemWithSubItems(
  item: SidebarItemConfig,
  ctx: SidebarAccessContext,
  config: SidebarConfig,
  customRole: boolean,
): SidebarItemConfig | null {
  if (!canSeeItem(item.title, ctx, config, customRole)) return null

  if (!item.subItems || item.subItems.length === 0) return item

  const filteredSubItems = item.subItems
    .map((sub) => filterItemWithSubItems(sub, ctx, config, customRole))
    .filter((s): s is SidebarItemConfig => s !== null)

  if (filteredSubItems.length === 0) return null

  if (filteredSubItems.length === item.subItems.length) return item

  return { ...item, subItems: filteredSubItems }
}

export function buildVisibleSidebarGroups(
  config: SidebarConfig,
  ctx: SidebarAccessContext,
): SidebarGroupConfig[] {
  const customRole = hasCustomRole(ctx)

  return config.groups.reduce<SidebarGroupConfig[]>((acc, group) => {
    const items = group.items
      .map((item) => filterItemWithSubItems(item, ctx, config, customRole))
      .filter((item): item is SidebarItemConfig => item !== null)
      .filter((item) => {
        if (item.title === "Licencias" || item.title === "Planes") {
          return ctx.role === "admin"
        }
        return true
      })

    if (items.length === 0) return acc

    acc.push({ ...group, items })
    return acc
  }, [])
}
