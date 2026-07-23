import {
  canAccessAccountingItem,
  getAccountingItemFeatureKey,
  shouldHideBasicAccountingItem,
  shouldHideSeparateEmployeeModules,
} from "@/lib/plan-access"
import { canAccessFichaCosto } from "@/features/ficha-costo/lib/access"
import { type TenantRole } from "@/lib/auth/roles"
import type { SidebarConfig, SidebarAccessContext, SidebarGroupConfig, SidebarItemConfig } from "./types"

function canSeeItem(
  itemTitle: string,
  ctx: SidebarAccessContext,
  config: SidebarConfig,
): boolean {
  const user = {
    role: ctx.role,
    tenantRole: ctx.tenantRole,
    tenantId: ctx.tenantId,
    planFeatures: ctx.planFeatures ?? null,
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

  const allowedRoles = config.tenantPermissions[itemTitle]
  if (!allowedRoles) return user.tenantRole === "manager"

  return allowedRoles.includes(user.tenantRole)
}

function filterItemWithSubItems(
  item: SidebarItemConfig,
  ctx: SidebarAccessContext,
  config: SidebarConfig,
): SidebarItemConfig | null {
  if (!canSeeItem(item.title, ctx, config)) return null

  if (!item.subItems || item.subItems.length === 0) return item

  const filteredSubItems = item.subItems
    .map((sub) => filterItemWithSubItems(sub, ctx, config))
    .filter((s): s is SidebarItemConfig => s !== null)

  if (filteredSubItems.length === 0) return null

  if (filteredSubItems.length === item.subItems.length) return item

  return { ...item, subItems: filteredSubItems }
}

export function buildVisibleSidebarGroups(
  config: SidebarConfig,
  ctx: SidebarAccessContext,
): SidebarGroupConfig[] {
  return config.groups.reduce<SidebarGroupConfig[]>((acc, group) => {
    const items = group.items
      .map((item) => filterItemWithSubItems(item, ctx, config))
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
