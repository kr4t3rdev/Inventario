"use client";

import * as React from "react";
import {
	AnimatePresence,
	LazyMotion,
	m as motion,
} from "framer-motion";
import {
	LayoutDashboard,
	Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { useHydrationSafeReducedMotion } from "@/hooks/use-hydration-safe-reduced-motion";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { cn } from "@/lib/utils";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarSeparator,
	useSidebar,
} from "./ui/sidebar";
import {
	buildVisibleSidebarGroups,
	SIDEBAR_CONFIG,
	GROUP_TONE_BY_TITLE,
} from "@/features/sidebar";

/** Items públicos visibles aunque el usuario no tenga rol de tenant (modo degraded). */
export const TENANTLESS_PUBLIC_ITEMS = SIDEBAR_CONFIG.tenantlessPublicItems;

const SIDEBAR_CONTAINER_INITIAL = { opacity: 0, x: -10 };
const SIDEBAR_VISIBLE_POSITION = { opacity: 1, x: 0 };
const SIDEBAR_HEADER_INITIAL = { opacity: 0, y: -8 };
const SIDEBAR_HEADER_POSITION = { opacity: 1, y: 0 };
const SIDEBAR_HEADER_EXIT = { opacity: 0, y: -8 };
const SIDEBAR_FOOTER_INITIAL = { opacity: 0, y: 6 };
const SIDEBAR_FOOTER_POSITION = { opacity: 1, y: 0 };
const SIDEBAR_LOGO_HOVER = { scale: 1.04 };
const SIDEBAR_EASE = "easeOut" as const;
const SIDEBAR_CONTAINER_TRANSITION = { duration: 0.26, ease: SIDEBAR_EASE };
const SIDEBAR_HEADER_TRANSITION = { duration: 0.22, ease: SIDEBAR_EASE };
const SIDEBAR_LOGO_TRANSITION = { duration: 0.2, ease: SIDEBAR_EASE };
const SIDEBAR_FOOTER_TRANSITION = { duration: 0.22, ease: SIDEBAR_EASE };
const SIDEBAR_NO_MOTION_TRANSITION = { duration: 0 };

/**
 * @description Componente de barra lateral de la aplicación que incluye navegación a todas las páginas principales.
 * @param {React.ComponentProps<typeof Sidebar>} props - Propiedades del contenedor Sidebar.
 * @returns {JSX.Element} Barra lateral principal con navegación agrupada por dominio.
 */
