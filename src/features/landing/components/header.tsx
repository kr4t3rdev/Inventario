"use client";

import React from "react";
import { motion } from "framer-motion";
import { DollarSign } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
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

				<nav className="hidden items-center gap-5 md:flex">
					{NAV_ITEMS.map((item) => (
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
				</nav>

				<div className="flex items-center gap-2">
					<ThemeToggle />
					<Link href="/login">
						<Button variant="outline" size="sm" className="cursor-pointer">
							Login
						</Button>
					</Link>
					<Link href="/register">
						<Button size="sm" className="cursor-pointer">
							Register
						</Button>
					</Link>
				</div>
			</div>
		</header>
	);
}
