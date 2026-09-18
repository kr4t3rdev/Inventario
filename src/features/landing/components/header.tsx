"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, Menu, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV_ITEMS } from "@/features/landing/data";

/**
 * @description Header principal del landing con navegación, theme toggle y botones de acceso.
 * @param {{ reduceMotion?: boolean }} props
 * @returns {JSX.Element} Header sticky con navegación
 */
export function LandingHeader({
	reduceMotion,
}: {
	reduceMotion?: boolean;
}): React.JSX.Element {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isMoreOpen, setIsMoreOpen] = useState(false);
	const menuTriggerRef = useRef<HTMLButtonElement>(null);
	const moreTriggerRef = useRef<HTMLButtonElement>(null);
	const primaryItems = NAV_ITEMS.slice(0, 4);
	const secondaryItems = NAV_ITEMS.slice(4);

	useEffect(() => {
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && isMenuOpen) {
				setIsMenuOpen(false);
				menuTriggerRef.current?.focus();
			}
		};
		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [isMenuOpen]);

	const closeMenu = () => setIsMenuOpen(false);

	return (
		<header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
			<div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6">
				<Link
					href="/"
					className="group flex items-center gap-2 text-lg font-bold"
				>
					<motion.span
						className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10"
						animate={reduceMotion ? undefined : { rotate: [0, 10, -10, 0] }}
						transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
					>
						<DollarSign className="h-4 w-4 text-primary" />
					</motion.span>
					<span className="font-mono tracking-tight">
						Fina<span className="text-primary">nce</span>MDM
					</span>
				</Link>

				<nav aria-label="Navegación principal" className="hidden items-center gap-5 md:flex">
					{primaryItems.map((item) => (
						<motion.div
							key={item.href}
							whileHover={{ y: -2, transition: { duration: 0.2 } }}
						>
							<Link
								href={item.href}
								className="text-sm text-muted-foreground transition-colors hover:text-foreground"
							>
								{item.label}
							</Link>
						</motion.div>
					))}
					<DropdownMenu open={isMoreOpen} onOpenChange={setIsMoreOpen}>
						<DropdownMenuTrigger asChild>
							<button ref={moreTriggerRef} type="button" className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Más opciones">
								Más
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" onCloseAutoFocus={(event) => { event.preventDefault(); moreTriggerRef.current?.focus(); }}>
							{secondaryItems.map((item) => (
								<DropdownMenuItem key={item.href} asChild>
									<Link href={item.href}>{item.label}</Link>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</nav>

				<div className="flex items-center gap-2">
					<ThemeToggle />
					<div className="hidden items-center gap-2 md:flex">
						<Button asChild variant="outline" size="sm"><Link href="/login">Iniciar sesión</Link></Button>
						<Button asChild size="sm"><Link href="/register">Registrarse</Link></Button>
					</div>
					<Button
						ref={menuTriggerRef}
						variant="outline"
						size="icon"
						className="md:hidden"
						aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
						aria-expanded={isMenuOpen}
						aria-controls="landing-mobile-menu"
						onClick={() => setIsMenuOpen((open) => !open)}
					>
						{isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
					</Button>
				</div>
			</div>
			{isMenuOpen && (
				<nav id="landing-mobile-menu" aria-label="Navegación móvil" className="border-t border-border/50 px-4 py-4 md:hidden">
					<div className="mx-auto flex max-w-7xl flex-col gap-1">
						{NAV_ITEMS.map((item) => (
							<Link key={item.href} href={item.href} onClick={closeMenu} className="rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
								{item.label}
							</Link>
						))}
						<div className="mt-2 flex gap-2 border-t border-border/50 pt-3">
							<Button asChild variant="outline" className="flex-1"><Link href="/login" onClick={closeMenu}>Iniciar sesión</Link></Button>
							<Button asChild className="flex-1"><Link href="/register" onClick={closeMenu}>Registrarse</Link></Button>
						</div>
					</div>
				</nav>
			)}
		</header>
	);
}
