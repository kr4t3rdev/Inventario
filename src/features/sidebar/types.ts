import type { LucideIcon } from "lucide-react"

export interface SidebarItemConfig {
  title: string
  url: string
  icon: LucideIcon
  subItems?: SidebarItemConfig[]
}

export interface SidebarGroupConfig {
  title: string
  items: SidebarItemConfig[]
}

export interface SidebarConfig {
  groups: SidebarGroupConfig[]
  dashboardUrl: string
  groupToneByTitle: Record<string, string>
  featureMap: Record<string, string>
  tenantPermissions: Record<string, string[]>
  tenantlessPublicItems: Set<string>
}

export interface SidebarAccessContext {
  role: string | null | undefined
  tenantRole: string | null | undefined
  tenantId: string | null | undefined
  planFeatures: Record<string, boolean | undefined> | null | undefined
  planName: string | null | undefined
  isBusyRoute: boolean
}