export function AppSidebar2({
	className,
	...props
}: React.ComponentProps<typeof Sidebar>): React.JSX.Element {
	const { user } = useAuth();
	const { state } = useSidebar();
	const pathname = usePathname();
	const shouldReduceMotion = useHydrationSafeReducedMotion();
	const isMounted = useIsMounted();
	const shouldAnimate = isMounted && !shouldReduceMotion;
	const isBusyRoute = pathname.startsWith("/busy");
	const planFeatures = user?.planFeatures ?? null;

	const accessContext = React.useMemo(
		() => ({
			role: user?.role ?? null,
			tenantRole: user?.tenantRole ?? null,
			tenantId: user?.tenantId ?? null,
			planFeatures,
			planName: user?.planName ?? null,
			permissions: user?.permissions ?? null,
			isBusyRoute,
		}),
		[
			user?.role,
			user?.tenantRole,
			user?.tenantId,
			user?.planName,
			user?.permissions,
			planFeatures,
			isBusyRoute,
		],
	);

	const filteredGroups = React.useMemo(
		() => buildVisibleSidebarGroups(SIDEBAR_CONFIG, accessContext),
		[accessContext],
	);

	return (
		<Sidebar
			collapsible="icon"
			className={cn("group-data-[variant=floating]:p-3", className)}
			{...props}
		>
			<motion.div
				className="flex h-full min-h-0 flex-col"
				initial={shouldAnimate ? SIDEBAR_CONTAINER_INITIAL : SIDEBAR_VISIBLE_POSITION}
				animate={SIDEBAR_VISIBLE_POSITION}
				transition={shouldAnimate ? SIDEBAR_CONTAINER_TRANSITION : SIDEBAR_NO_MOTION_TRANSITION}
			>
				<AnimatePresence initial={false}>
					{state !== "collapsed" && (
						<motion.div
							key="sidebar-brand-header"
							initial={shouldAnimate ? SIDEBAR_HEADER_INITIAL : SIDEBAR_HEADER_POSITION}
							animate={SIDEBAR_HEADER_POSITION}
							exit={shouldAnimate ? SIDEBAR_HEADER_EXIT : SIDEBAR_HEADER_POSITION}
							transition={shouldAnimate ? SIDEBAR_HEADER_TRANSITION : SIDEBAR_NO_MOTION_TRANSITION}
						>
							<SidebarHeader className="px-3 pb-2 pt-3">
								<Link
									href={SIDEBAR_CONFIG.dashboardUrl}
									className="group/brand flex min-h-11 items-center gap-3 rounded-xl border border-sidebar-border/70 bg-linear-to-br from-primary/15 via-sidebar-accent/55 to-transparent px-3 py-3 text-sidebar-foreground transition-colors duration-200 hover:border-primary/40 hover:from-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
								>
									<motion.span
										className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
										whileHover={shouldAnimate ? SIDEBAR_LOGO_HOVER : undefined}
										transition={shouldAnimate ? SIDEBAR_LOGO_TRANSITION : SIDEBAR_NO_MOTION_TRANSITION}
									>
										<LayoutDashboard className="h-5 w-5 transition-transform duration-200 group-hover/brand:-translate-y-0.5" />
									</motion.span>
									<span className="grid min-w-0 gap-0.5">
										<span className="truncate text-sm font-semibold tracking-wide">
											FinanceMDM
										</span>
										<span className="truncate text-xs text-sidebar-foreground/70">
											Inventario y finanzas
										</span>
									</span>
								</Link>
							</SidebarHeader>
							<SidebarSeparator className="mx-0.5 mb-0.5" />
						</motion.div>
					)}
				</AnimatePresence>

				<SidebarContent className="px-2 pb-2 group-data-[collapsible=icon]:overflow-y-auto group-data-[collapsible=icon]:px-0">
					<div className="flex flex-col gap-2 group-data-[collapsible=icon]:gap-2">
						{filteredGroups.map((group) => (
							<div
								key={group.title}
								title={state === "collapsed" ? group.title : undefined}
							>
								<SidebarGroup
									className={cn(
										"rounded-xl border border-sidebar-border/70 bg-linear-to-br p-2 shadow-sm transition-colors duration-200 hover:border-sidebar-border",
										GROUP_TONE_BY_TITLE[group.title] ??
											"from-sidebar-accent/55 via-sidebar-accent/30 to-transparent",
										"group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-1.5 group-data-[collapsible=icon]:shadow-none",
									)}
								>
									<SidebarGroupLabel className="h-auto px-2 py-1 text-[0.67rem] font-semibold uppercase tracking-widest text-sidebar-foreground/70">
										{group.title}
									</SidebarGroupLabel>
									<NavMain items={group.items} label={group.title} />
								</SidebarGroup>
							</div>
						))}
					</div>
				</SidebarContent>

				<motion.div
					initial={shouldAnimate ? SIDEBAR_FOOTER_INITIAL : SIDEBAR_FOOTER_POSITION}
					animate={SIDEBAR_FOOTER_POSITION}
					transition={shouldAnimate ? SIDEBAR_FOOTER_TRANSITION : SIDEBAR_NO_MOTION_TRANSITION}
				>
					<SidebarSeparator className="mx-0.5 mt-1" />
					<SidebarFooter className="flex flex-col gap-2 p-3 pt-2 group-data-[collapsible=icon]:p-1">
						{user?.role === "admin" && (
							<Link
								href="/admin"
								className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2"
							>
								<Shield className="h-4 w-4" />
								<span className="group-data-[collapsible=icon]:hidden">
									Panel de Control
								</span>
							</Link>
						)}
						<NavUser />
					</SidebarFooter>
				</motion.div>
				<SidebarRail className="after:opacity-70" />
			</motion.div>
		</Sidebar>
	);
}
