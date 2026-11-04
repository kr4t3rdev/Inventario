"use client"

import { BellIcon, LogOutIcon, MoreVerticalIcon, MoonIcon, SunIcon, UserCircleIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuth } from "@/contexts/auth-context"
import { Shield, LayoutDashboard } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useAdminUsers } from '@/features/admin/hooks/use-admin-users'
import { TenantSwitcher } from "@/components/tenant-switcher"

/**
 * @description Resuelve la etiqueta corta del fallback de avatar para el usuario actual.
 * @param {string} name - Nombre visible del usuario.
 * @param {string | null | undefined} tenantRole - Rol del usuario en el tenant.
 * @param {string | null | undefined} role - Rol global de plataforma.
 * @returns {string} Abreviatura legible para el avatar fallback.
 */
export function getNavUserFallbackLabel(
  name: string,
  tenantRole?: string | null,
  role?: string | null,
): string {
  if (tenantRole === 'dependiente') return 'DEP'
  if (tenantRole === 'economico') return 'ECO'
  if (tenantRole === 'manager') return 'MGR'
  if (role === 'admin') return 'ADM'

  const normalizedName = name?.trim()
  if (!normalizedName) {
    return 'US'
  }

  return normalizedName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/**
 * @description Menú de usuario en el footer del sidebar o compacto en el encabezado.
 * @param {{ compact?: boolean }} props - Presentación reducida para espacios de encabezado.
 * @returns {JSX.Element | null} Menú de usuario o null si no hay usuario autenticado.
 */
export function NavUser({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname()
  const { isMobile } = useSidebar()
  const { setTheme, theme } = useTheme()
  const { user } = useAuth()
  const { users } = useAdminUsers({ enabled: user?.role === 'admin' })
  const { logout } = useAuth()

  const profile = users?.find((u) => u.userId === user?.userId)

  if (!user) {
    return null
  }

  const handleLogout = async () => {
   logout()
  }

  const displayName = user.name?.trim() || user.email || 'Usuario'
  const initials = getNavUserFallbackLabel(displayName, user.tenantRole, user.role)
  const compactInitials = displayName.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const avatarFallback = compact ? compactInitials || 'US' : initials

  const avatarSrc = profile?.avatar || user.avatar || ''


  return (
    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem className="group-data-[collapsible=icon]:w-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={displayName}
              aria-label={compact ? 'Menú de usuario' : undefined}
              className={`data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 ${compact ? '!size-11 justify-center rounded-full p-0' : ''}`}
            >
              <Avatar className={`h-8 w-8 rounded-lg group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7 ${compact ? 'rounded-full' : ''}`}>
                <AvatarImage src={avatarSrc} alt={displayName} />
                <AvatarFallback className="rounded-lg">{<span>{avatarFallback}</span>}</AvatarFallback>
              </Avatar>
              {!compact && <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>}
              {!compact && <MoreVerticalIcon className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={compact || isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={avatarSrc} alt={displayName} />
                <AvatarFallback className="rounded-lg">{<span>{avatarFallback}</span>}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  {!compact && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
               <Link href="/busy/perfil" className="flex items-center gap-2 cursor-pointer">
                <UserCircleIcon />
                Perfil
              </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/busy/notificaciones" className="flex items-center gap-2 cursor-pointer">
                  <BellIcon />
                Notificaciones
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <TenantSwitcher />
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="flex items-center gap-2 cursor-pointer">
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                {theme === "dark" ? "Modo Claro" : "Modo Oscuro"}
              </DropdownMenuItem>
              {user?.role === "admin" && (
                <DropdownMenuItem className="cursor-pointer">
                  <Link
                    href={pathname.startsWith("/admin") ? "/busy/dashboard" : "/admin"}
                    className="flex items-center gap-2 cursor-pointer w-full"
                  >
                    {pathname.startsWith("/admin") ? (
                      <><LayoutDashboard className="h-4 w-4" /> Ir al Negocio</>
                    ) : (
                      <><Shield className="h-4 w-4" /> Panel de Control</>
                    )}
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
              <LogOutIcon />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
